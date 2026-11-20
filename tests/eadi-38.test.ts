import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { campioneEAdi, campioneMotore, letturaEAdi } from '../device/screens/scenario/ventilatore/motore';
import type { StatoVentilatore } from '../device/screens/scenario/ventilatore/fisica';
import type { Drive } from '../device/screens/scenario/ventilatore/asincronie';

function stato(modalita: string, imp: Record<string, unknown>, drive: Drive, fis: Record<string, unknown> = {}): StatoVentilatore {
  let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
  ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
  ist = applica(ist, { tipo: 'modalita', modalita: modalita as never }, 0).istantanea;
  const s = statoDa(ist);
  return {
    ...s,
    impostazioni: { ...s.impostazioni, ...imp },
    fisiologia: { ...s.fisiologia, compliance: 50, resistenza: 10, reclutabilita: 0, limitazioneFlusso: 0, secrezioni: 0, catetereEAdi: 'giusto', ...fis },
    drive,
    asincronia: null,
    umidificatore: null,
  };
}

const PS = { psLevel: 8, peep: 5 };
const picco = (s: StatoVentilatore, t = 100) => letturaEAdi(t, s)!.picco;
const minimo = (s: StatoVentilatore, t = 100) => letturaEAdi(t, s)!.minimo;
/** Il picco del segnale vero: catetere giusto, rumore piccolo. Media su più finestre. */
const piccoMedio = (s: StatoVentilatore) => [100, 120, 140, 160].map((t) => picco(s, t)).reduce((a, b) => a + b, 0) / 4;

