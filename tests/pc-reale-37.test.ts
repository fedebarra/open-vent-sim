/**
 * Pressure control on a real machine: the pressure controller lags behind the
 * patient, a patient who pushes during a time-cycled breath sends gas back
 * through the expiratory valve, double cycling works in pressure modes, and
 * active expiration is not mistaken for a cough.
 */
import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, statoDa, conVentilazioneDelloScenario } from '../device/screens/scenario/ventilatore/istantanea';
import { campioneMotore, attiRecenti } from '../device/screens/scenario/ventilatore/motore';
import type { StatoVentilatore } from '../device/screens/scenario/ventilatore/fisica';
import { SCENARI_PRONTI } from '../remote/scenari';
import { PRESET_ASINCRONIA } from '../device/screens/scenario/ventilatore/asincronie';
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
    const atti = attiRecenti(115, s, 15).length;
    // above target + 2 for less than half a second per breath: a spike, not a new plateau
    const sopra = c.filter((x) => x.paw > 19 + 2).length * 0.005;
    expect(sopra / atti).toBeLessThan(0.5);
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
    expect(Math.max(...a.map((x) => x.pip))).toBeGreaterThan(23);
  });
});

describe('settings written in a scenario', () => {
  it('PC 14 above PEEP, Ti 1.5 s at RR 20 is I:E 1:1 with rise 0', () => {
    const ist = conVentilazioneDelloScenario(istantaneaIniziale('invasiva', 0), { mode: 'pressometrica', rate: 20, peep: 5, inspiratory_pressure_cmh2o: 14, inspiratory_time_s: 1.5, rise_time_s: 0 });
    expect(ist.modalita).toBe('PC');
    expect(ist.impostazioni.pressureTarget).toBe(14);
    expect(ist.impostazioni.ratio).toBe('1:1');
    expect(ist.impostazioni.inspiratoryRiseTimeSeconds).toBe(0);
  });
  it('in pressure support the written level is the support', () => {
    const ist = conVentilazioneDelloScenario(istantaneaIniziale('invasiva', 0), { mode: 'pressione di supporto', inspiratory_pressure_cmh2o: 10 });
    expect(ist.modalita).toBe('PS');
    expect(ist.impostazioni.psLevel).toBe(10);
  });
  it('the console preset "pushing to get out" is the ready-made case patient', () => {
    const p = SCENARI_PRONTI.find((x) => x.id === 'pc-fame-aria')!;
    expect(PRESET_ASINCRONIA['spinge-per-uscire'].drive).toEqual(p.scenario.drive);
    expect(PRESET_ASINCRONIA['spinge-per-uscire'].asincronia).toEqual(p.scenario.asincronia);
  });
});

