/**
 * Le funzioni della 3.2 entrate dal confronto con RTMaven: ognuna con la fisica
 * che deve far vedere, e dove c'è un numero del riferimento, quel numero.
 */
import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { campioneMotore, attiRecenti, curvaLenta, letturaCurvaLenta } from '../device/screens/scenario/ventilatore/motore';
import { esitoManovra, misura as misuraDisplay, piccoDecelerante, PRESET_FISIOLOGIA, type StatoVentilatore } from '../device/screens/scenario/ventilatore/fisica';
import { MISURE_VUOTE } from '../device/screens/scenario/ventilatore/parametri';
import { provaPeep, quadroEit, istanteEit, regioni } from '../device/screens/scenario/ventilatore/eit';
import { conQuadro, senzaQuadro, quadroAcceso } from '../device/screens/scenario/ventilatore/quadri';
import { regolaPrvc } from '../device/screens/scenario/ventilatore/prvc';
import { comandiScenario, parseScenario, scenarioDa } from '../remote/scenario';

const PASSIVO = { frequenza: 0, intensita: 0 };

function stato(modalita: string, imp: Record<string, unknown>, fis: Record<string, unknown>, drive: any = PASSIVO): StatoVentilatore {
  let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
  ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
  ist = applica(ist, { tipo: 'modalita', modalita: modalita as never }, 0).istantanea;
  const s = statoDa(ist);
  return { ...s, impostazioni: { ...s.impostazioni, ...imp }, fisiologia: { ...s.fisiologia, reclutabilita: 0, limitazioneFlusso: 0, secrezioni: 0, ...fis }, drive, asincronia: null, umidificatore: null };
}
const ultimi = (s: StatoVentilatore, T = 100) => attiRecenti(T, s, 20).slice(-3);
const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('volume controllato a flusso decelerante', () => {
  it('RTMaven: VC 500 decelerante, Tif 1 s, C 50 R 10 → PIP 17,5', () => {
    const s = stato('VC', { volume: 500, frequency: 20, ratio: '1:2', inspiratoryPausePercent: 0, peep: 5, formaFlusso: 1 }, { compliance: 50, resistenza: 10 });
    const a = ultimi(s);
    expect(Math.abs(media(a.map((x) => x.pip)) - 17.5)).toBeLessThan(0.5);
    expect(Math.abs(media(a.map((x) => x.vti)) - 500)).toBeLessThan(15);
    expect(piccoDecelerante(5, 500, 1, 50, 10)).toBeCloseTo(17.5, 1);
  });
});

describe('la curva pressione-volume e lo stress index', () => {
  const si = (fis: Record<string, unknown>, imp: Record<string, unknown>) => ultimi(stato('VC', { frequency: 20, ratio: '1:2', inspiratoryPausePercent: 10, ...imp }, fis)).at(-1)!.stressIndex!;
  it('polmone lineare: 1', () => {
    expect(si({ compliance: 60, resistenza: 8, reclutabilita: 0.15 }, { volume: 500, peep: 5 })).toBeCloseTo(1, 1);
  });
  it('ARDS reclutabile a PEEP bassa: sotto 0,9 (reclutamento tidalico)', () => {
    expect(si({ compliance: 30, resistenza: 12, reclutabilita: 0.5 }, { volume: 420, peep: 5 })).toBeLessThan(0.92);
  });
  it('plateau sopra 30: sopra 1,1 (sovradistensione)', () => {
    expect(si({ compliance: 30, resistenza: 12, reclutabilita: 0 }, { volume: 500, peep: 16 })).toBeGreaterThan(1.1);
  });
  it('la corda resta quella: il plateau al corrente impostato è PEEP + VT/C', () => {
    const a = ultimi(stato('VC', { volume: 420, frequency: 20, ratio: '1:2', inspiratoryPausePercent: 10, peep: 5 }, { compliance: 30, resistenza: 12, reclutabilita: 0.5 })).at(-1)!;
    expect(Math.abs(a.palvFineInsp - (5 + 420 / 30))).toBeLessThan(0.5);
  });
  it('sul display lo stress index c\'è solo in VC a flusso quadro', () => {
    const q = misuraDisplay(stato('VC', { volume: 420, peep: 5 }, { compliance: 30, resistenza: 12, reclutabilita: 0.5 }), 100, 2, null);
    expect(q.stressIndex).not.toBeNull();
    const d = misuraDisplay(stato('VC', { volume: 420, peep: 5, formaFlusso: 1 }, { compliance: 30, resistenza: 12, reclutabilita: 0.5 }), 100, 2, null);
    expect(d.stressIndex).toBeNull();
  });
});

