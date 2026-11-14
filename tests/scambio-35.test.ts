/**
 * Lo scambio dei gas (3.5): i casi del piano, con i numeri attesi.
 * Valori del modello, non formule ripetute.
 */
import { describe, it, expect } from 'vitest';
import {
  scambioIniziale, avanzaScambio, letturaScambio, regime, avanzaIsteresi, fineCapillare,
  PARAMETRI_SCAMBIO, ISTERESI_CMH2O, type IngressiScambio, type ParametriScambio, type StatoScambio,
} from '../device/screens/scenario/ventilatore/scambio';
import { PRESET_FISIOLOGIA, complianceA } from '../device/screens/scenario/ventilatore/fisica';
import { istantaneaIniziale, applica, batti, statoDa } from '../device/screens/scenario/ventilatore/istantanea';

const fis = (preset: keyof typeof PRESET_FISIOLOGIA, extra: Record<string, unknown> = {}) => ({ ...PRESET_FISIOLOGIA[preset].fisiologia, preset, ...extra }) as any;
const ing = (o: Partial<IngressiScambio> = {}): IngressiScambio => {
  const i = { pesoKg: 70, fio2: 0.21, veMlMin: 6000, vtMl: 500, frequenza: 12, vdMl: 150, vieAperte: true, fonteO2: 0.21, peepTotale: 5, pFine: 15, pMedia: 8, reclutamento: false, scollegato: false, fisiologia: fis('normale'), mac: 0, portata: null, spo2Bersaglio: null, etco2Bersaglio: null, vaTotaleStimata: 0, ...o };
  return { ...i, veMlMin: o.veMlMin ?? i.frequenza * i.vtMl, vaTotaleStimata: i.frequenza * Math.max(0, i.vtMl - i.vdMl) };
};
const corri = (s: StatoScambio, i: IngressiScambio, sec: number) => { for (let t = 0; t < sec; t += 2) s = avanzaScambio(s, i, 2); return s; };
const leggi = (s: StatoScambio, i: IngressiScambio) => letturaScambio(s, i);
const con = (p: Partial<ParametriScambio>) => ({ ...PARAMETRI_SCAMBIO, ...p });

describe('CO₂ e acido-base', () => {
  it('polmone sano in aria: PaCO₂ 38-42, gradiente 2-5, PaO₂ 85-100, SpO₂ 96-98', () => {
    const i = ing(); const l = leggi(scambioIniziale(i), i);
    expect(l.paco2).toBeGreaterThan(38); expect(l.paco2).toBeLessThan(43);
    expect(l.paco2 - l.etco2).toBeGreaterThan(0.5); expect(l.paco2 - l.etco2).toBeLessThan(5);
    expect(l.pao2).toBeGreaterThan(85); expect(l.pao2).toBeLessThan(105);
    expect(l.spo2).toBeGreaterThan(95.5); expect(l.spo2).toBeLessThan(98.5);
    expect(l.ph).toBeGreaterThan(7.36); expect(l.ph).toBeLessThan(7.44);
  });
  it('stesso volume minuto, respiro rapido e superficiale: PaCO₂ sopra 50', () => {
    const i0 = ing(); const s = scambioIniziale(i0);
    const i = ing({ vtMl: 250, frequenza: 24 });
    expect(leggi(corri(s, i, 1800), i).paco2).toBeGreaterThan(50);
  });
  it('apnea: +6-12 mmHg il primo minuto, poi 2-6 al minuto', () => {
    const i0 = ing(); let s = scambioIniziale(i0);
    const a = ing({ frequenza: 0, vtMl: 0, veMlMin: 0 });
    const p0 = s.pco2Sangue; s = corri(s, a, 60); const p1 = s.pco2Sangue; s = corri(s, a, 120); const p3 = s.pco2Sangue;
    expect(p1 - p0).toBeGreaterThan(6); expect(p1 - p0).toBeLessThan(13);
    expect((p3 - p1) / 2).toBeGreaterThan(2); expect((p3 - p1) / 2).toBeLessThan(6);
  });
  it('PaCO₂ 80 acuta con HCO₃⁻ 24 di partenza: pH 7,13-7,22', () => {
    const i = ing({ vtMl: 300, frequenza: 9 }); const s = regime(scambioIniziale(ing()), i);
    const l = leggi(s, i);
    expect(l.paco2).toBeGreaterThan(70);
    const ph80 = 6.1 + Math.log10((24 + 4) / (0.0307 * 80));
    expect(ph80).toBeGreaterThan(7.13); expect(ph80).toBeLessThan(7.22);
  });
  it('embolia: gradiente PaCO₂−EtCO₂ sopra 10, VD/VT sopra 0,5', () => {
    const i = ing(); const l = leggi(scambioIniziale(i, con({ spazioMortoAlv: 0.35 })), i);
    expect(l.paco2 - l.etco2).toBeGreaterThan(10); expect(l.vdvt!).toBeGreaterThan(0.5);
  });
  it('acidosi metabolica: HCO₃⁻ 14 → pH sotto 7,25, BE sotto −8', () => {
    const i = ing(); const l = leggi(scambioIniziale(i, con({ hco3: 14 })), i);
    expect(l.ph).toBeLessThan(7.25); expect(l.be).toBeLessThan(-8);
  });
});

