// Una regolazione confermata vale dall'atto dopo: l'atto in corso non si spezza.
import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { attiRecenti, campioneMotore } from '../device/screens/scenario/ventilatore/motore';

function partito() {
  let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
  ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
  return applica(ist, { tipo: 'modalita', modalita: 'VC' as never }, 0).istantanea;
}

describe('la frequenza nuova parte dall\'atto dopo', () => {
  it('in VC 12 → 14 a metà espirio: la griglia nuova comincia sul prossimo atto della vecchia', () => {
    const prima = partito();
    const tSec = 101.7; // gli atti a 12/min cadono ogni 5 s: 100, 105, ...
    const dopo = applica(prima, { tipo: 'parametro', chiave: 'frequency', valore: 14 }, tSec).istantanea;
    const o = dopo.origineMacchina!;
    const vecchi = attiRecenti(tSec + 15, statoDa(prima), 15).map((a) => a.inizio);
    expect(o).toBeCloseTo(vecchi.find((t) => t > tSec)!, 3);
    // con le impostazioni nuove c'è un atto che comincia proprio lì, e poi ogni 60/14 s
    const nuovi = attiRecenti(o + 12, statoDa(dopo), 12.01).map((a) => a.inizio);
    expect(nuovi[0]).toBeCloseTo(o, 2);
    expect(nuovi[1] - nuovi[0]).toBeCloseTo(60 / 14, 2);
    // e sul fronte le due curve si incontrano: la vecchia finisce l'espirio
    // alla PEEP, la nuova comincia lì l'insufflazione col volume da zero.
    const vecchio = campioneMotore(o - 0.01, statoDa(prima));
    const nuovo = campioneMotore(o + 0.02, statoDa(dopo));
    expect(Math.abs(vecchio.paw - 5)).toBeLessThan(0.5);
    expect(vecchio.flusso).toBeLessThanOrEqual(0);
    expect(nuovo.flusso).toBeGreaterThan(10);
    expect(nuovo.volume).toBeLessThan(25);
  });

  it('una seconda regolazione prima che la prima parta non sposta l\'origine', () => {
    const prima = partito();
    const a = applica(prima, { tipo: 'parametro', chiave: 'frequency', valore: 14 }, 101.7).istantanea;
    const b = applica(a, { tipo: 'parametro', chiave: 'volume', valore: 450 }, 102.5).istantanea;
    expect(b.origineMacchina).toBe(a.origineMacchina);
  });

  it('a macchina ferma non c\'è un atto da aspettare: la griglia resta quella di sempre', () => {
    const ferma = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
    const dopo = applica(ferma, { tipo: 'parametro', chiave: 'frequency', valore: 14 }, 50).istantanea;
    expect(dopo.origineMacchina ?? 0).toBe(0);
  });
});

describe('seguiRegolazione: chi disegna tiene lo stato di prima fino all\'atto dopo', () => {
  it('fino all\'origine lo stato vecchio, poi il nuovo; una seconda regolazione tiene il primo', async () => {
    const { seguiRegolazione, statoAllIstante } = await import('../device/screens/scenario/ventilatore/onde');
    const ist0 = partito();
    const ist1 = applica(ist0, { tipo: 'parametro', chiave: 'frequency', valore: 14 }, 101.7).istantanea;
    const ist2 = applica(ist1, { tipo: 'parametro', chiave: 'volume', valore: 450 }, 102.5).istantanea;
    const [s0, s1, s2] = [ist0, ist1, ist2].map(statoDa);
    const t1 = seguiRegolazione(s0, s1, null, 101.8)!;
    expect(t1.vecchio).toBe(s0);
    expect(statoAllIstante(104, s1, t1)).toBe(s0);
    expect(statoAllIstante(t1.fino + 0.01, s1, t1)).toBe(s1);
    const t2 = seguiRegolazione(s1, s2, t1, 102.6);
    expect(t2?.vecchio).toBe(s0);
    // passata l'origine, nessuna transizione
    expect(seguiRegolazione(s2, s2, t2, t1.fino + 1)).toBeNull();
  });
});

