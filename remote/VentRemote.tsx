/**
 * Ventilator side of the classroom link: runs the device, publishes its state
 * and events to the server, and feeds the director's commands into it.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createLink, Link, LinkStatus } from './link';
import type { RemoteCommand, RunningVent, ServerMessage } from './protocol';
import type { VentIstantanea } from '../device/screens/scenario/ventilatore/istantanea';
import { Specchio, Avviso } from './Specchio';
import { rt, ventName } from './strings';
import { useLanguage } from '../src/contexts/LanguageContext';
import { DeviceApp } from '../device/DeviceApp';
import type { DeviceRemoteActions, DeviceRemoteCommand } from '../device/remoteTypes';

type Modo =
  | { k: 'decide' }
  | { k: 'own'; iniziale: VentIstantanea | null; n: number }
  | { k: 'choose'; list: RunningVent[] }
  | { k: 'mirror'; id: string; name: string; ist: VentIstantanea | null; on: boolean; offsetMs: number; didattica: boolean; gone: boolean };

export const LinkedDevice: React.FC<{ wsUrl: string; pin: string }> = ({ wsUrl, pin }) => {
  const { language } = useLanguage();
  const s = rt(language);
  const [status, setStatus] = useState<LinkStatus>('connecting');
  const [detail, setDetail] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [regiaPresent, setRegiaPresent] = useState(false);
  const [recording, setRecording] = useState(false);
  // OVS 3.3: is this screen a machine of its own, or the mirror of one already on?
  const [modo, setModo] = useState<Modo>({ k: 'decide' });
  const modoRef = useRef(modo); modoRef.current = modo;
  const linkRef = useRef<Link | null>(null);
  const listeners = useRef(new Set<(c: DeviceRemoteCommand, s?: 'director' | 'mirror') => void>());
  const pending = useRef<object[]>([]);

  const segui = (r: RunningVent) => {
    linkRef.current?.send({ t: 'follow', id: r.id });
    setModo({ k: 'mirror', id: r.id, name: r.name, ist: null, on: true, offsetMs: 0, didattica: false, gone: false });
  };
  const proprio = (iniziale: VentIstantanea | null = null) => {
    if (modoRef.current.k === 'mirror') linkRef.current?.send({ t: 'unfollow' });
    setModo((m) => ({ k: 'own', iniziale, n: (m.k === 'own' ? m.n : 0) + 1 }));
  };

  useEffect(() => {
    const link = createLink({
      url: wsUrl, role: 'vent', pin,
      onStatus: (st, d) => {
        setStatus(st); setDetail(d);
        if (st === 'online') pending.current.splice(0).forEach((m) => link.send(m));
      },
      onMessage: (m: ServerMessage) => {
        if (m.t === 'welcome') {
          setName(m.name); setRegiaPresent(!!m.regia);
          const ora = modoRef.current;
          if (ora.k === 'decide') {
            const list = m.running ?? [];
            if (m.mirrorOf) segui({ id: m.mirrorOf, name: '' });
            else if (list.length === 0) setModo({ k: 'own', iniziale: null, n: 1 });
            else if (list.length === 1) segui(list[0]);
            else setModo({ k: 'choose', list });
          } else if (ora.k === 'mirror' && !m.mirrorOf) {
            // The server forgot (restarted): ask again for the same machine.
            link.send({ t: 'follow', id: ora.id });
          }
        }
        else if (m.t === 'renamed') setName(m.name);
        else if (m.t === 'regia') { setRegiaPresent(m.present); if (!m.present) setRecording(false); }
        else if (m.t === 'mirror-state') {
          setModo((ora) => ora.k !== 'mirror' || ora.id !== m.from ? ora : {
            ...ora, name: m.name || ora.name, ist: m.state.ventilatore ?? ora.ist,
            on: m.state.screen === 'running' && !!m.state.ventilatore,
            offsetMs: typeof m.state.at === 'number' ? m.state.at - Date.now() : ora.offsetMs,
            didattica: !!m.state.didattica, gone: false,
          });
        }
        else if (m.t === 'mirror-gone') setModo((ora) => ora.k === 'mirror' && ora.id === m.from ? { ...ora, gone: true } : ora);
        else if (m.t === 'mirror-back') setModo((ora) => ora.k === 'mirror' && ora.id === m.from ? { ...ora, gone: false } : ora);
        else if (m.t === 'cmd') {
          const cmd = m.cmd as RemoteCommand;
          let error: string | undefined;
          try {
            if (cmd.type === 'recording') setRecording(!!cmd.on);
            else if (listeners.current.size === 0) error = 'not-ready';
            else listeners.current.forEach((fn) => fn(cmd, m.by === 'mirror' ? 'mirror' : 'director'));
          } catch (e) { error = String(e); }
          link.send({ t: 'ack', cmdId: m.cmdId, ok: !error, error });
        }
      },
    });
    linkRef.current = link;
    return () => link.close();
  }, [wsUrl, pin]); // eslint-disable-line react-hooks/exhaustive-deps

  // No answer from the classroom server: this screen is a ventilator of its own.
  useEffect(() => {
    if (modo.k !== 'decide') return;
    const id = window.setTimeout(() => setModo((m) => (m.k === 'decide' ? { k: 'own', iniziale: null, n: 1 } : m)), 4000);
    return () => window.clearTimeout(id);
  }, [modo.k]);

  const remoteActions = useMemo<DeviceRemoteActions>(() => ({
    subscribe(fn) { listeners.current.add(fn); return () => { listeners.current.delete(fn); }; },
  }), []);

  const send = (msg: object, queue = false) => {
    if (!linkRef.current?.send(msg) && queue) { pending.current.push(msg); if (pending.current.length > 200) pending.current.shift(); }
  };

  const badgeName = modo.k === 'mirror' ? `${s.mirrorBadge} ${ventName(modo.name, language)}` : name;

  return (
    <>
      {modo.k === 'decide' && <div style={{ position: 'fixed', inset: 0, background: '#0f172a' }} />}
      {modo.k === 'own' && (
        <DeviceApp
          key={modo.n}
          linked
          iniziale={modo.iniziale}
          remoteActions={remoteActions}
          onSnapshot={(_ist, info) => send({ t: 'state', state: { ...info, at: Date.now() } })}
          onEvent={(text, source, kind) => send({ t: 'event', event: { at: Date.now(), text, source, kind } }, true)}
        />
      )}
      {modo.k === 'choose' && (
        <Avviso>
          <p className="text-lg text-slate-100 mb-5">{s.mirrorChoose}</p>
          <div className="flex flex-col gap-3" data-testid="mirror-choose">
            {modo.list.map((r) => (
              <button key={r.id} data-testid={`mirror-pick-${r.id}`} onClick={() => segui(r)} className="px-5 py-3 rounded-xl bg-sky-700 text-white font-semibold">{ventName(r.name, language)}</button>
            ))}
            <button data-testid="mirror-pick-new" onClick={() => proprio()} className="px-5 py-3 rounded-xl bg-slate-700 text-white">{s.mirrorChooseNew}</button>
          </div>
        </Avviso>
      )}
      {modo.k === 'mirror' && (
        <>
          {modo.ist && modo.on
            ? <Specchio ist={modo.ist} offsetMs={modo.offsetMs} didattica={modo.didattica} s={s}
                onAzione={(azione) => send({ t: 'mirror-action', azione })} onStacca={() => proprio()} />
            : <div style={{ position: 'fixed', inset: 0, background: '#0f172a' }} />}
          {!modo.gone && !modo.ist && <Avviso><p className="text-lg text-slate-200" data-testid="mirror-connecting">{s.mirrorConnecting}</p></Avviso>}
          {!modo.gone && modo.ist && !modo.on && (
            <Avviso>
              <p className="text-lg text-slate-100 mb-5" data-testid="mirror-off">{s.mirrorOff}</p>
              <button onClick={() => proprio()} className="px-5 py-3 rounded-xl bg-sky-700 text-white font-semibold">{s.mirrorNew}</button>
            </Avviso>
          )}
          {modo.gone && (
            <Avviso>
              <p className="text-lg text-slate-100 mb-5" data-testid="mirror-gone">{s.mirrorGone}</p>
              <div className="flex flex-wrap gap-3 justify-center">
                {modo.ist && modo.on && <button data-testid="mirror-takeover" onClick={() => proprio(modo.ist)} className="px-5 py-3 rounded-xl bg-sky-700 text-white font-semibold">{s.mirrorTakeOver}</button>}
                <button data-testid="mirror-new" onClick={() => proprio()} className="px-5 py-3 rounded-xl bg-slate-700 text-white">{s.mirrorNew}</button>
                <button onClick={() => setModo((m) => (m.k === 'mirror' ? { ...m, gone: false } : m))} className="px-5 py-3 rounded-xl bg-slate-800 text-slate-200">{s.mirrorWait}</button>
              </div>
            </Avviso>
          )}
        </>
      )}
      <ConnectionBadge status={status} detail={detail} name={badgeName} regiaPresent={regiaPresent} recording={recording} />
    </>
  );
};

/**
 * Link status as a single dot in the top-right corner. The machine header gets
 * a little right padding while linked (index.css, `.ovs-linked`), so the dot
 * sits next to the fullscreen/silence buttons without covering anything.
 * Tapping it shows the text; problems open the text by themselves.
 */
