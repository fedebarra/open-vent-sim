import { test, expect, type Page } from '@playwright/test';
import { launchServer } from './helpers';

let srv: any;
test.beforeEach(async () => { srv = await launchServer('1234'); });
test.afterEach(async () => { await srv.close(); });

const SHOTS = process.env.OVS_SHOTS;
const CLOSE = '.simvent__cassetto:not(.simvent__cassetto--via) > header > button';

async function apri(browser: any) {
  const regia: Page = await (await browser.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 900 } })).newPage();
  const vent: Page = await (await browser.newContext({ locale: 'it-IT', viewport: { width: 1366, height: 860 } })).newPage();
  const errors: string[] = [];
  for (const pg of [regia, vent]) pg.on('pageerror', (e) => errors.push(e.message));
  await regia.goto(srv.regiaUrl('127.0.0.1'));
  await vent.goto(`http://127.0.0.1:${srv.port}/`);
  await vent.getByTestId('pin-input').fill('1234');
  return { regia, vent, errors };
}

async function pazienteCheRespira(regia: Page, f: string, i: string) {
  await regia.getByTestId('tab-patient').click();
  await regia.getByTestId('sl-spont').fill(f);
  await regia.getByTestId('sl-effort').fill(i);
  await regia.getByTestId('patient-apply').click();
}

test('NEURO: greyed out until the console mounts the catheter; the EAdi shows only in NEURO; fallback to PS when the catheter slips', async ({ browser }) => {
  const { regia, vent, errors } = await apri(browser);
  await vent.getByTestId('mode-icu').click();
  await vent.getByTestId('icu-invasive').click();
  await vent.getByTestId('patient-confirm').click();
  await expect(regia.getByTestId('vent-list')).toContainText('Ventilatore');
  await pazienteCheRespira(regia, '18', '0.5');

  // no catheter: NEURO is in the list, greyed out
  await vent.locator('[data-fam="maniglia-modalita"]').click();
  const neuro = vent.locator('[data-fam="modalita-NEURO"]');
  await expect(neuro).toBeDisabled();
  await expect(neuro).toContainText('serve il catetere EAdi');
  if (SHOTS) { await vent.waitForTimeout(800); await vent.screenshot({ path: `${SHOTS}/neuro-grigio.png` }); }

  // the console mounts it: in VC nothing EAdi shows yet
  await regia.getByTestId('tab-diaphragm').click();
  await regia.getByTestId('cath-giusto').click();
  await expect(neuro).toBeEnabled();
  await expect(vent.getByTestId('eadi-sola')).toHaveCount(0);
  await expect(vent.locator('.simvent__monitoraggio')).not.toContainText('EAdi picco');

  // NEURO chosen, still in standby: the lane alone
  await neuro.click();
  await vent.locator(CLOSE).click({ timeout: 2000 }).catch(() => {});
  await expect(vent.getByTestId('eadi-sola')).toBeVisible();
  if (SHOTS) await vent.screenshot({ path: `${SHOTS}/neuro-standby.png` });

  // ventilating in NEURO: lane, tiles, the level knob
  await vent.locator('[data-fam="maniglia-ventilazione"]').click();
  await vent.getByRole('button', { name: /AVVIA LA VENTILAZIONE/i }).click();
  await expect(vent.getByTestId('eadi-sola')).toHaveCount(0);
  await expect(vent.locator('.simvent__monitoraggio')).toContainText('EAdi picco');
  await expect(vent.locator('.simvent__barra')).toContainText('Livello NEURO');
  await expect(vent.getByTestId('neuro-stato')).toHaveCount(0);
  await vent.waitForTimeout(8000);
  if (SHOTS) await vent.screenshot({ path: `${SHOTS}/neuro-ventila.png` });

  // the catheter slips: the machine falls back to pressure support, and says so
  await regia.getByTestId('cath-staccato').click();
  await expect(vent.getByTestId('neuro-stato')).toHaveText('NEURO ⇄ PS', { timeout: 30_000 });
  if (SHOTS) await vent.screenshot({ path: `${SHOTS}/neuro-ripiego.png` });
  if (SHOTS) await regia.screenshot({ path: `${SHOTS}/regia-diaframma.png` });

  // removed: the lane goes; NEURO stays on pressure support
  await regia.getByTestId('cath-none').click();
  await expect(vent.locator('.simvent__monitoraggio')).not.toContainText('EAdi picco');
  await expect(vent.getByTestId('neuro-stato')).toHaveText('NEURO ⇄ PS');
  expect(errors).toEqual([]);
});

test('high flow: the band moves while it delivers, and no EAdi', async ({ browser }) => {
  const { regia, vent, errors } = await apri(browser);
  await vent.getByTestId('mode-highflow').click();
  if (await vent.getByTestId('patient-confirm').count()) await vent.getByTestId('patient-confirm').click();
  await expect(regia.getByTestId('vent-list')).toContainText(/Alti flussi|alto/i);
  await regia.getByTestId('tab-diaphragm').click();
  await regia.getByTestId('cath-giusto').click();
  const fascia = vent.getByTestId('af-flusso');
  await expect(fascia).toHaveAttribute('data-attivo', 'no');
  if (SHOTS) await vent.screenshot({ path: `${SHOTS}/af-standby.png` });
  await vent.locator('[data-fam="maniglia-ventilazione"]').click();
  await vent.getByRole('button', { name: /AVVIA/i }).click();
  await expect(fascia).toHaveAttribute('data-attivo', 'si');
  await expect(vent.getByTestId('eadi-sola')).toHaveCount(0);
  await vent.locator(CLOSE).click({ timeout: 2000 }).catch(() => {});
  await vent.waitForTimeout(1500);
  if (SHOTS) await vent.screenshot({ path: `${SHOTS}/af-eroga.png` });

  // the cannula from the console: occluded → less flow and an alarm; out of the nose → silence
  await regia.getByTestId('tab-mechanics').click();
  await expect(regia.getByTestId('hf-rox')).not.toHaveText('–');
  const impostato = Number(await vent.getByTestId('af-flusso-misurato').innerText());
  await regia.getByTestId('hf-occluded').click();
  await expect.poll(async () => Number(await vent.getByTestId('af-flusso-misurato').innerText()), { timeout: 15_000 }).toBeLessThan(impostato * 0.5);
  await expect(vent.locator('body')).toContainText('Flusso ostacolato');
  if (SHOTS) { await vent.waitForTimeout(800); await vent.screenshot({ path: `${SHOTS}/af-ostruita.png` }); await regia.screenshot({ path: `${SHOTS}/regia-af.png` }); }
  await regia.getByTestId('hf-out').click();
  await expect.poll(async () => Number(await vent.getByTestId('af-flusso-misurato').innerText()), { timeout: 15_000 }).toBe(impostato);
  await expect(vent.locator('body')).not.toContainText('Flusso ostacolato');
  await expect(vent.locator('body')).not.toContainText('Circuito aperto');
  expect(errors).toEqual([]);
});
