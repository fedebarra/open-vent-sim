import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, batti, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { flussoAltoFlusso, misura, PRESET_FISIOLOGIA } from '../device/screens/scenario/ventilatore/fisica';
import { ingressiDaVentilatore } from '../device/screens/scenario/ventilatore/scambio';
import { valuta, LIMITI_INIZIALI } from '../device/screens/scenario/ventilatore/allarmi';
import { rox, fasciaRox } from '../remote/rox';
import { parseScenario, scenarioDa, comandiScenario } from '../remote/scenario';

function af(fis: Record<string, unknown> = {}, fgf = 50) {
  let ist = istantaneaIniziale('alto-flusso', 0, { pesoKg: 70, etco2: null, spo2: 92, heartRate: 90, map: 85 });
  ist = { ...ist, fisiologia: { ...ist.fisiologia, ...fis }, drive: { frequenza: 24, intensita: 0.6 }, impostazioni: { ...ist.impostazioni, fgf, fio2: 60 } };
  return applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
}
const allarmi = (ist: ReturnType<typeof af>) => {
  const s = statoDa(ist);
  return valuta(s, misura(s, 10, 2, null), LIMITI_INIZIALI).map((a) => a.chiave);
};

describe('Alto flusso: la cannula', () => {
  it('a posto: il flusso misurato è quello impostato, e arriva al naso', () => {
    expect(flussoAltoFlusso(statoDa(af()))).toEqual({ erogato: 50, alPaziente: 50 });
    expect(misura(statoDa(af()), 10, 2, null).flussoMisurato).toBe(50);
    expect(allarmi(af())).toEqual([]);
  });
  it('ostruita: l’apparecchio non riesce a dare il flusso, e suona', () => {
    const s = statoDa(af({ cannulaAF: 'occlusa' }));
    expect(flussoAltoFlusso(s).erogato).toBeLessThan(25);
    expect(flussoAltoFlusso(s).alPaziente).toBe(flussoAltoFlusso(s).erogato);
    expect(allarmi(af({ cannulaAF: 'occlusa' }))).toEqual(['ostruzioneAF']);
  });
  it('tubo staccato: il flusso c’è ma non arriva, e suona', () => {
    expect(flussoAltoFlusso(statoDa(af({ cannulaAF: 'staccata' })))).toEqual({ erogato: 50, alPaziente: 0 });
    expect(allarmi(af({ cannulaAF: 'staccata' }))).toEqual(['perditaAF']);
  });
  it('fuori dal naso: per l’apparecchio è tutto in ordine', () => {
    expect(flussoAltoFlusso(statoDa(af({ cannulaAF: 'dislocata' })))).toEqual({ erogato: 50, alPaziente: 0 });
    expect(allarmi(af({ cannulaAF: 'dislocata' }))).toEqual([]);
  });
  it('in standby non eroga niente', () => {
    const s = { ...statoDa(af()), ventilando: false };
    expect(flussoAltoFlusso(s)).toEqual({ erogato: 0, alPaziente: 0 });
  });
});

describe('Alto flusso: il paziente', () => {
  const ing = (fis: Record<string, unknown>, fgf = 50) => {
    const s = statoDa(af(fis, fgf));
    return ingressiDaVentilatore(s, misura(s, 10, 2, null), { spo2: 92, etco2: null });
  };
  it('la pressione cresce con il flusso: circa 2,7 cmH₂O a 35 l/min a bocca chiusa', () => {
    expect(ing({}, 35).peepTotale).toBeGreaterThan(2);
    expect(ing({}, 35).peepTotale).toBeLessThan(3.2);
    expect(ing({}, 60).peepTotale).toBeGreaterThan(ing({}, 30).peepTotale);
  });
  it('a bocca aperta la pressione cala a un terzo', () => {
    expect(ing({ boccaAperta: true }).peepTotale).toBeCloseTo(ing({}).peepTotale / 3, 5);
  });
  it('senza flusso al naso: aria ambiente, niente pressione, niente lavaggio', () => {
    for (const g of ['staccata', 'dislocata']) {
      const i = ing({ cannulaAF: g });
      expect(i.fio2).toBeCloseTo(0.21, 5);
      expect(i.peepTotale).toBe(0);
      expect(i.vdMl).toBeGreaterThan(ing({}).vdMl);
    }
  });
  it('con la cannula ostruita la FiO₂ vera scende sotto quella impostata', () => {
    expect(ing({ cannulaAF: 'occlusa' }).fio2).toBeLessThan(ing({}).fio2 - 0.05);
  });
  it('cannula fuori dal naso: la SpO₂ scende e l’apparecchio tace', () => {
    let ist = af();
    ist = { ...ist, scambioAttivo: true, fisiologia: { ...ist.fisiologia, ...PRESET_FISIOLOGIA.ards.fisiologia } };
    for (let t = 2; t <= 120; t += 2) ist = batti(ist, t, 2);
    const prima = ist.misure.spo2!;
    ist = { ...ist, fisiologia: { ...ist.fisiologia, cannulaAF: 'dislocata' } };
    for (let t = 122; t <= 420; t += 2) ist = batti(ist, t, 2);
    expect(ist.misure.spo2!).toBeLessThan(prima - 4);
    expect(ist.allarmi).toEqual([]);
  });
});

describe('Il ROX per il docente', () => {
  it('(SpO₂/FiO₂)/FR, con le soglie di Roca 2019', () => {
    expect(rox(92, 60, 24)).toBeCloseTo(92 / 0.6 / 24, 6);
    expect(fasciaRox(rox(96, 40, 18))).toBe('basso');
    expect(fasciaRox(rox(85, 100, 34))).toBe('alto');
    expect(fasciaRox(rox(90, 80, 28))).toBe('incerto');
    expect(rox(null, 60, 20)).toBeNull();
    expect(rox(92, 60, 0)).toBeNull();
  });
});

describe('Nei file', () => {
  it('lo scenario salvato si porta dietro la cannula e la bocca; uno vecchio le rimette a posto', () => {
    const ist = af({ cannulaAF: 'occlusa', boccaAperta: true });
    const sc = parseScenario(JSON.stringify(scenarioDa(ist, 'x')));
    expect(sc.fisiologia).toMatchObject({ cannulaAF: 'occlusa', boccaAperta: true });
    const vecchio = scenarioDa(af(), 'y') as any;
    delete vecchio.fisiologia.cannulaAF;
    delete vecchio.fisiologia.boccaAperta;
    expect(comandiScenario(parseScenario(JSON.stringify(vecchio)), ist).paziente.fisiologia).toMatchObject({ cannulaAF: null, boccaAperta: false });
  });
});
