/**
 * Ventilator side of the classroom link: runs the device, publishes its state
 * and events to the server, and feeds the director's commands into it.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createLink, Link, LinkStatus } from './link';
import type { RemoteCommand, ServerMessage } from './protocol';
import { rt, ventName } from './strings';
import { useLanguage } from '../src/contexts/LanguageContext';
import { DeviceApp } from '../device/DeviceApp';
import type { DeviceRemoteActions, DeviceRemoteCommand } from '../device/remoteTypes';

export const LinkedDevice: React.FC<{ wsUrl: string; pin: string }> = ({ wsUrl, pin }) => {
  const [status, setStatus] = useState<LinkStatus>('connecting');
  const [detail, setDetail] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [regiaPresent, setRegiaPresent] = useState(false);
  const [recording, setRecording] = useState(false);
  const linkRef = useRef<Link | null>(null);
  const listeners = useRef(new Set<(c: DeviceRemoteCommand, s?: 'director') => void>());
  const pending = useRef<object[]>([]);

  useEffect(() => {
    const link = createLink({
      url: wsUrl, role: 'vent', pin,
      onStatus: (s, d) => {
        setStatus(s); setDetail(d);
        if (s === 'online') pending.current.splice(0).forEach((m) => link.send(m));
      },
      onMessage: (m: ServerMessage) => {
        if (m.t === 'welcome') { setName(m.name); setRegiaPresent(!!m.regia); }
        else if (m.t === 'renamed') setName(m.name);
        else if (m.t === 'regia') { setRegiaPresent(m.present); if (!m.present) setRecording(false); }
        else if (m.t === 'cmd') {
          const cmd = m.cmd as RemoteCommand;
          let error: string | undefined;
          try {
            if (cmd.type === 'recording') setRecording(!!cmd.on);
            else if (listeners.current.size === 0) error = 'not-ready';
            else listeners.current.forEach((fn) => fn(cmd, 'director'));
          } catch (e) { error = String(e); }
          link.send({ t: 'ack', cmdId: m.cmdId, ok: !error, error });
        }
      },
    });
    linkRef.current = link;
    return () => link.close();
  }, [wsUrl, pin]);

  const remoteActions = useMemo<DeviceRemoteActions>(() => ({
    subscribe(fn) { listeners.current.add(fn); return () => { listeners.current.delete(fn); }; },
  }), []);

  const send = (msg: object, queue = false) => {
    if (!linkRef.current?.send(msg) && queue) { pending.current.push(msg); if (pending.current.length > 200) pending.current.shift(); }
  };

  return (
    <>
      <DeviceApp
        linked
        remoteActions={remoteActions}
        onSnapshot={(_ist, info) => send({ t: 'state', state: { ...info, at: Date.now() } })}
        onEvent={(text, source, kind) => send({ t: 'event', event: { at: Date.now(), text, source, kind } }, true)}
      />
      <ConnectionBadge status={status} detail={detail} name={name} regiaPresent={regiaPresent} recording={recording} />
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