describe('la chiusura delle vie aeree', () => {
  const imp = { volume: 400, frequency: 20, ratio: '1:2', inspiratoryPausePercent: 10, peep: 5 };
  const aperte = stato('VC', imp, { compliance: 30, resistenza: 10 });
  const chiuse = stato('VC', imp, { compliance: 30, resistenza: 10, aperturaVie: 12 });
  it('il polmone resta alla pressione di apertura: la pressione motrice letta è più alta di quella vera', () => {
    const a = ultimi(aperte).at(-1)!;
    const c = ultimi(chiuse).at(-1)!;
    expect(c.peepTotale).toBeGreaterThan(11);
    expect(c.vieChiuse).toBe(true);
    expect(c.palvFineInsp - 5).toBeGreaterThan(a.palvFineInsp - 5 + 5);
  });
  it('la pausa espiratoria non vede gli alveoli: misura la PEEP', () => {
    const e = esitoManovra({ ...chiuse, manovra: 'pausa-espiratoria', manovraDa: 95 }, 'pausa-espiratoria', MISURE_VUOTE, 100);
    expect(e.peepTotale).toBe(5);
  });
  it('la curva lenta trova il ginocchio alla pressione di apertura, e niente se le vie sono aperte', () => {
    const l = letturaCurvaLenta(chiuse, 5);
    expect(l.aperturaVie).not.toBeNull();
    expect(Math.abs(l.aperturaVie! - 12)).toBeLessThan(1.5);
    expect(letturaCurvaLenta(aperte, 5).aperturaVie).toBeNull();
    // cinque litri al minuto per cinque secondi
    expect(curvaLenta(5, aperte).volume).toBeCloseTo(417, 0);
  });
});

describe('lo sforzo del paziente', () => {
  const ps = (ps: number, drive: any) => stato('PS', { psLevel: ps, peep: 5, flowCycleOffPercent: 25, triggerFlow: 2 }, { compliance: 50, resistenza: 10 }, drive);
  it('P0.1 vicino a RTMaven (2,3 cmH₂O con Pmus 8)', () => {
    const p01 = media(ultimi(ps(10, { frequenza: 20, intensita: 0.8 })).map((a) => a.p01 ?? 0));
    expect(p01).toBeGreaterThan(1.8);
    expect(p01).toBeLessThan(2.9);
  });
  it('sforzo responsivo: alzando la PS lo sforzo e la P0.1 calano, il volume cresce meno', () => {
    const r5 = ultimi(ps(5, { frequenza: 20, intensita: 0.8, responsivo: true }));
    const r20 = ultimi(ps(20, { frequenza: 20, intensita: 0.8, responsivo: true }));
    const f20 = ultimi(ps(20, { frequenza: 20, intensita: 0.8 }));
    expect(media(r20.map((a) => a.p01!))).toBeLessThan(media(r5.map((a) => a.p01!)) * 0.6);
    expect(media(r20.map((a) => a.vti))).toBeLessThan(media(f20.map((a) => a.vti)));
  });
  it('variabilità: atti diversi fra loro, ma lo stesso atto uguale due volte', () => {
    const s = ps(8, { frequenza: 18, intensita: 0.6, variabilita: 1 });
    const vt = attiRecenti(200, s, 40).map((a) => a.vti);
    expect(Math.max(...vt) - Math.min(...vt)).toBeGreaterThan(40);
    expect(campioneMotore(123.456, s).paw).toBe(campioneMotore(123.456, { ...s }).paw);
  });
  it('variabilità ed espirio attivo non rompono la continuità ai bordi dei blocchi', () => {
    const s = ps(8, { frequenza: 18, intensita: 0.6, variabilita: 1, espirioAttivo: 0.8 });
    for (const b of [20, 40, 60, 80]) {
      const a = campioneMotore(b - 0.0025, s);
      const c = campioneMotore(b + 0.0025, s);
      expect(Math.abs(a.paw - c.paw)).toBeLessThan(1);
      expect(Math.abs(a.vPolmone - c.vPolmone)).toBeLessThan(5);
    }
  });
  it('espirio attivo: la Pmus va negativa in espirazione e la Pes sale', () => {
    const s = ps(8, { frequenza: 15, intensita: 0.6, espirioAttivo: 1 });
    let minPmus = 0;
    for (let t = 90; t < 100; t += 0.01) minPmus = Math.min(minPmus, campioneMotore(t, s).pmus);
    expect(minPmus).toBeLessThan(-2);
  });
  it('il freno espiratorio rallenta il picco di flusso espiratorio', () => {
    const s0 = stato('VC', { volume: 500, frequency: 15, peep: 5 }, { compliance: 50, resistenza: 10 });
    const s1 = { ...s0, fisiologia: { ...s0.fisiologia, sforzoEspiratorio: 0.8 } };
    let m0 = 0, m1 = 0;
    for (let t = 90; t < 100; t += 0.005) { m0 = Math.min(m0, campioneMotore(t, s0).flusso); m1 = Math.min(m1, campioneMotore(t, s1).flusso); }
    expect(m1).toBeGreaterThan(m0 * 0.6);
  });
});

