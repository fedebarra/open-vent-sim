/** Session log screen for the director: sheet, trends, timeline, print/export. */
import React, { useMemo, useRef, useState } from 'react';
import { CATEGORIE, Categoria, PARAMETRI_REGISTRO, Registro, durata, esportaCsv, esportaJson, leggiJson, mmss, raggruppa } from './registro';
import type { RemoteStrings } from './strings';

interface Props {
  registro: Registro;
  s: RemoteStrings;
  recording: boolean;
  onChangeScheda: (sc: Registro['scheda']) => void;
  onClose: () => void;
  onOpen: (r: Registro) => void;
}

const COLORE_CAT: Record<Categoria, string> = { ventilatore: '#38bdf8', paziente: '#f59e0b', allarmi: '#ef4444', regia: '#a78bfa' };
const W = 1000;

function scarica(nome: string, testo: string, tipo: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([testo], { type: tipo }));
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const RegistroView: React.FC<Props> = ({ registro: r, s, recording, onChangeScheda, onClose, onOpen }) => {
  const [cats, setCats] = useState<Set<Categoria>>(new Set(CATEGORIE));
  const [vent, setVent] = useState<string>('all');
  const [params, setParams] = useState<Set<string>>(new Set(['spo2', 'pPeak', 'peep', 'vte']));
  const [cursor, setCursor] = useState<number | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const catLabel: Record<Categoria, string> = { ventilatore: s.cat_ventilatore, paziente: s.cat_paziente, allarmi: s.cat_allarmi, regia: s.cat_regia };
  const whoLabel = { learner: s.learner, director: s.director, system: s.system };
  const total = Math.max(1000, durata(r));
  const ventIds = Object.keys(r.vents);
  const voci = useMemo(() => r.voci.filter((v) => cats.has(v.cat) && (vent === 'all' || v.vent === vent)), [r.voci, cats, vent]);
  const righe = useMemo(() => raggruppa(voci), [voci]);
  const stamp = new Date(r.t0).toISOString().slice(0, 16).replace(/[:T]/g, '-');

  const toggle = <T,>(set: Set<T>, k: T, fn: (x: Set<T>) => void) => { const n = new Set(set); n.has(k) ? n.delete(k) : n.add(k); fn(n); };

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-950 text-slate-100 overflow-y-auto registro-print" data-testid="registro">
      <style>{`@media print { body * { visibility: hidden; } .registro-print, .registro-print * { visibility: visible; } .registro-print { position: absolute; inset: 0; background: #fff !important; color: #000 !important; } .no-print { display: none !important; } .registro-print .card { background: #fff !important; border-color: #bbb !important; } .registro-print .muted { color: #444 !important; } @page { size: landscape; margin: 12mm; } }`}</style>
      <div className="max-w-6xl mx-auto p-4 space-y-3">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{s.regTitle}</h1>
          <span className="muted text-slate-400">{new Date(r.t0).toLocaleString()} · {s.regLength} {mmss(total)}</span>
          {recording && <span className="text-red-400 font-semibold animate-pulse">● REC</span>}
          <span className="ml-auto flex flex-wrap gap-2 no-print">
            <button onClick={() => window.print()} className="px-3 py-1.5 rounded bg-sky-700">{s.regPrint}</button>
            <button onClick={() => scarica(`open-vent-sim-registro-${stamp}.json`, esportaJson(r), 'application/json')} className="px-3 py-1.5 rounded bg-slate-700">{s.regSaveJson}</button>
            <button onClick={() => scarica(`open-vent-sim-registro-${stamp}.csv`, esportaCsv(r, { ...whoLabel, cat: catLabel }), 'text/csv;charset=utf-8')} className="px-3 py-1.5 rounded bg-slate-700">CSV</button>
            <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded bg-slate-700">{s.regOpen}</button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then((t) => { try { onOpen(leggiJson(t)); } catch (err) { window.alert(String(err)); } }); e.target.value = ''; }} />
            <button data-testid="registro-close" onClick={onClose} className="px-3 py-1.5 rounded bg-slate-600">✕ {s.regClose}</button>
          </span>
        </header>

        {/* Session sheet */}
        <section className="card bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="font-semibold">{s.regSheet}</div>
          <div className="muted text-xs text-slate-400 mb-2">{s.regSheetHint}</div>
          <div className="grid md:grid-cols-3 gap-3">
            <label className="text-xs">{s.regSheetTitle}
              <input value={r.scheda.titolo} onChange={(e) => onChangeScheda({ ...r.scheda, titolo: e.target.value })} placeholder={s.regSheetTitlePh} className="block w-full mt-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm" /></label>
            <label className="text-xs">{s.regSheetLearners}
              <textarea value={r.scheda.discenti} onChange={(e) => onChangeScheda({ ...r.scheda, discenti: e.target.value })} placeholder={s.regSheetLearnersPh} rows={3} className="block w-full mt-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm" /></label>
            <label className="text-xs">{s.regSheetNotes}
              <textarea value={r.scheda.note} onChange={(e) => onChangeScheda({ ...r.scheda, note: e.target.value })} placeholder={s.regSheetNotesPh} rows={3} className="block w-full mt-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm" /></label>
          </div>
        </section>

        {/* Trends */}
        <section className="card bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-semibold mr-2">{s.regParams}</span>
            {PARAMETRI_REGISTRO.map((p) => (
              <button key={p.key} onClick={() => toggle(params, p.key, setParams)} className={`no-print px-2 py-0.5 rounded-full text-xs border ${params.has(p.key) ? 'text-slate-900' : 'text-slate-300 border-slate-600'}`} style={params.has(p.key) ? { background: p.color, borderColor: p.color } : {}}>{p.label}</button>
            ))}
            {ventIds.length > 1 && (
              <select value={vent} onChange={(e) => setVent(e.target.value)} className="ml-auto bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs no-print">
                <option value="all">{s.regAllVents}</option>
                {ventIds.map((id) => <option key={id} value={id}>{r.vents[id]}</option>)}
              </select>
            )}
          </div>
          <Trends r={r} params={params} vent={vent === 'all' ? ventIds[0] : vent} total={total} cursor={cursor} voci={voci} />
          {!r.campioni.length && <p className="muted text-xs text-slate-500">{s.regNoSamples}</p>}
        </section>

        {/* Timeline */}
        <section className="card bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-semibold mr-2">{s.regActions}</span>
            {CATEGORIE.map((c) => (
              <button key={c} onClick={() => toggle(cats, c, setCats)} className={`no-print px-2 py-0.5 rounded-full text-xs border`} style={cats.has(c) ? { background: COLORE_CAT[c], borderColor: COLORE_CAT[c], color: '#0f172a' } : { borderColor: '#475569', color: '#cbd5e1' }}>{catLabel[c]}</button>
            ))}
          </div>
          {righe.length === 0 ? <p className="muted text-slate-500 text-sm">{s.regEmpty}</p> : (
            <table className="w-full text-sm" data-testid="registro-table">
              <tbody>
                {righe.map((g, i) => (
                  <React.Fragment key={i}>
                    <tr className="border-t border-slate-800 hover:bg-slate-800/50 cursor-pointer" onMouseEnter={() => setCursor(g.voce.at)} onClick={() => g.riassunte.length && toggle(open, i, setOpen)}>
                      <td className="py-1 pr-2 font-mono text-slate-300 w-14 align-top">{mmss(g.voce.at - r.t0)}</td>
                      <td className="py-1 pr-2 w-28 align-top"><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: COLORE_CAT[g.voce.cat] }} />{catLabel[g.voce.cat]}</td>
                      {ventIds.length > 1 && <td className="py-1 pr-2 muted text-slate-400 w-28 align-top">{r.vents[g.voce.vent] || g.voce.vent}</td>}
                      <td className="py-1 pr-2 muted text-slate-400 w-20 align-top">{whoLabel[g.voce.who]}</td>
                      <td className="py-1">{g.voce.text}{g.riassunte.length > 0 && <span className="muted text-xs text-slate-400"> · {g.riassunte.length} {s.regAdjustments} {open.has(i) ? '▴' : '▾'}</span>}</td>
                    </tr>
                    {open.has(i) && g.riassunte.map((v, j) => (
                      <tr key={j} className="text-xs muted text-slate-400"><td className="font-mono pl-3">{mmss(v.at - r.t0)}</td><td colSpan={4} className="pl-8">{v.text}</td></tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
};

const Trends: React.FC<{ r: Registro; params: Set<string>; vent?: string; total: number; cursor: number | null; voci: Registro['voci'] }> = ({ r, params, vent, total, cursor, voci }) => {
  const lanes = PARAMETRI_REGISTRO.filter((p) => params.has(p.key));
  const H = 46;
  const samples = r.campioni.filter((c) => !vent || c.vent === vent);
  const x = (at: number) => ((at - r.t0) / total) * W;
  return (
    <svg viewBox={`0 0 ${W} ${lanes.length * H + 22}`} className="w-full" preserveAspectRatio="none" style={{ height: lanes.length * 52 + 26 }}>
      {voci.map((v, i) => <line key={i} x1={x(v.at)} x2={x(v.at)} y1={0} y2={8} stroke={COLORE_CAT[v.cat]} strokeWidth={2} />)}
      {lanes.map((p, li) => {
        const pts = samples.map((c) => [c.at, c.v[p.key]] as const).filter(([, v]) => Number.isFinite(v));
        const vals = pts.map(([, v]) => v);
        const mn = vals.length ? Math.min(...vals) : 0, mx = vals.length ? Math.max(...vals) : 1;
        const pad = Math.max(1, (mx - mn) * 0.15);
        const y0 = 12 + li * H;
        const y = (v: number) => y0 + H - 6 - ((v - (mn - pad)) / (mx + pad - (mn - pad))) * (H - 12);
        return (
          <g key={p.key}>
            <line x1={0} x2={W} y1={y0 + H - 2} y2={y0 + H - 2} stroke="#334155" strokeWidth={0.5} />
            <text x={4} y={y0 + 10} fontSize={10} fill={p.color}>{p.label} {vals.length ? `${Math.round(mn)}–${Math.round(mx)} ${p.unit}` : ''}</text>
            <polyline fill="none" stroke={p.color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" points={pts.map(([at, v]) => `${x(at)},${y(v)}`).join(' ')} />
          </g>
        );
      })}
      {cursor !== null && <line x1={x(cursor)} x2={x(cursor)} y1={0} y2={lanes.length * H + 14} stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth={1} />}
      <text x={0} y={lanes.length * H + 20} fontSize={10} fill="#94a3b8">0:00</text>
      <text x={W} y={lanes.length * H + 20} fontSize={10} fill="#94a3b8" textAnchor="end">{mmss(total)}</text>
    </svg>
  );
};
