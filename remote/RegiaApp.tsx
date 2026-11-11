/**
 * Director console ("Regia"): sees every connected ventilator live and drives
 * the patient – lung, drive, vitals, asynchronies – and the machine; fires
 * timed events; records the session log.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { createLink, Link, LinkStatus } from './link';
import type { RemoteCommand, RemoteEvent, ServerMessage, VentInfo, VentSnapshot } from './protocol';
import { rt, RemoteStrings, ventName } from './strings';
import { MiniWaves } from './MiniWaves';
import { EVENT_LIBRARY, SequenceStep, parseSequence, EventDef } from './events';
import { comandiScenario, parseScenario, scenarioDa } from './scenario';
import { Tour } from '../tour/Tour';
import { REGIA_STEPS } from '../tour/regia';
import { RegistroView } from './RegistroView';
import { Categoria, Registro, nuovoRegistro, vociAllarmi, PASSO_CAMPIONE_MS, leggiJson } from './registro';
import { useLanguage } from '../src/contexts/LanguageContext';
import { translate } from '../device/i18n';
import type { ComandoPaziente, VentIstantanea, AzioneVentilatore } from '../device/remoteTypes';
import { PEEP_MINIMA_RI, PRESET_FISIOLOGIA, RECLUTAMENTO_SECONDI, trasmissioneToracica } from '../device/screens/scenario/ventilatore/fisica';
import { PRESET_ASINCRONIA, TIPI_ASINCRONIA, type TipoAsincronia } from '../device/screens/scenario/ventilatore/asincronie';
import { MODALITA_PER_AMBIENTE, PARAMETRI, impostazioniVisibili, type ChiaveImpostazione } from '../device/screens/scenario/ventilatore/parametri';
import { ALLARMI, LIMITI_INIZIALI, type ChiaveAllarme } from '../device/screens/scenario/ventilatore/allarmi';
import { NOME_AMBIENTE, NOME_ASINCRONIA, NOME_MODALITA, NOME_PRESET, NOME_MANOVRA, NOME_QUADRO } from '../device/screens/scenario/ventilatore/nomi';
import { QUADRI_MECCANICA, conQuadro, quadroAcceso, senzaQuadro, type QuadroMeccanica } from '../device/screens/scenario/ventilatore/quadri';

interface Props { wsUrl: string; regiaKey: string }
interface LogLine { at: number; vent: string; text: string; source: 'learner' | 'director' | 'device'; kind?: string }
interface Ramp { vent: string; group: 'fisiologia' | 'drive' | 'vitali'; key: string; from: number; to: number; start: number; dur: number }
type Patch = Omit<ComandoPaziente, 'type'>;

const num = (v: unknown, d = 0) => { const n = Number(v); return v !== null && v !== undefined && Number.isFinite(n) ? n : d; };
const fmt = (v: unknown, digits = 0) => { const n = Number(v); return v !== null && v !== undefined && v !== '' && Number.isFinite(n) ? n.toFixed(digits) : '–'; };
/** A seed for the spacing of a coughing fit: the same on every screen, different each time. */
const seme = () => Math.floor(Math.random() * 2 ** 31);
const PRESETS = Object.keys(PRESET_FISIOLOGIA) as (keyof typeof PRESET_FISIOLOGIA)[];
const REGISTRO_KEY = 'ovs-registro-corrente';

