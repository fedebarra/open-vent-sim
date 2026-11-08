/** Ready-made clinical events for the director console, and the sequence format. */
import type { ComandoPaziente } from '../device/remoteTypes';
import type { RemoteStrings } from './strings';

export interface EventDef { id: string; labelKey: keyof RemoteStrings; patch: Omit<ComandoPaziente, 'type'>; rampSec: number }

export const EVENT_LIBRARY: EventDef[] = [
  { id: 'bronchospasm', labelKey: 'ev_bronchospasm', patch: { fisiologia: { resistenza: 32, limitazioneFlusso: 0.6 }, vitali: { spo2: 91, etco2: 48 } }, rampSec: 60 },
  { id: 'plug', labelKey: 'ev_plug', patch: { fisiologia: { resistenza: 28, secrezioni: 0.8 }, vitali: { spo2: 90 } }, rampSec: 30 },
  { id: 'ptx', labelKey: 'ev_ptx', patch: { fisiologia: { compliance: 18 }, vitali: { spo2: 84, heartRate: 128, map: 58 } }, rampSec: 30 },
  { id: 'desat', labelKey: 'ev_desat', patch: { vitali: { spo2: 82 } }, rampSec: 60 },
  { id: 'hypercapnia', labelKey: 'ev_hypercapnia', patch: { vitali: { etco2: 62 } }, rampSec: 120 },
  { id: 'apnea', labelKey: 'ev_apnea', patch: { rampaFrequenza: { a: 0, durataSec: 30 }, asincronia: null }, rampSec: 0 },
  { id: 'wakeup', labelKey: 'ev_wakeup', patch: { rampaFrequenza: { a: 16, durataSec: 60 }, drive: { intensita: 0.6 } }, rampSec: 0 },
  { id: 'reversal', labelKey: 'ev_reversal', patch: { drive: { frequenza: 12, intensita: 0.45, forza: 1 }, asincronia: { tipo: 'sforzo-inefficace', quota: 0.5 } }, rampSec: 0 },
  { id: 'edema', labelKey: 'ev_edema', patch: { preset: 'edema-polmonare', vitali: { spo2: 87, heartRate: 115 } }, rampSec: 0 },
  { id: 'ards', labelKey: 'ev_ards', patch: { preset: 'ards', vitali: { spo2: 88 } }, rampSec: 0 },
  { id: 'tachy', labelKey: 'ev_tachycardia', patch: { vitali: { heartRate: 135, map: 55 } }, rampSec: 30 },
  { id: 'maskleak', labelKey: 'ev_maskleak', patch: { fisiologia: { perditaMaschera: 90 } }, rampSec: 0 },
  { id: 'maskseal', labelKey: 'ev_maskseal', patch: { fisiologia: { perditaMaschera: 10 } }, rampSec: 0 },
  { id: 'normal', labelKey: 'ev_normal', patch: { preset: 'normale', asincronia: null, vitali: { spo2: 98, etco2: 38, heartRate: 75, map: 85 } }, rampSec: 0 },
];

export interface SequenceStep { eventId: string; afterSec: number }
export interface SequenceFile { app: 'open-vent-sim'; kind: 'sequence'; version: 1; name: string; steps: SequenceStep[] }

/** Patch groups whose numeric fields can move gradually. */
export const RAMPABLE_GROUPS = ['fisiologia', 'drive', 'vitali'] as const;

export function parseSequence(text: string): SequenceFile {
  const data = JSON.parse(text);
  if (!data || data.app !== 'open-vent-sim' || data.kind !== 'sequence' || !Array.isArray(data.steps)) throw new Error('not an Open Vent Sim sequence file');
  const known = new Set(EVENT_LIBRARY.map((e) => e.id));
  const steps: SequenceStep[] = data.steps
    .filter((s: any) => s && known.has(String(s.eventId)))
    .map((s: any) => ({ eventId: String(s.eventId), afterSec: Math.max(0, Math.min(3600, Number(s.afterSec) || 0)) }));
  return { app: 'open-vent-sim', kind: 'sequence', version: 1, name: String(data.name || 'sequence').slice(0, 80), steps };
}