describe('EAdi nel motore', () => {
  it('senza catetere non c’è segnale', () => {
    const s = stato('PS', PS, { frequenza: 18, intensita: 0.5 }, { catetereEAdi: null });
    expect(campioneMotore(100, s).eadi).toBeNull();
    expect(letturaEAdi(100, s)).toBeNull();
  });

  it('nell’adulto sotto supporto il picco sta nel range clinico, il minimo sotto un paio di µV', () => {
    const s = stato('PS', PS, { frequenza: 18, intensita: 0.5 });
    const p = piccoMedio(s);
    expect(p).toBeGreaterThan(3);
    expect(p).toBeLessThan(15);
    expect(minimo(s)).toBeLessThan(2);
  });

  it('il picco cresce con lo sforzo', () => {
    expect(piccoMedio(stato('PS', PS, { frequenza: 18, intensita: 0.8 }))).toBeGreaterThan(
      1.5 * piccoMedio(stato('PS', PS, { frequenza: 18, intensita: 0.3 })),
    );
  });

  it('a parità di Pmus, la NME dimezzata raddoppia l’EAdi fasica', () => {
    const d = { frequenza: 18, intensita: 0.6 };
    const a = piccoMedio(stato('PS', PS, d, { nme: 1 })) - minimo(stato('PS', PS, d, { nme: 1 }));
    const b = piccoMedio(stato('PS', PS, d, { nme: 0.5 })) - minimo(stato('PS', PS, d, { nme: 0.5 }));
    expect(b / a).toBeGreaterThan(1.7);
    expect(b / a).toBeLessThan(2.3);
    // e la meccanica non cambia: la Pmus è la stessa
    expect(campioneMotore(101.3, stato('PS', PS, d, { nme: 0.5 })).pmus).toBeCloseTo(campioneMotore(101.3, stato('PS', PS, d, { nme: 1 })).pmus, 6);
  });

  it('il curaro azzera il segnale, la sedazione lo abbassa', () => {
    const curaro = stato('VC', { volume: 500, peep: 5 }, { frequenza: 14, intensita: 0.5, forza: 0 });
    for (let t = 100; t < 110; t += 0.05) expect(campioneMotore(t, curaro).eadi!).toBeLessThan(1.2);
    expect(picco(curaro)).toBeLessThan(1.2);
    const sveglio = piccoMedio(stato('PS', PS, { frequenza: 18, intensita: 0.7 }));
    const sedato = piccoMedio(stato('PS', PS, { frequenza: 10, intensita: 0.2 }));
    expect(sedato).toBeLessThan(sveglio * 0.5);
  });

  it('il frenico spento toglie l’EAdi ma lascia la Pmus degli accessori', () => {
    const d = { frequenza: 18, intensita: 0.6 };
    const leso = stato('PS', PS, d, { lesioneFrenico: 1 });
    expect(picco(leso)).toBeLessThan(1.2);
    let pmus = 0;
    for (let t = 100; t < 106; t += 0.02) pmus = Math.max(pmus, campioneMotore(t, leso).pmus);
    expect(pmus).toBeGreaterThan(1);
    // mezzo frenico: metà dell'EAdi fasica
    const integro = piccoMedio(stato('PS', PS, d));
    const mezzo = piccoMedio(stato('PS', PS, d, { lesioneFrenico: 0.5 }));
    expect(mezzo / integro).toBeGreaterThan(0.4);
    expect(mezzo / integro).toBeLessThan(0.65);
  });

  it('il potenziale arriva prima della forza', () => {
    const s = stato('VC', { volume: 450, peep: 5, triggerControllata: 0 }, { frequenza: 12, intensita: 0.6 });
    // il primo istante in cui l'EAdi passa 1 µV sopra il fondo, e quello in cui la Pmus passa 1 cmH₂O
    let te = -1;
    let tp = -1;
    const base = minimo(s, 100);
    for (let t = 100; t < 106 && (te < 0 || tp < 0); t += 0.005) {
      if (te < 0 && campioneMotore(t, s).eadi! > base + 1) te = t;
      if (tp < 0 && te > 0 && campioneMotore(t, s).pmus > 1) tp = t;
    }
    expect(te).toBeGreaterThan(0);
    expect(tp - te).toBeGreaterThan(0.02);
  });

  it('la tonica sale quando il polmone reclutabile perde la PEEP', () => {
    const d = { frequenza: 18, intensita: 0.5 };
    const aperto = minimo(stato('PS', { psLevel: 8, peep: 12 }, d, { reclutabilita: 0.8, peepMemoria: 12 }));
    const chiuso = minimo(stato('PS', { psLevel: 8, peep: 3 }, d, { reclutabilita: 0.8, peepMemoria: 3 }));
    expect(chiuso).toBeGreaterThan(aperto + 0.5);
  });
});

describe('Il catetere', () => {
  const d = { frequenza: 18, intensita: 0.5 };
  it('troppo superficiale: l’ECG alza il minimo molto sopra il vero', () => {
    expect(minimo(stato('PS', PS, d, { catetereEAdi: 'superficiale' }))).toBeGreaterThan(5);
  });
  it('staccato: picco e minimo quasi coincidono', () => {
    const m = letturaEAdi(100, stato('PS', PS, d, { catetereEAdi: 'staccato' }))!;
    expect(m.picco - m.minimo).toBeLessThan(1);
  });
  it('troppo profondo: il segnale cala, e gli addominali si vedono in espirazione', () => {
    expect(piccoMedio(stato('PS', PS, d, { catetereEAdi: 'profondo' }))).toBeLessThan(piccoMedio(stato('PS', PS, d)));
    const attivo = { ...d, espirioAttivo: 1 };
    const giusto = stato('PS', PS, attivo);
    const profondo = stato('PS', PS, attivo, { catetereEAdi: 'profondo' });
    // a metà espirazione, dove spingono gli addominali
    let g = 0;
    let p = 0;
    for (let t = 100; t < 110; t += 0.02) {
      if (campioneMotore(t, giusto).pmus < -2) {
        g = Math.max(g, campioneMotore(t, giusto).eadi!);
        p = Math.max(p, campioneMotore(t, profondo).eadi!);
      }
    }
    expect(p).toBeGreaterThan(g + 1.5);
  });
});