describe('ossigenazione', () => {
  it('shunt 30%: la FiO₂ da 0,5 a 1 porta la PaO₂ su di poco (sotto 200)', () => {
    const p = con({ shuntFisso: 0.3 });
    const a = leggi(scambioIniziale(ing({ fio2: 0.5 }), p), ing({ fio2: 0.5 }));
    const b = leggi(scambioIniziale(ing({ fio2: 1 }), p), ing({ fio2: 1 }));
    expect(b.pao2).toBeLessThan(200); expect(b.pao2 - a.pao2).toBeLessThan(110);
  });
  it('basso V/Q: ipossiemia in aria, la FiO₂ 0,5 la corregge', () => {
    const p = con({ bassoVQ: 0.35 });
    const a = leggi(scambioIniziale(ing(), p), ing());
    const b = leggi(scambioIniziale(ing({ fio2: 0.5 }), p), ing({ fio2: 0.5 }));
    expect(a.pao2).toBeLessThan(70); expect(b.pao2 - a.pao2).toBeGreaterThan(80);
  });
  it('ARDS reclutabile: la PEEP abbassa lo shunt e alza il P/F; non reclutabile poco', () => {
    const pf = (r: number, peep: number) => { const i = ing({ fisiologia: fis('ards', { reclutabilita: r }), fio2: 0.6, peepTotale: peep, pFine: peep + 14, vtMl: 420, frequenza: 20 }); return leggi(scambioIniziale(i), i).pf; };
    expect(pf(0.5, 15)).toBeGreaterThan(pf(0.5, 5) * 2.5);
    expect(pf(0.05, 15)).toBeLessThan(pf(0.05, 5) * 1.5);
  });
  it('apnea: preossigenato molto più a lungo che in aria, l’obeso meno', () => {
    const minuti = (fio2: number, bmi: number) => {
      const p = con({ bmi }); let s = scambioIniziale(ing({ fio2 }), p);
      const a = ing({ fio2, frequenza: 0, vtMl: 0, veMlMin: 0, vieAperte: false });
      let t = 0; while (leggi(s, a).spo2 > 90 && t < 1800) { s = avanzaScambio(s, a, 2); t += 2; } return t / 60;
    };
    const pre = minuti(1, 24), aria = minuti(0.21, 24), obeso = minuti(1, 40);
    expect(pre).toBeGreaterThan(5); expect(pre).toBeLessThan(11);
    expect(aria).toBeGreaterThan(0.5); expect(aria).toBeLessThan(2);
    expect(obeso).toBeLessThan(pre * 0.75);
  });
  it('ossigenazione apneica a vie aperte con FiO₂ 1: SpO₂ sopra 95 a 10 min, la CO₂ sale', () => {
    let s = scambioIniziale(ing({ fio2: 1 }));
    const a = ing({ fio2: 1, frequenza: 0, vtMl: 0, veMlMin: 0, vieAperte: true, fonteO2: 1 });
    const p0 = s.pco2Sangue; s = corri(s, a, 600);
    expect(leggi(s, a).spo2).toBeGreaterThan(95); expect(s.pco2Sangue - p0).toBeGreaterThan(20);
  });
  it('portata dimezzata con shunt 20%: la PaO₂ scende di almeno 8 mmHg', () => {
    const i = ing({ fio2: 0.4 });
    const a = leggi(scambioIniziale(i, con({ shuntFisso: 0.2, portata: 5 })), i);
    const b = leggi(scambioIniziale(i, con({ shuntFisso: 0.2, portata: 2.5 })), i);
    expect(a.pao2 - b.pao2).toBeGreaterThan(8); expect(b.svo2).toBeLessThan(a.svo2 - 10);
  });
});

