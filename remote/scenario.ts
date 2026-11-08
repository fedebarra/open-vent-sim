/**
 * A scenario file: the patient and the machine as they are now, saved by the
 * director and loaded back later — on the same ventilator or on all of them.
 *
 * It is what the reference simulator exports to a spreadsheet; here it is a
 * small JSON next to the event sequences (`events.ts`), in the same family
 * (`app: 'open-vent-sim'`, a `kind`, a `version`). Loading never trusts the
 * file: unknown settings are dropped, numbers are clamped to the knob's range,
 * and the environment (anaesthesia, ICU, NIV, high flow) is not switched from
 * the console — it is the learner's machine, so a mismatch is reported instead.
 */
import type { AzioneVentilatore, ComandoPaziente, VentIstantanea } from '../device/remoteTypes';
import { PARAMETRI, type Ambiente, type ChiaveImpostazione, type Modalita, MODALITA_PER_AMBIENTE } from '../device/screens/scenario/ventilatore/parametri';

export interface ScenarioFile {
  app: 'open-vent-sim';
  kind: 'scenario';
  version: 1;
  name: string;
  ambiente: Ambiente;
  modalita: Modalita;
  impostazioni: Record<string, number | string>;
  fisiologia: Record<string, unknown>;
  drive: Record<string, unknown>;
  asincronia: VentIstantanea['asincronia'];
  vitali: { spo2: number | null; etco2: number | null; heartRate: number | null; map: number | null };
}

export function scenarioDa(ist: VentIstantanea, name: string): ScenarioFile {
  const { preset: _preset, ...fisiologia } = ist.fisiologia;
  return {
    app: 'open-vent-sim',
    kind: 'scenario',
    version: 1,
    name: name.slice(0, 80),
    ambiente: ist.ambiente,
    modalita: ist.modalita,
    impostazioni: { ...(ist.impostazioni as unknown as Record<string, number | string>) },
    fisiologia,
    drive: { ...ist.drive },
    asincronia: ist.asincronia,
    vitali: { spo2: ist.paziente.spo2, etco2: ist.paziente.etco2, heartRate: ist.paziente.heartRate, map: ist.paziente.map },
  };
}

const FIS_NUMERI = ['compliance', 'complianceParete', 'reclutabilita', 'resistenza', 'sforzoEspiratorio', 'limitazioneFlusso', 'secrezioni', 'oscillazioniCardiache', 'aperturaVie', 'pesBasale', 'perditaMaschera'] as const;
const DRIVE_NUMERI = ['frequenza', 'intensita', 'forza', 'variabilita', 'espirioAttivo'] as const;

const finito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function parseScenario(text: string): ScenarioFile {
  const d = JSON.parse(text);
  if (!d || d.app !== 'open-vent-sim' || d.kind !== 'scenario') throw new Error('not an Open Vent Sim scenario file');
  const ambienti = Object.keys(MODALITA_PER_AMBIENTE) as Ambiente[];
  const ambiente: Ambiente = ambienti.includes(d.ambiente) ? d.ambiente : 'invasiva';
  const modalita: Modalita = MODALITA_PER_AMBIENTE[ambiente].includes(d.modalita) ? d.modalita : MODALITA_PER_AMBIENTE[ambiente][0];
  const impostazioni: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(d.impostazioni ?? {})) {
    const def = (PARAMETRI as Record<string, { regolabile?: boolean; min?: number; max?: number }>)[k];
    if (!def || !def.regolabile) continue;
    if (finito(v)) impostazioni[k] = Math.min(def.max ?? v, Math.max(def.min ?? v, v));
    else if (typeof v === 'string' && /^\d+(\.\d+)?:\d+(\.\d+)?$/.test(v)) impostazioni[k] = v;
  }
  const fisiologia: Record<string, unknown> = {};
  for (const k of FIS_NUMERI) if (finito(d.fisiologia?.[k])) fisiologia[k] = d.fisiologia[k];
  const drive: Record<string, unknown> = {};
  for (const k of DRIVE_NUMERI) if (finito(d.drive?.[k])) drive[k] = d.drive[k];
  if (typeof d.drive?.responsivo === 'boolean') drive.responsivo = d.drive.responsivo;
  const f = d.drive?.forma;
  drive.forma = f && finito(f.salita) && finito(f.tenuta) && finito(f.discesa) ? { salita: f.salita, tenuta: f.tenuta, discesa: f.discesa } : null;
  const a = d.asincronia;
  const asincronia = a && typeof a.tipo === 'string' && finito(a.quota) ? { tipo: a.tipo, quota: Math.min(1, Math.max(0, a.quota)), ...(finito(a.grado) ? { grado: a.grado } : {}) } : null;
  const v = d.vitali ?? {};
  const vit = (x: unknown) => (finito(x) ? x : null);
  return {
    app: 'open-vent-sim',
    kind: 'scenario',
    version: 1,
    name: String(d.name || 'scenario').slice(0, 80),
    ambiente,
    modalita,
    impostazioni,
    fisiologia,
    drive,
    asincronia: asincronia as ScenarioFile['asincronia'],
    vitali: { spo2: vit(v.spo2), etco2: vit(v.etco2), heartRate: vit(v.heartRate), map: vit(v.map) },
  };
}

/**
 * What loading a scenario onto this ventilator means: the machine actions (mode
 * first, then every knob that differs) and the patient patch. `ambienteDiverso`
 * is true when the file was saved on another kind of machine: the knobs that
 * exist on both are still applied.
 */
export function comandiScenario(sc: ScenarioFile, ist: VentIstantanea): { azioni: AzioneVentilatore[]; paziente: Omit<ComandoPaziente, 'type'>; ambienteDiverso: boolean } {
  const azioni: AzioneVentilatore[] = [];
  const ambienteDiverso = sc.ambiente !== ist.ambiente;
  if (MODALITA_PER_AMBIENTE[ist.ambiente].includes(sc.modalita) && sc.modalita !== ist.modalita) azioni.push({ tipo: 'modalita', modalita: sc.modalita });
  for (const [k, v] of Object.entries(sc.impostazioni)) {
    if ((ist.impostazioni as unknown as Record<string, unknown>)[k] === v) continue;
    azioni.push({ tipo: 'parametro', chiave: k as ChiaveImpostazione, valore: v });
  }
  return {
    azioni,
    paziente: {
      fisiologia: sc.fisiologia as ComandoPaziente['fisiologia'],
      drive: sc.drive as ComandoPaziente['drive'],
      asincronia: sc.asincronia,
      vitali: sc.vitali,
    },
    ambienteDiverso,
  };
}