const ConnectionBadge: React.FC<{ status: LinkStatus; detail?: string; name: string; regiaPresent: boolean; recording: boolean }> = ({ status, detail, name, regiaPresent, recording }) => {
  const { language } = useLanguage();
  const s = rt(language);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.classList.add('ovs-linked');
    return () => document.body.classList.remove('ovs-linked');
  }, []);
  let color = '#f59e0b';
  let text = s.badgeConnecting;
  if (status === 'online') { color = regiaPresent ? '#22c55e' : '#38bdf8'; text = regiaPresent ? s.badgeOnline : s.badgeWaitingRegia; }
  if (status === 'offline') { color = '#f59e0b'; text = detail === 'replaced' ? s.badgeReplaced : s.badgeReconnecting; }
  if (status === 'denied') { color = '#ef4444'; text = detail === 'pin' ? s.badgeBadPin : detail === 'removed' ? s.badgeRemoved : detail === 'full' ? s.badgeFull : s.badgeDenied; }
  const problem = status === 'offline' || status === 'denied';
  const full = `${name ? `${ventName(name, language)} · ` : ''}${text}${recording && status === 'online' ? ' · ● REC' : ''}`;
  useEffect(() => {
    if (!open || problem) return;
    const id = setTimeout(() => setOpen(false), 4000);
    return () => clearTimeout(id);
  }, [open, problem]);
  return (
    <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 19px)', right: 12, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'system-ui, Arial, sans-serif' }}>
      {(open || problem) && (
        <span data-testid="remote-badge-text" style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(15,23,42,.92)', border: '1px solid rgba(255,255,255,.12)', color: '#e5e7eb', fontSize: 12, whiteSpace: 'nowrap' }}>{full}</span>
      )}
      <button
        type="button"
        data-testid="remote-badge"
        aria-label={full}
        title={full}
        onClick={() => setOpen((x) => !x)}
        style={{ position: 'relative', width: 16, height: 16, borderRadius: 16, border: 0, padding: 0, background: color, boxShadow: `0 0 0 3px rgba(15,23,42,.9), 0 0 8px ${color}`, cursor: 'pointer' }}
      >
        {recording && status === 'online' && <span data-testid="rec-badge" style={{ position: 'absolute', right: -3, top: -3, width: 7, height: 7, borderRadius: 7, background: '#ef4444', boxShadow: '0 0 0 2px rgba(15,23,42,.9)' }} />}
        {/* screen-reader / test hook for the full status */}
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{full}</span>
      </button>
    </div>
  );
};
