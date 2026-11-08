/**
 * Session log ("registro"), in the style of the Sim Scenario Creator:
 * time from T0 (mm:ss), categories, repeated adjustments grouped, parameter
 * trends sampled during the recording, and a session sheet (title, learners,
 * notes) for the debriefing.
 */

export type Categoria = 'ventilatore' | 'paziente' | 'allarmi' | 'regia';
export const CATEGORIE: Categoria[] = ['ventilatore', 'paziente', 'allarmi', 'regia'];

export interface VoceRegistro {
  at: number;            // epoch ms
  vent: string;          // ventilator id
  cat: Categoria;
  who: 'learner' | 'director' | 'system';
  text: string;
  /** For grouping repeated adjustments of the same knob. */
  key?: string;
  value?: string | number;
}

export interface Campione { at: number; vent: string; v: Record<string, number> }

export interface Scheda { titolo: string; discenti: string; note: string }

export interface Registro {
  app: 'open-vent-sim';
  kind: 'registro';
  version: 1;
  t0: number;
  t1: number | null;
  scheda: Scheda;
  vents: Record<string, string>; // id → name
  voci: VoceRegistro[];
  campioni: Campione[];
}

export const PARAMETRI_REGISTRO: { key: string; label: string; unit: string; color: string }[] = [
  { key: 'spo2', label: 'SpO₂', unit: '%', color: '#38bdf8' },
  { key: 'etco2', label: 'EtCO₂', unit: 'mmHg', color: '#facc15' },
  { key: 'pPeak', label: 'Ppeak', unit: 'cmH₂O', color: '#f97316' },
  { key: 'peep', label: 'PEEP', unit: 'cmH₂O', color: '#a78bfa' },
  { key: 'vte', label: 'VTe', unit: 'mL', color: '#4ade80' },
  { key: 'f', label: 'f', unit: '/min', color: '#f472b6' },
  { key: 'fio2', label: 'FiO₂', unit: '%', color: '#e5e7eb' },
  { key: 'hr', label: 'HR', unit: '/min', color: '#ef4444' },
];

/** Same knob touched again within this window → one grouped line. */
export const FINESTRA_REGOLAZIONE_MS = 60_000;
export const PASSO_CAMPIONE_MS = 5_000;

export function nuovoRegistro(t0 = Date.now()): Registro {
  return { app: 'open-vent-sim', kind: 'registro', version: 1, t0, t1: null, scheda: { titolo: '', discenti: '', note: '' }, vents: {}, voci: [], campioni: [] };
}

export function mmss(ms: number): string {
  const neg = ms < 0;
  const s = neg ? Math.ceil(-ms / 1000 - 0.01) : Math.floor(ms / 1000);
  const txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return neg ? `−${txt}` : txt;
}

export interface RigaRaggruppata { voce: VoceRegistro; riassunte: VoceRegistro[] }

/**
 * Consecutive turns of the same knob on the same ventilator within the window
 * become one line ("PEEP 5 → 8 → 10" reads as "PEEP → 10, 3 adjustments").
 */
export function raggruppa(voci: VoceRegistro[], finestra = FINESTRA_REGOLAZIONE_MS): RigaRaggruppata[] {
  const out: RigaRaggruppata[] = [];
  for (const v of voci) {
    const last = out[out.length - 1];
    if (last && v.key && last.voce.key === v.key && last.voce.vent === v.vent && last.voce.who === v.who
      && v.at - (last.riassunte.length ? last.riassunte[last.riassunte.length - 1].at : last.voce.at) <= finestra) {
      if (!last.riassunte.length) last.riassunte.push(last.voce);
      last.riassunte.push(v);
      last.voce = { ...v, at: last.riassunte[0].at };
      continue;
    }
    out.push({ voce: v, riassunte: [] });
  }
  return out;
}

export function durata(r: Registro, now = Date.now()): number {
  return (r.t1 ?? now) - r.t0;
}

export function esportaJson(r: Registro): string {
  return JSON.stringify(r, null, 1);
}

export function leggiJson(text: string): Registro {
  const d = JSON.parse(text);
  if (!d || d.app !== 'open-vent-sim' || d.kind !== 'registro' || !Array.isArray(d.voci)) throw new Error('not an Open Vent Sim log');
  return {
    ...nuovoRegistro(Number(d.t0) || Date.now()),
    t1: d.t1 ?? null,
    scheda: { titolo: String(d.scheda?.titolo ?? ''), discenti: String(d.scheda?.discenti ?? ''), note: String(d.scheda?.note ?? '') },
    vents: typeof d.vents === 'object' && d.vents ? d.vents : {},
    voci: d.voci.filter((v: any) => v && typeof v.text === 'string' && Number.isFinite(v.at)),
    campioni: Array.isArray(d.campioni) ? d.campioni.filter((c: any) => c && Number.isFinite(c.at) && c.v) : [],
  };
}

export function esportaCsv(r: Registro, labels: { learner: string; director: string; system: string; cat: Record<Categoria, string> }): string {
  const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [['T', 'ora', 'ventilatore', 'categoria', 'chi', 'azione'].map(q).join(',')];
  for (const v of r.voci) {
    rows.push([mmss(v.at - r.t0), new Date(v.at).toLocaleTimeString(), r.vents[v.vent] || v.vent, labels.cat[v.cat], labels[v.who], v.text].map((x) => q(String(x))).join(','));
  }
  return rows.join('\n') + '\n';
}

/** Alarm on/off lines from two consecutive snapshots' alarm lists. */
export function vociAllarmi(prima: string[], dopo: string[], at: number, vent: string, nome: (k: string) => string, on: string, off: string): VoceRegistro[] {
  const a = new Set(prima), b = new Set(dopo);
  const out: VoceRegistro[] = [];
  for (const k of b) if (!a.has(k)) out.push({ at, vent, cat: 'allarmi', who: 'system', text: `${on}: ${nome(k)}` });
  for (const k of a) if (!b.has(k)) out.push({ at, vent, cat: 'allarmi', who: 'system', text: `${off}: ${nome(k)}` });
  return out;
}
