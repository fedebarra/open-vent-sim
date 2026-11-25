import { describe, it, expect } from 'vitest';
import { forzaSoffio, timbroSoffio, faseDa, scattoFra, MOTIVI, type FaseRespiro } from '../device/screens/scenario/ventilatore/suono';

describe('il suono del respiro', () => {
  it('è muto a flusso zero, cresce col flusso, e l’espirazione è più piano', () => {
    expect(forzaSoffio(0)).toBe(0);
    expect(forzaSoffio(NaN)).toBe(0);
    expect(forzaSoffio(60)).toBeGreaterThan(forzaSoffio(30));
    expect(forzaSoffio(-40)).toBeLessThan(forzaSoffio(40));
    expect(forzaSoffio(500)).toBeLessThanOrEqual(1);
    expect(timbroSoffio(60)).toBeGreaterThan(timbroSoffio(10));
  });
  it('un atto fa due scatti, e il rumore attorno allo zero nessuno', () => {
    const conta = (flussi: number[]) => {
      let f: FaseRespiro = 'ferma', n = 0;
      for (const x of flussi) { const g = faseDa(x, f); if (scattoFra(f, g) > 0) n++; f = g; }
      return n;
    };
    expect(conta([0, 40, 40, 40, -60, -30, -10, -3, -1, 0, 0])).toBe(2);
    expect(conta([0, 3, -3, 4, -5, 2, 0, 5, -4])).toBe(0);
    // con la pausa: insufflazione, chiusura, apertura dell'espirazione
    expect(conta([0, 40, 40, 0, 0, -60, -20, 0])).toBe(3);
  });
  it('il rosso insiste più del giallo', () => {
    expect(MOTIVI.rosso.ogni).toBeLessThan(MOTIVI.giallo.ogni);
    for (const m of Object.values(MOTIVI)) {
      const fine = Math.max(...m.note.map(([i, d]) => i + d));
      expect(fine).toBeLessThan(m.ogni);
      expect(m.note.every(([, d]) => d > 0.06)).toBe(true);
    }
  });
});
