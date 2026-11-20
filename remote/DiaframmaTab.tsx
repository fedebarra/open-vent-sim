/**
 * Director console, "Diaphragm" tab (OVS 3.8): the EAdi catheter and what the
 * diaphragm signal says. The console mounts the catheter (on any patient, also
 * in standby and on high flow), chooses where it sits — right, too deep, too
 * shallow, dislodged — and drives what changes the signal: the patient's
 * neuromechanical efficiency, a phrenic nerve lesion, sedation and curare.
 * The learner's screen shows the signal as the catheter reads it; the name of
 * the fault lives here, not there.
 */
import React, { useState } from 'react';
import type { RemoteStrings } from './strings';
import type { ComandoPaziente, VentIstantanea } from '../device/remoteTypes';
import { CATETERI_EADI, NME_MASSIMA, NME_MINIMA, NME_NORMALE, type CatetereEAdi } from '../device/screens/scenario/ventilatore/eadi';

type Patch = Omit<ComandoPaziente, 'type'>;

const fmt1 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(1) : '–');

/** Patient pictures for the neuromechanical efficiency, cmH₂O/µV. */
const NME_QUADRI: { k: 'nme_strong' | 'nme_normal' | 'nme_weak' | 'nme_copd'; v: number }[] = [
  { k: 'nme_strong', v: 2 },
  { k: 'nme_normal', v: NME_NORMALE },
  { k: 'nme_weak', v: 0.4 },
  { k: 'nme_copd', v: 0.25 },
];

const FRENICO: { k: 'phrenic_intact' | 'phrenic_one' | 'phrenic_both'; v: number }[] = [
  { k: 'phrenic_intact', v: 0 },
  { k: 'phrenic_one', v: 0.5 },
  { k: 'phrenic_both', v: 1 },
];

export const DiaframmaTab: React.FC<{ s: RemoteStrings; ist: VentIstantanea; onApply: (p: Patch, label: string, rampSec: number) => void }> = ({ s, ist, onApply }) => {
  const f = ist.fisiologia;
  const catetere = f.catetereEAdi ?? null;
  const [nme, setNme] = useState(typeof f.nme === 'number' ? f.nme : NME_NORMALE);
  const frenico = f.lesioneFrenico ?? 0;
  const forza = ist.drive.forza ?? 1;
  const m = ist.misure;
  const btn = (on: boolean) => `px-3 py-1.5 rounded border ${on ? 'bg-sky-700 border-sky-400 text-white' : 'bg-slate-800 border-slate-700 hover:border-sky-500'}`;
  const metti = (c: CatetereEAdi | null) => onApply({ fisiologia: { catetereEAdi: c } }, c ? `${s.eadiCatheter}: ${s[`cath_${c}`]}` : s.eadiRemove, 0);
  return (
    <div className="space-y-3">
      <p className="text-slate-400 text-xs">{s.eadiIntro}</p>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-slate-400">{s.eadiCatheter}:</span>
        <button data-testid="cath-none" onClick={() => metti(null)} className={btn(catetere === null)}>{s.eadiNone}</button>
        {CATETERI_EADI.map((c) => (
          <button key={c} data-testid={`cath-${c}`} onClick={() => metti(c)} className={btn(catetere === c)}>{s[`cath_${c}`]}</button>
        ))}
      </div>
      <p className="text-slate-300 text-sm min-h-[1.25rem]">{catetere ? s[`cathHint_${catetere}`] : s.eadiNoneHint}</p>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-slate-800 rounded px-2 py-1"><div className="text-slate-400">{s.eadiPeak}</div><div data-testid="eadi-peak" className="font-mono text-base">{fmt1(m.eadiPicco)} µV</div></div>
        <div className="bg-slate-800 rounded px-2 py-1"><div className="text-slate-400">{s.eadiMin}</div><div data-testid="eadi-min" className="font-mono text-base">{fmt1(m.eadiMin)} µV</div></div>
        <div className="bg-slate-800 rounded px-2 py-1"><div className="text-slate-400">NME</div><div className="font-mono text-base">{fmt1(typeof f.nme === 'number' ? f.nme : NME_NORMALE)} cmH₂O/µV</div></div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-slate-400">{s.eadiNme}:</span>
        {NME_QUADRI.map(({ k, v }) => (
          <button key={k} data-testid={k} onClick={() => { setNme(v); onApply({ fisiologia: { nme: v } }, `NME ${v} — ${s[k]}`, 0); }} className={btn(Math.abs((f.nme ?? NME_NORMALE) - v) < 1e-6)}>{s[k]}</button>
        ))}
      </div>
      <div className="flex items-end gap-3">
        <label className="block flex-1">
          <div className="flex justify-between text-slate-300 text-xs"><span>NME</span><span><b className="text-white font-mono">{nme.toFixed(2)}</b> cmH₂O/µV</span></div>
          <input data-testid="sl-nme" type="range" min={NME_MINIMA} max={NME_MASSIMA} step={0.05} value={nme} onChange={(e) => setNme(Number(e.target.value))} className="w-full accent-sky-500" />
        </label>
        <button data-testid="nme-apply" onClick={() => onApply({ fisiologia: { nme } }, `NME ${nme.toFixed(2)}`, 0)} className="px-4 py-2 rounded-lg bg-sky-600 font-semibold">{s.apply}</button>
      </div>
      <p className="text-slate-500 text-xs">{s.eadiNmeHint}</p>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-slate-400">{s.eadiPhrenic}:</span>
        {FRENICO.map(({ k, v }) => (
          <button key={k} data-testid={k} onClick={() => onApply({ fisiologia: { lesioneFrenico: v } }, `${s.eadiPhrenic}: ${s[k]}`, 0)} className={btn(Math.abs(frenico - v) < 1e-6)}>{s[k]}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-slate-400">{s.eadiDrugs}:</span>
        <button data-testid="sed-light" onClick={() => onApply({ drive: { intensita: 0.3 }, rampaFrequenza: { a: 14, durataSec: 30 } }, s.sedLight, 0)} className={btn(false)}>{s.sedLight}</button>
        <button data-testid="sed-deep" onClick={() => onApply({ drive: { intensita: 0.15 }, rampaFrequenza: { a: 6, durataSec: 60 } }, s.sedDeep, 0)} className={btn(false)}>{s.sedDeep}</button>
        <button data-testid="nmb-on" onClick={() => onApply({ drive: { forza: 0 } }, s.nmbOn, 0)} className={btn(forza <= 0)}>{s.nmbOn}</button>
        <button data-testid="nmb-off" onClick={() => onApply({ drive: { forza: 1 } }, s.nmbOff, 120)} className={btn(false)}>{s.nmbOff}</button>
      </div>
      <p className="text-slate-500 text-xs">{s.eadiDrugsHint}</p>
    </div>
  );
};
