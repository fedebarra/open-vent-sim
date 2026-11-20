/**
 * Pressure control on a real machine: the pressure controller lags behind the
 * patient, a patient who pushes during a time-cycled breath sends gas back
 * through the expiratory valve, double cycling works in pressure modes, and
 * active expiration is not mistaken for a cough.
 */
import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { campioneMotore, attiRecenti } from '../device/screens/scenario/ventilatore/motore';
import type { StatoVentilatore } from '../device/screens/scenario/ventilatore/fisica';
import { SCENARI_PRONTI } from '../remote/scenari';
import { parseScenario, comandiScenario } from '../remote/scenario';

const PASSIVO = { frequenza: 0, intensita: 0 };
const FAME = { frequenza: 23, intensita: 0.7, forma: { salita: 0.35, tenuta: 0.05, discesa: 0.3 }, espirioAttivo: 0.7 };
const PC = { pressureTarget: 14, peep: 5, frequency: 20, ratio: '1:1', inspiratoryRiseTimeSeconds: 0, triggerFlow: 2, triggerControllata: 1 };

function stato(imp: Record<string, unknown>, drive: any = PASSIVO, asincronia: any = null): StatoVentilatore {
  let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 58, etco2: null, spo2: null, heartRate: 90, map: null });
  ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
  ist = applica(ist, { tipo: 'modalita', modalita: 'PC' as never }, 0).istantanea;
  const s = statoDa(ist);
  return { ...s, impostazioni: { ...s.impostazioni, ...imp }, fisiologia: { ...s.fisiologia, compliance: 40, resistenza: 10, reclutabilita: 0, limitazioneFlusso: 0, secrezioni: 0 }, drive, asincronia, umidificatore: null };
}
const campioni = (s: StatoVentilatore, da = 100, durata = 15) => {
  const out: { t: number; paw: number; flusso: number; fase: number }[] = [];
  for (let t = da; t < da + durata; t += 0.005) { const c = campioneMotore(t, s); out.push({ t, paw: c.paw, flusso: c.flusso, fase: c.fase }); }
  return out;
};

describe('the pressure controller', () => {
  it('passive patient, rise 0.15 s: Paw sits on the target, no overshoot', () => {
    const a = attiRecenti(100, stato({ ...PC, inspiratoryRiseTimeSeconds: 0.15 }), 15).slice(-3);
    for (const x of a) expect(Math.abs(x.pip - 19)).toBeLessThan(0.3);
  });
  it('passive patient, rise 0: a short overshoot above the target, then back on it', () => {
    const s = stato(PC);
    const a = attiRecenti(100, s, 15).slice(-3);
    for (const x of a) { expect(x.pip).toBeGreaterThan(19.5); expect(x.pip).toBeLessThan(23); }
    const atto = a.at(-1)!;
    expect(Math.abs(campioneMotore(atto.inizio + 0.6, s).paw - 19)).toBeLessThan(0.2);
  });
});

describe('delayed cycling in PC', () => {
  it('the patient pushes before the machine cycles: flow reverses and Paw spikes above the target', () => {
    const s = stato(PC, FAME, { tipo: 'ciclaggio-ritardato', quota: 1 });
    const c = campioni(s);
    const insp = c.filter((x) => x.fase === 0);
    expect(Math.min(...insp.map((x) => x.flusso))).toBeLessThan(-2);
    expect(Math.max(...insp.map((x) => x.paw))).toBeGreaterThan(20.5);
  });
  it('the spike is transient: the valve opens and Paw goes back to the target', () => {
    const s = stato(PC, FAME, { tipo: 'ciclaggio-ritardato', quota: 1 });
    const c = campioni(s).filter((x) => x.fase === 0);
    const sopra = c.filter((x) => x.paw > 19 + 2).length * 0.005;
    expect(sopra).toBeLessThan(1);
  });
  it('active expiration is not a cough: expiratory Paw stays near PEEP', () => {
    const s = stato(PC, { ...FAME, espirioAttivo: 1 }, { tipo: 'ciclaggio-ritardato', quota: 1 });
    // past the valve ramp from the inspiratory pressure (the first 150 ms)
    const c = campioni(s);
    let fine = -1;
    const dopo = c.filter((x, i) => { if (x.fase === 2 && i > 0 && c[i - 1].fase !== 2) fine = x.t; return x.fase === 2 && fine > 0 && x.t - fine > 0.15; });
    expect(dopo.length).toBeGreaterThan(100);
    expect(Math.max(...dopo.map((x) => x.paw))).toBeLessThan(7);
  });
});

describe('double cycling in pressure modes', () => {
  for (const triggerControllata of [0, 1]) {
    it(`PC, assist ${triggerControllata ? 'on' : 'off'}: a second breath stacks on the first, without a third in a row`, () => {
      const s = stato({ ...PC, triggerControllata }, { frequenza: 0, intensita: 0.7 }, { tipo: 'doppio-ciclo', quota: 1 });
      const a = attiRecenti(130, s, 30);
      const coppie = a.filter((x, i) => i > 0 && x.inizio - a[i - 1].inizio < 2.2);
      expect(coppie.length).toBeGreaterThanOrEqual(3);
      for (let i = 2; i < a.length; i++) expect(a[i].inizio - a[i - 2].inizio).toBeGreaterThan(2.9);
    });
  }
  it('VC keeps its own double cycling', () => {
    let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
    ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
    const s0 = statoDa(ist);
    const s = { ...s0, impostazioni: { ...s0.impostazioni, volume: 450, frequency: 16, ratio: '1:2' }, drive: { frequenza: 0, intensita: 0.6 }, asincronia: { tipo: 'doppio-ciclo' as const, quota: 1 }, umidificatore: null };
    const a = attiRecenti(100, s, 30);
    expect(a.filter((x, i) => i > 0 && x.inizio - a[i - 1].inizio < 2).length).toBeGreaterThanOrEqual(3);
  });
});

describe('the ready-made case', () => {
  it('PC with long Ti and air hunger: RR above the set rate, VT above 10 ml/kg, end-inspiratory spike', () => {
    const p = SCENARI_PRONTI.find((x) => x.id === 'pc-fame-aria')!;
    const sc = parseScenario(JSON.stringify(p.scenario));
    let ist: any = istantaneaIniziale('invasiva', 0, { pesoKg: 58, etco2: 34, spo2: 95, heartRate: 105, map: 85 });
    ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
    const { azioni } = comandiScenario(sc, ist);
    for (const az of azioni) ist = applica(ist, az, 0).istantanea;
    const s0 = statoDa(ist);
    const s = { ...s0, fisiologia: { ...s0.fisiologia, ...sc.fisiologia }, drive: { ...s0.drive, ...sc.drive }, asincronia: sc.asincronia };
    expect(s.modalita).toBe('PC');
    expect(s.impostazioni.ratio).toBe('1:1');
    const a = attiRecenti(160, s, 20);
    expect(a.length).toBeGreaterThanOrEqual(7);
    const vt = a.reduce((x, y) => x + y.vti, 0) / a.length;
    expect(vt / 58).toBeGreaterThan(10);
    expect(Math.max(...a.map((x) => x.pip))).toBeGreaterThan(20.5);
  });
});