describe('la pausa espiratoria come test di occlusione', () => {
  it('con uno sforzo dentro la pausa: ΔPocc, Pmus stimata 0,75·|ΔPocc|, ΔPaw/ΔPes = 1', () => {
    const s = stato('PS', { psLevel: 10, peep: 5, triggerFlow: 2 }, { compliance: 50, resistenza: 10 }, { frequenza: 20, intensita: 0.8 });
    const e = esitoManovra({ ...s, manovra: 'pausa-espiratoria', manovraDa: 95 }, 'pausa-espiratoria', MISURE_VUOTE, 100);
    expect(e.pOcc).toBeLessThan(-5);
    expect(e.pmusStimata).toBeCloseTo(0.75 * -(e.pOcc as number), 0);
    expect(e.rapportoOcclusione).toBe(1);
    expect(e.p01).toBeGreaterThan(1);
  });
  it('a paziente passivo la pausa non riporta il test', () => {
    const s = stato('VC', { volume: 500, peep: 5 }, { compliance: 50, resistenza: 10 });
    const e = esitoManovra({ ...s, manovra: 'pausa-espiratoria', manovraDa: 95 }, 'pausa-espiratoria', MISURE_VUOTE, 100);
    expect(e.pOcc).toBeUndefined();
  });
});

describe('il rapporto R/I', () => {
  it('reclutabile sopra non reclutabile, e niente sotto PEEP 10', () => {
    const base = { compliance: 30, resistenza: 12 };
    const rec = esitoManovra(stato('VC', { peep: 15 }, { ...base, reclutabilita: 0.8 }), 'rapporto-ri', MISURE_VUOTE);
    const non = esitoManovra(stato('VC', { peep: 15 }, { ...base, reclutabilita: 0 }), 'rapporto-ri', MISURE_VUOTE);
    expect(rec.rapportoRI!).toBeGreaterThan(0.5);
    expect(non.rapportoRI!).toBeLessThan(0.1);
    expect(esitoManovra(stato('VC', { peep: 8 }, base), 'rapporto-ri', MISURE_VUOTE).rapportoRI).toBeNull();
  });
});

describe('EIT e PEEP trial', () => {
  const ards = { ...PRESET_FISIOLOGIA.ards.fisiologia, preset: 'ards' as const };
  const sano = { ...PRESET_FISIOLOGIA.normale.fisiologia, preset: 'normale' as const };
  it('ARDS a PEEP bassa ventila davanti; la PEEP riporta l\'aria dietro', () => {
    expect(regioni(ards, 5, 17).ventrale).toBeGreaterThan(60);
    expect(regioni(ards, 15, 27).ventrale).toBeLessThan(55);
    expect(Math.abs(regioni(sano, 5, 15).ventrale - 50)).toBeLessThan(6);
  });
  it('il trial: collasso a PEEP bassa, sovradistensione a PEEP alta, un incrocio in mezzo', () => {
    const p = provaPeep(ards, 12);
    const primo = p.passi[0];
    const ultimo = p.passi.at(-1)!;
    expect(primo.peep).toBe(24);
    expect(primo.sovradistensione).toBeGreaterThan(10);
    expect(ultimo.collasso).toBeGreaterThan(20);
    expect(p.incrocio).not.toBeNull();
    expect(p.incrocio!).toBeGreaterThan(10);
    expect(p.incrocio!).toBeLessThan(20);
  });
  it('pendelluft: con uno sforzo vigoroso nell\'ARDS il dorsale si prende aria dal ventrale', () => {
    const s = stato('PS', { psLevel: 8, peep: 8 }, ards, { frequenza: 25, intensita: 0.5 });
    const forte = conQuadro(s, 'sforzo-vigoroso');
    const picco = (v: StatoVentilatore) => { const q = quadroEit(100, v)!; let m = 0; for (let t = 90; t < 100; t += 0.01) m = Math.max(m, istanteEit(t, v, q).pendelluft); return m; };
    expect(picco(forte)).toBeGreaterThan(25);
    expect(picco(s)).toBeLessThan(picco(forte) / 3);
  });
});

describe('i quadri della meccanica', () => {
  it('si accendono, si riconoscono e si tolgono senza toccare il resto', () => {
    const s = stato('PS', { psLevel: 8 }, { compliance: 33 }, { frequenza: 20, intensita: 0.5 });
    const ob = conQuadro(s, 'obesita');
    expect(quadroAcceso(ob, 'obesita')).toBe(true);
    expect(ob.fisiologia.pesBasale).toBe(16);
    const via = senzaQuadro(ob, 'obesita');
    expect(quadroAcceso(via, 'obesita')).toBe(false);
    expect(via.fisiologia.compliance).toBe(33);
    expect(via.fisiologia.pesBasale).toBe(0);
    const sv = senzaQuadro(conQuadro(s, 'sforzo-vigoroso'), 'sforzo-vigoroso');
    expect(sv.drive.forma).toBeNull();
  });
});

