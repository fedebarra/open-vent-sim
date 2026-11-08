import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, batti, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { prossimaPressione, PRVC_PROVA, PRVC_PASSO } from '../device/screens/scenario/ventilatore/prvc';
import { volumeCorrenteAtteso, polmoneOra } from '../device/screens/scenario/ventilatore/fisica';
import { pressioneAlveolare, pressioneMuscolare } from '../device/screens/scenario/ventilatore/pressioni';
import { puntoOnda } from '../device/screens/scenario/ventilatore/onde';

const avvia = (modalita: any) => {
  let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: null, map: null });
  ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
  ist = applica(ist, { tipo: 'modalita', modalita }, 0).istantanea;
  return ist;
};
const corri = (ist: any, secondi: number, da = 0) => { for (let t = da + 2; t <= da + secondi; t += 2) ist = batti(ist, t, 2); return ist; };
const vt = (ist: any) => volumeCorrenteAtteso(polmoneOra(statoDa(ist)));

describe('PRVC', () => {
  it('a step never exceeds 3 cmH2O and stays within limits', () => {
    expect(prossimaPressione(10, 100, 500, 50)).toBe(10 + PRVC_PASSO);
    expect(prossimaPressione(10, 900, 500, 50)).toBe(10 - PRVC_PASSO);
    expect(prossimaPressione(39, 100, 900, 10)).toBe(40);
    expect(prossimaPressione(6, 900, 100, 10)).toBe(5);
  });
  it('starts from the test breath and converges to the set volume', () => {
    let ist = avvia('PRVC');
    expect(ist.impostazioni.pressureTarget).toBe(PRVC_PROVA);
    const p0 = ist.impostazioni.pressureTarget;
    ist = corri(ist, 120);
    expect(Math.abs(vt(ist) - ist.impostazioni.volume)).toBeLessThan(25);
    expect(ist.impostazioni.pressureTarget).not.toBe(p0);
  });
  it('when compliance falls, pressure rises by itself and the volume is restored', () => {
    let ist = corri(avvia('PRVC'), 120);
    const prima = ist.impostazioni.pressureTarget;
    ist = { ...ist, fisiologia: { ...ist.fisiologia, compliance: ist.fisiologia.compliance / 2 } };
    ist = corri(ist, 120, 120);
    expect(ist.impostazioni.pressureTarget).toBeGreaterThan(prima + 3);
    expect(Math.abs(vt(ist) - ist.impostazioni.volume)).toBeLessThan(40);
  });
  it('PC is untouched by the regulator', () => {
    let ist = avvia('PC');
    const p = ist.impostazioni.pressureTarget;
    ist = corri(ist, 60);
    expect(ist.impostazioni.pressureTarget).toBe(p);
  });
  it('PRVC draws finite waveforms', () => {
    const s = statoDa(corri(avvia('PRVC'), 30));
    for (let t = 30; t < 40; t += 0.05) { const p = puntoOnda(t, s); expect(Number.isFinite(p.paw + p.flusso + p.volume)).toBe(true); }
  });
});

describe('Palv and Pmus', () => {
  it('Palv is below Paw during inspiration and above during expiration', () => {
    const s = statoDa(corri(avvia('VC'), 10));
    let below = 0, above = 0;
    for (let t = 10; t < 20; t += 0.02) {
      const p = puntoOnda(t, s), a = pressioneAlveolare(t, s);
      if (p.flusso > 5 && a < p.paw) below++;
      if (p.flusso < -5 && a > p.paw) above++;
    }
    expect(below).toBeGreaterThan(10);
    expect(above).toBeGreaterThan(10);
  });
  it('Pmus is zero for a passive patient and positive with a drive', () => {
    const ist = corri(avvia('VC'), 10);
    const passivo = statoDa({ ...ist, drive: { frequenza: 0, intensita: 0 } });
    const attivo = statoDa({ ...ist, drive: { frequenza: 15, intensita: 0.6 } });
    let maxA = 0, maxP = 0;
    for (let t = 10; t < 20; t += 0.05) { maxP = Math.max(maxP, pressioneMuscolare(t, passivo)); maxA = Math.max(maxA, pressioneMuscolare(t, attivo)); }
    expect(maxP).toBe(0);
    expect(maxA).toBeGreaterThan(4);
  });
});
