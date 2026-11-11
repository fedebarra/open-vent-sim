/**
 * Il motore contro il simulatore di riferimento.
 *
 * I numeri «RTM» sono misurati l'8 novembre 2026 su sim.rtmaven.com (Piraino,
 * revisione esterna di Bellani), con Playwright, a paziente e macchina
 * regolati come qui sotto. Sono il banco di prova: se un cambio al motore li
 * allontana, è un cambio di fisiologia e va guardato, non un dettaglio.
 *
 * Le tolleranze sono del 6% sui volumi e di 1 cmH₂O sulle pressioni: i due
 * motori non sono lo stesso codice, e sulle cose che contano devono dire la
 * stessa cosa. Dove la fisica di questo motore è diversa di proposito (l'aria
 * intrappolata che alza il picco, la PEEP sotto la pressione critica) la prova
 * controlla la fisica, non il numero dell'altro.
 */
import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { campioneMotore, attiRecenti } from '../device/screens/scenario/ventilatore/motore';
import { puntoOnda } from '../device/screens/scenario/ventilatore/onde';
import type { StatoVentilatore } from '../device/screens/scenario/ventilatore/fisica';

const PASSIVO = { frequenza: 0, intensita: 0 };

function stato(modalita: string, imp: Record<string, unknown>, fis: Record<string, unknown>, drive = PASSIVO, extra: Partial<StatoVentilatore> = {}): StatoVentilatore {
  let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
  ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
  ist = applica(ist, { tipo: 'modalita', modalita: modalita as never }, 0).istantanea;
  const s = statoDa(ist);
  return {
    ...s,
    impostazioni: { ...s.impostazioni, ...imp },
    fisiologia: { ...s.fisiologia, reclutabilita: 0, limitazioneFlusso: 0, secrezioni: 0, ...fis },
    drive,
    asincronia: null,
    umidificatore: null,
    ...extra,
  };
}

/** Le medie degli ultimi tre atti, e la frequenza contata. */
function misura(s: StatoVentilatore, T = 100) {
  const atti = attiRecenti(T, s, 20);
  const ultimi = atti.slice(-3);
  const media = (f: (a: (typeof atti)[number]) => number) => ultimi.reduce((x, a) => x + f(a), 0) / ultimi.length;
  let pmin = Infinity;
  for (let t = T - 10; t < T; t += 0.005) pmin = Math.min(pmin, campioneMotore(t, s).paw);
  return {
    vt: media((a) => a.vti),
    pip: media((a) => a.pip),
    pplat: ultimi.at(-1)?.pplat ?? null,
    peepTot: media((a) => a.peepTotale),
    rr: atti.length > 1 ? (60 * (atti.length - 1)) / (atti.at(-1)!.inizio - atti[0].inizio) : 0,
    innescati: atti.filter((a) => a.innescato).length,
    atti,
    pmin,
  };
}

const entro = (x: number, rif: number, quota = 0.06) => expect(Math.abs(x - rif) / rif).toBeLessThan(quota);

describe('Il motore contro RTMaven: paziente passivo', () => {
  it('VC 500, flusso 60, pausa 0,3 s, FR 24 (C 50, R 10): PIP 25, plateau 15,4', () => {
    const m = misura(stato('VC', { volume: 500, frequency: 24, peep: 5, ratio: '1:2.125', inspiratoryPausePercent: 37.5 }, { compliance: 50, resistenza: 10 }));
    expect(Math.abs(m.pip - 25)).toBeLessThan(1);
    expect(Math.abs((m.pplat ?? 0) - 15.4)).toBeLessThan(0.6);
    entro(m.vt, 500, 0.02);
  });
  it('PC 15 su PEEP 5, Ti 1 s, FR 20 (C 50, R 10): VT 630', () => {
    const m = misura(stato('PC', { pressureTarget: 15, frequency: 20, peep: 5, ratio: '1:2', inspiratoryRiseTimeSeconds: 0.1 }, { compliance: 50, resistenza: 10 }));
    entro(m.vt, 630);
    expect(Math.abs(m.pip - 20)).toBeLessThan(0.6);
  });
  it('PC con Ti corto su un polmone lento (C 30, R 20, Ti 0,6 s): VT 275 — il polmone non fa in tempo', () => {
    const m = misura(stato('PC', { pressureTarget: 15, frequency: 20, peep: 5, ratio: '0.6:2.4', inspiratoryRiseTimeSeconds: 0.1 }, { compliance: 30, resistenza: 20 }));
    entro(m.vt, 275);
  });
});

