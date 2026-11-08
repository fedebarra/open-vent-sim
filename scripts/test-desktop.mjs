// Smoke test of a packaged desktop build: node scripts/test-desktop.mjs "/path/Open Vent Sim.app/Contents/MacOS/Open Vent Sim"
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import dgram from 'node:dgram';

const bin = process.argv[2];
const SHOTS = process.argv[3] || '.';
const app = process.env.ATTACH ? { kill() {} } : spawn(bin, ['--remote-debugging-port=9333'], { stdio: 'ignore' });
setTimeout(() => { console.error('✘ timeout'); app.kill(); process.exit(2); }, 120000);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (m) => console.log('✔', m);
try {
  let browser;
  for (let i = 0; i < 40 && !browser; i++) { try { browser = await chromium.connectOverCDP('http://127.0.0.1:9333'); } catch { await wait(500); } }
  if (!browser) throw new Error('app did not start');
  ok('app started');
  let page;
  for (let i = 0; i < 40 && !page; i++) { page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith('http://127.0.0.1')); if (!page) await wait(500); }
  await page.getByTestId('choose-regia').waitFor({ timeout: 15000 });
  ok('launcher shown: ' + page.url());
  await page.screenshot({ path: `${SHOTS}/desktop-launcher.png` });

  // UDP beacon must appear once the console starts
  const beacon = new Promise((resolve) => {
    const s = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    s.on('message', (m) => { try { const j = JSON.parse(String(m)); if (j.ovs) { s.close(); resolve(j); } } catch {} });
    s.bind(47878);
    setTimeout(() => { try { s.close(); } catch {} resolve(null); }, 15000);
  });
  await page.getByTestId('choose-regia').click();
  await page.getByTestId('regia-pin').waitFor({ timeout: 20000 });
  await page.waitForFunction(() => /\d{4}/.test(document.querySelector('[data-testid=regia-pin]')?.textContent || ''), null, { timeout: 15000 });
  const pin = (await page.getByTestId('regia-pin').innerText()).trim();
  ok(`console open, PIN ${pin}, url ${page.url()}`);
  const addr = await page.getByTestId('vent-address').innerText();
  ok('learner address shown: ' + addr);
  const b = await beacon;
  if (!b) throw new Error('no UDP beacon received');
  ok(`beacon received: ${b.name} port ${b.port}`);

  // a learner joins from a normal browser on the LAN address
  const ext = await chromium.launch();
  const v = await (await ext.newContext({ locale: 'it-IT' })).newPage();
  await v.goto(`${addr}/?role=vent&pin=${pin}`);
  await v.getByTestId('mode-icu').waitFor();
  await page.getByTestId('vent-list').getByText('Ventilatore 1').waitFor({ timeout: 15000 });
  ok('learner joined over the LAN address and appears on the console');
  await page.screenshot({ path: `${SHOTS}/desktop-regia.png` });
  await ext.close();
  await browser.close();
  console.log('ALL OK');
} catch (e) {
  console.error('✘', e.message); process.exitCode = 1;
} finally { app.kill(); process.exit(process.exitCode || 0); }