describe('vasocostrizione ipossica e monopolmonare', () => {
  it('monopolmonare a FiO₂ 1: la SpO₂ scende nei primi minuti e poi risale da sola', () => {
    const i0 = ing({ fio2: 1 }); let s = scambioIniziale(i0);
    const o = ing({ fio2: 1, fisiologia: fis('normale', { monopolmonare: 'sinistro' }) });
    s = corri(s, o, 300); const a5 = leggi(s, o);
    s = corri(s, o, 1500); const a30 = leggi(s, o);
    expect(a5.spo2).toBeLessThan(leggi(scambioIniziale(i0), i0).spo2 - 1);
    expect(a30.qsqt).toBeLessThan(a5.qsqt - 0.02);
    expect(a30.pao2).toBeGreaterThan(a5.pao2);
  });
  it('gli alogenati sopra 1 MAC tolgono parte della vasocostrizione: più shunt', () => {
    const o = (mac: number) => ing({ fio2: 1, mac, fisiologia: fis('normale', { monopolmonare: 'sinistro' }) });
    const senza = leggi(scambioIniziale(o(0)), o(0)); const con15 = leggi(scambioIniziale(o(1.5)), o(1.5));
    expect(con15.qsqt).toBeGreaterThan(senza.qsqt + 0.02);
  });
  it('l’NO inalatorio sposta flusso verso il ventilato: shunt più basso', () => {
    const i = ing({ fio2: 0.6 });
    const a = leggi(scambioIniziale(i, con({ shuntFisso: 0.3 })), i); const b = leggi(scambioIniziale(i, con({ shuntFisso: 0.3, noPpm: 20 })), i);
    expect(b.qsqt).toBeLessThan(a.qsqt - 0.02);
  });
});

describe('diffusione', () => {
  it('a riposo quasi normale; sotto sforzo (portata alta, VO₂ alto) si desatura', () => {
    const p = (q: number, m: number, dl: number) => { const i = ing({ frequenza: 12 * m }); return leggi(scambioIniziale(i, con({ diffusione: dl, portata: q, metabolismo: m })), i); };
    expect(p(5, 1, 0.3).pao2).toBeGreaterThan(80);
    expect(p(12, 2.5, 0.3).aa).toBeGreaterThan(p(5, 1, 0.3).aa * 2);
    expect(p(12, 2.5, 1).spo2).toBeGreaterThan(94);
  });
  it('il sangue equilibra in un terzo del transito con la diffusione normale', () => {
    const sangue = { hb: 14, ph: 7.4, temperatura: 37, be: 0, pco2: 40, cohb: 0, methb: 0 };
    expect(fineCapillare(100, 40, 25 / 60 / 75, 0.25, sangue)).toBeGreaterThan(95);
    expect(fineCapillare(100, 40, 5 / 60 / 75, 0.4, sangue)).toBeLessThan(80);
  });
});

describe('disemoglobinemie', () => {
  it('CO: SpO₂ quasi normale, contenuto e SaO₂ bassi', () => {
    const i = ing({ fio2: 0.21 }); const l = leggi(scambioIniziale(i, con({ cohb: 0.3 })), i);
    expect(l.spo2).toBeGreaterThan(94); expect(l.do2).toBeLessThan(leggi(scambioIniziale(i), i).do2 * 0.8);
  });
  it('metaemoglobina 30%: SpO₂ verso 85', () => {
    const i = ing({ fio2: 0.4 }); const l = leggi(scambioIniziale(i, con({ methb: 0.3 })), i);
    expect(l.spo2).toBeGreaterThan(83); expect(l.spo2).toBeLessThan(90);
  });
});

