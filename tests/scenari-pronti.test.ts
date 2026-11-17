/**
 * The ready-made literature cases (remote/scenari.ts), loaded as the console
 * loads them and run on the whole ventilator: they must show what the paper shows.
 */
import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, batti, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { PARAMETRI_SCAMBIO, letturaScambio, ingressiDaVentilatore } from '../device/screens/scenario/ventilatore/scambio';
import { SCENARI_PRONTI } from '../remote/scenari';
import { parseScenario } from '../remote/scenario';

function corri(id: string) {
  const p = SCENARI_PRONTI.find((x) => x.id === id)!;
  const sc = parseScenario(JSON.stringify(p.scenario));
  let t = 0;
  let ist: any = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: sc.vitali.etco2, spo2: null, heartRate: 85, map: 80 });
  ist = { ...ist, scambioAttivo: true, fisiologia: { ...ist.fisiologia, ...sc.fisiologia }, drive: { ...ist.drive, ...sc.drive }, parametriScambio: { ...PARAMETRI_SCAMBIO, ...sc.scambio } };
  for (const [k, v] of Object.entries(sc.impostazioni)) ist = applica(ist, { tipo: 'parametro', chiave: k as any, valore: v }, t).istantanea;
  ist = applica(ist, { tipo: 'standby', ventilando: true }, t).istantanea;
  for (let k = 0; k < 900; k += 2) { t += 2; ist = batti(ist, t, 2); }
  return { ...letturaScambio(ist.scambio, ingressiDaVentilatore(statoDa(ist), ist.misure, { spo2: null, etco2: sc.vitali.etco2 })), pplat: ist.misure.pPlateau, crs: ist.misure.compliance };
}

describe('casi dalla letteratura', () => {
  it('ogni caso ha nome, nota e riferimento al lavoro e al caso, e passa il controllo dei file scenario', () => {
    for (const p of SCENARI_PRONTI) {
      expect(p.nome.it && p.nome.en && p.nota.it && p.nota.en).toBeTruthy();
      expect(p.riferimento).toMatch(/doi:10\.\d+\/.+, caso \d\.$/);
      const sc = parseScenario(JSON.stringify(p.scenario));
      expect(sc.fisiologia).toEqual(p.scenario.fisiologia);
      expect(sc.scambio).toEqual(p.scenario.scambio);
    }
  });
  it('ARDS da influenza H1N1: PaCO₂ 48, EtCO₂ 24, Qs 0,27, VD alveolare 0,50', () => {
    const l = corri('ards-h1n1');
    expect(l.paco2).toBeGreaterThan(46.5); expect(l.paco2).toBeLessThan(49.5);
    expect(l.etco2).toBeCloseTo(24, 0); expect(l.qsqt).toBeCloseTo(0.27, 1); expect(l.vdAlveolare!).toBeCloseTo(0.5, 1);
  }, 20000);
  it('ARDS pneumococcica: PaCO₂ 57, EtCO₂ 25, Qs 0,42, VD alveolare 0,56', () => {
    const l = corri('ards-pneumococco');
    expect(l.paco2).toBeGreaterThan(55); expect(l.paco2).toBeLessThan(59);
    expect(l.etco2).toBeCloseTo(25, 0); expect(l.qsqt).toBeCloseTo(0.42, 1); expect(l.vdAlveolare!).toBeCloseTo(0.56, 1);
  }, 20000);
  it('COVID-19, PEEP decrementale, a PEEP 18: Pplat 30, Crs 40, PaCO₂ 46, EtCO₂ 33, Qs 0,15, VD 0,28', () => {
    const l = corri('covid-peep');
    expect(l.pplat).toBeGreaterThan(29); expect(l.pplat).toBeLessThan(31);
    expect(l.crs).toBeGreaterThan(37); expect(l.crs).toBeLessThan(43);
    expect(l.paco2).toBeGreaterThan(44.5); expect(l.paco2).toBeLessThan(47.5);
    expect(l.etco2).toBeCloseTo(33, 0); expect(l.qsqt).toBeCloseTo(0.15, 1); expect(l.vdAlveolare!).toBeCloseTo(0.28, 1);
  }, 20000);
});