describe('more than one asynchrony at once', () => {
  it('the quotas share the breaths without overlapping', async () => {
    const { asincroniaDellAtto, elencoAsincronie, attoAsincrono } = await import('../device/screens/scenario/ventilatore/asincronie');
    const el = elencoAsincronie({ tipo: 'ciclaggio-ritardato', quota: 0.5, insieme: [{ tipo: 'doppio-ciclo', quota: 0.25 }] });
    const conta: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) { const v = asincroniaDellAtto(i, el, 7); conta[v?.tipo ?? '-'] = (conta[v?.tipo ?? '-'] ?? 0) + 1; }
    expect(conta['ciclaggio-ritardato'] / 4000).toBeCloseTo(0.5, 1);
    expect(conta['doppio-ciclo'] / 4000).toBeCloseTo(0.25, 1);
    // one asynchrony alone is exactly the old behaviour
    const sola = { tipo: 'doppio-ciclo' as const, quota: 0.3 };
    for (let i = 0; i < 500; i++) expect(asincroniaDellAtto(i, elencoAsincronie(sola), 3) !== null).toBe(attoAsincrono(i, sola, 3));
  });
  it('duplicates and zero quotas are dropped', async () => {
    const { elencoAsincronie } = await import('../device/screens/scenario/ventilatore/asincronie');
    expect(elencoAsincronie({ tipo: 'doppio-ciclo', quota: 0.3, insieme: [{ tipo: 'doppio-ciclo', quota: 0.2 }, { tipo: 'auto-trigger', quota: 0 }] })).toEqual([{ tipo: 'doppio-ciclo', quota: 0.3 }]);
  });
  it('delayed cycling and double cycling on the same patient: both show up in the same minute', () => {
    const s = stato(PC, { ...FAME, intensita: 0.9, espirioAttivo: 0.8 }, { tipo: 'ciclaggio-ritardato', quota: 0.5, insieme: [{ tipo: 'doppio-ciclo', quota: 0.25 }] });
    const a = [100, 120, 140].flatMap((T) => attiRecenti(T + 20, s, 20));
    const coppie = a.filter((x, i) => i > 0 && x.inizio - a[i - 1].inizio < 2.2 && x.inizio - a[i - 1].inizio > 0.5).length;
    expect(coppie).toBeGreaterThanOrEqual(2);
    const spinte = a.filter((x) => x.pip > 21.5 && x.pip < 24.5).length;
    expect(spinte).toBeGreaterThanOrEqual(4);
    expect(Math.max(...a.map((x) => x.pip))).toBeLessThan(29);
  });
  it('the measured rate counts both', async () => {
    const { frequenzaErogata } = await import('../device/screens/scenario/ventilatore/fisica');
    const base = stato(PC, PASSIVO, null);
    const uno = stato(PC, PASSIVO, { tipo: 'doppio-ciclo', quota: 0.25 });
    const due = stato(PC, PASSIVO, { tipo: 'sforzo-inefficace', quota: 0.5, insieme: [{ tipo: 'doppio-ciclo', quota: 0.25 }] });
    expect(frequenzaErogata(uno)).toBeCloseTo(frequenzaErogata(base) * 1.25, 5);
    expect(frequenzaErogata(due)).toBeCloseTo(frequenzaErogata(base) * 1.25, 5);
  });
  it('a scenario file keeps the second asynchrony', () => {
    const p = SCENARI_PRONTI.find((x) => x.id === 'pc-fame-aria')!;
    const sc = parseScenario(JSON.stringify(p.scenario));
    expect(sc.asincronia).toEqual({ tipo: 'ciclaggio-ritardato', quota: 0.5, insieme: [{ tipo: 'doppio-ciclo', quota: 0.25 }] });
    const rotto = parseScenario(JSON.stringify({ ...p.scenario, asincronia: { tipo: 'doppio-ciclo', quota: 0.3, insieme: 'x' } }));
    expect(rotto.asincronia).toEqual({ tipo: 'doppio-ciclo', quota: 0.3 });
  });
});

describe('assist-control: the asynchronies follow the patient', () => {
  it('delayed cycling on every breath: every breath opened by the patient, flow reversing inside each inspiration', () => {
    const s = stato(PC, FAME, { tipo: 'ciclaggio-ritardato', quota: 1 });
    const a = attiRecenti(120, s, 20);
    expect(a.every((x) => x.innescato)).toBe(true);
    expect(60 / ((a.at(-1)!.inizio - a[0].inizio) / (a.length - 1))).toBeGreaterThan(21);
    for (const x of a.slice(1, -1)) {
      let minimo = 0;
      for (let t = x.inizio + 0.3; t < x.fineInsp; t += 0.005) minimo = Math.min(minimo, campioneMotore(t, s).flusso);
      expect(minimo).toBeLessThan(-5);
    }
  });
  it('letting go of an expiratory push does not open a breath', () => {
    const s = stato(PC, { ...FAME, frequenza: 12 }, { tipo: 'ciclaggio-ritardato', quota: 1 });
    const a = attiRecenti(120, s, 20);
    // patient at 12/min, machine at 20/min: the mandatory breaths fill in, no extra ones
    expect(a.length).toBeLessThanOrEqual(8);
  });
});
