/**
 * Director console, "Gas exchange" tab: the patient's gas exchange parameters,
 * one-lung ventilation, and the live picture for the instructor: the arterial
 * blood gas as a physiological reference (nobody "draws" it, the ventilator
 * sends it to no one), shunt, dead space, HPV tone, safe apnoea time.
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
}> = ({ s, ist, onApply }) => {
  const attuali = ist.scambio?.parametri ?? ist.parametriScambio ?? PARAMETRI_SCAMBIO;
  const [vals, setVals] = useState<ParametriScambio>({ ...attuali });
  const [portataAuto, setPortataAuto] = useState(attuali.portata === null);
  const lettura = useMemo(() => emogasDi(ist), [ist]);
  const kg = ist.paziente.pesoKg ?? 70;
  const portata = vals.portata ?? Math.round(0.07 * kg * 10) / 10;
  const mono = ist.fisiologia.monopolmonare ?? null;

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

      <div className="text-slate-400 text-xs">{s.abgTitle}</div>
      <div className="grid grid-cols-6 gap-1 text-xs" data-testid="gas-live">
        <Box k="pH" v={fmt(lettura?.ph, 2)} />
        <Box k="PaCO₂" v={`${fmt(lettura?.paco2)} mmHg`} />
        <Box k="PaO₂" v={`${fmt(lettura?.pao2)} mmHg`} />
        <Box k="HCO₃⁻" v={`${fmt(lettura?.hco3, 1)} mmol/L`} />
        <Box k="BE" v={fmt(lettura?.be, 1)} />
        <Box k="SaO₂" v={`${fmt(lettura?.sao2)} %`} />
        <Box k={s.gasLactate} v={`${fmt(lettura?.lattato, 1)} mmol/L`} />
        <Box k="Hb" v={`${fmt(lettura?.hb, 1)} g/dL`} />
        <Box k="COHb · MetHb" v={lettura ? `${fmt(lettura.cohb * 100, 1)} · ${fmt(lettura.methb * 100, 1)} %` : '–'} />
        <Box k="SvO₂" v={`${fmt(lettura?.svo2)} %`} />
        <Box k="P/F" v={fmt(lettura?.pf)} />
        <Box k="A-a" v={`${fmt(lettura?.aa)} mmHg`} />
      </div>
      <div className="text-slate-400 text-xs">{s.gasDerived}</div>
      <div className="grid grid-cols-6 gap-1 text-xs" data-testid="gas-derived">
        <Box k="Qs/Qt" v={lettura ? `${Math.round(lettura.qsqt * 100)} %` : '–'} />
        <Box k="VD/VT" v={lettura?.vdvt != null ? `${Math.round(lettura.vdvt * 100)} %` : '–'} />
        <Box k="OI" v={fmt(lettura?.oi, 1)} />
        <Box k={s.gasVentRatio} v={fmt(lettura?.rapportoVentilatorio, 2)} />
        <Box k={s.gasHpvTone} v={lettura ? `${Math.round(lettura.tono * 100)} %` : '–'} />
        <Box k={s.gasSafeApnoea} v={lettura ? `${fmt(lettura.apneaSicuraMin, 1)} min` : '–'} />
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

    </div>
  );
};

const Box: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div className="bg-slate-800 rounded px-2 py-1"><div className="text-slate-400">{k}</div><div className="font-mono text-sm">{v}</div></div>
);