describe('Il motore contro RTMaven: paziente che respira (Pmus 8, FR 20)', () => {
  const sforzo = { frequenza: 20, intensita: 0.8 };
  it('PS 10: VT 579, la Paw scende sotto la PEEP al trigger', () => {
    const m = misura(stato('PS', { psLevel: 10, peep: 5, flowCycleOffPercent: 25, inspiratoryRiseTimeSeconds: 0.1, triggerFlow: 2 }, { compliance: 50, resistenza: 10 }, sforzo));
    entro(m.vt, 579);
    expect(m.innescati).toBe(m.atti.length);
    expect(Math.abs(m.rr - 20)).toBeLessThan(0.5);
    expect(m.pmin).toBeLessThan(4.8);
  });
  it('PS 5: VT 403', () => {
    const m = misura(stato('PS', { psLevel: 5, peep: 5, flowCycleOffPercent: 25, inspiratoryRiseTimeSeconds: 0.1, triggerFlow: 2 }, { compliance: 50, resistenza: 10 }, sforzo));
    entro(m.vt, 403);
  });
  it('PAV+ 50%: VT 458', () => {
    const m = misura(stato('PAV', { peep: 5, pavSupporto: 50, triggerFlow: 2, flowCycleOffPercent: 25 }, { compliance: 50, resistenza: 10 }, sforzo));
    entro(m.vt, 458);
  });
  it('PAV+: più supporto, più volume, con lo stesso sforzo', () => {
    const basso = misura(stato('PAV', { peep: 5, pavSupporto: 30 }, { compliance: 50, resistenza: 10 }, sforzo));
    const alto = misura(stato('PAV', { peep: 5, pavSupporto: 80 }, { compliance: 50, resistenza: 10 }, sforzo));
    expect(alto.vt).toBeGreaterThan(basso.vt * 1.5);
  });
  it('VC con un drive più veloce della macchina, trigger aperto (A/C): conta il paziente, come in RTMaven', () => {
    const m = misura(stato('VC', { volume: 500, frequency: 14, peep: 5, ratio: '1:2', triggerControllata: 1 }, { compliance: 50, resistenza: 10 }, { frequenza: 22, intensita: 0.6 }));
    expect(Math.abs(m.rr - 22)).toBeLessThan(0.5);
    expect(m.innescati).toBe(m.atti.length);
  });
  it('VC col trigger chiuso: la macchina tiene la sua cadenza e gli sforzi scavano la Paw', () => {
    const m = misura(stato('VC', { volume: 500, frequency: 14, peep: 5, ratio: '1:2' }, { compliance: 50, resistenza: 10 }, { frequenza: 22, intensita: 0.6 }));
    expect(Math.abs(m.rr - 14)).toBeLessThan(0.5);
    expect(m.innescati).toBe(0);
    expect(m.pmin).toBeLessThan(4);
  });
});

