import { describe, it, expect } from 'vitest';
import {
  CALIBRI, calibroPerPeso, catetereA, catetereMontato, derivazioni, derivazioniForti, letturaDaProfondita,
  nexPerPeso, profonditaCalcolata, profonditaGiusta,
} from '../device/screens/scenario/ventilatore/catetere';
import { creaEcgEsofageo } from '../device/screens/scenario/ventilatore/ecgEsofageo';
import { istantaneaIniziale, applica, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { attiRecenti } from '../device/screens/scenario/ventilatore/motore';
import { parseScenario, scenarioDa } from '../remote/scenario';

const ADULTO = CALIBRI[0];

describe('La profondità di partenza', () => {
  it('NEX × 0,9 + costante dal naso, × 0,8 dalla bocca', () => {
    expect(profonditaCalcolata(50, 'nasale', ADULTO)).toBe(63);
    expect(profonditaCalcolata(50, 'orale', ADULTO)).toBe(58);
    expect(profonditaCalcolata(40, 'nasale', CALIBRI[1])).toBe(51);
  });
  it('il calibro e la NEX seguono il peso: adulto, bambino, piccolo', () => {
    expect(calibroPerPeso(70).nome).toBe('16 Fr');
    expect(calibroPerPeso(20).nome).toBe('12 Fr');
    expect(calibroPerPeso(8).nome).toBe('8 Fr');
    expect(nexPerPeso(70)).toBeGreaterThan(45);
    expect(nexPerPeso(70)).toBeLessThan(56);
    expect(nexPerPeso(12)).toBeLessThan(nexPerPeso(70));
  });
});

describe('La lettura dalla profondità', () => {
  it('entro un passo è giusto; oltre, profondo o superficiale; oltre cinque, il diaframma non si vede', () => {
    const g = 63;
    expect(letturaDaProfondita(g + 1.5, g, ADULTO)).toBe('giusto');
    expect(letturaDaProfondita(g + 3.2, g, ADULTO)).toBe('profondo');
    expect(letturaDaProfondita(g - 3.2, g, ADULTO)).toBe('superficiale');
    expect(letturaDaProfondita(g - 9, g, ADULTO)).toBe('staccato');
  });
  it('la regia monta il catetere a una profondità vera', () => {
    const fis = { nexCm: 50 };
    expect(catetereMontato('giusto', fis, 70)).toEqual({ catetereCm: 63, catetereEAdi: 'giusto' });
    expect(catetereMontato('profondo', fis, 70)).toEqual({ catetereCm: 67.8, catetereEAdi: 'profondo' });
    expect(catetereMontato('superficiale', fis, 70).catetereEAdi).toBe('superficiale');
    expect(catetereMontato('staccato', fis, 70).catetereEAdi).toBe('staccato');
    // la via conta: dalla bocca la profondità giusta è più corta
    expect(profonditaGiusta({ nexCm: 50, catetereVia: 'orale' }, 70)).toBe(58);
  });
});

describe('Le quattro derivazioni', () => {
  it('a posto: il diaframma nelle due di mezzo; P grandi in alto, assenti in basso', () => {
    const dv = derivazioni(63, 63, ADULTO);
    expect(derivazioniForti(dv)).toEqual([1, 2]);
    expect(dv[0].p).toBeGreaterThan(0.4);
    expect(dv[3].p).toBe(0);
    expect(dv[0].qrs).toBeGreaterThan(dv[3].qrs);
  });
  it('troppo dentro: il diaframma sale sulle alte (si tira); troppo fuori: scende sulle basse (si spinge)', () => {
    expect(derivazioniForti(derivazioni(63 + 3 * 1.6, 63, ADULTO))).toContain(0);
    expect(derivazioniForti(derivazioni(63 - 3 * 1.6, 63, ADULTO))).toContain(3);
  });
  it('fuori portata: nessuna derivazione si accende', () => {
    expect(derivazioniForti(derivazioni(63 - 11, 63, ADULTO))).toEqual([]);
  });
});

describe('L’ECG esofageo', () => {
  const dv = derivazioni(63, 63, ADULTO);
  it('le quattro battono insieme, con la R sui multipli del periodo', () => {
    const ecg = creaEcgEsofageo(dv, 75);
    const periodo = 60 / 75;
    for (let n = 2; n < 6; n++) {
      const t = n * periodo;
      for (let k = 0; k < 4; k++) {
        const v = ecg.at(k, t);
        expect(v).toBeGreaterThan(ecg.at(k, t - 0.03));
        expect(v).toBeGreaterThan(ecg.at(k, t + 0.03));
      }
    }
  });
  it('in alto la P supera il QRS; in basso la P non c’è', () => {
    const ecg = creaEcgEsofageo(dv, 60);
    let pAlta = 0, rAlta = 0, pBassa = 0;
    for (let t = 2.6; t < 2.9; t += 0.002) pAlta = Math.max(pAlta, ecg.at(0, t)), pBassa = Math.max(pBassa, Math.abs(ecg.at(3, t)));
    for (let t = 2.97; t < 3.03; t += 0.002) rAlta = Math.max(rAlta, ecg.at(0, t));
    expect(pAlta).toBeGreaterThan(rAlta);
    expect(pBassa).toBeLessThan(0.05);
  });
  it('deterministico', () => {
    const a = creaEcgEsofageo(dv, 80);
    const b = creaEcgEsofageo(dv, 80);
    for (let t = 0; t < 5; t += 0.137) expect(a.at(2, t)).toBe(b.at(2, t));
  });
});

describe('Il discente sposta il catetere', () => {
  const base = () => {
    let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
    ist = { ...ist, fisiologia: { ...ist.fisiologia, ...catetereMontato('profondo', {}, 70) }, drive: { frequenza: 18, intensita: 0.6 } };
    ist = applica(ist, { tipo: 'modalita', modalita: 'NEURO' }, 0).istantanea;
    return applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
  };
  it('tre passi indietro dal troppo profondo: la lettura torna giusta', () => {
    let ist = base();
    expect(ist.fisiologia.catetereEAdi).toBe('profondo');
    for (let i = 0; i < 3; i++) ist = applica(ist, { tipo: 'catetere', cm: ist.fisiologia.catetereCm! - 1.6 }, 0).istantanea;
    expect(ist.fisiologia.catetereEAdi).toBe('giusto');
  });
  it('sfilato: la macchina ripiega; reinserito alla profondità calcolata, NEURO torna', () => {
    let ist = base();
    ist = { ...ist, fisiologia: { ...ist.fisiologia, ...catetereMontato('staccato', ist.fisiologia, 70) } };
    expect(attiRecenti(120, statoDa(ist), 30).every((a) => a.ripiego)).toBe(true);
    const giusta = profonditaGiusta(ist.fisiologia, 70);
    ist = applica(ist, { tipo: 'catetere', cm: giusta, via: 'nasale' }, 0).istantanea;
    expect(ist.fisiologia.catetereEAdi).toBe('giusto');
    expect(attiRecenti(120, statoDa(ist), 30).filter((a) => a.apertura === 'neurale').length).toBeGreaterThan(5);
  });
  it('senza catetere montato non si sposta niente', () => {
    const ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
    expect(applica(ist, { tipo: 'catetere', cm: 60 }, 0).istantanea.fisiologia.catetereCm).toBeUndefined();
  });
  it('la profondità resta nei limiti', () => {
    expect(catetereA(500, {}, 70).catetereCm).toBe(90);
  });
  it('lo scenario salvato si porta dietro profondità, NEX e via', () => {
    let ist = base();
    ist = { ...ist, fisiologia: { ...ist.fisiologia, nexCm: 48, catetereVia: 'orale' } };
    const sc = parseScenario(JSON.stringify(scenarioDa(ist, 'x')));
    expect(sc.fisiologia).toMatchObject({ catetereCm: ist.fisiologia.catetereCm, nexCm: 48, catetereVia: 'orale' });
  });
});
