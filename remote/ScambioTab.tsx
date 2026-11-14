/**
 * Director console, "Gas exchange" tab: the patient's gas exchange parameters,
 * one-lung ventilation, the live picture (shunt, dead space, HPV tone, safe
 * apnoea time) and the blood gas, which arrives after a delay like a real one.
 */
import React, { useMemo, useState } from 'react';
import type { RemoteStrings } from './strings';
import type { ComandoPaziente, VentIstantanea } from '../device/remoteTypes';
import { statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import {
  PARAMETRI_SCAMBIO,
  ingressiDaVentilatore,
  letturaScambio,
  type LetturaScambio,
  type ParametriScambio,
} from '../device/screens/scenario/ventilatore/scambio';

type Patch = Omit<ComandoPaziente, 'type'>;

/** The blood gas of a ventilator at this moment, or null before the model starts. */
export function emogasDi(ist: VentIstantanea): LetturaScambio | null {
  if (!ist.scambio) return null;
  const ing = ingressiDaVentilatore(statoDa(ist), ist.misure, { spo2: ist.paziente.spo2, etco2: ist.paziente.etco2 });
  return letturaScambio(ist.scambio, ing);
}

/** One line for the session log. */
export function rigaEmogas(l: LetturaScambio, s: RemoteStrings): string {
  const f = (x: number | null, d = 0) => (x === null || !Number.isFinite(x) ? '–' : x.toFixed(d));
  return `${s.abgTitle}: pH ${f(l.ph, 2)} · PaCO₂ ${f(l.paco2)} · PaO₂ ${f(l.pao2)} · HCO₃⁻ ${f(l.hco3, 1)} · BE ${f(l.be, 1)} · SaO₂ ${f(l.sao2)}% · Lac ${f(l.lattato, 1)} · FiO₂ ${f(l.fio2 * 100)}% · P/F ${f(l.pf)}`;
}

export interface Emogas { at: number; prontoAt: number; lettura: LetturaScambio }

type Campo = { k: keyof ParametriScambio; label: keyof RemoteStrings; min: number; max: number; step: number; unit?: string; digits?: number; perc?: boolean };
const CAMPI: Campo[] = [
  { k: 'shuntFisso', label: 'gasShunt', min: 0, max: 0.6, step: 0.01, unit: '%', perc: true },
  { k: 'bassoVQ', label: 'gasLowVQ', min: 0, max: 0.6, step: 0.01, unit: '%', perc: true },
  { k: 'spazioMortoAlv', label: 'gasDeadSpace', min: 0, max: 0.7, step: 0.01, unit: '%', perc: true },
  { k: 'diffusione', label: 'gasDiffusion', min: 0.1, max: 1, step: 0.05, unit: '%', perc: true },
  { k: 'hb', label: 'gasHb', min: 4, max: 20, step: 0.5, unit: 'g/dL', digits: 1 },
  { k: 'temperatura', label: 'gasTemp', min: 32, max: 42, step: 0.1, unit: '°C', digits: 1 },
  { k: 'metabolismo', label: 'gasMetab', min: 0.5, max: 3, step: 0.1, unit: '×', digits: 1 },
  { k: 'hco3', label: 'gasHco3', min: 8, max: 40, step: 1, unit: 'mmol/L' },
  { k: 'bmi', label: 'gasBmi', min: 15, max: 60, step: 1, unit: 'kg/m²' },
  { k: 'inibizioneHpv', label: 'gasHpvInhib', min: 0, max: 1, step: 0.05, unit: '%', perc: true },
  { k: 'noPpm', label: 'gasNo', min: 0, max: 40, step: 1, unit: 'ppm' },
  { k: 'cohb', label: 'gasCohb', min: 0, max: 0.6, step: 0.01, unit: '%', perc: true },
  { k: 'methb', label: 'gasMethb', min: 0, max: 0.6, step: 0.01, unit: '%', perc: true },
];

const fmt = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : v.toFixed(d));

