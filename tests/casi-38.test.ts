/**
 * The 3.8 ready cases (remote/scenari.ts) loaded as the console loads them —
 * the patient first, then the machine — and run: each must show what its note says.
 */
import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, batti, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { attiRecenti, letturaEAdi } from '../device/screens/scenario/ventilatore/motore';
import { misura } from '../device/screens/scenario/ventilatore/fisica';
import { derivazioni, derivazioniForti, profonditaGiusta, calibroPerPeso } from '../device/screens/scenario/ventilatore/catetere';
import { SCENARI_PRONTI } from '../remote/scenari';
import { comandiScenario, parseScenario } from '../remote/scenario';
import { rox } from '../remote/rox';

function carica(id: string) {
  const p = SCENARI_PRONTI.find((x) => x.id === id)!;
  const sc = parseScenario(JSON.stringify(p.scenario));
  let ist: any = istantaneaIniziale(sc.ambiente, 0, { pesoKg: 70, etco2: sc.vitali.etco2, spo2: sc.vitali.spo2, heartRate: sc.vitali.heartRate, map: sc.vitali.map });
  const c = comandiScenario(sc, ist);
  ist = { ...ist, fisiologia: { ...ist.fisiologia, ...c.paziente.fisiologia }, drive: { ...ist.drive, ...c.paziente.drive }, asincronia: c.paziente.asincronia };
  for (const a of c.azioni) ist = applica(ist, a, 0).istantanea;
  return applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
}
const media = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
const ti = (s: any) => media(attiRecenti(120, s, 30).map((a) => a.fineInsp - a.inizio));
const picco = (s: any) => media([100, 120, 140].map((t) => letturaEAdi(t, s)!.picco));

describe('i casi 3.8', () => {
  it('NEURO, titolazione: si carica in NEURO; alzando il livello l’EAdi scende e il VT sale', () => {
    const ist = carica('neuro-titolazione');
    expect(ist.modalita).toBe('NEURO');
    const s = statoDa(ist);
    const basso = { e: picco(s), vt: media(attiRecenti(120, s, 30).map((a) => a.vti)) };
    expect(basso.e).toBeGreaterThan(6);
    const alto = { ...s, impostazioni: { ...s.impostazioni, livelloNeuro: 1.5 } };
    expect(picco(alto)).toBeLessThan(basso.e * 0.8);
    expect(media(attiRecenti(120, alto, 30).map((a) => a.vti))).toBeGreaterThan(basso.vt * 1.2);
  });

  it('BPCO in NIV con perdita: la PS cicla tardi; NEURO no, e apre col diaframma', () => {
    const ist = carica('niv-bpco-perdita');
    expect(ist.ambiente).toBe('niv');
    expect(ist.modalita).toBe('PS');
    const ps = statoDa(ist);
    const neuro = statoDa(applica(ist, { tipo: 'modalita', modalita: 'NEURO' }, 0).istantanea);
    expect(neuro.modalita).toBe('NEURO');
    expect(ti(ps)).toBeGreaterThan(ti(neuro) * 1.5);
    expect(attiRecenti(120, neuro, 30).every((a) => a.apertura === 'neurale')).toBe(true);
    // con l'auto-PEEP la Palv parte sopra la Paw: non è il paziente che spinge, un atto per sforzo
    expect(attiRecenti(120, neuro, 20).length).toBeGreaterThanOrEqual(7);
    expect(attiRecenti(120, neuro, 20).length).toBeLessThanOrEqual(9);
  });

  it('alto flusso: ROX intorno a 5,5; la cannula fuori dal naso fa desaturare in silenzio', () => {
    let ist: any = carica('af-cannula');
    expect(ist.ambiente).toBe('alto-flusso');
    expect(rox(92, ist.impostazioni.fio2, ist.drive.frequenza)).toBeCloseTo(5.5, 1);
    ist = { ...ist, scambioAttivo: true };
    for (let t = 2; t <= 120; t += 2) ist = batti(ist, t, 2);
    const prima = ist.misure.spo2;
    ist = { ...ist, fisiologia: { ...ist.fisiologia, cannulaAF: 'dislocata' } };
    for (let t = 122; t <= 420; t += 2) ist = batti(ist, t, 2);
    expect(ist.misure.spo2).toBeLessThan(prima - 4);
    expect(ist.allarmi).toEqual([]);
  }, 20000);

  it('catetere alla regola: legge superficiale, il diaframma nelle derivazioni basse; due passi dentro e torna al centro', () => {
    let ist = carica('catetere-nex');
    const f = ist.fisiologia;
    expect(f.catetereCm).toBe(63);
    expect(f.catetereEAdi).toBe('superficiale');
    const giusta = profonditaGiusta(f, 70);
    expect(giusta).toBe(65.5);
    expect(derivazioniForti(derivazioni(f.catetereCm!, giusta, calibroPerPeso(70)))).toContain(3);
    for (let i = 0; i < 2; i++) ist = applica(ist, { tipo: 'catetere', cm: ist.fisiologia.catetereCm! + 1.6 }, 0).istantanea;
    expect(ist.fisiologia.catetereEAdi).toBe('giusto');
    expect(derivazioniForti(derivazioni(ist.fisiologia.catetereCm!, giusta, calibroPerPeso(70)))).toEqual([1, 2]);
  });

  it('svezzamento difficile: in PS l’EAdi picco passa 15 µV; in NEURO scende', () => {
    const ist = carica('svezzamento-eadi');
    const ps = statoDa(ist);
    expect(misura(ps, 120, 2, null).eadiPicco!).toBeGreaterThan(15);
    const neuro = statoDa(applica(ist, { tipo: 'modalita', modalita: 'NEURO' }, 0).istantanea);
    expect(picco(neuro)).toBeLessThan(picco(ps));
  });
});
