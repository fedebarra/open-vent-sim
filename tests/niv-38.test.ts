import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { attiRecenti, campioneMotore, inPausaPerdita } from '../device/screens/scenario/ventilatore/motore';
import { misura, type StatoVentilatore } from '../device/screens/scenario/ventilatore/fisica';
import { impostazioniVisibili, MODALITA_PER_AMBIENTE, modalitaDisponibile, IMPOSTAZIONI_INIZIALI } from '../device/screens/scenario/ventilatore/parametri';
import { valuta, LIMITI_INIZIALI } from '../device/screens/scenario/ventilatore/allarmi';
import type { Drive } from '../device/screens/scenario/ventilatore/asincronie';

function stato(ambiente: 'niv' | 'invasiva', modalita: string, imp: Record<string, unknown> = {}, fis: Record<string, unknown> = {}, drive: Drive = { frequenza: 18, intensita: 0.5 }): StatoVentilatore {
  let ist = istantaneaIniziale(ambiente, 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
  ist = { ...ist, fisiologia: { ...ist.fisiologia, catetereEAdi: 'giusto' } };
  ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
  ist = applica(ist, { tipo: 'modalita', modalita: modalita as never }, 0).istantanea;
  const s = statoDa(ist);
  return {
    ...s,
    impostazioni: { ...s.impostazioni, peep: 5, psLevel: 10, pressureTarget: 10, frequency: 14, livelloNeuro: 1, ...imp },
    fisiologia: { ...s.fisiologia, compliance: 50, resistenza: 10, reclutabilita: 0, limitazioneFlusso: 0, secrezioni: 0, catetereEAdi: 'giusto', ...fis },
    drive,
    asincronia: null,
    umidificatore: null,
  };
}
const media = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
const ti = (s: StatoVentilatore) => media(attiRecenti(120, s, 30).map((a) => a.fineInsp - a.inizio));
const MASCHERA_STACCATA = { perditaMaschera: 400 };

describe('NIV: le modalità', () => {
  it('ci sono PS, CPAP, PC e NEURO; NEURO solo con il catetere', () => {
    expect(MODALITA_PER_AMBIENTE.niv).toEqual(['PS', 'CPAP', 'PC', 'NEURO']);
    expect(modalitaDisponibile('NEURO', {})).toBe(false);
    expect(stato('niv', 'PC').modalita).toBe('PC');
    expect(stato('niv', 'NEURO').modalita).toBe('NEURO');
  });
  it('NIV PC: pressione, frequenza, I:E, salita e trigger; niente sigh né interruttore A/C', () => {
    const s = stato('niv', 'PC');
    const k = impostazioniVisibili({ ambiente: 'niv', modalita: 'PC', respiro: s.respiro, impostazioni: { ...s.impostazioni, sighRate: 1 } });
    expect(k).toEqual(expect.arrayContaining(['pressureTarget', 'frequency', 'ratio', 'inspiratoryRiseTimeSeconds', 'triggerFlow', 'peep', 'fio2', 'perditaEccessiva']));
    expect(k).not.toContain('sighRate');
    expect(k).not.toContain('sighPressure');
    expect(k).not.toContain('triggerControllata');
  });
  it('NIV NEURO: livello, trigger EAdi e il supporto di ripiego', () => {
    const s = stato('niv', 'NEURO');
    const k = impostazioniVisibili({ ambiente: 'niv', modalita: 'NEURO', respiro: s.respiro, impostazioni: s.impostazioni });
    expect(k).toEqual(expect.arrayContaining(['livelloNeuro', 'triggerEAdi', 'psLevel', 'flowCycleOffPercent', 'backupPressure', 'perditaEccessiva']));
    expect(k).not.toContain('frequency');
  });
});

describe('NIV PC', () => {
  it('è assistita: il paziente apre l’atto, e il ciclo è a tempo', () => {
    const atti = attiRecenti(120, stato('niv', 'PC', { frequency: 10 }), 30);
    expect(atti.filter((a) => a.innescato).length).toBeGreaterThan(atti.length * 0.7);
    // 1:2 a 10/min: un Ti di due secondi, che il paziente apra o no
    const durate = atti.map((a) => a.fineInsp - a.inizio);
    expect(Math.max(...durate) - Math.min(...durate)).toBeLessThan(0.05);
  });
  it('con la perdita la PS cicla tardi, la PC no', () => {
    const ps = [10, 120].map((l) => ti(stato('niv', 'PS', {}, { perditaMaschera: l })));
    const pc = [10, 120].map((l) => ti(stato('niv', 'PC', {}, { perditaMaschera: l })));
    expect(ps[1]).toBeGreaterThan(ps[0] * 2);
    expect(Math.abs(pc[1] - pc[0])).toBeLessThan(0.05);
  });
});

describe('NIV NEURO', () => {
  it('trigger e ciclaggio non sentono la perdita: gli atti li apre il diaframma, il Ti resta quello', () => {
    const [poca, tanta] = [10, 120].map((l) => stato('niv', 'NEURO', {}, { perditaMaschera: l }));
    for (const s of [poca, tanta]) {
      const atti = attiRecenti(120, s, 30);
      expect(atti.length).toBeGreaterThan(5);
      expect(atti.every((a) => a.apertura === 'neurale' && !a.ripiego)).toBe(true);
    }
    expect(Math.abs(ti(tanta) - ti(poca))).toBeLessThan(0.1);
  });
  it('senza segnale ripiega sulla PS della NIV, e lì la perdita torna a contare', () => {
    const atti = attiRecenti(120, stato('niv', 'NEURO', {}, { catetereEAdi: 'staccato', perditaMaschera: 120 }), 30);
    expect(atti.length).toBeGreaterThan(3);
    expect(atti.every((a) => a.ripiego && a.apertura === 'pneumatico')).toBe(true);
    expect(media(atti.map((a) => a.fineInsp - a.inizio))).toBeGreaterThan(1.2);
  });
});

describe('La maschera staccata: perdita oltre il 95%', () => {
  it('di fabbrica la macchina continua a ventilare, e suona la perdita eccessiva', () => {
    expect(IMPOSTAZIONI_INIZIALI.perditaEccessiva).toBe(0);
    const s = stato('niv', 'PS', {}, MASCHERA_STACCATA);
    expect(attiRecenti(120, s, 20).length).toBeGreaterThan(3);
    const m = misura(s, 120, 2, null);
    expect(m.leakPercentage!).toBeGreaterThan(95);
    expect(m.pausaPerdita).toBe(0);
    expect(valuta(s, m, LIMITI_INIZIALI).map((a) => a.chiave)).toContain('perditaEccessiva');
  });
  it('la PEEP non arriva: la Paw resta a terra anche in espirazione', () => {
    const s = stato('niv', 'PS', {}, MASCHERA_STACCATA);
    let massimo = 0;
    for (let t = 110; t < 120; t += 0.05) massimo = Math.max(massimo, campioneMotore(t, s).paw);
    // la perdita fluttua del 25%: qualche decimo, mai la PEEP
    expect(massimo).toBeLessThan(4);
  });
  for (const modalita of ['PS', 'CPAP', 'PC', 'NEURO']) {
    it(`in pausa (${modalita}): niente atti, niente volumi, suona solo la perdita`, () => {
      const s = stato('niv', modalita, { perditaEccessiva: 1 }, MASCHERA_STACCATA);
      expect(attiRecenti(120, s, 20)).toHaveLength(0);
      expect(inPausaPerdita(120, s)).toBe(true);
      const m = misura(s, 120, 2, null);
      expect(m).toMatchObject({ pausaPerdita: 1, leakPercentage: 100, volumeMinute: 0, measuredFrequency: 0 });
      const allarmi = valuta(s, m, LIMITI_INIZIALI, 60).map((a) => a.chiave);
      expect(allarmi).toContain('perditaEccessiva');
      expect(allarmi).not.toContain('apnea');
      expect(allarmi).not.toContain('volumeMinute');
    });
  }
  it('flusso alto o basso: lo stesso, con la maschera staccata non tiene niente', () => {
    for (const pe of [1, 2]) {
      const s = stato('niv', 'PS', { perditaEccessiva: pe }, MASCHERA_STACCATA);
      expect(campioneMotore(115, s).paw).toBeLessThan(1);
    }
  });
  it('la maschera che perde tanto ma sta sul viso non mette in pausa', () => {
    for (const modalita of ['PS', 'PC', 'NEURO', 'CPAP']) {
      const s = stato('niv', modalita, { perditaEccessiva: 1 }, { perditaMaschera: 100 });
      expect(inPausaPerdita(120, s)).toBe(false);
      expect(attiRecenti(120, s, 20).length).toBeGreaterThan(3);
    }
  });
  it('rimessa la maschera la macchina riparte', () => {
    const s = stato('niv', 'PS', { perditaEccessiva: 1 }, { perditaMaschera: 10 });
    expect(inPausaPerdita(120, s)).toBe(false);
    expect(misura(s, 120, 2, null).pausaPerdita).toBe(0);
  });
  it('fuori dalla NIV non esiste', () => {
    const s = stato('invasiva', 'PS', { perditaEccessiva: 1 }, MASCHERA_STACCATA);
    expect(inPausaPerdita(120, s)).toBe(false);
    expect(misura(s, 120, 2, null).pausaPerdita).toBeNull();
  });
});

describe('Il picco misurato dove il bersaglio non c’è', () => {
  it('in PAV e in NEURO la Ppicco è quella degli atti, non PEEP + 1,5', () => {
    for (const modalita of ['PAV', 'NEURO']) {
      const s = stato('invasiva', modalita, {}, {}, { frequenza: 18, intensita: 0.6 });
      const atti = attiRecenti(120, s, 20);
      expect(Math.abs(misura(s, 120, 2, null).pPeak! - atti[atti.length - 1].pip)).toBeLessThan(0.6);
      expect(misura(s, 120, 2, null).pPeak!).toBeGreaterThan(8);
    }
  });
});
