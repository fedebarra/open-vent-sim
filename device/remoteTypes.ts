/**
 * What the classroom layer can send to a running device, and what the device
 * reports back. The device engine is the Scenario Creator one (Italian names
 * kept on purpose, so the files stay diff-able with the Scenario Creator).
 */
import type { AzioneVentilatore } from './screens/scenario/ventilatore/azioni'
import type { Fisiologia, PresetFisiologia } from './screens/scenario/ventilatore/fisica'
import type { Drive, ImpostazioniAsincronia } from './screens/scenario/ventilatore/asincronie'
import type { VentIstantanea } from './screens/scenario/ventilatore/istantanea'
import type { Ambiente } from './screens/scenario/ventilatore/parametri'

export type { AzioneVentilatore, Fisiologia, PresetFisiologia, Drive, ImpostazioniAsincronia, VentIstantanea, Ambiente }

/** A machine command, applied exactly as if the learner had touched the screen. */
export interface ComandoAzione {
  type: 'azione'
  azione: AzioneVentilatore
}

/**
 * A change to the patient. Every field is optional: only what is sent changes.
 *  - `preset` loads lung mechanics AND the matching spontaneous drive.
 *  - `fisiologia` / `drive` are merged over the current values.
 *  - `rampaFrequenza` moves the spontaneous rate gradually (Scenario Creator
 *    "addormenta / risveglia": e.g. 15 → 0 over 30 s for induction).
 *  - `asincronia: null` removes any asynchrony.
 *  - `vitali` are the monitor values the ventilator receives (SpO₂, EtCO₂
 *    the capnograph tracks, HR and MAP used by the recruitment stop criteria).
 */
export interface ComandoPaziente {
  type: 'paziente'
  preset?: PresetFisiologia
  fisiologia?: Partial<Omit<Fisiologia, 'preset'>>
  drive?: Partial<Drive>
  rampaFrequenza?: { a: number; durataSec: number }
  asincronia?: ImpostazioniAsincronia | null
  vitali?: { spo2?: number | null; etco2?: number | null; heartRate?: number | null; map?: number | null; pesoKg?: number | null }
}

export type DeviceRemoteCommand = ComandoAzione | ComandoPaziente

export interface DeviceRemoteActions {
  /** Called once by the device; returns an unsubscribe function. */
  subscribe(fn: (cmd: DeviceRemoteCommand, source?: 'director') => void): () => void
}

/** Where a log line comes from. */
export type EventSource = 'learner' | 'director' | 'device'

/** Which screen the host is showing (for the director's overview). */
export type DeviceScreen = 'startup' | 'setup' | 'running'

export interface DeviceSnapshot {
  screen: DeviceScreen
  /** null until a machine is switched on. */
  ventilatore: VentIstantanea | null
  language: 'it' | 'en'
}
