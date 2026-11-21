import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { attiRecenti, campioneMotore, letturaEAdi } from '../device/screens/scenario/ventilatore/motore';
import { impostazioniVisibili, MODALITA_PER_AMBIENTE, modalitaDisponibile } from '../device/screens/scenario/ventilatore/parametri';
import { misura, type StatoVentilatore } from '../device/screens/scenario/ventilatore/fisica';
import { valuta, LIMITI_INIZIALI } from '../device/screens/scenario/ventilatore/allarmi';
import { puntoOnda } from '../device/screens/scenario/ventilatore/onde';
import { attivitaDiaframma } from '../device/screens/scenario/ventilatore/pressioni';
import type { Drive } from '../device/screens/scenario/ventilatore/asincronie';

function stato(imp: Record<string, unknown>, drive: Drive, fis: Record<string, unknown> = {}): StatoVentilatore {
  let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
  ist = { ...ist, fisiologia: { ...ist.fisiologia, catetereEAdi: 'giusto' } };
  ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
  ist = applica(ist, { tipo: 'modalita', modalita: 'NEURO' }, 0).istantanea;
  const s = statoDa(ist);
  return {
    ...s,
    impostazioni: { ...s.impostazioni, peep: 5, ...imp },
    fisiologia: { ...s.fisiologia, compliance: 50, resistenza: 10, reclutabilita: 0, limitazioneFlusso: 0, secrezioni: 0, catetereEAdi: 'giusto', ...fis },
    drive,
    asincronia: null,
    umidificatore: null,
  };
}
const media = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
const D = { frequenza: 20, intensita: 0.6 };

describe('NEURO: la modalità', () => {
  it('c’è nell’invasiva e si sceglie solo con il catetere', () => {
    expect(MODALITA_PER_AMBIENTE.invasiva).toContain('NEURO');
    expect(modalitaDisponibile('NEURO', {})).toBe(false);
    expect(modalitaDisponibile('NEURO', { catetereEAdi: 'giusto' })).toBe(true);
    expect(modalitaDisponibile('PS', {})).toBe(true);
    let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
    expect(applica(ist, { tipo: 'modalita', modalita: 'NEURO' }, 0).istantanea.modalita).not.toBe('NEURO');
    ist = { ...ist, fisiologia: { ...ist.fisiologia, catetereEAdi: 'giusto' } };
    expect(applica(ist, { tipo: 'modalita', modalita: 'NEURO' }, 0).istantanea.modalita).toBe('NEURO');
  });
  it('si regolano livello, trigger EAdi, PEEP, il supporto di ripiego e il backup; non la frequenza', () => {
    const s = stato({}, D);
    const k = impostazioniVisibili({ ambiente: 'invasiva', modalita: 'NEURO', respiro: s.respiro, impostazioni: s.impostazioni });
    expect(k).toEqual(expect.arrayContaining(['livelloNeuro', 'triggerEAdi', 'peep', 'fio2', 'psLevel', 'triggerFlow', 'backupPressure', 'backupFrequency']));
    expect(k).not.toContain('frequency');
  });
});

