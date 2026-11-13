/**
 * La compliance dinamica sugli atti del paziente: in PS con uno sforzo forte
 * il volume lo fa il diaframma, la pressione al denominatore è solo quella
 * della macchina, e la «compliance» schizza sopra quella vera.
 */
import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, battiFino, type VentIstantanea } from '../device/screens/scenario/ventilatore/istantanea';

function inPs(intensita: number): VentIstantanea {
  let ist = istantaneaIniziale('invasiva', 0, { pesoKg: 75, etco2: null, spo2: null, heartRate: 90, map: null });
  ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
  ist = applica(ist, { tipo: 'modalita', modalita: 'PS' as never }, 0).istantanea;
  ist = applica(ist, { tipo: 'parametro', chiave: 'peep', valore: 8 }, 0).istantanea;
  ist = applica(ist, { tipo: 'parametro', chiave: 'psLevel', valore: 5 }, 0).istantanea;
  return { ...ist, fisiologia: { ...ist.fisiologia, compliance: 40 }, drive: { ...ist.drive, frequenza: 26, intensita } };
}

describe('compliance dinamica', () => {
  it('sforzo forte con PS bassa: la compliance scritta supera di molto quella vera', () => {
    const ist = battiFino(inPs(1), 0, 40);
    expect(ist.misure.p01).not.toBeNull();
    expect(ist.misure.compliance!).toBeGreaterThan(70);
  });
  it('paziente passivo in controllata: la compliance resta quella vera', () => {
    let ist = inPs(0);
    ist = applica(ist, { tipo: 'modalita', modalita: 'VC' as never }, 0).istantanea;
    ist = battiFino({ ...ist, drive: { ...ist.drive, frequenza: 0, intensita: 0 } }, 0, 40);
    expect(ist.misure.p01).toBeNull();
    expect(Math.abs(ist.misure.compliance! - 40)).toBeLessThanOrEqual(8);
  });
});
