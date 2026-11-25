import { test, expect, type Page } from '@playwright/test';
import { launchServer, startIcuVentilation } from './helpers';
import { campioneMotore } from '../../device/screens/scenario/ventilatore/motore';
import { statoDa } from '../../device/screens/scenario/ventilatore/istantanea';
import { forzaSoffio } from '../../device/screens/scenario/ventilatore/suono';

let srv: any;
test.beforeEach(async () => { srv = await launchServer('1234'); });
test.afterEach(async () => { await srv.close(); });

/** Taps what reaches the speakers: level every ~10 ms with the wall clock, plus the notes started. */
async function ascolta(p: Page) {
  await p.addInitScript(() => {
    const w = window as any;
    w.__liv = []; w.__note = [];
    const connect = AudioNode.prototype.connect as any;
    AudioNode.prototype.connect = function (this: AudioNode, dest: any, ...r: any[]) {
      if (dest === this.context?.destination) {
        const an = (this.context as AudioContext).createAnalyser();
        an.fftSize = 512; connect.call(this, an);
        const b = new Float32Array(512);
        const i = (w.__canali = (w.__canali ?? -1) + 1);
        setInterval(() => { an.getFloatTimeDomainData(b); let s = 0; for (const x of b) s += x * x; w.__liv.push([i, Date.now(), Math.sqrt(s / 512)]); }, 10);
      }
      return connect.call(this, dest, ...r);
    };
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (t?: number) { w.__note.push([Date.now(), this.frequency.value, this.type]); return start.call(this, t); };
    const send = WebSocket.prototype.send;
    WebSocket.prototype.send = function (d: any) { if (String(d).includes('"impostazioni"')) w.__ultimo = String(d); return send.call(this, d); };
  });
}
const trova = (o: any): any => {
  if (!o || typeof o !== 'object') return null;
  if (o.impostazioni && o.accesoDa) return o;
  for (const v of Object.values(o)) { const x = trova(v); if (x) return x; }
  return null;
};
const picco = async (p: Page, canale: number, ms: number) => p.evaluate(async ([c, ms]) => {
  const w = window as any; w.__liv = [];
  await new Promise((r) => setTimeout(r, ms));
  return Math.max(0, ...w.__liv.filter((x: any) => x[0] === c).map((x: any) => x[2]));
}, [canale, ms] as const);

test('the breath sound follows the flow; freeze does not stop it; alarms differ and silence leaves the breath', async ({ browser }) => {
  const vent = await (await browser.newContext({ locale: 'it-IT', viewport: { width: 1180, height: 820 } })).newPage();
  const errors: string[] = [];
  vent.on('pageerror', (e) => errors.push(e.message));
  await ascolta(vent);
  await vent.goto(`http://127.0.0.1:${srv.port}/?role=vent&pin=1234`);
  await startIcuVentilation(vent);
  await vent.waitForTimeout(2500);

  // channel 0 = breath: the envelope against the engine's own flow
  await vent.evaluate(() => { (window as any).__liv = []; });
  await vent.waitForTimeout(12_000);
  const { liv, msg } = await vent.evaluate(() => ({ liv: (window as any).__liv, msg: (window as any).__ultimo }));
  const ist = trova(JSON.parse(msg));
  expect(ist).toBeTruthy();
  const stato = statoDa(ist);
  const s = liv.filter((x: any) => x[0] === 0) as [number, number, number][];
  expect(s.length).toBeGreaterThan(400);
  const corr = (ritardo: number) => {
    const a = s.map((x) => x[2]), b = s.map((x) => forzaSoffio(campioneMotore((x[1] - ritardo - ist.accesoDa) / 1000, stato).flusso));
    const m = (v: number[]) => v.reduce((p, q) => p + q, 0) / v.length, ma = m(a), mb = m(b);
    let n = 0, da = 0, db = 0;
    a.forEach((x, i) => { n += (x - ma) * (b[i] - mb); da += (x - ma) ** 2; db += (b[i] - mb) ** 2; });
    return n / Math.sqrt(da * db);
  };
  let migliore = 0, c = -1;
  for (let d = -200; d <= 200; d += 5) { const k = corr(d); if (k > c) { c = k; migliore = d; } }
  console.log(`breath sound: best lag ${migliore} ms, correlation ${c.toFixed(2)}`);
  expect(c).toBeGreaterThan(0.7);
  expect(Math.abs(migliore)).toBeLessThan(50);

  // frozen screen: still breathing
  await vent.getByRole('button', { name: 'CONGELA' }).click();
  expect(await picco(vent, 0, 6000)).toBeGreaterThan(0.01);
  await vent.getByRole('button', { name: 'CONGELA' }).click();

  // yellow, then red: different notes
  const note = () => vent.evaluate(() => { const w = window as any; return [...new Set(w.__note.filter((x: any) => x[2] === 'triangle').map((x: any) => Math.round(x[1])))]; });
  expect(await note()).toEqual([]);
  await vent.locator('[data-fam="maniglia-allarmi"]').click();
  await vent.locator('[data-fam="soglia-pPeak-preAlto"]').focus();
  for (let i = 0; i < 20; i++) await vent.keyboard.press('ArrowLeft');
  await expect.poll(note).toContain(494);
  expect(await note()).not.toContain(784);
  await vent.locator('[data-fam="soglia-pPeak-alto"]').focus();
  for (let i = 0; i < 25; i++) await vent.keyboard.press('ArrowLeft');
  await expect.poll(note).toContain(784);

  // silence: the alarm stops, the breath does not
  await vent.locator('.simvent__cassetto > header > button').click();
  await vent.locator('[data-fam="silenzia"]').click();
  await vent.waitForTimeout(500);
  expect(await picco(vent, 1, 5000)).toBeLessThan(0.001);
  expect(await picco(vent, 0, 6000)).toBeGreaterThan(0.01);

  // volumes: separate, and kept
  await vent.locator('[data-fam="maniglia-allarmi"]').click();
  await vent.locator('[data-fam="volume-respiro"]').fill('0');
  await vent.waitForTimeout(500);
  expect(await picco(vent, 0, 5500)).toBeLessThan(0.001);
  expect(await vent.evaluate(() => JSON.parse(localStorage.getItem('ovs-volumi-ventilatore')!))).toMatchObject({ respiro: 0, allarmi: 0.7 });
  await vent.locator('[data-fam="volume-respiro"]').fill('60');

  // standby: mute
  await vent.locator('.simvent__cassetto > header > button').click();
  await vent.locator('[data-fam="maniglia-ventilazione"]').click();
  await vent.locator('[data-fam="avvia"]').click();
  await vent.waitForTimeout(800);
  expect(await picco(vent, 0, 5500)).toBeLessThan(0.001);
  expect(errors).toEqual([]);
});
