/**
 * CO₂ e spazio morto (3.6), sul lavoro di riferimento:
 * Cipulli F, Sanna A, Garberi R, Lassola S, Forcione M, Bellani G, Foti G,
 * Rezoagli E. Dead space in critical care: a practical approach with clinical
 * scenarios. J Anesth Analg Crit Care 2026;6:20. doi:10.1186/s44158-025-00320-4.
 *
 * I casi 1–3 del lavoro, ripetuti nel modello con le impostazioni scritte qui.
 * Il caso 4 (EIT con bolo salino) non si ripete: vedi docs/spazio-morto.md.
 */
import { describe, it, expect } from 'vitest';
import {
  scambioIniziale, avanzaScambio, letturaScambio, paco2Arteriosa, quotaIntrappolata, pendenzaCapnogramma,
  PARAMETRI_SCAMBIO, QUOZIENTE_RESPIRATORIO, ingressiDaVentilatore,
  type IngressiScambio, type ParametriScambio, type StatoScambio,
} from '../device/screens/scenario/ventilatore/scambio';
import { PRESET_FISIOLOGIA } from '../device/screens/scenario/ventilatore/fisica';
import { istantaneaIniziale, applica, batti, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { createCapnoWaveform, VITALS_VUOTI } from '../device/screens/scenario/monitor/sources';

/** Gli ingressi di un paziente intubato di 70 kg in volume controllato (VD 1,1 ml/kg + 10 di circuito). */
const ing = (o: Partial<IngressiScambio> = {}): IngressiScambio => {
  const i = {
    pesoKg: 70, fio2: 0.21, vtMl: 500, frequenza: 12, vdMl: 87, vieAperte: true, fonteO2: 0.21, peepTotale: 5, autoPeep: 0,
    pFine: 15, pMedia: 8, reclutamento: false, scollegato: false, fisiologia: { ...PRESET_FISIOLOGIA.normale.fisiologia, preset: 'normale' } as any,
    mac: 0, portata: null, spo2Bersaglio: null, etco2Bersaglio: null, vaTotaleStimata: 0, ...o,
  };
  return { ...i, fonteO2: i.fio2, veMlMin: i.frequenza * i.vtMl, vaTotaleStimata: i.frequenza * Math.max(0, i.vtMl - i.vdMl) };
};
const con = (p: Partial<ParametriScambio>) => ({ ...PARAMETRI_SCAMBIO, ...p });
const corri = (s: StatoScambio, i: IngressiScambio, sec: number) => { for (let t = 0; t < sec; t += 2) s = avanzaScambio(s, i, 2); return s; };
const aRegime = (i: IngressiScambio, p: ParametriScambio) => corri(scambioIniziale(i, p), i, 300);
const ards = (compliance: number) => ({ ...PRESET_FISIOLOGIA.ards.fisiologia, preset: 'ards', compliance, reclutabilita: 0.2 }) as any;

describe('le formule', () => {
  it('Bohr-Enghoff: alveolare con l’EtCO₂, fisiologico con la PECO₂, anatomico per differenza', () => {
    const i = ing({ fio2: 0.5 }); const l = letturaScambio(aRegime(i, con({ spazioMortoAlv: 0.3 })), i);
    expect(l.vdAlveolare!).toBeCloseTo((l.paco2 - l.etco2) / l.paco2, 6);
    expect(l.vdFisiologico!).toBeCloseTo((l.paco2 - l.peco2) / l.paco2, 6);
    expect(l.vdAnatomico!).toBeCloseTo(l.vdFisiologico! - l.vdAlveolare!, 6);
    expect(l.vdvt).toBe(l.vdFisiologico);
    expect(l.gradienteCo2!).toBeCloseTo(l.paco2 - l.etco2, 6);
    expect(l.rapportoEtPa!).toBeCloseTo(l.etco2 / l.paco2, 6);
  });
  it('rapporto ventilatorio VE·PaCO₂/(100·kg·37,5) e VE standardizzata VE·PaCO₂/40', () => {
    const i = ing(); const l = letturaScambio(aRegime(i, PARAMETRI_SCAMBIO), i);
    expect(l.rapportoVentilatorio!).toBeCloseTo((6000 * l.paco2) / (100 * 70 * 37.5), 6);
    expect(l.ventilazioneStandardizzata!).toBeCloseTo((6 * l.paco2) / 40, 6);
  });
  it('a riposo: gradiente PaCO₂ − EtCO₂ fra 3 e 6 mmHg (circa 5), EtCO₂/PaCO₂ sopra 0,8', () => {
    const i = ing(); const l = letturaScambio(aRegime(i, PARAMETRI_SCAMBIO), i);
    expect(l.gradienteCo2!).toBeGreaterThan(3); expect(l.gradienteCo2!).toBeLessThan(6);
    expect(l.rapportoEtPa!).toBeGreaterThan(0.85);
    expect(l.paco2).toBeGreaterThan(37); expect(l.paco2).toBeLessThan(43);
  });
  it('VCO₂ di base 3 ml/kg/min: quella che esce col respiro a regime (210 ml/min a 70 kg)', () => {
    const i = ing(); const s = corri(scambioIniziale(i), i, 1800); const l = letturaScambio(s, i);
    const vco2 = (l.peco2 * i.veMlMin) / 863;
    expect(vco2).toBeGreaterThan(200); expect(vco2).toBeLessThan(220);
    expect(QUOZIENTE_RESPIRATORIO).toBeCloseTo(3 / 3.5, 6);
  });
  it('la PaCO₂ è la PACO₂ mescolata con lo shunt', () => {
    expect(paco2Arteriosa(40, 46, 0)).toBe(40);
    expect(paco2Arteriosa(40, 46, 0.5)).toBe(43);
  });
});

describe('lo shunt e la sovrastima dell’Enghoff', () => {
  const sovrastima = (shunt: number) => {
    const i = ing({ fio2: 0.6, vtMl: 450, frequenza: 22, peepTotale: 10, pFine: 22, pMedia: 14, fisiologia: { ...ards(40), reclutabilita: 0 } });
    const l = letturaScambio(corri(scambioIniziale(i, con({ shuntFisso: shunt, spazioMortoAlv: 0.3, inibizioneHpv: 1 })), i, 600), i);
    return { l, d: l.vdAlveolare! - l.vdAlveolareVero! };
  };
  it('senza shunt PaCO₂ = PACO₂; con lo shunt la PaCO₂ sale sopra la PACO₂', () => {
    expect(sovrastima(0).l.paco2 - sovrastima(0).l.pAco2).toBeLessThan(0.05);
    expect(sovrastima(0.4).l.paco2 - sovrastima(0.4).l.pAco2).toBeGreaterThan(3);
  });
  it('sotto il 20% di shunt trascurabile, sopra il 40% marcata (e cresce più dello shunt)', () => {
    expect(sovrastima(0.1).d).toBeLessThan(0.025);
    expect(sovrastima(0.45).d).toBeGreaterThan(0.08);
    expect(sovrastima(0.6).d).toBeGreaterThan(2 * sovrastima(0.3).d);
  });
  it('a shunt costante il trend resta: più spazio morto vero, più spazio morto calcolato', () => {
    const i = ing({ fio2: 1 });
    const vd = (sm: number) => letturaScambio(aRegime(i, con({ shuntFisso: 0.5, spazioMortoAlv: sm })), i).vdAlveolare!;
    expect(vd(0.3)).toBeGreaterThan(vd(0.2) + 0.07); expect(vd(0.4)).toBeGreaterThan(vd(0.3) + 0.07);
  });
});

describe('CO₂ intrappolata e capnogramma', () => {
  it('con l’auto-PEEP alta l’EtCO₂ può superare la PaCO₂ (spazio morto negativo)', () => {
    const p = con({ spazioMortoAlv: 0.1 });
    const senza = ing({ vtMl: 650, frequenza: 8, autoPeep: 0, etco2Bersaglio: 50 });
    const con14 = ing({ vtMl: 650, frequenza: 8, autoPeep: 14, etco2Bersaglio: 50 });
    expect(letturaScambio(aRegime(senza, p), senza).vdAlveolare!).toBeGreaterThan(0.05);
    expect(letturaScambio(aRegime(con14, p), con14).vdAlveolare!).toBeLessThan(0);
    expect(quotaIntrappolata(1.5)).toBe(0);
  });
  it('il capnogramma perde il plateau con l’ostruzione', () => {
    const f = (k: keyof typeof PRESET_FISIOLOGIA) => PRESET_FISIOLOGIA[k].fisiologia;
    expect(pendenzaCapnogramma(f('normale'))).toBe(0);
    expect(pendenzaCapnogramma(f('bpco'))).toBeGreaterThan(0.5);
    const curva = (p: number) => createCapnoWaveform(() => ({ ...VITALS_VUOTI, etco2: 40, respiratoryRate: 10 }), undefined, () => p);
    // ciclo 6 s: plateau da 1,2 a 3,7 s
    const sano = curva(0); const ostruito = curva(1);
    expect(sano.at(3.6) - sano.at(1.5)).toBeLessThan(3);
    expect(ostruito.at(3.6) - ostruito.at(1.5)).toBeGreaterThan(8);
    expect(ostruito.at(3.7)).toBeGreaterThan(38);
  });
});

/**
 * I casi del lavoro. Il modello non riceve la PaCO₂: riceve l’EtCO₂ (lo
 * scenario la scrive, il modello trova la VCO₂), lo shunt fisso e lo spazio
 * morto alveolare vero, scelti perché Qs/Qt e VD/VT di Enghoff vengano quelli
 * del lavoro. La PaCO₂ è quella che ne esce.
 */
describe('Cipulli 2026, i casi', () => {
  it('caso 1, ARDS H1N1: VT 480, FR 24, PEEP 12, FiO₂ 0,65 → PaCO₂ 48, EtCO₂ 24, Qs 0,27, VD alveolare 0,5', () => {
    const i = ing({ fio2: 0.65, vtMl: 480, frequenza: 24, peepTotale: 12, pFine: 22, pMedia: 15, etco2Bersaglio: 24, fisiologia: ards(48) });
    const l = letturaScambio(aRegime(i, con({ shuntFisso: 0.351, spazioMortoAlv: 0.467 })), i);
    expect(l.paco2).toBeGreaterThan(47); expect(l.paco2).toBeLessThan(50);
    expect(l.etco2).toBeCloseTo(24, 0);
    expect(l.qsqt).toBeCloseTo(0.27, 1);
    expect(l.vdAlveolare!).toBeCloseTo(0.5, 1);
    expect(l.rapportoEtPa!).toBeLessThan(0.8);
  });
  it('caso 1, prono 16 h: PaCO₂ 56, EtCO₂ 32 → VD alveolare 0,42 (meno spazio morto, e più VCO₂)', () => {
    const i = ing({ fio2: 0.65, vtMl: 480, frequenza: 24, peepTotale: 12, pFine: 22, pMedia: 15, etco2Bersaglio: 24, fisiologia: ards(48) });
    const prima = aRegime(i, con({ shuntFisso: 0.351, spazioMortoAlv: 0.467 }));
    // Il prono non è un’azione di OVS: lo fa la regia, togliendo spazio morto alveolare.
    const giu = { ...prima, parametri: { ...prima.parametri, spazioMortoAlv: 0.38 } };
    // Solo questo, a VE e VCO₂ costanti: l’EtCO₂ resta, la PaCO₂ scende (quello che la fisica dice).
    const fisico = letturaScambio(corri(giu, i, 3600), i);
    expect(fisico.etco2).toBeCloseTo(24, 0); expect(fisico.paco2).toBeLessThan(44);
    // Con l’EtCO₂ a 32 come nel lavoro, la VCO₂ sale di un terzo e i numeri sono quelli.
    const i32 = { ...i, etco2Bersaglio: 32 };
    const s = corri(giu, i32, 3600); const l = letturaScambio(s, i32);
    expect(l.paco2).toBeGreaterThan(54.5); expect(l.paco2).toBeLessThan(57.5);
    expect(l.vdAlveolare!).toBeGreaterThan(0.4); expect(l.vdAlveolare!).toBeLessThan(0.44);
    expect(s.vco2Fattore / prima.vco2Fattore).toBeGreaterThan(1.25);
  });
  it('caso 1, reclutamento a 40 cmH₂O e PEEP 12 → 14 nel ventilatore: PaCO₂, EtCO₂ e spazio morto non cambiano, il P/F sale di poco', () => {
    let t = 0;
    let ist: any = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: 24, spo2: null, heartRate: 90, map: 80 });
    ist = {
      ...ist, scambioAttivo: true, drive: { frequenza: 0, intensita: 0 },
      fisiologia: { ...PRESET_FISIOLOGIA.ards.fisiologia, preset: 'ards', compliance: 46, reclutabilita: 0.45 },
      parametriScambio: con({ shuntFisso: 0.32, spazioMortoAlv: 0.47 }),
    };
    const fa = (x: any) => { ist = applica(ist, x, t).istantanea; };
    const corriV = (sec: number) => { for (let k = 0; k < sec; k += 2) { t += 2; ist = batti(ist, t, 2); } };
    const leggi = () => letturaScambio(ist.scambio, ingressiDaVentilatore(statoDa(ist), ist.misure, { spo2: null, etco2: 24 }));
    for (const [k, v] of [['volume', 480], ['frequency', 24], ['peep', 12], ['fio2', 65]] as const) fa({ tipo: 'parametro', chiave: k, valore: v });
    fa({ tipo: 'standby', ventilando: true });
    corriV(900); const a = leggi();
    expect(a.paco2).toBeGreaterThan(47); expect(a.paco2).toBeLessThan(49.5);
    expect(a.qsqt).toBeCloseTo(0.27, 1); expect(a.vdAlveolare!).toBeCloseTo(0.5, 1);
    fa({ tipo: 'manovra', manovra: 'reclutamento' }); corriV(20); fa({ tipo: 'manovra', manovra: null });
    fa({ tipo: 'parametro', chiave: 'peep', valore: 14 }); corriV(900); const b = leggi();
    expect(Math.abs(b.paco2 - a.paco2)).toBeLessThan(1);
    expect(Math.abs(b.etco2 - a.etco2)).toBeLessThan(1);
    expect(Math.abs(b.vdAlveolare! - a.vdAlveolare!)).toBeLessThan(0.02);
    expect(b.pf).toBeGreaterThan(a.pf * 1.04); expect(b.pf).toBeLessThan(a.pf * 1.2);
  }, 20000);
  it('caso 2, ARDS pneumococcica: VT 380, FR 28, PEEP 14, FiO₂ 1, Qs 0,42 → PaCO₂ 57, EtCO₂ 25, VD 0,56 sovrastimato', () => {
    const i = ing({ fio2: 1, vtMl: 380, frequenza: 28, peepTotale: 14, pFine: 24, pMedia: 17, etco2Bersaglio: 25, fisiologia: ards(38) });
    const l = letturaScambio(aRegime(i, con({ shuntFisso: 0.526, spazioMortoAlv: 0.516 })), i);
    expect(l.paco2).toBeGreaterThan(56); expect(l.paco2).toBeLessThan(60);
    expect(l.qsqt).toBeCloseTo(0.42, 1);
    expect(l.vdAlveolare!).toBeCloseTo(0.56, 1);
    expect(l.vdAlveolare! - l.vdAlveolareVero!).toBeGreaterThan(0.035);
  });
  it('caso 3, asma grave: VT 650, FR 8, PEEPi 14, FiO₂ 0,35, Qs 0,11 → PaCO₂ 57, EtCO₂ 63, VD −0,10', () => {
    const f = { ...PRESET_FISIOLOGIA.bpco.fisiologia, preset: 'bpco', compliance: 65, resistenza: 30, limitazioneFlusso: 0.8 } as any;
    const i = ing({ fio2: 0.35, vtMl: 650, frequenza: 8, peepTotale: 14, autoPeep: 14, pFine: 24, pMedia: 14, etco2Bersaglio: 63, fisiologia: f });
    const l = letturaScambio(aRegime(i, con({ shuntFisso: 0.128, spazioMortoAlv: 0.106 })), i);
    expect(l.paco2).toBeGreaterThan(55.5); expect(l.paco2).toBeLessThan(58.5);
    expect(l.etco2).toBeCloseTo(63, 0);
    expect(l.qsqt).toBeCloseTo(0.11, 1);
    expect(l.vdAlveolare!).toBeGreaterThan(-0.13); expect(l.vdAlveolare!).toBeLessThan(-0.07);
    expect(pendenzaCapnogramma(f, 14)).toBeGreaterThan(0.8);
  });
});