describe('i loop: ogni atto con lo stato e sulla griglia di quando è stato dato', () => {
  // Come nell'app: uno stato nuovo a ogni battito (2 s) e a ogni regolazione, la transizione rifatta da
  // Ventilatore.tsx, e Loop.tsx che a ogni fotogramma ricorda lo stato e taglia gli atti.
  type Cambi = Record<string, number | string>
  const applicaCambi = (ist: ReturnType<typeof partito>, imp: Cambi, t: number) => {
    for (const [chiave, valore] of Object.entries(imp))
      if (chiave === 'drive') ist = { ...ist, drive: { ...ist.drive, frequenza: valore as number, intensita: 0.6 } };
      else if (chiave === 'sfasamentoSpontaneo') ist = { ...ist, sfasamentoSpontaneo: valore as number };
      else ist = applica(ist, chiave === 'modalita' ? { tipo: 'modalita', modalita: valore as never } : { tipo: 'parametro', chiave: chiave as never, valore: valore as number }, t).istantanea;
    return ist;
  };
  async function prova(cambi: [number, Cambi][], iniziali: Cambi = {}, da = 90, a = 140) {
    const { seguiRegolazione, statoAllIstante } = await import('../device/screens/scenario/ventilatore/onde');
    const { ricordaStato, statoDallaStoria, iniziAtti } = await import('../device/screens/scenario/ventilatore/Loop');
    let ist = applicaCambi(partito(), iniziali, 0);
    let stato = statoDa(ist);
    let tr: ReturnType<typeof seguiRegolazione> = null;
    // la verità: lo stato con cui la macchina dà gli atti da ogni origine in poi
    const veri: { o: number; s: ReturnType<typeof statoDa> }[] = [{ o: -Infinity, s: stato }];
    const vero = (t: number) => veri.filter((x) => x.o <= t).pop()!.s;
    const attiVeri = (fino: number) =>
      veri.flatMap((x, i) => {
        const dopo = veri[i + 1]?.o ?? Infinity;
        // un blocco ogni 20 s, coi due blocchi di ogni chiamata: anche gli atti lunghi; e l'origine, dove lo stato cambia
        const out: number[] = [x.o, x.s.origineMacchina ?? 0].filter(Number.isFinite);
        for (let t = Math.floor(Math.max(0, x.o) / 20) * 20 + 19.999; t < Math.min(dopo, fino) + 40; t += 20) out.push(...attiRecenti(t, x.s, Infinity).map((at) => at.inizio));
        return out.filter((t) => t >= x.o - 1e-3 && t < dopo - 1e-3);
      });
    const nuovoStato = (adesso: number) => {
      const nuovo = statoDa(ist);
      tr = seguiRegolazione(stato, nuovo, tr, adesso);
      stato = nuovo;
    };
    let storia: Parameters<typeof ricordaStato>[0] = [];
    let prossimoBattito = 2 * Math.ceil(da / 2);
    const resti = [...cambi];
    let controllati = 0;
    for (let ora = da; ora < a; ora += 0.05) {
      while (resti.length && resti[0][0] <= ora) {
        const [t, imp] = resti.shift()!;
        ist = applicaCambi(ist, imp, t);
        nuovoStato(t);
        veri.push({ o: ist.origineMacchina!, s: statoDa(ist) });
      }
      if (ora >= prossimoBattito) { nuovoStato(ora); prossimoBattito += 2; }
      const s = stato, t0 = tr;
      const adesso = (t: number) => statoAllIstante(t, s, t0);
      storia = ricordaStato(storia, adesso(ora), ora);
      const st = storia;
      const al = (t: number) => statoDallaStoria(st, adesso, t);
      if (ora < da + 16) continue; // la storia si fa da quando il loop è sullo schermo
      const inizi = iniziAtti(al, ora, 3);
      const atti = attiVeri(ora + 20); // attiRecenti dà solo gli atti finiti: anche quello in corso
      for (const t of inizi) {
        const vicino = Math.min(...atti.map((v) => Math.abs(v - t)));
        expect(vicino, `ora ${ora.toFixed(2)}, inizio ${t.toFixed(3)}`).toBeLessThan(0.01);
      }
      expect(inizi[0]).toBeLessThanOrEqual(ora);
      // atti interi: mai uno scarto di pochi millisecondi fra due griglie al posto di un atto
      for (let k = 0; k < 3; k++) expect(inizi[k] - inizi[k + 1], `atto ${k} a ${ora.toFixed(2)}`).toBeGreaterThan(0.5);
      // e ogni punto dei tre atti si campiona con lo stato con cui la macchina l'ha dato
      for (let t = inizi[3]; t <= ora; t += 0.2) {
        expect(al(t).impostazioni, `campione a ${t.toFixed(2)} (ora ${ora.toFixed(2)})`).toEqual(vero(t).impostazioni);
        expect(al(t).origineMacchina ?? 0).toBe(vero(t).origineMacchina ?? 0);
      }
      controllati++;
    }
    expect(controllati).toBeGreaterThan(500);
  }

  it('12 → 14', () => prova([[111.7, { frequency: 14 }]]));
  it('12 → 8', () => prova([[111.7, { frequency: 8 }]]));
  it('12 → 14 e, un atto dopo, → 20', () => prova([[111.7, { frequency: 14 }], [119.2, { frequency: 20 }]]));
  it('due regolazioni prima che parta la prima', () => prova([[111.7, { frequency: 14 }], [112.5, { volume: 450 }]]));
  it('solo il volume', () => prova([[111.7, { volume: 450 }]]));
  // a 14/min l'atto non cade sul passo del motore: l'origine è qualche millisecondo dopo la griglia
  it('a 14/min, solo il volume', () => prova([[111.7, { volume: 450 }]], { frequency: 14 }));
  it('a 14/min, → 20 → 9', () => prova([[111.7, { frequency: 20 }], [118.3, { frequency: 9 }]], { frequency: 14 }));
  it('da VC a PC', () => prova([[111.7, { modalita: 'PC' }]]));
  it('da VC a PS: gli atti del paziente', () => prova([[111.7, { modalita: 'PS' }]]));
  // in PS gli atti li apre il paziente quando vuole: nessuna griglia della macchina li taglia
  // dal controllato allo spontaneo il motore nuovo si rifà un passato: prima dell'origine valgono gli atti di prima
  it('da VC a PS col paziente a 18', () => prova([[111.7, { modalita: 'PS' }]], { drive: 18 }));
  it('da VC a CPAP col paziente a 12', () => prova([[111.7, { modalita: 'CPAP' }]], { drive: 12 }));
  // atti lenti, più lunghi di un blocco
  it('PS col paziente a 3/min', () => prova([[111.7, { psLevel: 12 }]], { modalita: 'PS', drive: 3 }, 60, 170));
  it('PS col paziente a 2/min', () => prova([[111.7, { psLevel: 12 }]], { modalita: 'PS', drive: 2 }, 60, 170));
  it('PS col paziente a 18, sfasato', () => prova([[111.7, { psLevel: 12 }]], { modalita: 'PS', drive: 18, sfasamentoSpontaneo: 3 }));
});
