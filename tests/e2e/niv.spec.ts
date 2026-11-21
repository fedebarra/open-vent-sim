import { test, expect, type Page } from '@playwright/test';
import { launchServer } from './helpers';

let srv: any;
test.beforeEach(async () => { srv = await launchServer('1234'); });
test.afterEach(async () => { await srv.close(); });

const SHOTS = process.env.OVS_SHOTS;
const CLOSE = '.simvent__cassetto:not(.simvent__cassetto--via) > header > button';

async function scegli(vent: Page, modalita: string) {
  await vent.locator('[data-fam="maniglia-modalita"]').click();
  await vent.locator(`[data-fam="modalita-${modalita}"]`).click();
  await vent.locator(CLOSE).click({ timeout: 2000 }).catch(() => {});
}

test('NIV: PC and NEURO in the list; the mask comes off and the machine pauses, then resumes', async ({ browser }) => {
  const regia: Page = await (await browser.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 900 } })).newPage();
  const vent: Page = await (await browser.newContext({ locale: 'it-IT', viewport: { width: 1366, height: 860 } })).newPage();
  const errors: string[] = [];
  for (const pg of [regia, vent]) pg.on('pageerror', (e) => errors.push(e.message));
  await regia.goto(srv.regiaUrl('127.0.0.1'));
  await vent.goto(`http://127.0.0.1:${srv.port}/?role=vent&pin=1234`);
  await vent.getByTestId('mode-icu').click();
  await vent.getByTestId('icu-niv').click();
  await vent.getByTestId('patient-confirm').click();
  await expect(regia.getByTestId('vent-list')).toContainText(/Non Invasiva/);
  await regia.getByTestId('tab-patient').click();
  await regia.getByTestId('sl-spont').fill('18');
  await regia.getByTestId('sl-effort').fill('0.5');
  await regia.getByTestId('patient-apply').click();

  // the list: PC is there; NEURO is there, greyed until the console mounts the catheter
  await vent.locator('[data-fam="maniglia-modalita"]').click();
  await expect(vent.locator('[data-fam="modalita-PC"]')).toBeEnabled();
  const neuro = vent.locator('[data-fam="modalita-NEURO"]');
  await expect(neuro).toBeDisabled();
  await regia.getByTestId('tab-diaphragm').click();
  await regia.getByTestId('cath-giusto').click();
  await expect(neuro).toBeEnabled();
  await neuro.click();
  await vent.locator(CLOSE).click({ timeout: 2000 }).catch(() => {});

  // NEURO through the mask
  await vent.locator('[data-fam="maniglia-ventilazione"]').click();
  await vent.getByRole('button', { name: /AVVIA LA VENTILAZIONE/i }).click();
  await expect(vent.locator('.simvent__barra')).toContainText('Livello NEURO');
  await expect(vent.locator('.simvent__monitoraggio')).toContainText('EAdi picco');
  await vent.waitForTimeout(6000);
  if (SHOTS) await vent.screenshot({ path: `${SHOTS}/niv-neuro.png` });

  // NIV PC
  await scegli(vent, 'PC');
  await expect(vent.locator('.simvent__barra')).toContainText(/Pressione/);
  await expect(vent.locator('.simvent__monitoraggio')).not.toContainText('EAdi picco');

  // back to PS, and the machine set to pause when the leak passes 95%
  await scegli(vent, 'PS');
  const tessera = vent.locator('[data-fam="manopola-perditaEccessiva"]');
  await expect(tessera.locator('b[title]')).toHaveAttribute('title', 'Continua');
  await tessera.locator('.simvent__manopola-corpo').click();
  await tessera.getByRole('button', { name: '+' }).click();
  await expect(tessera.locator('b[title]')).toHaveAttribute('title', 'Pausa alto');
  await tessera.locator('.simvent__passi-conferma').click();

  // the mask comes off
  await regia.getByTestId('tab-events').click();
  await regia.getByTestId('event-fire-maskoff').click();
  await expect(vent.getByTestId('pausa-perdita')).toBeVisible({ timeout: 30_000 });
  await expect(vent.locator('body')).toContainText('Perdita eccessiva');
  if (SHOTS) { await vent.waitForTimeout(1500); await vent.screenshot({ path: `${SHOTS}/niv-pausa.png` }); }

  // refitted: it starts again on its own
  await regia.getByTestId('event-fire-maskseal').click();
  await expect(vent.getByTestId('pausa-perdita')).toHaveCount(0, { timeout: 30_000 });
  expect(errors).toEqual([]);
});