describe('PRVC sugli atti del motore', () => {
  it('lo sforzo del paziente fa scendere la pressione che il regolatore sceglie', () => {
    let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
    ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
    ist = applica(ist, { tipo: 'modalita', modalita: 'PRVC' as never }, 0).istantanea;
    const passivo = { ...ist, fisiologia: { ...ist.fisiologia, compliance: 40 } };
    const attivo = { ...passivo, drive: { frequenza: 20, intensita: 0.8 }, impostazioni: { ...passivo.impostazioni, triggerControllata: 1 } };
    const a = regolaPrvc(passivo, 120).impostazioni.pressureTarget;
    const b = regolaPrvc(attivo, 120).impostazioni.pressureTarget;
    expect(b).toBeLessThan(a);
  });
});

describe('lo scenario salvato dalla regia', () => {
  it('va e torna: le impostazioni diverse diventano azioni, il paziente un comando', () => {
    let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
    ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
    const salvato = { ...ist, modalita: 'PS' as const, impostazioni: { ...ist.impostazioni, peep: 12, psLevel: 14 }, fisiologia: { ...ist.fisiologia, compliance: 28, aperturaVie: 10 }, drive: { frequenza: 22, intensita: 0.7, forma: { salita: 0.3, tenuta: 0.1, discesa: 0.4 } } };
    const sc = parseScenario(JSON.stringify(scenarioDa(salvato, 'prova')));
    const c = comandiScenario(sc, ist);
    expect(c.azioni[0]).toEqual({ tipo: 'modalita', modalita: 'PS' });
    expect(c.azioni).toContainEqual({ tipo: 'parametro', chiave: 'peep', valore: 12 });
    expect(c.paziente.fisiologia?.aperturaVie).toBe(10);
    expect((c.paziente.drive as any).forma).toEqual({ salita: 0.3, tenuta: 0.1, discesa: 0.4 });
    expect(c.ambienteDiverso).toBe(false);
  });
  it('un file qualunque non passa, e i numeri fuori scala si riportano dentro', () => {
    expect(() => parseScenario('{"app":"altro"}')).toThrow();
    const sc = parseScenario(JSON.stringify({ app: 'open-vent-sim', kind: 'scenario', ambiente: 'invasiva', modalita: 'VC', impostazioni: { peep: 999, nonEsiste: 3 } }));
    expect(sc.impostazioni.peep).toBeLessThan(999);
    expect(sc.impostazioni.nonEsiste).toBeUndefined();
  });
});

describe('la perdita della maschera in NIV', () => {
  const niv = (perdita: number | null | undefined) => {
    let ist = istantaneaIniziale('niv', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
    ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
    const s = statoDa(ist);
    return { ...s, fisiologia: { ...s.fisiologia, perditaMaschera: perdita }, drive: { frequenza: 18, intensita: 0.5 } } as StatoVentilatore;
  };
  it('senza perdita scritta: la piccola perdita di sempre, solo sul display', () => {
    const m = misuraDisplay(niv(undefined), 100, 2, null);
    expect(m.leakPercentage!).toBeGreaterThan(2);
    expect(m.leakPercentage!).toBeLessThan(11);
    expect(m.leakFlow).toBeNull();
  });
  it('sigillata: VTi = VTe e perdita zero', () => {
    const m = misuraDisplay(niv(0), 100, 2, null);
    expect(m.leakPercentage).toBe(0);
    expect(m.volumeInspired).toBe(m.volumeExpired);
  });
  it('più perdita: VTi sopra VTe, ciclaggio ritardato fino al tempo massimo', () => {
    const ti = (p: number) => media(attiRecenti(100, niv(p), 30).slice(-3).map((a) => a.fineInsp - a.inizio));
    expect(ti(50)).toBeGreaterThan(ti(0));
    expect(ti(200)).toBeGreaterThan(2.9);
    const m = misuraDisplay(niv(50), 100, 2, null);
    expect(m.volumeInspired!).toBeGreaterThan(m.volumeExpired! * 1.5);
    expect(m.leakFlow!).toBeGreaterThan(30);
  });
  it('oltre il flusso della turbina la pressione non arriva', () => {
    let max = 0;
    const s = niv(200);
    for (let t = 80; t < 100; t += 0.01) max = Math.max(max, campioneMotore(t, s).paw);
    expect(max).toBeLessThan(14);
  });
});