export const RegiaApp: React.FC<Props> = ({ wsUrl, regiaKey }) => {
  const { language, setLanguage } = useLanguage();
  const s = rt(language);
  const tr = useCallback((k: string, vars?: Record<string, string | number>) => translate(language, k as any, vars), [language]);

  const [status, setStatus] = useState<LinkStatus>('connecting');
  const [denied, setDenied] = useState(false);
  const [session, setSession] = useState({ name: '', pin: '' });
  const [vents, setVents] = useState<VentInfo[]>([]);
  const [snaps, setSnaps] = useState<Record<string, VentSnapshot>>({});
  const [log, setLog] = useState<LogLine[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [sendAll, setSendAll] = useState(false);
  const [tab, setTab] = useState<'patient' | 'async' | 'mechanics' | 'lung' | 'machine' | 'alarms' | 'events'>('patient');
  const [flash, setFlash] = useState<string | null>(null);
  const [ramps, setRamps] = useState<Ramp[]>([]);
  const [info, setInfo] = useState<{ addresses: string[]; port: number } | null>(null);
  const [registro, setRegistro] = useState<Registro | null>(() => { try { const t = localStorage.getItem(REGISTRO_KEY); return t ? leggiJson(t) : null; } catch { return null; } });
  const [recording, setRecording] = useState(() => { try { return localStorage.getItem('ovs-recording') === '1'; } catch { return false; } });
  const [showRegistro, setShowRegistro] = useState(false);
  const [tourActive, setTourActive] = useState(false);

  const linkRef = useRef<Link | null>(null);
  const rampsRef = useRef<Ramp[]>([]); rampsRef.current = ramps;
  const snapsRef = useRef(snaps); snapsRef.current = snaps;
  const ventsRef = useRef(vents); ventsRef.current = vents;
  const recRef = useRef(recording); recRef.current = recording;
  const regRef = useRef(registro); regRef.current = registro;

  // ------------------------------------------------------------ registro --
  const addVoce = useCallback((at: number, vent: string, cat: Categoria, who: 'learner' | 'director' | 'system', text: string, key?: string, value?: string | number) => {
    if (!recRef.current) return;
    setRegistro((r) => r ? { ...r, vents: { ...r.vents, [vent]: ventName(ventsRef.current.find((v) => v.id === vent)?.name || r.vents[vent] || vent, language) }, voci: [...r.voci, { at, vent, cat, who, text, key, value }] } : r);
  }, [language]);

  useEffect(() => { try { if (registro) localStorage.setItem(REGISTRO_KEY, JSON.stringify(registro)); } catch { /* full */ } }, [registro]);
  useEffect(() => { try { localStorage.setItem('ovs-recording', recording ? '1' : '0'); } catch { /* ignore */ } }, [recording]);

  // trend samples
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const at = Date.now();
      const samples = (Object.entries(snapsRef.current) as [string, VentSnapshot][]).filter(([, sn]) => sn.ventilatore).map(([vent, sn]) => {
        const v = sn.ventilatore!; const m = v.misure as any;
        return { at, vent, v: Object.fromEntries(Object.entries({ spo2: v.paziente.spo2, etco2: m.etco2 ?? v.paziente.etco2, pPeak: m.pPeak, peep: v.impostazioni.peep, vte: m.volumeExpired, f: m.measuredFrequency, fio2: v.impostazioni.fio2, hr: v.paziente.heartRate }).filter(([, x]) => x !== null && x !== undefined && Number.isFinite(Number(x))).map(([k, x]) => [k, Number(x)])) };
      });
      if (samples.length) setRegistro((r) => r ? { ...r, campioni: [...r.campioni, ...samples] } : r);
    }, PASSO_CAMPIONE_MS);
    return () => clearInterval(id);
  }, [recording]);

  const broadcastRecording = (on: boolean) => {
    for (const v of ventsRef.current) linkRef.current?.send({ t: 'cmd', to: v.id, cmd: { type: 'recording', on }, cmdId: 'rec' + Date.now() });
  };
  const startRecording = () => {
    const r = nuovoRegistro();
    r.vents = Object.fromEntries(ventsRef.current.map((v) => [v.id, ventName(v.name, language)]));
    setRegistro(r); setRecording(true); broadcastRecording(true);
    setFlash(s.recBadge);
  };
  const stopRecording = () => {
    setRecording(false); broadcastRecording(false);
    setRegistro((r) => r ? { ...r, t1: Date.now() } : r);
    setShowRegistro(true);
  };

  // ---------------------------------------------------------------- link --
  const addLog = useCallback((l: LogLine) => {
    setLog((prev) => [...prev.slice(-499), l]);
    const cat: Categoria = l.source === 'device' || l.kind?.startsWith('allarme') ? 'allarmi' : l.source === 'director' ? (l.kind === 'paziente' ? 'paziente' : 'regia') : 'ventilatore';
    addVoce(l.at, l.vent, cat, l.source === 'device' ? 'system' : l.source, l.text, l.kind && l.kind.startsWith('parametro') ? `${l.kind}` : undefined);
  }, [addVoce]);

  useEffect(() => {
    const link = createLink({
      url: wsUrl, role: 'regia', key: regiaKey,
      onStatus: (st, d) => { setStatus(st); if (st === 'denied' && d === 'key') setDenied(true); },
      onMessage: (m: ServerMessage) => {
        switch (m.t) {
          case 'welcome': setSession({ name: m.name, pin: m.pin || '' }); break;
          case 'vents':
            setVents(m.list);
            setSelected((cur) => cur && m.list.some((v) => v.id === cur) ? cur : (m.list[0]?.id ?? null));
            if (recRef.current) for (const v of m.list) if (v.connected) linkRef.current?.send({ t: 'cmd', to: v.id, cmd: { type: 'recording', on: true }, cmdId: 'rec' + Date.now() });
            break;
          case 'state': {
            const prev = snapsRef.current[m.from];
            const a = prev?.ventilatore?.allarmi.map((x) => x.chiave) ?? [];
            const b = m.state.ventilatore?.allarmi.map((x) => x.chiave) ?? [];
            if (recRef.current && prev && (a.join() !== b.join())) {
              vociAllarmi(a, b, Date.now(), m.from, (k) => tr((ALLARMI as any)[k]?.etichetta ?? k), s.alarmOn, s.alarmOff)
                .forEach((v) => addVoce(v.at, v.vent, v.cat, v.who, v.text));
            }
            setSnaps((p) => ({ ...p, [m.from]: m.state }));
            break;
          }
          case 'event': addLog({ at: m.event.at, vent: m.from, text: m.event.text, source: m.event.source || 'learner', kind: m.event.kind }); break;
          case 'events': setLog((prev) => {
            const seen = new Set(prev.map((l) => `${l.vent}|${l.at}|${l.text}`));
            const add = m.events.filter((e: RemoteEvent) => !seen.has(`${m.from}|${e.at}|${e.text}`)).map((e: RemoteEvent) => ({ at: e.at, vent: m.from, text: e.text, source: e.source || 'learner', kind: e.kind } as LogLine));
            return [...prev, ...add].sort((x, y) => x.at - y.at).slice(-500);
          }); break;
          case 'ack': if (!m.ok && m.error !== 'not-ready') setFlash(`⚠ ${m.error}`); break;
        }
      },
    });
    linkRef.current = link;
    const bridge = (window as any).ovsDesktop;
    if (bridge?.serverInfo) bridge.serverInfo().then((i: any) => i && setInfo({ addresses: i.addresses, port: i.port })).catch(() => {});
    return () => link.close();
  }, [wsUrl, regiaKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!flash) return; const id = setTimeout(() => setFlash(null), 3500); return () => clearTimeout(id); }, [flash]);

  const targets = useCallback((): string[] => sendAll ? ventsRef.current.filter((v) => v.connected).map((v) => v.id) : selected ? [selected] : [], [sendAll, selected]);

  const sendRaw = (to: string, cmd: RemoteCommand) => linkRef.current?.send({ t: 'cmd', to, cmd, cmdId: Math.random().toString(36).slice(2) });

  /** Machine command, applied as if the learner touched the screen. */
  const azione = useCallback((a: AzioneVentilatore, label: string) => {
    const list = targets();
    if (!list.length) { setFlash(s.noVentilators); return; }
    list.forEach((id) => { sendRaw(id, { type: 'azione', azione: a }); });
    setFlash(`${s.applied}: ${label}`);
  }, [targets, s]);

  // ---------------------------------------------------------------- ramps --
  const currentOf = (vent: string, group: Ramp['group'], key: string): number | undefined => {
    const v = snapsRef.current[vent]?.ventilatore as any;
    if (!v) return undefined;
    const src = group === 'vitali' ? v.paziente : v[group];
    const x = src?.[key];
    return x === null || x === undefined ? undefined : Number(x);
  };

  /** Patient change now, or gradually: numeric fields move over `rampSec`. */
  const paziente = useCallback((patch: Patch, label: string, rampSec: number) => {
    const list = targets();
    if (!list.length) { setFlash(s.noVentilators); return; }
    const now = Date.now();
    const newRamps: Ramp[] = [];
    for (const id of list) {
      const immediate: any = { ...patch };
      if (rampSec > 0) {
        for (const g of ['fisiologia', 'drive', 'vitali'] as const) {
          const part = (patch as any)[g];
          if (!part) continue;
          const keep: any = {};
          for (const [k, to] of Object.entries(part)) {
            const from = currentOf(id, g, k);
            if (typeof to === 'number' && from !== undefined && from !== to) newRamps.push({ vent: id, group: g, key: k, from, to, start: now, dur: rampSec * 1000 });
            else keep[k] = to;
          }
          if (Object.keys(keep).length) immediate[g] = keep; else delete immediate[g];
        }
      }
      if (Object.keys(immediate).length) sendRaw(id, { type: 'paziente', ...immediate });
      addLog({ at: now, vent: id, text: rampSec > 0 ? `${label} (${rampSec} ${s.seconds})` : label, source: 'director', kind: 'paziente' });
    }
    if (newRamps.length) setRamps((prev) => [...prev.filter((r) => !newRamps.some((n) => n.vent === r.vent && n.group === r.group && n.key === r.key)), ...newRamps]);
    setFlash(`${s.applied}: ${label}${rampSec > 0 ? ` – ${rampSec} ${s.seconds}` : ''}`);
  }, [targets, addLog, s]);

  useEffect(() => {
    const id = setInterval(() => {
      const list = rampsRef.current;
      if (!list.length) return;
      const now = Date.now();
      const byVent: Record<string, any> = {};
      const keep: Ramp[] = [];
      for (const r of list) {
        const p = Math.min(1, (now - r.start) / r.dur);
        let v = r.from + (r.to - r.from) * p;
        v = Math.abs(r.to) >= 10 || Math.abs(r.from) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
        ((byVent[r.vent] ||= {})[r.group] ||= {})[r.key] = v;
        if (p < 1) keep.push(r);
      }
      Object.entries(byVent).forEach(([vent, patch]) => sendRaw(vent, { type: 'paziente', ...patch }));
      if (keep.length !== list.length) setRamps(keep);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ------------------------------------------------------------ sequence --
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [seq, setSeq] = useState<{ index: number; nextAt: number; paused: number | null } | null>(null);
  const seqRef = useRef(seq); seqRef.current = seq;
  const stepsRef = useRef(steps); stepsRef.current = steps;
  const fireEvent = useCallback((id: string) => {
    const ev = EVENT_LIBRARY.find((e) => e.id === id);
    if (ev) paziente(ev.patch, s[ev.labelKey] as string, ev.rampSec);
  }, [paziente, s]);
  const fireRef = useRef(fireEvent); fireRef.current = fireEvent;
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setTick((x) => x + 1);
      const q = seqRef.current;
      if (!q || q.paused !== null || Date.now() < q.nextAt) return;
      const step = stepsRef.current[q.index];
      if (step) fireRef.current(step.eventId);
      const next = stepsRef.current[q.index + 1];
      setSeq(next ? { index: q.index + 1, nextAt: Date.now() + next.afterSec * 1000, paused: null } : null);
      if (!next) setFlash(s.eventsDone);
    }, 500);
    return () => clearInterval(id);
  }, [s.eventsDone]);

  // ------------------------------------------------------------- derived --
  const snap = selected ? snaps[selected] ?? null : null;
  const ist = snap?.ventilatore ?? null;
  const vent = vents.find((v) => v.id === selected) || null;
  const lan = info?.addresses?.length ? info.addresses : [window.location.hostname];
  const port = info?.port || Number(window.location.port) || 80;
  const ventUrl = `http://${lan[0]}:${port}/?role=vent&pin=${session.pin}`;
  const tabletUrl = `http://${lan[0]}:${port}/?role=regia&key=${regiaKey}`;

  // A ventilator on the second screen of the computer running the console: the
  // desktop app places it full screen on the other display; in a browser it is
  // a new window to drag there (it joins this session like any learner).
  const apriSecondoSchermo = () => {
    const desk = (window as any).ovsDesktop;
    if (desk?.openSecondScreen) { desk.openSecondScreen().catch((e: unknown) => setFlash(String(e))); return; }
    window.open(`${window.location.protocol}//${window.location.host}/?role=vent&pin=${session.pin}`, '_blank', 'popup,width=1366,height=860');
  };

  if (denied) return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6"><p className="text-red-300 text-lg">{s.regiaDenied}</p></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 text-sm" data-testid="regia">
      <header className="flex flex-wrap items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-800">
        <span className="text-lg font-bold">Open Vent Sim · {s.regiaTitle}</span>
        <span className="text-slate-400 truncate">{session.name}</span>
        <span className="flex flex-wrap items-center gap-2 ml-auto">
          <Dot ok={status === 'online'} />
          {status !== 'online' && <span className="text-slate-400">{status === 'offline' ? s.regiaOffline : s.regiaConnecting}</span>}
          {!recording
            ? <button data-testid="rec-start" onClick={startRecording} className="px-3 py-1.5 rounded-lg border-2 border-red-500 bg-slate-800 font-semibold">● {s.recStart}</button>
            : <button data-testid="rec-stop" onClick={stopRecording} className="px-3 py-1.5 rounded-lg bg-red-600 font-semibold animate-pulse">■ {s.recStop}</button>}
          <button data-testid="regia-tour" onClick={() => setTourActive(true)} className="px-3 py-1.5 rounded-lg bg-sky-800">? {s.guide}</button>
          {registro && <button data-testid="rec-open" onClick={() => setShowRegistro(true)} className="px-3 py-1.5 rounded-lg bg-slate-700">{s.recOpen}</button>}
          <span className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700">{s.regiaPin}: <b data-testid="regia-pin" className="text-2xl tracking-widest text-amber-300 font-mono">{session.pin || '····'}</b></span>
          <select aria-label={s.language} value={language} onChange={(e) => setLanguage(e.target.value as 'it' | 'en')} className="bg-slate-800 border border-slate-700 rounded px-2 py-1">
            <option value="it">IT</option><option value="en">EN</option>
          </select>
        </span>
      </header>
      <Tour active={tourActive} onClose={() => setTourActive(false)} steps={REGIA_STEPS}
        context={{ screen: 'running', icuChoice: false, ambiente: ist?.ambiente ?? null, vent: ist, actions: [] }} />
      {flash && <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 shadow-xl" data-testid="regia-flash">{flash}</div>}

      <div className="grid gap-3 p-3" style={{ gridTemplateColumns: 'minmax(250px, 300px) 1fr minmax(260px, 320px)' }}>
        <aside className="space-y-3">
          <ConnectCard s={s} ventUrl={ventUrl} tabletUrl={tabletUrl} pin={session.pin} addresses={lan} port={port} expanded={vents.length === 0} onSecondScreen={apriSecondoSchermo} />
          <Card title={`${s.ventilators} (${vents.filter((v) => v.connected).length})`}>
            {vents.length === 0 && <p className="text-slate-400">{s.noVentilators}</p>}
            <ul className="space-y-1" data-testid="vent-list">
              {vents.map((v) => <VentRow key={v.id} v={v} snap={snaps[v.id]} s={s} tr={tr} lang={language} active={v.id === selected} onSelect={() => setSelected(v.id)}
                onRename={(name) => linkRef.current?.send({ t: 'rename', id: v.id, name })} onRemove={() => linkRef.current?.send({ t: 'forget', id: v.id })} />)}
            </ul>
          </Card>
        </aside>

        <main className="space-y-3 min-w-0">
          <Card title={vent ? ventName(vent.name, language) : s.ventilators} right={ist && <Summary ist={ist} s={s} tr={tr} />}>
            {!snap ? <p className="text-slate-400 py-8 text-center">{vent ? s.waitingData : s.noVentilators}</p>
              : !ist ? <p className="text-slate-400 py-8 text-center">{(s as any)['screen_' + snap.screen] || snap.screen}</p> : (
                <div data-tour="regia-ventilatore">
                  <MiniWaves ist={ist} />
                  <Numbers ist={ist} />
                  <div className="mt-2 flex flex-wrap gap-1 items-center">
                    <span className="text-slate-400 mr-1">{s.alarms}:</span>
                    {ist.allarmi.length === 0 ? <span className="text-slate-500">{s.noAlarms}</span> :
                      ist.allarmi.map((a) => <span key={a.chiave} className="px-2 py-0.5 rounded bg-red-900/70 border border-red-600 text-red-100 text-xs">{tr((ALLARMI as any)[a.chiave]?.etichetta ?? a.chiave)}{a.verso ? (a.verso === 'alto' ? ' ↑' : ' ↓') : ''}</span>)}
                  </div>
                </div>
              )}
          </Card>

          <Card title="" pad={false}>
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 px-2 pt-2">
              {(['patient', 'async', 'mechanics', 'lung', 'machine', 'alarms', 'events'] as const).map((k) => (
                <button key={k} data-testid={`tab-${k}`} onClick={() => setTab(k)} className={`px-3 py-2 rounded-t-lg ${tab === k ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}>
                  {{ patient: s.tabPatient, async: s.tabAsync, mechanics: s.tabMechanics, lung: s.tabLung, machine: s.tabMachine, alarms: s.tabAlarms, events: s.tabEvents }[k]}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-2 text-slate-300 pb-1 pr-2">{s.sendTo}:
                <select data-testid="send-to" value={sendAll ? 'all' : 'one'} onChange={(e) => setSendAll(e.target.value === 'all')} className="bg-slate-800 border border-slate-700 rounded px-2 py-1">
                  <option value="one">{s.sendToThis}</option><option value="all">{s.sendToAll}</option>
                </select>
              </label>
            </div>
            <div className="p-3">
              {!ist && tab !== 'events' ? <p className="text-slate-400">{s.notRunning}</p> : <>
                {tab === 'patient' && ist && <PatientTab key={selected!} s={s} tr={tr} ist={ist} onApply={paziente} ramps={ramps.filter((r) => targets().includes(r.vent))} onStopRamps={() => setRamps([])} />}
                {tab === 'async' && ist && <AsyncTab key={selected!} s={s} tr={tr} ist={ist} onApply={paziente} />}
                {tab === 'mechanics' && ist && <MechanicsTab key={selected!} s={s} tr={tr} ist={ist} onApply={paziente} />}
                {tab === 'lung' && ist && <LungTab key={selected!} s={s} ist={ist} onApply={paziente} onRecruit={() => azione({ tipo: 'manovra', manovra: 'reclutamento' }, s.recruitmentStart)} />}
                {tab === 'machine' && ist && <MachineTab s={s} tr={tr} ist={ist} azione={azione} onPaziente={paziente} opzioni={(on) => { targets().forEach((id) => sendRaw(id, { type: 'opzioni', pressioniDidattiche: on })); setFlash(`${s.applied}: ${s.teachingTraces} ${on ? 'ON' : 'OFF'}`); }} />}
                {tab === 'alarms' && ist && <AlarmsTab s={s} tr={tr} ist={ist} azione={azione} />}
              </>}
              {tab === 'events' && <EventsTab s={s} steps={steps} setSteps={setSteps} seq={seq} setSeq={setSeq} fire={fireEvent} />}
            </div>
          </Card>
        </main>

        <aside>
          <Card title={s.log}>
            <div className="max-h-[78vh] overflow-y-auto space-y-1 text-xs" data-testid="regia-log">
              {log.length === 0 && <p className="text-slate-500">{s.logEmpty}</p>}
              {[...log].reverse().map((l, i) => (
                <div key={i} className={`border-l-2 pl-2 ${l.source === 'director' ? 'border-amber-400' : l.source === 'device' ? 'border-red-400' : 'border-sky-400'}`}>
                  <span className="text-slate-500">{new Date(l.at).toLocaleTimeString()}</span>{' '}
                  <span className="text-slate-400">{ventName(vents.find((v) => v.id === l.vent)?.name || l.vent, language)}</span>{' '}
                  <span className={l.source === 'director' ? 'text-amber-200' : 'text-sky-200'}>[{l.source === 'director' ? s.director : l.source === 'device' ? s.system : s.learner}]</span>{' '}
                  <span className="break-words">{l.text}</span>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>
      {showRegistro && registro && (
        <RegistroView registro={registro} s={s} recording={recording} onClose={() => setShowRegistro(false)}
          onChangeScheda={(sc) => setRegistro((r) => r ? { ...r, scheda: sc } : r)} onOpen={(r) => { setRegistro(r); setRecording(false); }} />
      )}
    </div>
  );
};

// ======================================================================== UI

const Dot: React.FC<{ ok: boolean }> = ({ ok }) => <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />;

const Card: React.FC<{ title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; pad?: boolean }> = ({ title, right, children, pad = true }) => (
  <section className="bg-slate-900 border border-slate-800 rounded-xl">
    {(title || right) && <div className="flex items-center gap-2 px-3 pt-2.5 pb-1"><h2 className="font-semibold text-slate-200">{title}</h2><div className="ml-auto">{right}</div></div>}
    <div className={pad ? 'px-3 pb-3' : ''}>{children}</div>
  </section>
);

const QR: React.FC<{ text: string; size?: number; testId?: string }> = ({ text, size = 180, testId }) => {
  const [src, setSrc] = useState('');
  useEffect(() => { QRCode.toDataURL(text, { margin: 1, width: size * 2 }).then(setSrc).catch(() => setSrc('')); }, [text, size]);
  return src ? <img data-testid={testId} src={src} width={size} height={size} alt="QR" className="rounded bg-white p-1" /> : null;
};

const ConnectCard: React.FC<{ s: RemoteStrings; ventUrl: string; tabletUrl: string; pin: string; addresses: string[]; port: number; expanded: boolean; onSecondScreen: () => void }> = ({ s, ventUrl, tabletUrl, pin, addresses, port, expanded, onSecondScreen }) => {
  const [open, setOpen] = useState(expanded);
  const [tablet, setTablet] = useState(false);
  useEffect(() => { if (expanded) setOpen(true); }, [expanded]);
  // OVS 3.3: the second screen sits under the QR code, as a question — it is the
  // other way to "let a ventilator in" (classroom feedback). Shown also when the
  // card is folded, so the guided tour can always point at it.
  const secondo = (
    <p className="text-slate-300 text-center" title={s.secondScreenHint}>
      {s.secondScreenAsk}{' '}
      <button data-testid="second-screen" onClick={onSecondScreen} className="text-sky-300 underline font-semibold">{s.secondScreenOpen}</button>
    </p>
  );
  return (
    <Card title={s.howToTitle} right={<button className="text-xs underline" onClick={() => setOpen(!open)}>{open ? s.hideQr : s.showQr}</button>}>
      {open && (
        <div className="space-y-2" data-testid="connect-card">
          <ol className="list-decimal pl-4 space-y-1 text-slate-300"><li>{s.howTo1}</li><li>{s.howTo2}</li></ol>
          <div className="flex justify-center"><QR text={ventUrl} testId="vent-qr" /></div>
          {secondo}
          <ol start={3} className="list-decimal pl-4 space-y-1 text-slate-300"><li>{s.howTo3}</li><li>{s.howTo4} <b className="font-mono text-amber-300 text-lg">{pin}</b></li></ol>
          <div className="bg-slate-800 rounded p-2 font-mono text-xs break-all select-all" data-testid="vent-address">http://{addresses[0]}:{port}</div>
          {addresses.length > 1 && <details className="text-xs text-slate-400"><summary>{s.otherAddresses}</summary>{addresses.slice(1).map((a) => <div key={a} className="font-mono">http://{a}:{port}</div>)}</details>}
          <details className="text-xs text-slate-400" onToggle={(e) => setTablet((e.target as HTMLDetailsElement).open)}>
            <summary>{s.tabletRegia}</summary>
            <p className="my-1 text-amber-200">{s.tabletRegiaHint}</p>
            {tablet && <div className="flex justify-center"><QR text={tabletUrl} size={150} /></div>}
          </details>
        </div>
      )}
      {!open && secondo}
    </Card>
  );
};

type Tr = (k: string, vars?: Record<string, string | number>) => string;

const VentRow: React.FC<{ v: VentInfo; snap?: VentSnapshot; s: RemoteStrings; tr: Tr; lang: string; active: boolean; onSelect: () => void; onRename: (n: string) => void; onRemove: () => void }> = ({ v, snap, s, tr, lang, active, onSelect, onRename, onRemove }) => {
  const [confirm, setConfirm] = useState(false);
  const ist = snap?.ventilatore;
  return (
    <li className={`rounded-lg px-2 py-1.5 cursor-pointer border ${active ? 'bg-slate-800 border-sky-600' : 'border-transparent hover:bg-slate-800/60'}`} onClick={onSelect} data-testid={`vent-${v.id}`}>
      <div className="flex items-center gap-2">
        <Dot ok={v.connected} />
        <span className="font-semibold truncate">{ventName(v.name, lang)}</span>
        {!!v.mirrors && <span data-testid={`mirrors-${v.id}`} title={s.mirrorsHint} className="text-xs text-sky-300 shrink-0">▣ +{v.mirrors}</span>}
        {active && (
          <span className="ml-auto flex gap-2 text-xs">
            <button className="underline" onClick={(e) => { e.stopPropagation(); const n = window.prompt(s.rename, v.name); if (n) onRename(n); }}>{s.rename}</button>
            <button className="underline text-red-300" onClick={(e) => { e.stopPropagation(); if (confirm) onRemove(); else { setConfirm(true); setTimeout(() => setConfirm(false), 3000); } }}>{confirm ? s.removeConfirm : s.remove}</button>
          </span>
        )}
      </div>
      <div className="text-xs text-slate-400 pl-4">
        {!v.connected ? s.offlineSince : !snap ? s.waitingData : ist
          ? `${tr(NOME_AMBIENTE[ist.ambiente])} · ${ist.modalita} · ${ist.ventilando ? s.ventilating : s.standby}`
          : (s as any)['screen_' + snap.screen] || snap.screen}
        {ist && ist.allarmi.length > 0 && <span className="ml-1 text-red-400">● {ist.allarmi.length}</span>}
      </div>
    </li>
  );
};

const Summary: React.FC<{ ist: VentIstantanea; s: RemoteStrings; tr: Tr }> = ({ ist, s, tr }) => (
  <span className="text-xs text-slate-300 flex gap-2 items-center">
    <span>{tr(NOME_AMBIENTE[ist.ambiente])}</span>
    <span className="px-2 py-0.5 rounded bg-sky-900 border border-sky-700 font-semibold">{ist.modalita}</span>
    <span className={ist.ventilando ? 'text-green-400' : 'text-slate-400'}>{ist.ventilando ? `● ${s.ventilating}` : s.standby}</span>
    {ist.ambiente === 'anestesia' && ist.respiro === 'manuale' && <span>({s.manual})</span>}
    {ist.manovra && <span className="text-amber-300">⏸ {tr(NOME_MANOVRA[ist.manovra])}</span>}
  </span>
);

const Numbers: React.FC<{ ist: VentIstantanea }> = ({ ist }) => {
  const m = ist.misure as any, i = ist.impostazioni as any, p = ist.paziente;
  const items: [string, unknown, number, string][] = [
    ['Ppeak', m.pPeak, 0, 'cmH₂O'], ['Pplat', m.pPlateau, 0, 'cmH₂O'], ['PEEP', i.peep, 0, 'cmH₂O'],
    ['VTe', m.volumeExpired, 0, 'mL'], ['MV', m.volumeMinute, 1, 'L/min'], ['f', m.measuredFrequency, 0, '/min'],
    ['FiO₂', i.fio2, 0, '%'], ['SpO₂', p.spo2 ?? m.spo2, 0, '%'], ['EtCO₂', m.etco2 ?? p.etco2, 0, 'mmHg'],
    ['C', m.compliance, 0, 'mL/cmH₂O'], ['R', m.resistance, 0, 'cmH₂O/L/s'], ['HR', p.heartRate, 0, '/min'],
  ];
  return (
    <div className="grid grid-cols-6 gap-1 mt-2" data-testid="regia-numbers">
      {items.map(([k, v, d, u]) => (
        <div key={k} className="bg-slate-800/70 rounded px-2 py-1">
          <div className="text-[10px] text-slate-400">{k} <span className="text-slate-500">{u}</span></div>
          <div className="text-lg font-mono leading-tight" data-testid={`num-${k}`}>{fmt(v, d)}</div>
        </div>
      ))}
    </div>
  );
};

const RampSelect: React.FC<{ s: RemoteStrings; value: number; onChange: (v: number) => void }> = ({ s, value, onChange }) => (
  <label className="flex items-center gap-2">{s.rampLabel}
    <select data-testid="ramp-select" value={value} onChange={(e) => onChange(Number(e.target.value))} className="bg-slate-800 border border-slate-700 rounded px-2 py-1">
      <option value={0}>{s.rampNow}</option><option value={30}>30 s</option><option value={60}>1 min</option><option value={120}>2 min</option><option value={300}>5 min</option>
    </select>
  </label>
);

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step: number; live?: unknown; unit?: string; digits?: number; onChange: (v: number) => void; testId?: string; nowLabel?: string }> = ({ label, value, min, max, step, live, unit, digits = 0, onChange, testId, nowLabel = 'ora' }) => (
  <label className="block">
    <div className="flex justify-between text-slate-300 text-xs"><span>{label}</span><span><b className="text-white font-mono">{value.toFixed(digits)}</b> {unit} {live !== undefined && <span className="text-slate-500">({nowLabel} {fmt(live, digits)})</span>}</span></div>
    <input data-testid={testId} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-sky-500" />
  </label>
);

// -------------------------------------------------------------- Patient tab
type FieldDef = { g: 'fisiologia' | 'drive' | 'vitali'; k: string; label: keyof RemoteStrings; min: number; max: number; step: number; unit?: string; digits?: number; def: number; testId?: string };
const PATIENT_FIELDS: FieldDef[] = [
  { g: 'fisiologia', k: 'compliance', label: 'compliance', min: 5, max: 120, step: 1, unit: 'mL/cmH₂O', def: 60, testId: 'sl-compliance' },
  { g: 'fisiologia', k: 'resistenza', label: 'resistance', min: 2, max: 60, step: 1, unit: 'cmH₂O/L/s', def: 8, testId: 'sl-resistance' },
  { g: 'drive', k: 'frequenza', label: 'spontaneousRate', min: 0, max: 45, step: 1, unit: '/min', def: 0, testId: 'sl-spont' },
  { g: 'drive', k: 'intensita', label: 'inspEffort', min: 0, max: 1, step: 0.05, digits: 2, def: 0.5 },
  { g: 'fisiologia', k: 'limitazioneFlusso', label: 'flowLimitation', min: 0, max: 1, step: 0.05, digits: 2, def: 0 },
  { g: 'fisiologia', k: 'secrezioni', label: 'secretions', min: 0, max: 1, step: 0.05, digits: 2, def: 0 },
  { g: 'fisiologia', k: 'sforzoEspiratorio', label: 'expEffort', min: 0, max: 1, step: 0.05, digits: 2, def: 0 },
];
const VITAL_FIELDS: FieldDef[] = [
  { g: 'vitali', k: 'spo2', label: 'spo2Target', min: 50, max: 100, step: 1, unit: '%', def: 98, testId: 'sl-spo2' },
  { g: 'vitali', k: 'etco2', label: 'etco2Target', min: 10, max: 100, step: 1, unit: 'mmHg', def: 38 },
  { g: 'vitali', k: 'heartRate', label: 'heartRate', min: 20, max: 200, step: 1, unit: '/min', def: 75 },
  { g: 'vitali', k: 'map', label: 'bloodPressure', min: 30, max: 140, step: 1, unit: 'mmHg', def: 85 },
];
const liveOf = (ist: VentIstantanea, f: FieldDef) => { const src: any = f.g === 'vitali' ? ist.paziente : (ist as any)[f.g]; return src?.[f.k]; };

const PatientTab: React.FC<{ s: RemoteStrings; tr: Tr; ist: VentIstantanea; onApply: (p: Patch, label: string, rampSec: number) => void; ramps: Ramp[]; onStopRamps: () => void }> = ({ s, tr, ist, onApply, ramps, onStopRamps }) => {
  const all = [...PATIENT_FIELDS, ...VITAL_FIELDS];
  const [vals, setVals] = useState<Record<string, number>>(() => Object.fromEntries(all.map((f) => [`${f.g}.${f.k}`, num(liveOf(ist, f), f.def)])));
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [ramp, setRamp] = useState(0);
  const set = (id: string, v: number) => { setVals((x) => ({ ...x, [id]: v })); setDirty((d) => new Set(d).add(id)); };
  const apply = () => {
    const patch: any = {};
    const names: string[] = [];
    dirty.forEach((id) => { const [g, k] = id.split('.'); (patch[g] ||= {})[k] = vals[id]; const f = all.find((x) => `${x.g}.${x.k}` === id)!; names.push(`${s[f.label]} ${vals[id]}`); });
    // the spontaneous rate uses the engine's own ramp (keeps the breath phase)
    if (ramp > 0 && patch.drive?.frequenza !== undefined) { patch.rampaFrequenza = { a: patch.drive.frequenza, durataSec: ramp }; delete patch.drive.frequenza; if (!Object.keys(patch.drive).length) delete patch.drive; }
    if (!names.length) return;
    onApply(patch, names.join(', '), ramp);
    setDirty(new Set());
  };
  const row = (f: FieldDef) => { const id = `${f.g}.${f.k}`; return <Slider key={id} testId={f.testId} label={s[f.label] as string} unit={f.unit} digits={f.digits} value={vals[id]} min={f.min} max={f.max} step={f.step} live={liveOf(ist, f)} nowLabel={s.now} onChange={(v) => set(id, v)} />; };
  return (
    <div className="space-y-3">
      <div>
        <div className="text-slate-400 mb-1">{s.presets}</div>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((k) => (
            <button key={k} data-testid={`preset-${k}`} onClick={() => { const p = PRESET_FISIOLOGIA[k]; setVals((x) => ({ ...x, 'fisiologia.compliance': p.fisiologia.compliance, 'fisiologia.resistenza': p.fisiologia.resistenza, 'drive.frequenza': p.drive.frequenza, 'drive.intensita': p.drive.intensita })); onApply({ preset: k }, tr(NOME_PRESET[k]), 0); setDirty(new Set()); }}
              className={`px-2.5 py-1 rounded border ${ist.fisiologia.preset === k ? 'bg-sky-900 border-sky-500' : 'bg-slate-800 border-slate-700 hover:border-sky-500'}`}>{tr(NOME_PRESET[k])}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">{PATIENT_FIELDS.map(row)}</div>
      <div className="text-slate-400">{s.vitals}</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">{VITAL_FIELDS.map(row)}</div>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <RampSelect s={s} value={ramp} onChange={setRamp} />
        <button data-testid="patient-apply" disabled={!dirty.size} onClick={apply} className="px-5 py-2 rounded-lg bg-sky-600 disabled:bg-slate-700 disabled:text-slate-400 font-semibold">{s.apply}{dirty.size ? ` (${dirty.size})` : ''}</button>
        {ramps.length > 0 && <span className="text-amber-300 text-xs">{s.activeRamps}: {ramps.map((r) => `${r.key} → ${r.to}`).join(', ')} <button className="underline ml-1" onClick={onStopRamps}>{s.stopRamps}</button></span>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- Async tab
const AsyncTab: React.FC<{ s: RemoteStrings; tr: Tr; ist: VentIstantanea; onApply: (p: Patch, label: string, rampSec: number) => void }> = ({ s, tr, ist, onApply }) => {
  const [tipo, setTipo] = useState<TipoAsincronia | null>(ist.asincronia?.tipo ?? null);
  const [quota, setQuota] = useState(ist.asincronia?.quota ?? 0.5);
  const [grado, setGrado] = useState(ist.asincronia?.grado ?? 2);
  const [freq, setFreq] = useState(num(ist.drive.frequenza, 14));
  const [intens, setIntens] = useState(num(ist.drive.intensita, 0.5));
  const name = (k: TipoAsincronia) => tr(NOME_ASINCRONIA[k]);
  return (
    <div className="space-y-3">
      <p className="text-slate-400 text-xs">{s.asyncIntro}</p>
      <div className="flex flex-wrap gap-1 items-center">
        <span className="text-slate-400 mr-1">{s.asyncPresets}:</span>
        {Object.entries(PRESET_ASINCRONIA).map(([k, v]) => (
          <button key={k} data-testid={`async-preset-${k}`} onClick={() => { setTipo(v.asincronia.tipo); setQuota(v.asincronia.quota); setGrado(v.asincronia.grado ?? 2); setFreq(v.drive.frequenza); setIntens(v.drive.intensita); onApply({ drive: v.drive, asincronia: v.asincronia }, (s as any)['apreset_' + k] || k, 0); }}
            className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 hover:border-amber-500">{(s as any)['apreset_' + k] || k}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {TIPI_ASINCRONIA.map((k) => (
          <button key={k} data-testid={`async-${k}`} onClick={() => setTipo(k)} className={`text-left px-3 py-2 rounded-lg border ${tipo === k ? 'bg-amber-900/40 border-amber-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>
            <div className="font-semibold">{name(k)}</div>
            <div className="text-xs text-slate-400">{(s as any)['ahint_' + k] || ''}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        <Slider label={s.asyncQuota} value={quota * 100} min={5} max={100} step={5} unit="%" onChange={(v) => setQuota(v / 100)} />
        {tipo === 'fame-di-flusso' && <Slider label={s.asyncGrade} value={grado} min={1} max={4} step={1} onChange={setGrado} />}
        <Slider label={s.driveRate} value={freq} min={0} max={40} step={1} live={ist.drive.frequenza} nowLabel={s.now} onChange={setFreq} />
        <Slider label={s.driveIntensity} value={intens} min={0} max={1} step={0.05} digits={2} live={ist.drive.intensita} nowLabel={s.now} onChange={setIntens} />
      </div>
      <div className="flex gap-2 items-center">
        <button data-testid="async-apply" disabled={!tipo} onClick={() => tipo && onApply({ asincronia: { tipo, quota, grado }, drive: { frequenza: freq, intensita: intens } }, `${name(tipo)} ${Math.round(quota * 100)}%`, 0)} className="px-5 py-2 rounded-lg bg-amber-600 disabled:bg-slate-700 font-semibold">{s.apply}</button>
        <button data-testid="async-stop" onClick={() => { setTipo(null); onApply({ asincronia: null }, s.asyncStop, 0); }} className="px-4 py-2 rounded-lg bg-slate-700">{s.asyncStop}</button>
        <span className="text-xs text-slate-300" data-testid="async-current">{ist.asincronia ? `● ${name(ist.asincronia.tipo)} ${Math.round(ist.asincronia.quota * 100)}%` : ''}</span>
      </div>
      {/* OVS 3.4: the patient coughs on the machine (Scenario Creator §674): Paw up to the high limit, alarm */}
      {ist.ambiente !== 'alto-flusso' && (
        <div className="border-t border-slate-800 pt-3 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-slate-400 mr-1">{s.coughTitle}:</span>
            <button data-testid="cough-one" onClick={() => onApply({ tosse: { n: seme(), colpi: 1 } }, s.coughOne, 0)} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:border-amber-500">{s.coughOne}</button>
            <button data-testid="cough-fit" onClick={() => onApply({ tosse: { n: seme(), colpi: 4 } }, s.coughFit, 0)} className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:border-amber-500">{s.coughFit}</button>
          </div>
          <p className="text-slate-400 text-xs">{s.coughHint}</p>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------ Mechanics tab
const MechanicsTab: React.FC<{ s: RemoteStrings; tr: Tr; ist: VentIstantanea; onApply: (p: Patch, label: string, rampSec: number) => void }> = ({ s, tr, ist, onApply }) => {
  const f = ist.fisiologia;
  const d = ist.drive;
  const [osc, setOsc] = useState(num(f.oscillazioniCardiache, 0));
  const [pes, setPes] = useState(num(f.pesBasale, 0));
  const [aop, setAop] = useState(num(f.aperturaVie, 0));
  const [freno, setFreno] = useState(num(f.sforzoEspiratorio, 0));
  const [ea, setEa] = useState(num(d.espirioAttivo, 0));
  const [vari, setVari] = useState(num(d.variabilita, 0));
  const [auto, setAuto] = useState(!d.forma);
  const [forma, setForma] = useState(d.forma ?? { salita: 0.5, tenuta: 0.05, discesa: 0.4 });
  const [resp, setResp] = useState(!!d.responsivo);
  const [leakOn, setLeakOn] = useState(typeof f.perditaMaschera === 'number');
  const [leak, setLeak] = useState(num(f.perditaMaschera, 20));
  // A quadro: the patch is only the fields the picture touches, so the
  // director's other choices stay where they are.
  const toggle = (q: QuadroMeccanica) => {
    const on = quadroAcceso(ist, q);
    const next = on ? senzaQuadro(ist, q) : conQuadro(ist, q);
    const quadro = QUADRI_MECCANICA[q];
    const patch: Patch = {};
    if (quadro.fisiologia) patch.fisiologia = Object.fromEntries(Object.keys(quadro.fisiologia).map((k) => [k, (next.fisiologia as any)[k]])) as any;
    if (quadro.drive) patch.drive = Object.fromEntries(Object.keys(quadro.drive).map((k) => [k, (next.drive as any)[k]])) as any;
    onApply(patch, `${tr(NOME_QUADRO[q])} ${on ? 'OFF' : 'ON'}`, 0);
  };
  const apply = () => onApply({
    fisiologia: { oscillazioniCardiache: osc, pesBasale: pes, aperturaVie: aop, sforzoEspiratorio: freno, ...(ist.ambiente === 'niv' ? { perditaMaschera: leakOn ? leak : null } : {}) },
    drive: { espirioAttivo: ea, variabilita: vari, responsivo: resp, forma: auto ? null : forma },
  }, s.tabMechanics, 0);
  return (
    <div className="space-y-3">
      <p className="text-slate-400 text-xs">{s.mechIntro}</p>
      <div className="flex flex-wrap gap-1 items-center">
        <span className="text-slate-400 mr-1">{s.mechPictures}:</span>
        {(Object.keys(QUADRI_MECCANICA) as QuadroMeccanica[]).map((q) => (
          <button key={q} data-testid={`quadro-${q}`} onClick={() => toggle(q)}
            className={`px-2.5 py-1 rounded border ${quadroAcceso(ist, q) ? 'bg-sky-900 border-sky-500' : 'bg-slate-800 border-slate-700 hover:border-sky-500'}`}>{tr(NOME_QUADRO[q])}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        <Slider testId="sl-cardiac" label={s.cardiacOsc} value={osc} min={0} max={1} step={0.05} digits={2} live={f.oscillazioniCardiache ?? 0} nowLabel={s.now} onChange={setOsc} />
        <Slider testId="sl-pes" label={s.pesBaseline} value={pes} min={0} max={25} step={1} unit="cmH₂O" live={f.pesBasale ?? 0} nowLabel={s.now} onChange={setPes} />
        <Slider testId="sl-aop" label={s.aop} value={aop} min={0} max={20} step={1} unit="cmH₂O" live={f.aperturaVie ?? 0} nowLabel={s.now} onChange={setAop} />
        <Slider label={s.expBrake} value={freno} min={0} max={1} step={0.05} digits={2} live={f.sforzoEspiratorio} nowLabel={s.now} onChange={setFreno} />
        <Slider label={s.activeExp} value={ea} min={0} max={1} step={0.05} digits={2} live={d.espirioAttivo ?? 0} nowLabel={s.now} onChange={setEa} />
        <Slider testId="sl-variability" label={s.variability} value={vari} min={0} max={1} step={0.05} digits={2} live={d.variabilita ?? 0} nowLabel={s.now} onChange={setVari} />
      </div>
      {ist.ambiente === 'niv' && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 items-end">
          <Slider testId="sl-mask-leak" label={s.maskLeak} value={leak} min={0} max={200} step={5} live={f.perditaMaschera ?? '–'} nowLabel={s.now} onChange={(v) => { setLeak(v); setLeakOn(true); }} />
          <label className="flex items-center gap-2 text-slate-300 text-xs" title={s.maskLeakHint}><input type="checkbox" data-testid="opt-mask-leak" checked={leakOn} onChange={(e) => setLeakOn(e.target.checked)} className="accent-sky-500" /> {s.maskLeakSet}</label>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4 text-slate-300">
        <span className="text-slate-400">{s.effortShape}</span>
        <label className="flex items-center gap-2"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-sky-500" /> {s.autoShape}</label>
        <label className="flex items-center gap-2"><input type="checkbox" data-testid="opt-responsive" checked={resp} onChange={(e) => setResp(e.target.checked)} className="accent-sky-500" /> {s.responsive}</label>
      </div>
      {!auto && (
        <div className="grid grid-cols-3 gap-x-6 gap-y-2">
          <Slider label={s.riseS} value={forma.salita} min={0.1} max={1.5} step={0.05} digits={2} unit="s" onChange={(v) => setForma((x) => ({ ...x, salita: v }))} />
          <Slider label={s.holdS} value={forma.tenuta} min={0} max={1} step={0.05} digits={2} unit="s" onChange={(v) => setForma((x) => ({ ...x, tenuta: v }))} />
          <Slider label={s.releaseS} value={forma.discesa} min={0.1} max={1.5} step={0.05} digits={2} unit="s" onChange={(v) => setForma((x) => ({ ...x, discesa: v }))} />
        </div>
      )}
      <button data-testid="mech-apply" onClick={apply} className="px-5 py-2 rounded-lg bg-sky-600 font-semibold">{s.apply}</button>
    </div>
  );
};

// ----------------------------------------------------------------- Lung tab
const LungTab: React.FC<{ s: RemoteStrings; ist: VentIstantanea; onApply: (p: Patch, label: string, rampSec: number) => void; onRecruit: () => void }> = ({ s, ist, onApply, onRecruit }) => {
  const [r, setR] = useState(num(ist.fisiologia.reclutabilita, 0.15));
  const [ccw, setCcw] = useState(num(ist.fisiologia.complianceParete, 175));
  const m = ist.misure as any;
  const dp = num(m.pPlateau, NaN) - num(ist.impostazioni.peep, 0);
  const share = trasmissioneToracica({ ...ist.fisiologia, compliance: num(m.compliance, ist.fisiologia.compliance) });
  const tp = Number.isFinite(dp) ? dp * (1 - share) : NaN;
  const running = ist.manovra === 'reclutamento';
  return (
    <div className="space-y-3">
      <p className="text-slate-400 text-xs">{s.lungIntro}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        <Slider testId="sl-recruit" label={s.recruitability} value={r} min={0} max={1} step={0.05} digits={2} live={ist.fisiologia.reclutabilita} nowLabel={s.now} onChange={setR} />
        <Slider label={s.chestWall} value={ccw} min={50} max={250} step={5} unit="mL/cmH₂O" live={ist.fisiologia.complianceParete} nowLabel={s.now} onChange={setCcw} />
      </div>
      <div className="flex gap-2 flex-wrap">
        <button data-testid="lung-apply" onClick={() => onApply({ fisiologia: { reclutabilita: r, complianceParete: ccw } }, `${s.recruitability} ${r.toFixed(2)} · ${s.chestWall} ${ccw}`, 0)} className="px-5 py-2 rounded-lg bg-sky-600 font-semibold">{s.apply}</button>
        <button data-testid="recruit-start" disabled={!ist.ventilando || (!!ist.manovra && !running) || ist.ambiente !== 'invasiva'} onClick={onRecruit} className="px-4 py-2 rounded-lg bg-amber-600 disabled:bg-slate-700 font-semibold">{running ? `${s.recruitmentRunning} (${RECLUTAMENTO_SECONDI} s)` : s.recruitmentStart}</button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Info k={`C @ PEEP ${fmt(ist.impostazioni.peep)}`} v={`${fmt(m.compliance)} mL/cmH₂O`} />
        <Info k={s.transpulmonary} v={Number.isFinite(tp) ? `${tp.toFixed(1)} cmH₂O` : '–'} />
        <Info k="ΔP (Pplat − PEEP)" v={Number.isFinite(dp) ? `${dp.toFixed(1)} cmH₂O` : '–'} />
      </div>
    </div>
  );
};

const Info: React.FC<{ k: string; v: string }> = ({ k, v }) => <div className="bg-slate-800 rounded px-2 py-1"><div className="text-slate-400">{k}</div><div className="font-mono text-base">{v}</div></div>;

// -------------------------------------------------------------- Machine tab
/**
 * OVS 3.3: the alarm limits of the selected ventilator, changed from the console (classroom
 * feedback). Same steps and same rules as the machine's own Alarms drawer — the commands are
 * the learner's actions, so the log and the ventilator see exactly what a tap would do.
 */
const AlarmsTab: React.FC<{ s: RemoteStrings; tr: Tr; ist: VentIstantanea; azione: (a: AzioneVentilatore, label: string) => void }> = ({ s, tr, ist, azione }) => {
  const ctx = { ambiente: ist.ambiente, modalita: ist.modalita, respiro: ist.respiro, impostazioni: ist.impostazioni };
  const keys = (Object.keys(ALLARMI) as ChiaveAllarme[]).filter((k) => ALLARMI[k].visibile(ctx));
  const suona = new Set(ist.allarmi.map((a) => a.chiave));
  return (
    <div className="space-y-2" data-testid="alarms-tab">
      <p className="text-slate-400">{s.alarmsIntro}</p>
      <div className="grid gap-1">
        {keys.map((k) => {
          const def = ALLARMI[k];
          const lim = ist.limiti[k] ?? LIMITI_INIZIALI[k];
          const nome = tr(def.etichetta);
          const unita = tr(def.unita);
          return (
            <div key={k} data-testid={`alarm-${k}`} className={`flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 ${suona.has(k) ? 'bg-red-900/50 border border-red-700' : 'bg-slate-800/60'}`}>
              <span className="w-48 font-semibold">{nome}{unita ? <span className="text-slate-400 font-normal"> ({unita})</span> : null}</span>
              {!def.interruttore && (['basso', 'alto'] as const).map((estremo) => (
                <span key={estremo} className="flex items-center gap-1">
                  <span className="text-slate-400 text-xs w-8">{estremo === 'basso' ? s.alarmLow : s.alarmHigh}</span>
                  {lim[estremo] === null ? <span className="w-24 text-center text-slate-500">––</span> : <>
                    <button data-testid={`alarm-${k}-${estremo}-minus`} onClick={() => azione({ tipo: 'limite', chiave: k, estremo, verso: -1 }, `${nome} ${estremo === 'basso' ? s.alarmLow : s.alarmHigh} −`)} className="w-7 h-7 rounded bg-slate-700">−</button>
                    <b className="w-10 text-center font-mono">{lim[estremo]}</b>
                    <button data-testid={`alarm-${k}-${estremo}-plus`} onClick={() => azione({ tipo: 'limite', chiave: k, estremo, verso: 1 }, `${nome} ${estremo === 'basso' ? s.alarmLow : s.alarmHigh} +`)} className="w-7 h-7 rounded bg-slate-700">+</button>
                  </>}
                </span>
              ))}
              <label className="ml-auto flex items-center gap-2 text-slate-300">
                <input type="checkbox" data-testid={`alarm-${k}-on`} checked={lim.acceso} onChange={(e) => azione({ tipo: 'allarme', chiave: k, acceso: e.target.checked }, `${nome} ${e.target.checked ? 'ON' : 'OFF'}`)} className="w-4 h-4 accent-sky-500" />
                {s.alarmOnLabel}
              </label>
            </div>
          );
        })}
      </div>
      <button data-testid="alarms-reset" onClick={() => azione({ tipo: 'limiti-iniziali' }, s.alarmsReset)} className="px-4 py-2 rounded-lg bg-slate-700 font-semibold">{s.alarmsReset}</button>
    </div>
  );
};

const MachineTab: React.FC<{ s: RemoteStrings; tr: Tr; ist: VentIstantanea; azione: (a: AzioneVentilatore, label: string) => void; onPaziente: (p: Patch, label: string, rampSec: number) => void; opzioni: (on: boolean) => void }> = ({ s, tr, ist, azione, onPaziente, opzioni }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const scenarioRef = useRef<HTMLInputElement>(null);
  // The scenario: patient and machine as they are now, to a file and back.
  const salvaScenario = () => {
    const blob = new Blob([JSON.stringify(scenarioDa(ist, 'scenario'), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `open-vent-sim-scenario-${ist.modalita}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  const caricaScenario = (f: File) => f.text().then((txt) => {
    try {
      const sc = parseScenario(txt);
      const c = comandiScenario(sc, ist);
      c.azioni.forEach((a) => azione(a, a.tipo === 'parametro' ? `${a.chiave} → ${a.valore}` : `${s.mode} → ${(a as any).modalita}`));
      onPaziente(c.paziente, `${s.scenarioLoaded}: ${sc.name}${c.ambienteDiverso ? ` (${s.scenarioOtherEnv})` : ''}`, 0);
    } catch (e) { window.alert(String(e)); }
  });
  const keys = impostazioniVisibili({ ambiente: ist.ambiente, modalita: ist.modalita, respiro: ist.respiro, impostazioni: ist.impostazioni }) as ChiaveImpostazione[];
  return (
    <div className="space-y-3">
      <p className="text-slate-400 text-xs">{s.machineIntro}</p>
      <div className="flex flex-wrap gap-1 items-center">
        <span className="text-slate-400 mr-1">{s.mode}:</span>
        {MODALITA_PER_AMBIENTE[ist.ambiente].map((m) => (
          <button key={m} data-testid={`mode-${m}`} title={tr(NOME_MODALITA[m])} onClick={() => azione({ tipo: 'modalita', modalita: m }, `${s.mode} → ${m}`)} className={`px-3 py-1 rounded border ${ist.modalita === m ? 'bg-sky-800 border-sky-500' : 'bg-slate-800 border-slate-700'}`}>{m}</button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => {
          const d = (PARAMETRI as any)[k];
          if (!d || d.regolabile === false) return null;
          const cur = (ist.impostazioni as any)[k];
          const sendIt = () => {
            const raw = values[k];
            let v: number | string = raw;
            if (typeof cur === 'number') { const n = Number(String(raw).replace(',', '.')); if (!Number.isFinite(n)) return; v = Math.min(d.max ?? n, Math.max(d.min ?? n, n)); }
            azione({ tipo: 'parametro', chiave: k, valore: v }, `${tr(d.etichetta)} → ${v}`);
            setValues((x) => ({ ...x, [k]: '' }));
          };
          return (
            <label key={k} className="bg-slate-800 rounded px-2 py-1 text-xs">
              <div className="text-slate-400 truncate">{tr(d.etichetta)} <span className="text-slate-500">{d.unita ? tr(d.unita) : ''}</span></div>
              <div className="flex gap-1 mt-0.5">
                <input data-testid={`param-${k}`} className="w-20 bg-slate-900 border border-slate-700 rounded px-1 font-mono" placeholder={String(cur)} value={values[k] ?? ''} onChange={(e) => setValues((x) => ({ ...x, [k]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && values[k] && sendIt()} />
                <button data-testid={`param-send-${k}`} disabled={!values[k]} onClick={sendIt} className="px-2 rounded bg-sky-700 disabled:bg-slate-700">{s.send}</button>
                <span className="self-center text-slate-300 font-mono ml-auto">{String(cur)}</span>
              </div>
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <button data-testid="vent-toggle" onClick={() => azione({ tipo: 'standby', ventilando: !ist.ventilando }, ist.ventilando ? s.ventOff : s.ventOn)} className={`px-4 py-2 rounded-lg font-semibold ${ist.ventilando ? 'bg-red-700' : 'bg-green-700'}`}>{ist.ventilando ? s.ventOff : s.ventOn}</button>
        <button onClick={() => azione({ tipo: 'silenzia' }, s.silence)} className="px-4 py-2 rounded-lg bg-slate-700">{s.silence}</button>
        <button data-testid="scenario-save" onClick={salvaScenario} className="px-4 py-2 rounded-lg bg-slate-700">{s.scenarioSave}</button>
        <button data-testid="scenario-load" onClick={() => scenarioRef.current?.click()} className="px-4 py-2 rounded-lg bg-slate-700">{s.scenarioLoad}</button>
        <input ref={scenarioRef} data-testid="scenario-file" type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) caricaScenario(f); e.target.value = ''; }} />
        <label className="flex items-center gap-2 text-slate-300 px-2">
          <input type="checkbox" data-testid="opt-didattica" onChange={(e) => opzioni(e.target.checked)} className="accent-sky-500" /> {s.teachingTraces}
        </label>
        {ist.ambiente === 'invasiva' || ist.ambiente === 'anestesia' ? <>
          <button disabled={!ist.ventilando || !!ist.manovra} onClick={() => azione({ tipo: 'manovra', manovra: 'pausa-inspiratoria' }, s.inspHold)} className="px-4 py-2 rounded-lg bg-slate-700 disabled:opacity-40">{s.inspHold}</button>
          <button disabled={!ist.ventilando || !!ist.manovra} onClick={() => azione({ tipo: 'manovra', manovra: 'pausa-espiratoria' }, s.expHold)} className="px-4 py-2 rounded-lg bg-slate-700 disabled:opacity-40">{s.expHold}</button>
          {ist.ambiente === 'invasiva' && <>
            <button data-testid="man-curva-lenta" disabled={!ist.ventilando || !!ist.manovra} onClick={() => azione({ tipo: 'manovra', manovra: 'curva-lenta' }, s.slowCurve)} className="px-4 py-2 rounded-lg bg-slate-700 disabled:opacity-40">{s.slowCurve}</button>
            <button data-testid="man-rapporto-ri" disabled={!ist.ventilando || !!ist.manovra || num(ist.impostazioni.peep) < PEEP_MINIMA_RI} onClick={() => azione({ tipo: 'manovra', manovra: 'rapporto-ri' }, s.riRatio)} className="px-4 py-2 rounded-lg bg-slate-700 disabled:opacity-40">{s.riRatio}</button>
          </>}
          {ist.manovra && <button onClick={() => azione({ tipo: 'manovra', manovra: null }, '■')} className="px-4 py-2 rounded-lg bg-slate-600">■ {tr(NOME_MANOVRA[ist.manovra])}</button>}
        </> : null}
      </div>
    </div>
  );
};

// --------------------------------------------------------------- Events tab
const EventsTab: React.FC<{ s: RemoteStrings; steps: SequenceStep[]; setSteps: (f: (x: SequenceStep[]) => SequenceStep[]) => void; seq: { index: number; nextAt: number; paused: number | null } | null; setSeq: (v: any) => void; fire: (id: string) => void }> = ({ s, steps, setSteps, seq, setSeq, fire }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [after, setAfter] = useState(60);
  const labelOf = (id: string) => { const e = EVENT_LIBRARY.find((x) => x.id === id) as EventDef | undefined; return e ? (s[e.labelKey] as string) : id; };
  const save = () => {
    const blob = new Blob([JSON.stringify({ app: 'open-vent-sim', kind: 'sequence', version: 1, name: 'sequenza', steps }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'open-vent-sim-sequenza.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  const load = (f: File) => f.text().then((txt) => { try { const q = parseSequence(txt); setSteps(() => q.steps); } catch (e) { window.alert(String(e)); } });
  const remaining = seq ? Math.max(0, Math.ceil((seq.nextAt - (seq.paused ?? Date.now())) / 1000)) : 0;
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-slate-400 mb-1">{s.eventsLibrary}</div>
        <div className="flex items-center gap-2 mb-2 text-xs">{s.eventsAfter} <input type="number" min={0} value={after} onChange={(e) => setAfter(Math.max(0, Number(e.target.value)))} className="w-16 bg-slate-800 border border-slate-700 rounded px-1" /> {s.seconds}</div>
        <ul className="space-y-1">
          {EVENT_LIBRARY.map((e) => (
            <li key={e.id} className="flex items-center gap-2 bg-slate-800 rounded px-2 py-1">
              <span className="flex-1">{s[e.labelKey] as string} <span className="text-xs text-slate-500">{e.rampSec ? `· ${e.rampSec} s` : ''}</span></span>
              <button data-testid={`event-fire-${e.id}`} onClick={() => fire(e.id)} className="text-xs px-2 py-0.5 rounded bg-amber-700">{s.eventsNow}</button>
              <button data-testid={`event-add-${e.id}`} onClick={() => setSteps((x) => [...x, { eventId: e.id, afterSec: x.length === 0 ? 0 : after }])} className="text-xs px-2 py-0.5 rounded bg-slate-600">+ {s.eventsAdd}</button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-slate-400 mb-1">{s.eventsSequence}</div>
        {steps.length === 0 && <p className="text-slate-500 text-xs">{s.eventsEmpty}</p>}
        <ol className="space-y-1" data-testid="sequence">
          {steps.map((st, i) => (
            <li key={i} className={`flex items-center gap-2 rounded px-2 py-1 ${seq && seq.index === i ? 'bg-amber-900/50 border border-amber-600' : 'bg-slate-800'}`}>
              <span className="text-xs text-slate-400 w-24">{i === 0 ? '0 s' : `+${st.afterSec} s`}</span>
              <span className="flex-1">{labelOf(st.eventId)}</span>
              <button onClick={() => setSteps((x) => x.filter((_, j) => j !== i))} className="text-xs text-red-300">✕</button>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2 mt-2">
          {!seq && <button data-testid="seq-play" disabled={!steps.length} onClick={() => setSeq({ index: 0, nextAt: Date.now() + (steps[0]?.afterSec || 0) * 1000, paused: null })} className="px-3 py-1.5 rounded bg-green-700 disabled:bg-slate-700">▶ {s.eventsPlay}</button>}
          {seq && seq.paused === null && <button onClick={() => setSeq({ ...seq, paused: Date.now() })} className="px-3 py-1.5 rounded bg-slate-600">⏸ {s.eventsPause}</button>}
          {seq && seq.paused !== null && <button onClick={() => setSeq({ ...seq, nextAt: seq.nextAt + (Date.now() - seq.paused!), paused: null })} className="px-3 py-1.5 rounded bg-green-700">▶ {s.eventsResume}</button>}
          {seq && <button onClick={() => setSeq(null)} className="px-3 py-1.5 rounded bg-red-800">■ {s.eventsStop}</button>}
          {seq && <span className="text-xs text-amber-300 self-center">{s.eventsNext} {remaining} s</span>}
          <span className="ml-auto flex gap-2">
            <button onClick={save} disabled={!steps.length} className="text-xs underline disabled:opacity-40">{s.eventsSave}</button>
            <button onClick={() => fileRef.current?.click()} className="text-xs underline">{s.eventsLoad}</button>
            <button onClick={() => setSteps(() => [])} className="text-xs underline">{s.eventsClear}</button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ''; }} />
          </span>
        </div>
      </div>
    </div>
  );
};

export default RegiaApp;
