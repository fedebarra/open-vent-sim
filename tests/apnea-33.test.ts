/**
 * OVS 3.3 — l'allarme d'apnea (rilievo dell'aula): il paziente addormentato
 * dalla regia in una modalità spontanea deve far suonare l'apparecchio anche
 * mentre il backup ventila al posto suo.
 */
import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, battiFino, type VentIstantanea } from '../device/screens/scenario/ventilatore/istantanea';

function acceso(ambiente: 'invasiva' | 'niv' | 'anestesia', modalita: string): VentIstantanea {
  let ist = istantaneaIniziale(ambiente, 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null });
  ist = applica(ist, { tipo: 'standby', ventilando: true }, 0).istantanea;
  if (ambiente === 'anestesia') ist = applica(ist, { tipo: 'respiro', respiro: 'meccanica' }, 0).istantanea;
  ist = applica(ist, { tipo: 'modalita', modalita: modalita as never }, 0).istantanea;
  expect(ist.modalita).toBe(modalita);
  return ist;
}
const suona = (ist: VentIstantanea) => ist.allarmi.some((a) => a.chiave === 'apnea');
const respira = (ist: VentIstantanea) => ({ ...ist, drive: { ...ist.drive, frequenza: 15, intensita: 0.5 } });
const addormentato = (ist: VentIstantanea) => ({ ...ist, drive: { ...ist.drive, frequenza: 0, intensita: 0 } });

describe("l'allarme d'apnea", () => {
  for (const [amb, mod] of [['invasiva', 'PS'], ['invasiva', 'CPAP'], ['niv', 'PS'], ['niv', 'CPAP'], ['anestesia', 'PS']] as const) {
    it(`${amb} ${mod}: tace col respiro, suona dopo il tempo d'apnea`, () => {
      let ist = battiFino(respira(acceso(amb, mod)), 0, 60);
      expect(suona(ist)).toBe(false);
      ist = addormentato(ist);
      ist = battiFino(ist, 60, 70);
      expect(suona(ist)).toBe(false);
      ist = battiFino(ist, 70, 90);
      expect(suona(ist)).toBe(true);
    });
  }
  it('in controllata non si sorveglia', () => {
    const ist = battiFino(addormentato(acceso('invasiva', 'VC')), 0, 90);
    expect(suona(ist)).toBe(false);
  });
  it('il limite si sposta e si spegne', () => {
    let ist = battiFino(addormentato(acceso('invasiva', 'PS')), 0, 35);
    expect(suona(ist)).toBe(true);
    ist = applica(ist, { tipo: 'allarme', chiave: 'apnea', acceso: false }, 35).istantanea;
    ist = battiFino(ist, 35, 40);
    expect(suona(ist)).toBe(false);
  });
  it('CPAP senza respiro: frequenza misurata zero, non quella di backup', () => {
    const ist = battiFino(addormentato(acceso('invasiva', 'CPAP')), 0, 60);
    expect(ist.misure.measuredFrequency).toBe(0);
  });
});

describe('Et agente basso coi gas chiusi', () => {
  it("la macchina d'anestesia appena accesa non suona per l'agente", () => {
    const ist = battiFino(acceso('anestesia', 'VC'), 0, 60);
    expect(ist.allarmi.map((a) => a.chiave)).not.toContain('etAgentConcentration');
  });
  it("con l'erogazione aperta e l'Et sotto il limite suona", () => {
    let ist = acceso('anestesia', 'VC');
    ist = { ...ist, gas: { ...ist.gas!, erogazione: true, livelli: { ...ist.gas!.livelli, sevoflurano: 0 } } };
    ist = battiFino(ist, 0, 60);
    expect(ist.allarmi.map((a) => a.chiave)).toContain('etAgentConcentration');
  });
});
