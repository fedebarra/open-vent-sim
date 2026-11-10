/**
 * Open Vent Sim — classroom server for the local network.
 *
 * One process does three things:
 *   1. serves the built web app (dist/) over HTTP, so any device on the same
 *      Wi-Fi can open it in a browser;
 *   2. runs a WebSocket hub at /ws that links ONE classroom session:
 *      - "vent"  : a ventilator screen used by learners (needs the 4-digit PIN)
 *      - "regia" : the instructor's director console (needs the director key)
 *   3. announces itself on the LAN with a UDP broadcast beacon, so the desktop
 *      app can find it without typing any address.
 *
 * Nothing leaves the local network. No accounts, no cloud.
 *
 * Usage (stand-alone):  node server/ovs-server.mjs [--port 8787]
 * Usage (Electron):     import { startServer } from './server/ovs-server.mjs'
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import dgram from 'node:dgram';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

export const PROTOCOL_VERSION = 1;
export const DEFAULT_PORT = 8787;
export const BEACON_PORT = 47878;
const HEARTBEAT_MS = 5000;
const MAX_MESSAGE_BYTES = 256 * 1024;
const MAX_VENTS = 30;
const MAX_EVENTS_PER_VENT = 200;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

/** IPv4 addresses other devices can use to reach this computer. */
export function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push({ name, address: a.address });
    }
  }
  // Prefer typical home/school ranges first.
  const rank = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : ip.startsWith('172.') ? 2 : 3);
  return out.sort((a, b) => rank(a.address) - rank(b.address));
}

export function makePin() {
  return String(crypto.randomInt(0, 10000)).padStart(4, '0');
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const p = path.normalize(path.join(root, decoded));
  return p.startsWith(root) ? p : null;
}

/**
 * Start the classroom server.
 * @param {{ port?: number, host?: string, distDir?: string, pin?: string, name?: string, beacon?: boolean, log?: (m:string)=>void }} opts
 */
