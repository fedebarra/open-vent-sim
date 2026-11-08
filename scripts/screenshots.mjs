// Regenerates every README screenshot from the real app: `npm run screenshots`.
import { chromium } from '@playwright/test';
import { startServer } from '../server/ovs-server.mjs';
import fs from 'node:fs';

const OUT = process.env.OUT || 'docs/screenshots';
const SCALE = Number(process.env.SCALE || 1);
fs.mkdirSync(OUT, { recursive: true });
const LANG = process.env.LANG_SHOTS || 'it';
const loc = LANG === 'it' ? 'it-IT' : 'en-GB';
const sfx = LANG === 'it' ? '' : '-en';
const srv = await startServer({ port: 0, host: '127.0.0.1', beacon: false, pin: '4821', name: LANG === 'it' ? 'Open Vent Sim – Aula di simulazione' : 'Open Vent Sim – Simulation room' });
const base = `http://127.0.0.1:${srv.port}`;
const b = await chromium.launch();
const shot = async (p, name) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${name}${sfx}.png` }); console.log(name); };
// pretend to be the desktop app on a typical school network, so addresses look real
const ROOM = LANG === 'it' ? 'Open Vent Sim – Aula di simulazione' : 'Open Vent Sim – Simulation room';
const fakeDesktop = (launcher) => `window.ovsDesktop = { isLauncher: ${launcher}, startRegia: async () => '', serverInfo: async () => ({ addresses: ['192.168.1.20'], port: 8787 }), startDiscovery: async () => true, stopDiscovery: async () => true, onDiscovered: (fn) => { const f = () => fn({ name: '${ROOM}', host: '192.168.1.20', port: 8787, seen: Date.now() }); setTimeout(f, 300); setInterval(f, 2000); return () => {}; } };`;
const ctx = async (w, h, init) => { const c = await b.newContext({ viewport: { width: w, height: h }, locale: loc, deviceScaleFactor: SCALE }); if (init) await c.addInitScript(init); await c.addInitScript(`try{localStorage.setItem('ovs-language','${LANG}')}catch(e){}`); return c; };
const startIcu = async (p) => { await p.getByTestId('mode-icu').click(); await p.getByTestId('icu-invasive').click(); await p.getByTestId('patient-confirm').click(); await p.getByRole('button', { name: /^STANDBY$/i }).click(); await p.getByRole('button', { name: /AVVIA LA VENTILAZIONE|START VENTILATION/i }).click(); };

// 1. desktop launcher + ventilator search
{ const c = await ctx(1280, 800, fakeDesktop(true)); const p = await c.newPage(); await p.goto(`${base}/?desktop=1`); await shot(p, '01-launcher');
  await p.getByTestId('choose-vent').click(); await p.waitForTimeout(800); await shot(p, '05-find-instructor'); await c.close(); }

// 2. director console, empty
const rc = await ctx(1440, 900, fakeDesktop(false)); const regia = await rc.newPage();
await regia.goto(srv.regiaUrl('127.0.0.1')); await regia.getByTestId('vent-qr').waitFor(); await shot(regia, '02-regia-empty');

// 3. learner on a tablet: PIN screen, start screen
const vc = await ctx(1180, 820); const vent = await vc.newPage();
await vent.goto(`${base}/`); await vent.getByTestId('join-title').waitFor(); await vent.getByTestId('pin-input').fill('48'); await shot(vent, '03-join-pin');
await vent.getByTestId('pin-input').fill('4821'); await vent.getByTestId('mode-icu').waitFor(); await shot(vent, '04-start');
await vent.getByTestId('mode-icu').click(); await shot(vent, '06-icu-choice');
await vent.getByTestId('icu-invasive').click(); await shot(vent, '07-patient');
await vent.getByTestId('patient-confirm').click(); await vent.getByRole('button', { name: /^STANDBY$/i }).click(); await shot(vent, '08-standby-drawer');
await vent.getByRole('button', { name: /AVVIA LA VENTILAZIONE|START VENTILATION/i }).click(); await vent.waitForTimeout(6000); await shot(vent, '09-icu-running');

// 4. director live
await regia.getByTestId('rec-start').click();
await regia.getByTestId('tab-patient').click(); await regia.waitForTimeout(4200); await shot(regia, '10-regia-live');
await regia.getByTestId('tab-async').click(); await regia.getByTestId('async-preset-decurarizzazione').click(); await regia.waitForTimeout(6000); await shot(regia, '11-regia-async');
await vent.waitForTimeout(1500); await shot(vent, '12-learner-asynchrony');
await regia.getByTestId('tab-machine').click(); await regia.getByTestId('opt-didattica').check(); await regia.getByTestId('tab-async').click();
await vent.getByTestId('vista-loop').click(); await vent.waitForTimeout(6000); await vent.getByTestId('loop-riferimento').click(); await shot(vent, '21-loops');
await vent.getByTestId('vista-curve').click(); await vent.getByTestId('vista-palv').click(); await vent.waitForTimeout(12000); await shot(vent, '22-palv-pmus');
await vent.getByTestId('vista-palv').click();
await regia.getByTestId('tab-lung').click(); await shot(regia, '13-regia-lung');
await regia.getByTestId('tab-machine').click(); await regia.getByTestId('param-peep').fill('8'); await regia.getByTestId('param-send-peep').click(); await shot(regia, '14-regia-machine');
await regia.getByTestId('tab-events').click(); await regia.getByTestId('event-add-bronchospasm').click(); await regia.getByTestId('event-add-desat').click(); await regia.getByTestId('event-add-normal').click(); await shot(regia, '15-regia-events');
await regia.getByTestId('event-fire-bronchospasm').click(); await regia.waitForTimeout(12000);
await regia.getByTestId('rec-stop').click(); await regia.getByTestId('registro').waitFor();
await regia.getByTestId('registro').locator('input:not([type=file])').first().fill(LANG === 'it' ? 'Specializzandi 1° anno – martedì' : 'First-year residents – Tuesday');
await shot(regia, '16-registro');
await rc.close(); await vc.close();

// 5. the other machines, stand-alone
for (const [name, go] of [
  ['17-anesthesia', async (p) => { await p.getByTestId('mode-anesthesia').click(); await p.getByTestId('patient-confirm').click(); }],
  ['18-niv', async (p) => { await p.getByTestId('mode-icu').click(); await p.getByTestId('icu-niv').click(); await p.getByTestId('patient-confirm').click(); }],
  ['19-highflow', async (p) => { await p.getByTestId('mode-highflow').click(); await p.getByTestId('patient-confirm').click(); }],
]) {
  const c = await ctx(1366, 860); const p = await c.newPage(); await p.goto(`${base}/`); await p.getByText(/Usa senza regia|Use without instructor/).click(); await go(p);
  await p.getByRole('button', { name: /^STANDBY$/i }).click(); const start = p.getByRole('button', { name: /AVVIA|START/i }).last(); if (await start.count()) await start.click(); else await p.keyboard.press('Escape');
  await p.waitForTimeout(6000); await shot(p, name); await c.close();
}

// 6. guided tour
{ const c = await ctx(1366, 860); const p = await c.newPage(); await p.goto(`${base}/`); await p.getByText(/Usa senza regia|Use without instructor/).click();
  await p.getByTestId('start-tour').click(); await shot(p, '20-tour'); await c.close(); }

await b.close(); await srv.close();
