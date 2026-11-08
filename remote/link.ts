/**
 * WebSocket link to the classroom server, with automatic reconnection.
 * The same link is used by ventilator screens and by the director console.
 */
import type { Role, ServerMessage } from './protocol';

export type LinkStatus = 'connecting' | 'online' | 'offline' | 'denied';

export interface LinkOptions {
  url: string;               // ws://host:port/ws
  role: Role;
  pin?: string;
  key?: string;
  name?: string;
  onMessage: (m: ServerMessage) => void;
  onStatus: (s: LinkStatus, detail?: string) => void;
}

export interface Link {
  send: (msg: object) => boolean;
  close: () => void;
}

const CLIENT_ID_KEY = 'ovs-client-id';

/** Stable id for this browser tab, so a reload keeps the same ventilator slot. */
export function clientId(): string {
  try {
    let id = sessionStorage.getItem(CLIENT_ID_KEY);
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(CLIENT_ID_KEY, id); }
    return id;
  } catch {
    return 'tab-' + Math.random().toString(36).slice(2);
  }
}

export function createLink(opts: LinkOptions): Link {
  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let lastPong = Date.now();
  const id = clientId();

  const connect = () => {
    if (closed) return;
    opts.onStatus('connecting');
    try { ws = new WebSocket(opts.url); } catch { schedule(); return; }
    ws.onopen = () => {
      attempt = 0;
      lastPong = Date.now();
      ws!.send(JSON.stringify({ t: 'hello', role: opts.role, pin: opts.pin, key: opts.key, name: opts.name, clientId: id }));
      pingTimer = setInterval(() => {
        if (Date.now() - lastPong > 12000) { try { ws?.close(); } catch { /* ignore */ } return; }
        try { ws?.send(JSON.stringify({ t: 'ping' })); } catch { /* ignore */ }
      }, 4000);
    };
    ws.onmessage = (ev) => {
      let m: ServerMessage;
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      lastPong = Date.now();
      if (m.t === 'pong') return;
      if (m.t === 'welcome') opts.onStatus('online');
      if (m.t === 'denied') { closed = true; opts.onStatus('denied', m.reason); }
      opts.onMessage(m);
    };
    ws.onclose = (ev) => {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      ws = null;
      if (ev.code === 4403 || ev.code === 4410) { closed = true; if (ev.code === 4410) opts.onStatus('denied', 'removed'); return; }
      if (ev.code === 4409) { closed = true; opts.onStatus('offline', 'replaced'); return; }
      if (!closed) { opts.onStatus('offline'); schedule(); }
    };
    ws.onerror = () => { /* onclose follows */ };
  };

  const schedule = () => {
    if (closed) return;
    attempt += 1;
    const delay = Math.min(5000, 500 * 2 ** Math.min(attempt, 4));
    retryTimer = setTimeout(connect, delay);
  };

  connect();

  return {
    send(msg) {
      if (ws && ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify(msg)); return true; }
      return false;
    },
    close() {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pingTimer) clearInterval(pingTimer);
      try { ws?.close(1000); } catch { /* ignore */ }
    },
  };
}

/** Role and credentials taken from the page address (what the QR code opens). */
export interface LaunchInfo { role: Role | null; pin?: string; key?: string; wsUrl: string; served: boolean }

export function launchInfo(loc: Location = window.location): LaunchInfo {
  const q = new URLSearchParams(loc.search);
  const role = q.get('role');
  const served = loc.protocol === 'http:' || loc.protocol === 'https:';
  const wsUrl = `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/ws`;
  return {
    role: role === 'vent' || role === 'regia' ? role : null,
    pin: q.get('pin') || undefined,
    key: q.get('key') || undefined,
    wsUrl,
    served,
  };
}