export async function startServer(opts = {}) {
  const distDir = path.resolve(opts.distDir || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist'));
  const host = opts.host ?? '0.0.0.0';
  const pin = opts.pin || makePin();
  const regiaKey = crypto.randomBytes(12).toString('hex');
  const sessionName = opts.name || `Open Vent Sim – ${os.hostname().replace(/\.local$/, '')}`;
  const log = opts.log || (() => {});

  /** @type {Map<string, {id:string, clientId:string, name:string, ws:any, state:any, events:any[], connectedAt:number, lastSeen:number}>} */
  const vents = new Map();
  const regie = new Set();
  let ventCounter = 0;

  // ---------------------------------------------------------------- HTTP --
  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    if (url.startsWith('/api/info')) {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ app: 'open-vent-sim', protocol: PROTOCOL_VERSION, name: sessionName, pinRequired: true }));
      return;
    }
    let file = safeJoin(distDir, url === '/' ? '/index.html' : url);
    if (!file) { res.writeHead(400); res.end(); return; }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) file = path.join(distDir, 'index.html'); // SPA fallback
      fs.readFile(file, (err2, data) => {
        if (err2) {
          res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('Open Vent Sim: the app files are missing (run "npm run build").');
          return;
        }
        const ext = path.extname(file).toLowerCase();
        res.writeHead(200, {
          'content-type': MIME[ext] || 'application/octet-stream',
          'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
        });
        res.end(data);
      });
    });
  });

  // ----------------------------------------------------------- WebSocket --
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  wss.on('error', () => { /* keep serving */ });
  server.on('clientError', (_e, socket) => { try { socket.destroy(); } catch { /* ignore */ } });

  server.on('upgrade', (req, socket, head) => {
    if (!(req.url || '').startsWith('/ws')) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
  const online = (v) => !!v.ws && v.ws.readyState === 1;
  // OVS 3.3: a screen can be a **mirror** of another ventilator (same machine on the
  // projector and on the tablets). Mirrors are not machines: the console lists the
  // owner only, with how many screens show it.
  const ventList = () => [...vents.values()].filter((v) => !v.mirrorOf).map((v) => ({
    id: v.id, name: v.name, connected: online(v), lastSeen: v.lastSeen,
    mirrors: [...vents.values()].filter((m) => m.mirrorOf === v.id && online(m)).length,
  }));
  /** Machines that are switched on, to offer to a screen that joins. */
  const runningList = (except) => [...vents.values()]
    .filter((v) => v !== except && !v.mirrorOf && online(v) && v.state?.screen === 'running' && v.state?.ventilatore)
    .map((v) => ({ id: v.id, name: v.name }));
  const toMirrors = (owner, msg) => { for (const m of vents.values()) if (m.mirrorOf === owner.id) send(m.ws, msg); };
  const toRegie = (msg) => { for (const r of regie) send(r, msg); };
  const announceVents = () => toRegie({ t: 'vents', list: ventList() });

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    // Without this listener a malformed/oversized frame would crash the whole server.
    ws.on('error', () => { try { ws.terminate(); } catch { /* ignore */ } });
    let role = null;
    let vent = null;
    const remote = req.socket.remoteAddress;

    const helloTimer = setTimeout(() => { if (!role) ws.close(4401, 'hello timeout'); }, 10000);

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      if (!msg || typeof msg.t !== 'string') return;

      if (msg.t === 'ping') { send(ws, { t: 'pong' }); return; }

      if (!role) {
        if (msg.t !== 'hello') return;
        if (msg.role === 'regia') {
          if (msg.key !== regiaKey) { send(ws, { t: 'denied', reason: 'key' }); ws.close(4403, 'bad key'); return; }
          role = 'regia';
          regie.add(ws);
          clearTimeout(helloTimer);
          send(ws, { t: 'welcome', role, name: sessionName, pin, protocol: PROTOCOL_VERSION });
          send(ws, { t: 'vents', list: ventList() });
          for (const v of vents.values()) {
            if (v.state) send(ws, { t: 'state', from: v.id, state: v.state });
            if (v.events.length) send(ws, { t: 'events', from: v.id, events: v.events });
          }
          log(`regia connected from ${remote}`);
          return;
        }
        if (msg.role === 'vent') {
          if (String(msg.pin || '') !== pin) { send(ws, { t: 'denied', reason: 'pin' }); ws.close(4403, 'bad pin'); return; }
          const clientId = String(msg.clientId || crypto.randomUUID()).slice(0, 64);
          vent = [...vents.values()].find((v) => v.clientId === clientId) || null;
          if (!vent) {
            if (vents.size >= MAX_VENTS) { send(ws, { t: 'denied', reason: 'full' }); ws.close(4429, 'full'); return; }
            ventCounter += 1;
            vent = { id: `v${ventCounter}`, clientId, name: `Ventilatore ${ventCounter}`, ws: null, state: null, events: [], connectedAt: Date.now(), lastSeen: Date.now(), mirrorOf: null };
            vents.set(vent.id, vent);
          } else if (vent.ws && vent.ws !== ws) {
            try { vent.ws.close(4409, 'replaced'); } catch { /* ignore */ }
          }
          if (typeof msg.name === 'string' && msg.name.trim()) vent.name = msg.name.trim().slice(0, 40);
          vent.ws = ws;
          vent.lastSeen = Date.now();
          role = 'vent';
          clearTimeout(helloTimer);
          send(ws, { t: 'welcome', role, id: vent.id, name: vent.name, session: sessionName, protocol: PROTOCOL_VERSION, regia: regie.size > 0, running: runningList(vent), mirrorOf: vent.mirrorOf });
          // A mirror that reconnects gets the picture at once; an owner that comes back tells its mirrors.
          if (vent.mirrorOf) { const o = vents.get(vent.mirrorOf); if (o?.state) send(ws, { t: 'mirror-state', from: o.id, name: o.name, state: o.state }); }
          toMirrors(vent, { t: 'mirror-back', from: vent.id });
          announceVents();
          log(`${vent.name} connected from ${remote}`);
          return;
        }
        send(ws, { t: 'denied', reason: 'role' });
        ws.close(4400, 'bad role');
        return;
      }

      if (role === 'vent' && vent) {
        vent.lastSeen = Date.now();
        if (msg.t === 'state' && msg.state && typeof msg.state === 'object') {
          if (vent.mirrorOf) return; // a mirror has no machine of its own
          vent.state = msg.state;
          toRegie({ t: 'state', from: vent.id, state: msg.state });
          toMirrors(vent, { t: 'mirror-state', from: vent.id, name: vent.name, state: msg.state });
        } else if (msg.t === 'follow') {
          const o = vents.get(String(msg.id));
          if (!o || o === vent || o.mirrorOf) { send(ws, { t: 'mirror-gone', from: String(msg.id) }); return; }
          vent.mirrorOf = o.id;
          vent.state = null;
          if (o.state) send(ws, { t: 'mirror-state', from: o.id, name: o.name, state: o.state });
          announceVents();
        } else if (msg.t === 'unfollow') {
          vent.mirrorOf = null;
          announceVents();
        } else if (msg.t === 'mirror-action' && vent.mirrorOf && msg.azione && typeof msg.azione === 'object') {
          const o = vents.get(vent.mirrorOf);
          if (o && online(o)) send(o.ws, { t: 'cmd', cmd: { type: 'azione', azione: msg.azione }, cmdId: crypto.randomUUID(), by: 'mirror' });
        } else if (msg.t === 'event' && msg.event) {
          vent.events.push(msg.event);
          if (vent.events.length > MAX_EVENTS_PER_VENT) vent.events.splice(0, vent.events.length - MAX_EVENTS_PER_VENT);
          toRegie({ t: 'event', from: vent.id, event: msg.event });
        } else if (msg.t === 'ack') {
          toRegie({ t: 'ack', from: vent.id, cmdId: msg.cmdId, ok: !!msg.ok, error: msg.error });
        }
        return;
      }

      if (role === 'regia') {
        if (msg.t === 'cmd' && msg.cmd && typeof msg.cmd === 'object') {
          const targets = msg.to === 'all' ? [...vents.values()].filter((v) => !v.mirrorOf) : [vents.get(String(msg.to))].filter((v) => v && !v.mirrorOf);
          const cmdId = String(msg.cmdId || crypto.randomUUID()).slice(0, 64);
          let delivered = 0;
          for (const v of targets) { if (v.ws && v.ws.readyState === 1) { send(v.ws, { t: 'cmd', cmd: msg.cmd, cmdId }); delivered++; } }
          send(ws, { t: 'sent', cmdId, delivered });
        } else if (msg.t === 'rename' && vents.has(String(msg.id)) && typeof msg.name === 'string') {
          const v = vents.get(String(msg.id));
          v.name = msg.name.trim().slice(0, 40) || v.name;
          send(v.ws, { t: 'renamed', name: v.name });
          announceVents();
        } else if (msg.t === 'forget' && vents.has(String(msg.id))) {
          const v = vents.get(String(msg.id));
          if (v.ws) try { v.ws.close(4410, 'removed by instructor'); } catch { /* ignore */ }
          vents.delete(v.id);
          announceVents();
        }
      }
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (role === 'regia') { regie.delete(ws); for (const v of vents.values()) send(v.ws, { t: 'regia', present: regie.size > 0 }); }
      if (role === 'vent' && vent && vent.ws === ws) {
        vent.ws = null; vent.lastSeen = Date.now(); announceVents();
        toMirrors(vent, { t: 'mirror-gone', from: vent.id });
      }
    });
  });

  // When the first director joins, tell the ventilators.
  const origAdd = regie.add.bind(regie);
  regie.add = (ws) => { const r = origAdd(ws); for (const v of vents.values()) send(v.ws, { t: 'regia', present: true }); return r; };

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch { /* ignore */ }
    }
  }, HEARTBEAT_MS);

  // ---------------------------------------------------------------- listen --
  const basePort = opts.port ?? DEFAULT_PORT;
  let port = basePort;
  for (let attempt = 0; ; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const onErr = (e) => { server.off('listening', onOk); reject(e); };
        const onOk = () => { server.off('error', onErr); resolve(); };
        server.once('error', onErr);
        server.once('listening', onOk);
        server.listen(port, host);
      });
      break;
    } catch (e) {
      if (e.code === 'EADDRINUSE' && attempt < 10 && basePort !== 0) { port += 1; continue; }
      throw e;
    }
  }
  port = server.address().port;

  // ---------------------------------------------------------------- beacon --
  let beacon = null;
  let beaconTimer = null;
  if (opts.beacon !== false && host !== '127.0.0.1') {
    try {
      beacon = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      beacon.on('error', () => { /* beacon is best-effort */ });
      beacon.bind(() => {
        try { beacon.setBroadcast(true); } catch { /* ignore */ }
        const tick = () => {
          const payload = Buffer.from(JSON.stringify({ ovs: PROTOCOL_VERSION, name: sessionName, port }));
          try { beacon.send(payload, BEACON_PORT, '255.255.255.255'); } catch { /* ignore */ }
        };
        tick();
        beaconTimer = setInterval(tick, 2000);
      });
    } catch { beacon = null; }
  }

  const addresses = lanAddresses();
  const primary = addresses[0]?.address || '127.0.0.1';
  log(`Open Vent Sim server on port ${port} — PIN ${pin}`);

  return {
    port, pin, regiaKey, sessionName, addresses,
    ventUrl: `http://${primary}:${port}/?role=vent&pin=${pin}`,
    regiaUrl: (h = '127.0.0.1') => `http://${h}:${port}/?role=regia&key=${regiaKey}`,
    /** Drop every live connection (used by tests to simulate a Wi-Fi blip). */
    dropConnections() { for (const ws of wss.clients) try { ws.terminate(); } catch { /* ignore */ } },
    async close() {
      clearInterval(heartbeat);
      if (beaconTimer) clearInterval(beaconTimer);
      if (beacon) try { beacon.close(); } catch { /* ignore */ }
      for (const ws of wss.clients) try { ws.terminate(); } catch { /* ignore */ }
      await new Promise((r) => server.close(() => r()));
    },
  };
}

// ------------------------------------------------------------------- CLI --
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const i = process.argv.indexOf('--port');
  const port = i > 0 ? Number(process.argv[i + 1]) : DEFAULT_PORT;
  startServer({ port, log: (m) => console.log(m) }).then((s) => {
    console.log('');
    console.log('  Open Vent Sim classroom server is running.');
    console.log(`  Director (this computer):  ${s.regiaUrl('localhost')}`);
    console.log(`  Ventilators (same Wi-Fi):  ${s.ventUrl}`);
    console.log(`  PIN: ${s.pin}`);
    console.log('');
  }).catch((e) => { console.error(e); process.exit(1); });
}