export const ScambioTab: React.FC<{
  s: RemoteStrings;
  ist: VentIstantanea;
  onApply: (p: Patch, label: string, rampSec: number) => void;
  emogas: Emogas[];
  onEmogas: (ritardoSec: number) => void;
}> = ({ s, ist, onApply, emogas, onEmogas }) => {
  const attuali = ist.scambio?.parametri ?? ist.parametriScambio ?? PARAMETRI_SCAMBIO;
  const [vals, setVals] = useState<ParametriScambio>({ ...attuali });
  const [portataAuto, setPortataAuto] = useState(attuali.portata === null);
  const [ritardo, setRitardo] = useState(120);
  const lettura = useMemo(() => emogasDi(ist), [ist]);
  const kg = ist.paziente.pesoKg ?? 70;
  const portata = vals.portata ?? Math.round(0.07 * kg * 10) / 10;
  const mono = ist.fisiologia.monopolmonare ?? null;
  const ora = Date.now();

  const applica = () => {
    const patch: Partial<ParametriScambio> = {};
    const nomi: string[] = [];
    for (const c of CAMPI) {
      if (vals[c.k] !== attuali[c.k]) {
        (patch as Record<string, number>)[c.k] = vals[c.k] as number;
        nomi.push(`${s[c.label]} ${c.perc ? Math.round((vals[c.k] as number) * 100) + '%' : fmt(vals[c.k] as number, c.digits ?? 0)}`);
      }
    }
    const p = portataAuto ? null : portata;
    if (p !== attuali.portata) { patch.portata = p; nomi.push(`${s.gasCardiacOutput} ${p === null ? s.gasAuto : p}`); }
    if (!nomi.length) return;
    onApply({ scambio: patch }, nomi.join(', '), 0);
  };

  return (
    <div className="space-y-3" data-testid="gas-tab">
      <p className="text-slate-400 text-xs">{s.gasIntro}</p>

      <div className="grid grid-cols-5 gap-1 text-xs" data-testid="gas-live">
        <Box k="PaO₂" v={`${fmt(lettura?.pao2)} mmHg`} />
        <Box k="PaCO₂" v={`${fmt(lettura?.paco2)} mmHg`} />
        <Box k="pH" v={fmt(lettura?.ph, 2)} />
        <Box k="P/F" v={fmt(lettura?.pf)} />
        <Box k="SvO₂" v={`${fmt(lettura?.svo2)} %`} />
        <Box k="Qs/Qt" v={lettura ? `${Math.round(lettura.qsqt * 100)} %` : '–'} />
        <Box k="VD/VT" v={lettura?.vdvt != null ? `${Math.round(lettura.vdvt * 100)} %` : '–'} />
        <Box k={s.gasHpvTone} v={lettura ? `${Math.round(lettura.tono * 100)} %` : '–'} />
        <Box k={s.gasSafeApnoea} v={lettura ? `${fmt(lettura.apneaSicuraMin, 1)} min` : '–'} />
        <Box k={s.gasLactate} v={`${fmt(lettura?.lattato, 1)} mmol/L`} />
      </div>
      {!ist.scambio && <p className="text-amber-300 text-xs">{s.gasNotStarted}</p>}
      {lettura?.taraturaAlLimite && <p className="text-amber-300 text-xs" data-testid="gas-calib-limit">{s.gasCalibLimit}</p>}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
        <span className="text-slate-400">{s.gasOlv}:</span>
        {(['sinistro', 'destro', null] as const).map((m) => (
          <button key={String(m)} data-testid={`olv-${m ?? 'off'}`} onClick={() => onApply({ fisiologia: { monopolmonare: m } }, m === null ? s.gasOlvOff : m === 'sinistro' ? s.gasOlvLeft : s.gasOlvRight, 0)}
            className={`px-3 py-1.5 rounded border ${mono === m ? 'bg-sky-900 border-sky-500' : 'bg-slate-800 border-slate-700 hover:border-sky-500'}`}>
            {m === null ? s.gasOlvOff : m === 'sinistro' ? s.gasOlvLeft : s.gasOlvRight}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-slate-800 pt-3">
        {CAMPI.map((c) => {
          const v = vals[c.k] as number;
          const mostra = c.perc ? Math.round(v * 100) : v;
          return (
            <label key={c.k} className="block">
              <div className="flex justify-between text-slate-300 text-xs"><span>{s[c.label] as string}</span><span><b className="text-white font-mono">{c.perc ? mostra : fmt(v, c.digits ?? 0)}</b> {c.unit} <span className="text-slate-500">({s.now} {c.perc ? Math.round((attuali[c.k] as number) * 100) : fmt(attuali[c.k] as number, c.digits ?? 0)})</span></span></div>
              <input data-testid={`gas-${c.k}`} type="range" min={c.min} max={c.max} step={c.step} value={v} onChange={(e) => setVals((x) => ({ ...x, [c.k]: Number(e.target.value) }))} className="w-full accent-sky-500" />
            </label>
          );
        })}
        <label className="block">
          <div className="flex justify-between text-slate-300 text-xs"><span>{s.gasCardiacOutput}</span><span><b className="text-white font-mono">{portataAuto ? s.gasAuto : portata.toFixed(1)}</b> L/min</span></div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={portataAuto} onChange={(e) => setPortataAuto(e.target.checked)} /><span className="text-xs text-slate-400">{s.gasAuto}</span>
            <input data-testid="gas-portata" type="range" min={0.5} max={15} step={0.5} disabled={portataAuto} value={portata} onChange={(e) => setVals((x) => ({ ...x, portata: Number(e.target.value) }))} className="w-full accent-sky-500" />
          </div>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button data-testid="gas-apply" onClick={applica} className="px-5 py-2 rounded-lg bg-sky-600 font-semibold">{s.apply}</button>
        <button data-testid="gas-defaults" onClick={() => { setVals({ ...PARAMETRI_SCAMBIO }); setPortataAuto(true); onApply({ scambio: 'predefiniti' }, s.gasDefaults, 0); }} className="px-4 py-2 rounded-lg bg-slate-700">{s.gasDefaults}</button>
      </div>

      <div className="border-t border-slate-800 pt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button data-testid="abg-request" disabled={!ist.scambio} onClick={() => onEmogas(ritardo)} className="px-4 py-2 rounded-lg bg-rose-700 disabled:bg-slate-700 font-semibold">{s.abgButton}</button>
          <label className="flex items-center gap-2 text-xs">{s.abgDelay}
            <select data-testid="abg-delay" value={ritardo} onChange={(e) => setRitardo(Number(e.target.value))} className="bg-slate-800 border border-slate-700 rounded px-2 py-1">
              <option value={0}>{s.rampNow}</option><option value={60}>1 min</option><option value={120}>2 min</option><option value={300}>5 min</option>
            </select>
          </label>
        </div>
        {[...emogas].reverse().slice(0, 4).map((e) => (
          <div key={e.at} className="bg-slate-800 rounded px-3 py-2 text-xs" data-testid="abg-result">
            <div className="text-slate-400">{s.abgTitle} · {new Date(e.at).toLocaleTimeString()}{e.prontoAt > ora ? ` · ${s.abgPending} ${Math.ceil((e.prontoAt - ora) / 1000)} s` : ''}</div>
            {e.prontoAt <= ora && (
              <div className="grid grid-cols-6 gap-1 mt-1 font-mono">
                <span>pH {fmt(e.lettura.ph, 2)}</span><span>PaCO₂ {fmt(e.lettura.paco2)}</span><span>PaO₂ {fmt(e.lettura.pao2)}</span>
                <span>HCO₃⁻ {fmt(e.lettura.hco3, 1)}</span><span>BE {fmt(e.lettura.be, 1)}</span><span>SaO₂ {fmt(e.lettura.sao2)}%</span>
                <span>Lac {fmt(e.lettura.lattato, 1)}</span><span>Hb {fmt(e.lettura.hb, 1)}</span><span>COHb {fmt(e.lettura.cohb * 100, 1)}%</span>
                <span>MetHb {fmt(e.lettura.methb * 100, 1)}%</span><span>FiO₂ {fmt(e.lettura.fio2 * 100)}%</span><span>P/F {fmt(e.lettura.pf)}</span>
                <span>A-a {fmt(e.lettura.aa)}</span><span>SvO₂ {fmt(e.lettura.svo2)}%</span><span>OI {fmt(e.lettura.oi, 1)}</span>
                <span>VR {fmt(e.lettura.rapportoVentilatorio, 2)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const Box: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div className="bg-slate-800 rounded px-2 py-1"><div className="text-slate-400">{k}</div><div className="font-mono text-sm">{v}</div></div>
);