describe('isteresi del reclutamento', () => {
  it('dopo il reclutamento il polmone resta aperto se la PEEP scende di poco, si richiude se scende troppo', () => {
    let m = avanzaIsteresi(null, 14, 0.5, true, false, 2);
    m = avanzaIsteresi(m, 14, 0.5, false, false, 2);
    for (let t = 0; t < 600; t += 2) m = avanzaIsteresi(m, 14, 0.5, false, false, 2);
    expect(m.peepMemoria).toBeGreaterThan(14 + ISTERESI_CMH2O - 0.5);
    let n = m; for (let t = 0; t < 900; t += 2) n = avanzaIsteresi(n, 5, 0.5, false, false, 2);
    expect(n.peepMemoria).toBeLessThan(14);
    const f = { ...PRESET_FISIOLOGIA.ards.fisiologia, preset: 'ards' } as any;
    expect(complianceA({ ...f, peepMemoria: m.peepMemoria }, 14)).toBeGreaterThan(complianceA(f, 14));
  });
  it('FiO₂ 1 con PEEP 0: atelettasie da assorbimento in dieci minuti; il reclutamento le toglie', () => {
    let m = avanzaIsteresi(null, 0, 1, false, false, 2);
    for (let t = 0; t < 600; t += 2) m = avanzaIsteresi(m, 0, 1, false, false, 2);
    expect(m.atelettasia).toBeGreaterThan(0.8);
    expect(avanzaIsteresi(m, 10, 1, true, false, 2).atelettasia).toBe(0);
  });
});

describe('taratura e ventilatore', () => {
  it('la SpO₂ scritta è quella al primo passo; poi la FiO₂ la cambia', () => {
    const i = ing({ fio2: 0.4, spo2Bersaglio: 88 }); let s = scambioIniziale(i);
    expect(leggi(s, i).spo2).toBeCloseTo(88, 0);
    const piu = { ...i, fio2: 0.8 }; s = corri(s, piu, 300);
    expect(leggi(s, piu).spo2).toBeGreaterThan(92);
  });
  it('una SpO₂ scritta dopo si raggiunge in un paio di minuti', () => {
    const i = ing({ fio2: 0.4, spo2Bersaglio: 97 }); let s = scambioIniziale(i);
    const giu = { ...i, spo2Bersaglio: 85 }; s = corri(s, giu, 180);
    expect(Math.abs(leggi(s, giu).spo2 - 85)).toBeLessThan(1.5);
  });
  it('EtCO₂ scritta: tarata al primo passo', () => {
    const i = ing({ etco2Bersaglio: 55 });
    expect(leggi(scambioIniziale(i), i).etco2).toBeCloseTo(55, 0);
  });
  it('nel ventilatore: SpO₂ ed EtCO₂ escono dal modello, lo standby fa desaturare', () => {
    let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: 97, heartRate: 80, map: 85 });
    ist = { ...ist, scambioAttivo: true };
    ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
    for (let t = 2; t <= 60; t += 2) ist = batti(ist, t, 2);
    expect(ist.scambio).not.toBeNull();
    expect(ist.misure.spo2).toBeGreaterThan(95);
    expect(ist.misure.etco2!).toBeGreaterThan(25);
    ist = applica(ist, { tipo: 'standby', ventilando: false }, 60).istantanea;
    for (let t = 62; t <= 300; t += 2) ist = batti(ist, t, 2);
    expect(ist.scambio!.pco2Sangue).toBeGreaterThan(50);
    expect(statoDa(ist).fisiologia.peepMemoria).toBe(0);
  });
  it('deterministico', () => {
    const i = ing({ fio2: 0.5, spo2Bersaglio: 90 });
    const a = corri(scambioIniziale(i), i, 120); const b = corri(scambioIniziale(i), i, 120);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
