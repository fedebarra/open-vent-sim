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

describe('i loop tagliano gli atti sulla griglia della macchina', () => {
  // La stessa griglia di `Loop.tsx`: dopo una regolazione parte da `origineMacchina`.
  const inizioAtto = (ora: number, Ttot: number, o: number) => o + Math.floor((ora - o) / Ttot) * Ttot;

  it('dopo 12 → 14 l\'atto del loop comincia dove comincia quello della macchina', () => {
    const prima = partito();
    const dopo = applica(prima, { tipo: 'parametro', chiave: 'frequency', valore: 14 }, 101.7).istantanea;
    const s = statoDa(dopo);
    const o = dopo.origineMacchina!;
    const Ttot = 60 / 14;
    const ora = o + 3.5 * Ttot;
    // attiRecenti dà gli atti finiti: quello in corso si legge a fine atto
    const vero = attiRecenti(ora + Ttot, s, 20).map((a) => a.inizio).filter((t) => t <= ora).pop()!;
    expect(inizioAtto(ora, Ttot, o)).toBeCloseTo(vero, 2);
    // contando da t = 0, come prima, l'atto si spezzava a metà
    expect(Math.abs(Math.floor(ora / Ttot) * Ttot - vero)).toBeGreaterThan(0.1);
  });
});
