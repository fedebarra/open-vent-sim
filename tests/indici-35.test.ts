/**
 * Gli indici della 3.5: RSBI, flow index, RCexp e PMI. Ognuno esce dalle curve
 * del motore, non da una formula scritta accanto.
 */
import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { attiRecenti, flowIndex } from '../device/screens/scenario/ventilatore/motore';
import { esitoManovra, misura, type StatoVentilatore } from '../device/screens/scenario/ventilatore/fisica';
import { MISURE_VUOTE, misureVisibili } from '../device/screens/scenario/ventilatore/parametri';

function stato(modalita: string, imp: Record<string, unknown>, fis: Record<string, unknown>, drive: any): StatoVentilatore {
  let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
  ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
  ist = applica(ist, { tipo: 'modalita', modalita: modalita as never }, 0).istantanea;
  const s = statoDa(ist);
  return { ...s, impostazioni: { ...s.impostazioni, ...imp }, fisiologia: { ...s.fisiologia, reclutabilita: 0, limitazioneFlusso: 0, secrezioni: 0, ...fis }, drive, asincronia: null, umidificatore: null };
}
const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const ultimi = (s: StatoVentilatore) => attiRecenti(100, s, 20).slice(-3);
const PASSIVO = { frequenza: 0, intensita: 0 };

describe('RCexp', () => {
  it('in VC passiva è R·C (C 50, R 10 → 0,5 s)', () => {
    const a = ultimi(stato('VC', { volume: 500, peep: 5 }, { compliance: 50, resistenza: 10 }, PASSIVO));
    expect(media(a.map((x) => x.rcEsp!))).toBeGreaterThan(0.45);
    expect(media(a.map((x) => x.rcEsp!))).toBeLessThan(0.56);
  });
  it('cresce con la resistenza', () => {
    const r = (res: number) => media(ultimi(stato('VC', { volume: 500, peep: 5, frequency: 10 }, { compliance: 50, resistenza: res }, PASSIVO)).map((x) => x.rcEsp!));
    expect(r(25)).toBeGreaterThan(r(10) * 2);
  });
  it('sul display in invasiva', () => {
    const m = misura(stato('VC', { volume: 500, peep: 5 }, { compliance: 50, resistenza: 10 }, PASSIVO), 100, 2, null);
    expect(m.rcExp).toBeCloseTo(0.5, 1);
  });
});

describe('flow index', () => {
  it('un esponenziale puro dà circa 1', () => {
    const t = Array.from({ length: 100 }, (_, i) => i * 0.01);
    expect(flowIndex(t, t.map((x) => Math.exp(-x / 0.5)))!).toBeLessThan(1.05);
  });
  it('sale con lo sforzo a parità di supporto', () => {
    const fi = (intensita: number) => media(ultimi(stato('PS', { psLevel: 5, peep: 5 }, { compliance: 50, resistenza: 10 }, { frequenza: 18, intensita })).map((x) => x.flowIndex!));
    expect(fi(0.8)).toBeGreaterThan(fi(0.2) + 0.5);
  });
  it('scende alzando il supporto a parità di sforzo', () => {
    const fi = (ps: number) => media(ultimi(stato('PS', { psLevel: ps, peep: 5 }, { compliance: 50, resistenza: 10 }, { frequenza: 18, intensita: 0.8 })).map((x) => x.flowIndex!));
    expect(fi(15)).toBeLessThan(fi(5));
  });
  it('si vede solo in PS', () => {
    const ctx = (modalita: any) => ({ ambiente: 'invasiva' as const, modalita, respiro: 'meccanica' as const, impostazioni: {} as any });
    expect(misureVisibili(ctx('PS'))).toContain('flowIndex');
    expect(misureVisibili(ctx('VC'))).not.toContain('flowIndex');
  });
});

describe('RSBI', () => {
  it('è la frequenza contata sul corrente espirato, in PS', () => {
    const m = misura(stato('PS', { psLevel: 5, peep: 5 }, { compliance: 50, resistenza: 10 }, { frequenza: 30, intensita: 0.3 }), 100, 2, null);
    expect(m.rsbi).toBe(Math.round(m.measuredFrequency! / (m.volumeExpired! / 1000)));
    expect(m.rsbi!).toBeGreaterThan(80);
  });
  it('non c\'è in apnea (atti di backup)', () => {
    expect(misura(stato('PS', { psLevel: 10 }, { compliance: 50, resistenza: 10 }, PASSIVO), 100, 2, null).rsbi).toBeNull();
  });
  it('non c\'è in controllata', () => {
    expect(misura(stato('VC', { volume: 500 }, { compliance: 50, resistenza: 10 }, PASSIVO), 100, 2, null).rsbi).toBeNull();
  });
});

describe('PMI nella pausa inspiratoria in supporto', () => {
  it('cresce con lo sforzo: sopra 2 con un diaframma che tira', () => {
    const pmi = (intensita: number) => {
      const s = { ...stato('PS', { psLevel: 8, peep: 5 }, { compliance: 50, resistenza: 10 }, { frequenza: 18, intensita }), manovra: 'pausa-inspiratoria' as const, manovraDa: 95 };
      return esitoManovra(s, 'pausa-inspiratoria', MISURE_VUOTE, 100).pmi!;
    };
    expect(pmi(1)).toBeGreaterThan(2);
    expect(pmi(1)).toBeGreaterThan(pmi(0.3) + 2);
  });
  it('non c\'è in VC', () => {
    const s = { ...stato('VC', { volume: 500 }, { compliance: 50, resistenza: 10 }, PASSIVO), manovra: 'pausa-inspiratoria' as const, manovraDa: 95 };
    expect(esitoManovra(s, 'pausa-inspiratoria', MISURE_VUOTE, 100).pmi).toBeUndefined();
  });
});