describe('NEURO: il motore', () => {
  it('Ppicco ≈ PEEP + livello × (EAdi picco − EAdi min), entro 1,5 cmH₂O', () => {
    for (const L of [0.5, 1, 2]) {
      const s = stato({ livelloNeuro: L }, D);
      const atti = attiRecenti(120, s, 40);
      const e = letturaEAdi(120, s)!;
      expect(Math.abs(media(atti.map((a) => a.pip)) - (5 + L * (e.picco - e.minimo)))).toBeLessThan(1.5);
    }
  });
  it('con il catetere giusto gli atti li apre il diaframma, prima del trigger pneumatico', () => {
    const atti = attiRecenti(120, stato({ livelloNeuro: 1 }, D), 40);
    expect(atti.length).toBeGreaterThan(5);
    expect(atti.filter((a) => a.apertura === 'neurale').length / atti.length).toBeGreaterThan(0.9);
    expect(atti.every((a) => !a.ripiego)).toBe(true);
  });
  it('la Paw segue l’EAdi e cicla sulla sua discesa', () => {
    const s = stato({ livelloNeuro: 1 }, D);
    const a = attiRecenti(120, s, 20).find((x) => x.apertura === 'neurale')!;
    let picco = { t: 0, e: 0 };
    for (let t = a.inizio; t < a.fineInsp; t += 0.005) {
      const c = campioneMotore(t, s);
      if (c.eadi! > picco.e) picco = { t, e: c.eadi! };
    }
    // il ciclaggio arriva dopo il picco dell'EAdi, e quando l'EAdi è scesa sotto l'80% del picco
    expect(a.fineInsp).toBeGreaterThan(picco.t);
    expect(campioneMotore(a.fineInsp, s).eadi!).toBeLessThan(picco.e * 0.8);
  });
  it('il tetto: limite alto della pressione meno cinque', () => {
    const s = { ...stato({ livelloNeuro: 5 }, { frequenza: 20, intensita: 1 }), pressioneMassima: 30 };
    const atti = attiRecenti(120, s, 30);
    expect(Math.max(...atti.map((a) => a.pip))).toBeLessThanOrEqual(25.5);
    expect(atti.some((a) => a.tettoNeuro)).toBe(true);
  });
  it('catetere dislocato o tolto: la macchina ripiega sul supporto di pressione', () => {
    for (const fis of [{ catetereEAdi: 'staccato' }, { catetereEAdi: null }]) {
      const atti = attiRecenti(120, stato({ livelloNeuro: 1, psLevel: 8 }, D, fis), 30);
      expect(atti.length).toBeGreaterThan(5);
      expect(atti.every((a) => a.ripiego && a.apertura === 'pneumatico')).toBe(true);
    }
  });
  it('col curaro: niente segnale né trigger, entra il backup', () => {
    const atti = attiRecenti(120, stato({ livelloNeuro: 1, backupFrequency: 12 }, { ...D, forza: 0 }), 30);
    expect(atti.length).toBeGreaterThan(3);
    expect(atti.every((a) => a.apertura === 'macchina')).toBe(true);
  });
  it('titolazione: alzando il livello l’EAdi scende e il volume sale (paziente che scarica)', () => {
    const r = [0.3, 1, 3].map((L) => {
      const s = stato({ livelloNeuro: L }, { ...D, responsivo: true });
      const atti = attiRecenti(120, s, 40);
      return { e: letturaEAdi(120, s)!.picco, vt: media(atti.map((a) => a.vti)), pip: media(atti.map((a) => a.pip)) };
    });
    expect(r[2].e).toBeLessThan(r[0].e * 0.7);
    expect(r[2].vt).toBeGreaterThan(r[0].vt * 1.3);
    expect(r[1].pip).toBeGreaterThan(r[0].pip);
    expect(r[2].pip).toBeGreaterThan(r[1].pip);
  });
  it('Hering-Breuer: oltre il ginocchio il volume si ferma intorno a 6,5 ml/kg, l’EAdi continua a scendere', () => {
    const r = [0, 2, 3, 5].map((L) => {
      const s = stato({ livelloNeuro: L }, { ...D, responsivo: true });
      return { e: letturaEAdi(120, s)!.picco, vt: media(attiRecenti(120, s, 40).map((a) => a.vti)) };
    });
    // la salita sta tutta prima del ginocchio
    expect(r[1].vt - r[0].vt).toBeGreaterThan(150);
    expect(r[3].vt - r[2].vt).toBeLessThan(0.2 * (r[1].vt - r[0].vt));
    expect(r[3].vt).toBeLessThan(6.5 * 70 * 1.1);
    expect(r[3].e).toBeLessThan(r[2].e);
    expect(r[2].e).toBeLessThan(r[1].e);
  });
});

describe('NEURO: l’allarme del segnale e la verifica con l’occlusione', () => {
  it('ottanta secondi sul ripiego: suona «segnale EAdi»; con il catetere a posto no', () => {
    const buono = stato({ livelloNeuro: 1 }, D);
    const staccato = stato({ livelloNeuro: 1 }, D, { catetereEAdi: 'staccato' });
    expect(misura(buono, 200, 2, null).neuroRipiego).toBe(0);
    expect(valuta(buono, misura(buono, 200, 2, null), LIMITI_INIZIALI).map((a) => a.chiave)).not.toContain('segnaleEAdi');
    expect(misura(staccato, 200, 2, null).neuroRipiego).toBe(1);
    expect(valuta(staccato, misura(staccato, 200, 2, null), LIMITI_INIZIALI).map((a) => a.chiave)).toContain('segnaleEAdi');
  });
  it('in pausa espiratoria lo sforzo fa salire l’EAdi e scendere la Paw nello stesso tempo', () => {
    const s = { ...stato({ livelloNeuro: 1 }, D), manovra: 'pausa-espiratoria' as const, manovraDa: 118 };
    let eMax = { t: 0, v: 0 };
    let pMin = { t: 0, v: Infinity };
    for (let t = 118.5; t < 121.5; t += 0.01) {
      const e = attivitaDiaframma(t, s)!;
      const p = puntoOnda(t, s).paw;
      if (e > eMax.v) eMax = { t, v: e };
      if (p < pMin.v) pMin = { t, v: p };
    }
    expect(pMin.v).toBeLessThan(5 - 2);
    expect(eMax.v).toBeGreaterThan(3);
    expect(Math.abs(pMin.t - eMax.t)).toBeLessThan(0.5);
  });
});