describe('Senza la macchina', () => {
  it('in standby e in alto flusso il segnale c’è lo stesso, ed è lo stesso paziente', () => {
    const d = { frequenza: 18, intensita: 0.5 };
    const s = stato('PS', PS, d);
    const fermo: StatoVentilatore = { ...s, ventilando: false };
    const af: StatoVentilatore = { ...s, ambiente: 'alto-flusso', modalita: 'AF' as never };
    for (const x of [fermo, af]) {
      expect(campioneEAdi(100, x)).not.toBeNull();
      const m = letturaEAdi(100, x)!;
      expect(m.picco).toBeGreaterThan(3);
      expect(m.minimo).toBeLessThan(2);
    }
    // lo stesso istante, due volte: lo stesso numero
    expect(campioneEAdi(123.456, fermo)).toBe(campioneEAdi(123.456, fermo));
  });
});

import { misura } from '../device/screens/scenario/ventilatore/fisica';
import { misureVisibili } from '../device/screens/scenario/ventilatore/parametri';
import { gruppiMonitoraggio } from '../device/screens/scenario/ventilatore/pannello';
import { comandiScenario, parseScenario, scenarioDa } from '../remote/scenario';

describe('Sul display e nei file', () => {
  const d = { frequenza: 18, intensita: 0.5 };
  it('picco e minimo arrivano alle misure, anche a macchina ferma; senza catetere no', () => {
    const s = stato('PS', PS, d);
    for (const x of [s, { ...s, ventilando: false }, { ...s, ambiente: 'alto-flusso' as const, modalita: 'AF' as never }]) {
      const m = misura(x, 100, 2, null);
      expect(m.eadiPicco).toBeGreaterThan(3);
      expect(m.eadiMin).not.toBeNull();
    }
    expect(misura(stato('PS', PS, d, { catetereEAdi: null }), 100, 2, null).eadiPicco).toBeNull();
  });
  it('le tessere si vedono solo con il catetere, nel gruppo del diaframma', () => {
    const ctx = { ambiente: 'invasiva' as const, modalita: 'VC' as const, respiro: 'automatico' as never, impostazioni: stato('VC', {}, d).impostazioni };
    expect(misureVisibili(ctx)).not.toContain('eadiPicco');
    expect(misureVisibili({ ...ctx, catetereEAdi: true })).toEqual(expect.arrayContaining(['eadiPicco', 'eadiMin']));
    expect(gruppiMonitoraggio({ ...ctx, catetereEAdi: true }).find((g) => g.titolo === 'vent.group.diaframma')?.chiavi).toEqual(['eadiPicco', 'eadiMin']);
  });
  it('lo scenario salvato si porta dietro catetere, NME e frenico; uno senza catetere lo toglie', () => {
    let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
    ist = { ...ist, fisiologia: { ...ist.fisiologia, catetereEAdi: 'superficiale', nme: 0.4, lesioneFrenico: 0.5 } };
    const sc = parseScenario(JSON.stringify(scenarioDa(ist, 'x')));
    expect(sc.fisiologia).toMatchObject({ catetereEAdi: 'superficiale', nme: 0.4, lesioneFrenico: 0.5 });
    const vecchio = scenarioDa(ist, 'y') as any;
    delete vecchio.fisiologia.catetereEAdi;
    expect(parseScenario(JSON.stringify(vecchio)).fisiologia.catetereEAdi).toBeUndefined();
    expect(comandiScenario(parseScenario(JSON.stringify(vecchio)), ist).paziente.fisiologia?.catetereEAdi).toBeNull();
    const strano = scenarioDa(ist, 'z') as any;
    strano.fisiologia.catetereEAdi = 'in-bocca';
    expect(parseScenario(JSON.stringify(strano)).fisiologia.catetereEAdi).toBeUndefined();
    expect(comandiScenario(sc, ist).paziente.fisiologia?.catetereEAdi).toBe('superficiale');
  });
});
