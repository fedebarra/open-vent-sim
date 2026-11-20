import { test, expect } from '@playwright/test';
import { launchServer } from './helpers';

let srv: any;
test.beforeEach(async () => { srv = await launchServer('1234'); });
test.afterEach(async () => { await srv.close(); });

const SHOTS = process.env.OVS_SHOTS;

test('the console mounts the EAdi catheter: lane, numbers and pressure estimate on the learner screen, also in standby', async ({ browser }) => {
  const regia = await (await browser.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 900 } })).newPage();
  const vent = await (await browser.newContext({ locale: 'it-IT', viewport: { width: 1366, height: 860 } })).newPage();
  const errors: string[] = [];
  for (const pg of [regia, vent]) pg.on('pageerror', (e) => errors.push(e.message));

  await regia.goto(srv.regiaUrl('127.0.0.1'));
  await vent.goto(`http://127.0.0.1:${srv.port}/`);
  await vent.getByTestId('pin-input').fill('1234');
  await vent.getByTestId('mode-icu').click();
  await vent.getByTestId('icu-invasive').click();
  await vent.getByTestId('patient-confirm').click();
  await expect(regia.getByTestId('vent-list')).toContainText('Ventilatore');

  // a breathing patient, in standby: with the catheter the signal is there before ventilating
  await regia.getByTestId('tab-patient').click();
  await regia.getByTestId('sl-spont').fill('18');
  await regia.getByTestId('sl-effort').fill('0.5');
  await regia.getByTestId('patient-apply').click();
  await regia.getByTestId('tab-diaphragm').click();
  await expect(vent.getByTestId('eadi-sola')).toHaveCount(0);
  await regia.getByTestId('cath-giusto').click();
  await expect(vent.getByTestId('eadi-sola')).toBeVisible();
  await expect(vent.locator('.simvent__spento')).toBeVisible();
  if (SHOTS) await vent.screenshot({ path: `${SHOTS}/eadi-standby.png` });

  // ventilating: the lane joins the three curves, the numbers their own group
  await vent.locator('[data-fam="maniglia-ventilazione"]').click();
  await vent.getByRole('button', { name: /AVVIA LA VENTILAZIONE/i }).click();
  await expect(vent.getByTestId('eadi-sola')).toHaveCount(0);
  await expect(vent.locator('.simvent__monitoraggio')).toContainText('Diaframma');
  await expect(vent.locator('.simvent__monitoraggio')).toContainText('EAdi picco');
  await expect.poll(async () => Number((await regia.getByTestId('eadi-peak').innerText()).replace(/[^\d.]/g, '')), { timeout: 20_000 }).toBeGreaterThan(1);

  // the pressure estimate over Paw, and its level
  await vent.getByTestId('vista-stima').click();
  await expect(vent.getByTestId('stima-livello')).toHaveText('1.0');
  await vent.getByTestId('stima-piu').click();
  await expect(vent.getByTestId('stima-livello')).toHaveText('1.1');
  await vent.waitForTimeout(6000);
  if (SHOTS) await vent.screenshot({ path: `${SHOTS}/eadi-ventila.png` });

  // a shallow catheter: the minimum climbs (ECG in the signal)
  await regia.getByTestId('cath-superficiale').click();
  await expect.poll(async () => Number((await regia.getByTestId('eadi-min').innerText()).replace(/[^\d.]/g, '')), { timeout: 20_000 }).toBeGreaterThan(4);
  await vent.waitForTimeout(6000);
  if (SHOTS) await vent.screenshot({ path: `${SHOTS}/eadi-superficiale.png` });
  if (SHOTS) await regia.screenshot({ path: `${SHOTS}/regia-diaframma.png` });

  // removed: the lane goes, the numbers go
  await regia.getByTestId('cath-none').click();
  await expect(vent.locator('.simvent__monitoraggio')).not.toContainText('EAdi picco');
  await expect(vent.getByTestId('vista-stima')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('on high flow the EAdi is the only real curve', async ({ browser }) => {
  const regia = await (await browser.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 900 } })).newPage();
  const vent = await (await browser.newContext({ locale: 'it-IT', viewport: { width: 1366, height: 860 } })).newPage();
  const errors: string[] = [];
  for (const pg of [regia, vent]) pg.on('pageerror', (e) => errors.push(e.message));
  await regia.goto(srv.regiaUrl('127.0.0.1'));
  await vent.goto(`http://127.0.0.1:${srv.port}/`);
  await vent.getByTestId('pin-input').fill('1234');
  await vent.getByTestId('mode-highflow').click();
  if (await vent.getByTestId('patient-confirm').count()) await vent.getByTestId('patient-confirm').click();
  await expect(regia.getByTestId('vent-list')).toContainText(/Alti flussi|alto/i);
  await regia.getByTestId('tab-patient').click();
  await regia.getByTestId('sl-spont').fill('28');
  await regia.getByTestId('sl-effort').fill('0.8');
  await regia.getByTestId('patient-apply').click();
  await regia.getByTestId('tab-diaphragm').click();
  await regia.getByTestId('cath-giusto').click();
  await expect(vent.getByTestId('eadi-sola')).toBeVisible();
  await vent.waitForTimeout(5000);
  if (SHOTS) await vent.screenshot({ path: `${SHOTS}/eadi-altoflusso.png` });
  expect(errors).toEqual([]);
});