describe('Quello che deve succedere da sé', () => {
  it('BPCO: la PEEP sotto la pressione critica non gonfia il polmone (il cascata di Starling)', () => {
    const conPeep = (peep: number) => misura(stato('VC', { volume: 500, frequency: 20, peep, ratio: '1:5', inspiratoryPausePercent: 0 }, { compliance: 60, resistenza: 22, limitazioneFlusso: 0.5 })).peepTot;
    const a5 = conPeep(5), a7 = conPeep(7), a12 = conPeep(12);
    expect(a5).toBeGreaterThan(7); // l'auto-PEEP c'è
    expect(a7 - a5).toBeLessThan(0.8); // due cmH₂O di PEEP esterna sotto la Pcrit: quasi niente
    expect(a12).toBeGreaterThan(a5 + 2); // sopra la Pcrit, la PEEP si somma
  });
  it("l'aria intrappolata si vede sul flusso: non torna a zero prima dell'atto dopo", () => {
    const s = stato('VC', { volume: 500, frequency: 20, peep: 5, ratio: '1:2', inspiratoryPausePercent: 0 }, { compliance: 60, resistenza: 22, limitazioneFlusso: 0.5 });
    const atti = attiRecenti(100, s, 20);
    expect(puntoOnda(atti.at(-1)!.inizio - 0.02, s).flusso).toBeLessThan(-5);
  });
  it('lo sforzo inefficace della regia: lo sforzo c\'è, l\'atto no', () => {
    const s = stato('PS', { psLevel: 10, peep: 5, triggerFlow: 2 }, { compliance: 50, resistenza: 10 }, { frequenza: 20, intensita: 0.6 }, { asincronia: { tipo: 'sforzo-inefficace', quota: 0.5 } });
    const m = misura(s);
    expect(m.rr).toBeLessThan(16);
    expect(m.rr).toBeGreaterThan(5);
  });
  it('il doppio trigger della regia: due atti attaccati, e il volume sale sopra il corrente', () => {
    const s = stato('VC', { volume: 500, frequency: 12, peep: 5, ratio: '1:2' }, { compliance: 50, resistenza: 10 }, { frequenza: 16, intensita: 0.8 }, { asincronia: { tipo: 'doppio-ciclo', quota: 1 } });
    const m = misura(s);
    expect(m.rr).toBeGreaterThan(20);
    let vmax = 0;
    for (let t = 80; t < 100; t += 0.01) vmax = Math.max(vmax, puntoOnda(t, s).volume);
    expect(vmax).toBeGreaterThan(800);
  });
  it('le oscillazioni cardiache fanno partire atti col trigger sensibile, non con quello giusto', () => {
    const conTrigger = (triggerFlow: number) =>
      misura(stato('PS', { psLevel: 10, peep: 5, triggerFlow, backupFrequency: 8 }, { compliance: 50, resistenza: 10, oscillazioniCardiache: 1 })).innescati;
    expect(conTrigger(0.5)).toBeGreaterThan(3);
    expect(conTrigger(5)).toBe(0);
  });
  it('la Pes sale di VT/Ccw in un atto passivo, e PL = Paw − Pes', () => {
    const s = stato('VC', { volume: 500, frequency: 15, peep: 5, ratio: '1:2', inspiratoryPausePercent: 20 }, { compliance: 50, resistenza: 10, complianceParete: 200 });
    const atto = attiRecenti(100, s, 20).at(-1)!;
    // Lontano dal battito: si guarda la Pes senza l'artefatto cardiaco.
    const a = campioneMotore(atto.inizio + 0.01, s), b = campioneMotore(atto.fineInsp - 0.01, s);
    expect(Math.abs((b.pes - a.pes) - 500 / 200)).toBeLessThan(1.2);
    expect(Math.abs(b.pl - (b.paw - b.pes))).toBeLessThan(1e-6);
  });
});

describe('Una funzione pura del tempo', () => {
  it('ai bordi dei blocchi la curva non salta', () => {
    const s = stato('PS', { psLevel: 10, peep: 5 }, { compliance: 50, resistenza: 10 }, { frequenza: 22, intensita: 0.6 });
    for (const t of [40, 60, 80, 100, 120]) {
      const a = campioneMotore(t - 1e-4, s), b = campioneMotore(t + 1e-4, s);
      expect(Math.abs(a.paw - b.paw)).toBeLessThan(0.05);
      expect(Math.abs(a.flusso - b.flusso)).toBeLessThan(0.5);
    }
  });
  it('lo stesso stato e lo stesso istante danno lo stesso punto, su qualunque schermo', () => {
    const s = stato('PC', { pressureTarget: 15 }, { compliance: 40, resistenza: 12 }, { frequenza: 18, intensita: 0.5 });
    const copia = JSON.parse(JSON.stringify(s));
    for (const t of [3.21, 57.9, 333.3]) expect(puntoOnda(t, s)).toEqual(puntoOnda(t, copia));
  });
});
