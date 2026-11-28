// Una regolazione confermata vale dall'atto dopo: l'atto in corso non si spezza.
import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { attiRecenti, campioneMotore } from '../device/screens/scenario/ventilatore/motore';

function partito() {
  let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
  ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
  return applica(ist, { tipo: 'modalita', modalita: 'VC' as never }, 0).istantanea;
}

describe('la frequenza nuova parte dall\'atto dopo', () => {
  it('in VC 12 → 14 a metà espirio: la griglia nuova comincia sul prossimo atto della vecchia', () => {
    const prima = partito();
    const tSec = 101.7; // gli atti a 12/min cadono ogni 5 s: 100, 105, ...
    const dopo = applica(prima, { tipo: 'parametro', chiave: 'frequency', valore: 14 }, tSec).istantanea;
    const o = dopo.origineMacchina!;
    const vecchi = attiRecenti(tSec + 15, statoDa(prima), 15).map((a) => a.inizio);
    expect(o).toBeCloseTo(vecchi.find((t) => t > tSec)!, 3);
    // con le impostazioni nuove c'è un atto che comincia proprio lì, e poi ogni 60/14 s
    const nuovi = attiRecenti(o + 12, statoDa(dopo), 12.01).map((a) => a.inizio);
    expect(nuovi[0]).toBeCloseTo(o, 2);
    expect(nuovi[1] - nuovi[0]).toBeCloseTo(60 / 14, 2);
    // e sul fronte le due curve si incontrano: la vecchia finisce l'espirio
    // alla PEEP, la nuova comincia lì l'insufflazione col volume da zero.
    const vecchio = campioneMotore(o - 0.01, statoDa(prima));
    const nuovo = campioneMotore(o + 0.02, statoDa(dopo));
    expect(Math.abs(vecchio.paw - 5)).toBeLessThan(0.5);
    expect(vecchio.flusso).toBeLessThanOrEqual(0);
    expect(nuovo.flusso).toBeGreaterThan(10);
    expect(nuovo.volume).toBeLessThan(25);
  });

  it('una seconda regolazione prima che la prima parta non sposta l\'origine', () => {
    const prima = partito();
    const a = applica(prima, { tipo: 'parametro', chiave: 'frequency', valore: 14 }, 101.7).istantanea;
    const b = applica(a, { tipo: 'parametro', chiave: 'volume', valore: 450 }, 102.5).istantanea;
    expect(b.origineMacchina).toBe(a.origineMacchina);
  });

  it('a macchina ferma non c\'è un atto da aspettare: la griglia resta quella di sempre', () => {
    const ferma = istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
    const dopo = applica(ferma, { tipo: 'parametro', chiave: 'frequency', valore: 14 }, 50).istantanea;
    expect(dopo.origineMacchina ?? 0).toBe(0);
  });
});
