/**
 * OVS 3.4 — la tosse sulla macchina dalla regia (dal Scenario Creator, §674): il colpo spinge la Paw, la macchina la
 * taglia al limite alto della pressione di picco e suona l'allarme; finito l'accesso la Paw torna alla PEEP.
 */
import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, batti, conTosse, statoDa, type VentIstantanea } from '../device/screens/scenario/ventilatore/istantanea';
import { campioneMotore } from '../device/screens/scenario/ventilatore/motore';

function base(): VentIstantanea {
  let ist = istantaneaIniziale('anestesia', 0, { pesoKg: 75, etco2: 38, spo2: 98, heartRate: 80, map: 80 });
  ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
  ist = applica(ist, { tipo: 'respiro', respiro: 'meccanica' }, 0).istantanea;
  return applica(ist, { tipo: 'modalita', modalita: 'VC' as never }, 0).istantanea;
}

describe('la tosse sulla macchina', () => {
  const ist = base();
  const conColpi = conTosse(ist, { n: 7, colpi: 4, da: 30000 }, 30000);
  const st = statoDa(conColpi);
  const tossi = conColpi.tossi!;
  const paw = (t: number, s = st) => campioneMotore(t, s).paw;
  const picco = (a: number, b: number, s = st) => { let m = -1e9; for (let t = a; t <= b; t += 0.005) m = Math.max(m, paw(t, s)); return m; };
  const limite = st.pressioneMassima!;

  it('un accesso è di quattro colpi, sempre più deboli, nel tempo del ventilatore', () => {
    expect(tossi.length).toBe(4);
    tossi.forEach((c, i) => { if (i) expect(c.forza).toBeLessThan(tossi[i - 1].forza); });
    expect(tossi[0].t).toBeGreaterThan(30);
    expect(tossi[3].t).toBeLessThan(33);
  });

  it('il colpo forte arriva al limite alto e lo passa di poco', () => {
    expect(limite).toBe(conColpi.limiti.pPeak.alto);
    const p1 = picco(tossi[0].t - 0.05, tossi[0].t + 0.4);
    expect(p1).toBeGreaterThan(limite);
    expect(p1).toBeLessThanOrEqual(limite + 2);
  });

  it('flusso espiratorio di colpo, e la Paw non resta sotto zero dopo', () => {
    const fl = Math.min(...Array.from({ length: 80 }, (_, i) => campioneMotore(tossi[0].t + i * 0.005, st).flusso));
    expect(fl).toBeLessThan(-80);
    const minimo = Math.min(...Array.from({ length: 200 }, (_, i) => paw(tossi[3].t + 0.5 + i * 0.01)));
    expect(minimo).toBeGreaterThan(-3);
  });

  it('senza colpi la curva non cambia', () => {
    const senza = statoDa(ist);
    expect(Math.abs(picco(30, 33, senza) - picco(20, 23, senza))).toBeLessThan(1);
  });

  it("l'allarme di pressione suona entro un secondo dal colpo, e poi si spegne", () => {
    let b = conColpi;
    const visti: [number, boolean, number | null][] = [];
    for (let t = 20; t <= 45; t += 1) {
      b = batti(b, t, 1);
      visti.push([t, b.allarmi.some((a) => a.chiave === 'pPeak' && a.verso === 'alto'), b.misure.pPeak ?? null]);
    }
    const primo = visti.find(([, a]) => a);
    expect(primo).toBeDefined();
    expect(primo![0]).toBeLessThanOrEqual(Math.ceil(tossi[0].t) + 1);
    expect(visti.filter(([t]) => t < 30).every(([, a]) => !a)).toBe(true);
    expect(visti.at(-1)![1]).toBe(false);
    expect(Math.max(...visti.map(([, , p]) => p ?? 0))).toBeGreaterThan(limite);
  });
});
