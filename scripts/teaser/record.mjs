// Records the raw footage for the teaser from the real app, in English: one
// console and, in turn, the machines connected to it. Each scene is filmed
// with Chrome's screencast — JPEG frames with their real timestamps, so the
// clip lasts what the scene lasted (Playwright's own video drifts when the page
// is busy). `assemble.mjs` turns them into clips and captions them.
// Usage: node scripts/teaser/record.mjs <out-dir>
import { chromium } from '@playwright/test';
import { startServer } from '../../server/ovs-server.mjs';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] || 'teaser-raw');
fs.mkdirSync(OUT, { recursive: true });
const W = 1600, H = 900, SCALE = 1.6;
// LANG_SHOTS=it records the Italian app (for the Italian README's GIFs).
const IT = process.env.LANG_SHOTS === 'it';
const srv = await startServer({ port: 0, host: '127.0.0.1', beacon: false, pin: '4821', name: 'Simulation room' });
const base = `http://127.0.0.1:${srv.port}`;
const b = await chromium.launch();
const scenes = [];
const clocks = new Map();

async function page(name) {
  const c = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, locale: IT ? 'it-IT' : 'en-GB' });
  await c.addInitScript(`try{localStorage.setItem('ovs-language','${IT ? 'it' : 'en'}')}catch(e){}`);
  const p = await c.newPage();
  clocks.set(p, Date.now());
  p.__name = name;
  return p;
}
const now = (p) => (Date.now() - clocks.get(p)) / 1000;
/** Film `ms` milliseconds of `p` as scene `id`, doing `during` meanwhile. */
async function scene(p, id, ms, during) {
  const dir = path.join(OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await p.context().newCDPSession(p);
  const frames = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp, data });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: Math.round(W * SCALE), maxHeight: Math.round(H * SCALE), everyNthFrame: 1 });
  const t0 = Date.now();
  if (during) await during();
  const left = ms - (Date.now() - t0);
  if (left > 0) await p.waitForTimeout(left);
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  const end = frames.length ? frames[0].t + ms / 1000 : 0;
  // ffmpeg's concat list: each frame lasts until the next one, the last until the scene's end
  const list = [];
  frames.forEach((f, i) => {
    const name = `${String(i).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(dir, name), Buffer.from(f.data, 'base64'));
    const next = i + 1 < frames.length ? frames[i + 1].t : Math.max(f.t + 0.04, end);
    list.push(`file '${name}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  if (frames.length) list.push(`file '${String(frames.length - 1).padStart(5, '0')}.jpg'`);
  fs.writeFileSync(path.join(dir, 'frames.txt'), list.join('\n') + '\n');
  scenes.push({ id, page: p.__name, frames: frames.length, seconds: ms / 1000 });
  console.log(id, p.__name, frames.length, 'frames');
}
const startButton = (p) => p.getByRole('button', { name: /AVVIA LA VENTILAZIONE|START VENTILATION/i });
const ventilate = async (p) => { await p.locator('[data-fam="maniglia-ventilazione"]').click(); await startButton(p).click(); };
const pick = async (regia) => { await regia.getByTestId('vent-list').locator('li').last().click(); };
const close = (p) => p.context().close();

// ---- console
const regia = await page('regia');
await regia.goto(srv.regiaUrl('127.0.0.1'));
await regia.getByTestId('vent-qr').waitFor();

// ---- ICU, invasive
let vent = await page('icu');
await vent.goto(`${base}/`);
await vent.getByTestId('pin-input').fill('4821');
await vent.getByTestId('mode-icu').waitFor();
await scene(vent, 'machines', 4500);
await vent.getByTestId('mode-icu').click(); await vent.getByTestId('icu-invasive').click(); await vent.getByTestId('patient-confirm').click();
await ventilate(vent);
await regia.getByTestId('rec-start').click();
await vent.getByRole('button', { name: '10s' }).click();
await vent.waitForTimeout(9000);
await scene(vent, 'waves', 6000);
await regia.getByTestId('tab-patient').click();
await scene(regia, 'console-live', 5000);
await scene(regia, 'async-pick', 4500, async () => { await regia.waitForTimeout(900); await regia.getByTestId('case-pc-fame-aria').click(); });
await vent.waitForTimeout(12000);
await scene(vent, 'async-learner', 6000);
await regia.getByTestId('tab-async').click();
await regia.getByTestId('cough-fit').click();
await scene(vent, 'alarm', 5000);
await regia.getByTestId('tab-patient').click();
await regia.getByTestId('preset-normale').click();
await vent.getByTestId('vista-eit').click();
await vent.waitForTimeout(4000);
await scene(vent, 'eit', 5000);
await vent.getByTestId('vista-curve').click();

// ---- NEURO: the console mounts the catheter too deep; the learner pulls it into place
await regia.getByTestId('tab-patient').click();
await regia.getByTestId('case-neuro-titolazione').click();
await regia.getByTestId('tab-diaphragm').click();
await scene(regia, 'catheter-console', 4500, async () => { await regia.waitForTimeout(800); await regia.getByTestId('cath-profondo').click(); });
await vent.getByTestId('vista-catetere').click();
await vent.waitForTimeout(6000);
await scene(vent, 'catheter-deep', 4500);
await scene(vent, 'catheter-pull', 7000, async () => {
  for (let i = 0; i < 3; i++) { await vent.waitForTimeout(1200); await vent.getByTestId('cat-tira').click(); }
});
await vent.getByTestId('vista-catetere').click();
await vent.waitForTimeout(9000);
await scene(vent, 'neuro', 6000);
await close(vent);

// ---- NIV: the mask comes off, the machine pauses
vent = await page('niv');
await vent.goto(`${base}/`); await vent.getByTestId('pin-input').fill('4821');
await vent.getByTestId('mode-icu').click(); await vent.getByTestId('icu-niv').click(); await vent.getByTestId('patient-confirm').click();
await ventilate(vent);
await vent.getByRole('button', { name: '10s' }).click();
await pick(regia);
await regia.getByTestId('tab-patient').click();
await regia.getByTestId('case-niv-bpco-perdita').click();
const tile = vent.locator('[data-fam="manopola-perditaEccessiva"]');
await tile.locator('.simvent__manopola-corpo').click(); await tile.getByRole('button', { name: '+' }).click(); await tile.locator('.simvent__passi-conferma').click();
await vent.waitForTimeout(9000);
await scene(vent, 'niv', 5000);
await regia.getByTestId('tab-events').click();
await regia.getByTestId('event-fire-maskoff').click();
await vent.getByTestId('pausa-perdita').waitFor({ timeout: 30000 });
await vent.waitForTimeout(1500);
await scene(vent, 'niv-maskoff', 5000);
await close(vent);

// ---- High flow: the cannula out of the nose, and the ROX on the console
vent = await page('hf');
await vent.goto(`${base}/`); await vent.getByTestId('pin-input').fill('4821');
await vent.getByTestId('mode-highflow').click();
if (await vent.getByTestId('patient-confirm').count()) await vent.getByTestId('patient-confirm').click();
await ventilate(vent);
await pick(regia);
await vent.waitForTimeout(3000);
await scene(vent, 'hf', 4500);
await regia.getByTestId('tab-mechanics').click();
await scene(regia, 'hf-console', 4500, async () => { await regia.waitForTimeout(1000); await regia.getByTestId('hf-occluded').click(); });
await vent.waitForTimeout(1500);
await scene(vent, 'hf-blocked', 4500);
await close(vent);

// ---- Anaesthesia
vent = await page('anaesthesia');
await vent.goto(`${base}/`); await vent.getByTestId('pin-input').fill('4821');
await vent.getByTestId('mode-anesthesia').click(); await vent.getByTestId('patient-confirm').click();
await ventilate(vent);
await vent.getByRole('button', { name: '10s' }).click();
await vent.waitForTimeout(8000);
await scene(vent, 'anaesthesia', 5000);
await close(vent);

// ---- Session log
await regia.getByTestId('rec-stop').click();
await regia.getByTestId('registro').waitFor();
await regia.getByTestId('registro').locator('input:not([type=file])').first().fill(IT ? 'Specializzandi 1° anno – martedì' : 'First-year residents – Tuesday');
await scene(regia, 'log', 5000);

// ---- Guided tour (stand-alone screen)
vent = await page('tour');
await vent.goto(`${base}/`);
await vent.getByText(/Usa senza regia|Use without instructor/).click();
await vent.getByTestId('start-tour').click();
await scene(vent, 'tour', 6000, async () => {
  await vent.waitForTimeout(2200); await vent.getByTestId('tour-next').click();
  await vent.waitForTimeout(1500); await vent.getByTestId('mode-icu').dispatchEvent('click');
});
await close(vent);

await close(regia);
await b.close();
fs.writeFileSync(path.join(OUT, 'scenes.json'), JSON.stringify({ scenes }, null, 2));
console.log('scenes:', scenes.length);
process.exit(0);
