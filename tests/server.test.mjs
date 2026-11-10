// Classroom server tests: PIN, director key, relay, reconnection, removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { startServer } from '../server/ovs-server.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// a minimal built app, so the test does not depend on `npm run build`
const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-dist-'));
fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><div id="root"></div>');

const open = (port) => new Promise((res, rej) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  ws.inbox = [];
  ws.waiters = [];
  ws.on('message', (d) => {
    const m = JSON.parse(String(d));
    const w = ws.waiters.findIndex((x) => x.pred(m));
    if (w >= 0) { ws.waiters[w].res(m); ws.waiters.splice(w, 1); } else ws.inbox.push(m);
  });
  ws.on('open', () => res(ws));
  ws.on('error', rej);
});
const next = (ws, pred, ms = 2000) => {
  const i = ws.inbox.findIndex(pred);
  if (i >= 0) return Promise.resolve(ws.inbox.splice(i, 1)[0]);
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout waiting message')), ms);
    ws.waiters.push({ pred, res: (m) => { clearTimeout(t); res(m); } });
  });
};
const closed = (ws) => new Promise((r) => ws.on('close', (code) => r(code)));

let srv;
test.before(async () => { srv = await startServer({ port: 0, host: '127.0.0.1', beacon: false, pin: '4321', distDir }); });
test.after(async () => { await srv.close(); });

test('serves the app and /api/info', async () => {
  const info = await fetch(`http://127.0.0.1:${srv.port}/api/info`).then((r) => r.json());
  assert.equal(info.app, 'open-vent-sim');
  const html = await fetch(`http://127.0.0.1:${srv.port}/some/deep/link`).then((r) => r.text());
  assert.match(html, /<div id="root">/);
  const trav = await fetch(`http://127.0.0.1:${srv.port}/..%2f..%2fpackage.json`);
  assert.doesNotMatch(await trav.text(), /"dependencies"/);
});

test('wrong PIN is refused, wrong director key is refused', async () => {
  const v = await open(srv.port);
  v.send(JSON.stringify({ t: 'hello', role: 'vent', pin: '0000', clientId: 'x' }));
  assert.equal((await next(v, (m) => m.t === 'denied')).reason, 'pin');
  assert.equal(await closed(v), 4403);
  const r = await open(srv.port);
  r.send(JSON.stringify({ t: 'hello', role: 'regia', key: 'nope' }));
  assert.equal((await next(r, (m) => m.t === 'denied')).reason, 'key');
});

test('state flows vent → regia, commands flow regia → vent, acks come back', async () => {
  const r = await open(srv.port);
  r.send(JSON.stringify({ t: 'hello', role: 'regia', key: srv.regiaKey }));
  const w = await next(r, (m) => m.t === 'welcome');
  assert.equal(w.pin, '4321');
  const v = await open(srv.port);
  v.send(JSON.stringify({ t: 'hello', role: 'vent', pin: '4321', clientId: 'c1' }));
  const vw = await next(v, (m) => m.t === 'welcome');
  assert.equal(vw.regia, true);
  const list = await next(r, (m) => m.t === 'vents' && m.list.length === 1 && m.list[0].connected);
  const id = list.list[0].id;

  v.send(JSON.stringify({ t: 'state', state: { mode: 'VC', params: { peep: 5 } } }));
  const st = await next(r, (m) => m.t === 'state');
  assert.equal(st.from, id);
  assert.equal(st.state.params.peep, 5);

  r.send(JSON.stringify({ t: 'cmd', to: id, cmd: { type: 'setParam', key: 'peep', value: 8 }, cmdId: 'k1' }));
  const cmd = await next(v, (m) => m.t === 'cmd');
  assert.equal(cmd.cmd.value, 8);
  assert.equal((await next(r, (m) => m.t === 'sent')).delivered, 1);
  v.send(JSON.stringify({ t: 'ack', cmdId: cmd.cmdId, ok: true }));
  assert.equal((await next(r, (m) => m.t === 'ack')).ok, true);

  v.send(JSON.stringify({ t: 'event', event: { at: 1, text: 'PEEP changed' } }));
  assert.equal((await next(r, (m) => m.t === 'event')).event.text, 'PEEP changed');

  // reconnection keeps the same slot and the regia gets the cached state on join
  v.terminate();
  await next(r, (m) => m.t === 'vents' && m.list.some((x) => x.id === id && !x.connected));
  const v2 = await open(srv.port);
  v2.send(JSON.stringify({ t: 'hello', role: 'vent', pin: '4321', clientId: 'c1' }));
  assert.equal((await next(v2, (m) => m.t === 'welcome')).id, id);
  const r2 = await open(srv.port);
  r2.send(JSON.stringify({ t: 'hello', role: 'regia', key: srv.regiaKey }));
  assert.equal((await next(r2, (m) => m.t === 'state')).state.params.peep, 5);
  assert.equal((await next(r2, (m) => m.t === 'events')).events.length, 1);

  // broadcast to all
  const v3 = await open(srv.port);
  v3.send(JSON.stringify({ t: 'hello', role: 'vent', pin: '4321', clientId: 'c3' }));
  await next(v3, (m) => m.t === 'welcome');
  r.send(JSON.stringify({ t: 'cmd', to: 'all', cmd: { type: 'silenceAlarms' } }));
  await next(v2, (m) => m.t === 'cmd');
  await next(v3, (m) => m.t === 'cmd');

  // rename and remove
  r.send(JSON.stringify({ t: 'rename', id, name: 'Letto 3' }));
  assert.equal((await next(v2, (m) => m.t === 'renamed')).name, 'Letto 3');
  r.send(JSON.stringify({ t: 'forget', id }));
  assert.equal(await closed(v2), 4410);
  [r, r2, v3].forEach((x) => x.close());
});

