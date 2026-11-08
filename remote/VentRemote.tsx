/**
 * Ventilator side of the classroom link: runs the device, publishes its state
 * and events to the server, and feeds the director's commands into it.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createLink, Link, LinkStatus } from './link';
import type { RemoteCommand, ServerMessage } from './protocol';
import { rt } from './strings';
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

/** Small, unobtrusive pill in the corner so learners know the link is alive. */
const ConnectionBadge: React.FC<{ status: LinkStatus; detail?: string; name: string; regiaPresent: boolean; recording: boolean }> = ({ status, detail, name, regiaPresent, recording }) => {
  const { language } = useLanguage();
  const s = rt(language);
  let color = '#f59e0b';
  let text = s.badgeConnecting;
  if (status === 'online') { color = regiaPresent ? '#22c55e' : '#38bdf8'; text = regiaPresent ? s.badgeOnline : s.badgeWaitingRegia; }
  if (status === 'offline') { color = '#f59e0b'; text = detail === 'replaced' ? s.badgeReplaced : s.badgeReconnecting; }
  if (status === 'denied') { color = '#ef4444'; text = detail === 'pin' ? s.badgeBadPin : detail === 'removed' ? s.badgeRemoved : detail === 'full' ? s.badgeFull : s.badgeDenied; }
  return (
    <div data-testid="remote-badge" style={{ position: 'fixed', left: 8, bottom: 8, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, background: 'rgba(0,0,0,.6)', color: '#e5e7eb', fontSize: 11, fontFamily: 'system-ui, Arial, sans-serif', pointerEvents: 'none' }}>
      <span style={{ width: 8, height: 8, borderRadius: 8, background: color, boxShadow: `0 0 6px ${color}` }} />
      <span>{name ? `${name} · ` : ''}{text}</span>
      {recording && status === 'online' && <span data-testid="rec-badge" style={{ color: '#f87171', fontWeight: 700 }}>· ● REC</span>}
    </div>
  );
};