test('garbage and oversize messages do not crash the server', async () => {
  const v = await open(srv.port);
  v.send('not json');
  v.send(JSON.stringify({ nothing: true }));
  v.send(JSON.stringify({ t: 'cmd', cmd: {} })); // before hello: ignored
  const big = 'x'.repeat(300 * 1024);
  v.send(JSON.stringify({ t: 'hello', role: 'vent', pin: '4321', name: big }));
  const code = await closed(v);
  assert.equal(code, 1009); // message too big
  const ok = await fetch(`http://127.0.0.1:${srv.port}/api/info`);
  assert.equal(ok.status, 200);
});

test('a busy port falls back to the next one', async () => {
  const a = await startServer({ port: 18787, host: '127.0.0.1', beacon: false, distDir });
  const b = await startServer({ port: 18787, host: '127.0.0.1', beacon: false, distDir });
  assert.equal(b.port, 18788);
  await a.close(); await b.close();
});

test('OVS 3.3: a screen that joins mirrors the machine already on', async () => {
  const owner = await open(srv.port);
  owner.send(JSON.stringify({ t: 'hello', role: 'vent', pin: '4321', clientId: 'mirror-owner' }));
  const w1 = await next(owner, (m) => m.t === 'welcome');
  const snap = { screen: 'running', ventilatore: { accesoDa: 1, ambiente: 'invasiva' }, language: 'it', at: Date.now() };
  owner.send(JSON.stringify({ t: 'state', state: snap }));
  await new Promise((r) => setTimeout(r, 50));

  const screen2 = await open(srv.port);
  screen2.send(JSON.stringify({ t: 'hello', role: 'vent', pin: '4321', clientId: 'mirror-screen' }));
  const w2 = await next(screen2, (m) => m.t === 'welcome');
  assert.ok(w2.running.some((r) => r.id === w1.id), 'the running machine is offered');
  screen2.send(JSON.stringify({ t: 'follow', id: w1.id }));
  const first = await next(screen2, (m) => m.t === 'mirror-state');
  assert.equal(first.from, w1.id);
  // the owner's next snapshot reaches the mirror
  owner.send(JSON.stringify({ t: 'state', state: { ...snap, at: snap.at + 1 } }));
  assert.equal((await next(screen2, (m) => m.t === 'mirror-state')).state.at, snap.at + 1);
  // a tap on the mirror becomes the owner's command
  screen2.send(JSON.stringify({ t: 'mirror-action', azione: { tipo: 'silenzia' } }));
  const cmd = await next(owner, (m) => m.t === 'cmd');
  assert.equal(cmd.by, 'mirror');
  assert.deepEqual(cmd.cmd, { type: 'azione', azione: { tipo: 'silenzia' } });
  // a mirror sends no machine state of its own, and the console lists the owner only
  const r = await open(srv.port);
  r.send(JSON.stringify({ t: 'hello', role: 'regia', key: srv.regiaKey }));
  const list = await next(r, (m) => m.t === 'vents');
  assert.ok(!list.list.some((v) => v.id === w2.id), 'mirror not listed');
  assert.equal(list.list.find((v) => v.id === w1.id).mirrors, 1);
  // the owner goes: the mirror is told
  owner.close();
  await next(screen2, (m) => m.t === 'mirror-gone');
  screen2.close(); r.close();
});
