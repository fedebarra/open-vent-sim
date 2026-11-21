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

test('catheter: the console mounts it too deep, the learner reads the leads and pulls it into place', async ({ browser }) => {
  const { regia, vent, errors } = await apri(browser);
  await vent.getByTestId('mode-icu').click();
  await vent.getByTestId('icu-invasive').click();
  await vent.getByTestId('patient-confirm').click();
  await expect(regia.getByTestId('vent-list')).toContainText('Ventilatore');
  await pazienteCheRespira(regia, '18', '0.6');
  await regia.getByTestId('tab-diaphragm').click();
  await regia.getByTestId('cath-profondo').click();
  await expect(regia.getByTestId('cath-depth')).toContainText('+3.0');

  // NEURO, then the catheter screen (only there)
  await expect(vent.getByTestId('vista-catetere')).toHaveCount(0);
  await vent.locator('[data-fam="maniglia-modalita"]').click();
  await vent.locator('[data-fam="modalita-NEURO"]').click();
  await vent.locator(CLOSE).click({ timeout: 2000 }).catch(() => {});
  await vent.getByTestId('vista-catetere').click();
  await expect(vent.getByTestId('vista-catetere-schermo')).toBeVisible();
  const calcolata = await vent.getByTestId('cat-calcolata').innerText();
  const prima = parseFloat(await vent.getByTestId('cat-cm').innerText());
  await vent.waitForTimeout(5000);
  if (SHOTS) await vent.screenshot({ path: `${SHOTS}/catetere-profondo.png` });

  // three steps out: back to the calculated depth, and the console sees it right
  for (let i = 0; i < 3; i++) await vent.getByTestId('cat-tira').click();
  await expect.poll(async () => parseFloat(await vent.getByTestId('cat-cm').innerText())).toBeCloseTo(prima - 4.8, 1);
  await expect(vent.getByTestId('cat-cm')).toHaveText(calcolata);
  await expect(regia.getByTestId('cath-giusto')).toHaveClass(/bg-sky-700/);
  await vent.waitForTimeout(5000);
  if (SHOTS) await vent.screenshot({ path: `${SHOTS}/catetere-giusto.png` });

  // back to the curves
  await vent.getByTestId('vista-catetere').click();
  await expect(vent.getByTestId('vista-catetere-schermo')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('ready case: the console loads «NEURO: titrating the level» and the machine is in NEURO with the catheter', async ({ browser }) => {
  const { regia, vent, errors } = await apri(browser);
  await vent.getByTestId('mode-icu').click();
  await vent.getByTestId('icu-invasive').click();
  await vent.getByTestId('patient-confirm').click();
  await expect(regia.getByTestId('vent-list')).toContainText('Ventilatore');
  await regia.getByTestId('tab-patient').click();
  await regia.getByTestId('case-neuro-titolazione').click();
  await expect(regia.getByTestId('case-note')).toContainText('Brander');
  await expect(vent.locator('.simvent__modo-sigla')).toHaveText('NEURO', { timeout: 15_000 });
  await vent.locator('[data-fam="maniglia-ventilazione"]').click();
  await vent.getByRole('button', { name: /AVVIA LA VENTILAZIONE/i }).click();
  await expect(vent.locator('.simvent__barra')).toContainText('0.3');
  await expect(vent.locator('.simvent__monitoraggio')).toContainText('EAdi picco');
  await expect(vent.getByTestId('vista-catetere')).toBeVisible();
  expect(errors).toEqual([]);
});

test('tour: the NEURO and catheter steps light up and tick as the learner does them', async ({ browser }) => {
  const { regia, vent, errors } = await apri(browser);
  await vent.getByTestId('start-tour').click();
  await expect(vent.getByTestId('tour-card')).toBeVisible();
  // the welcome card sits in the middle: past it, the start-up steps light what to touch
  await vent.getByTestId('tour-next').click();
  await vent.getByTestId('mode-icu').click();
  await vent.getByTestId('icu-invasive').click();
  await vent.getByTestId('patient-confirm').click();
  await expect(regia.getByTestId('vent-list')).toContainText('Ventilatore');
  await pazienteCheRespira(regia, '18', '0.6');
  await regia.getByTestId('tab-diaphragm').click();
  await regia.getByTestId('cath-profondo').click();

  const card = vent.getByTestId('tour-card');
  const fatto = vent.getByTestId('tour-try');
  // the step id, not the title: the card writes titles in capitals
  const passo = () => vent.locator('.ovs-tour').getAttribute('data-step', { timeout: 5000 });
  const finoA = async (id: string) => {
    for (let i = 0; i < 60; i++) {
      const ora = await passo();
      if (process.env.OVS_TOUR_DEBUG) console.log('tour:', id, '←', ora, await vent.getByTestId('tour-progress').innerText());
      if (ora === id) return;
      await vent.getByTestId('tour-next').click({ timeout: 5000 });
      await expect.poll(passo).not.toBe(ora);
    }
    expect(await passo()).toBe(id);
  };

  await finoA('neuro');
  await vent.locator('[data-fam="maniglia-modalita"]').click();
  await vent.locator('[data-fam="modalita-NEURO"]').click();
  await expect(fatto).toHaveClass(/is-done/);
  await vent.locator(CLOSE).click({ timeout: 2000 }).catch(() => {});

  await finoA('neuro-catheter');
  await vent.getByTestId('vista-catetere').click();
  await expect(fatto).toHaveClass(/is-done/);

  await finoA('neuro-depth');
  await vent.getByTestId('cat-inserisci').click();
  await expect(fatto).toHaveClass(/is-done/);

  await finoA('neuro-leads');
  await expect(fatto).toHaveClass(/is-done/);
  await expect(regia.getByTestId('cath-giusto')).toHaveClass(/bg-sky-700/);

  await finoA('neuro-occlusion');
  await vent.locator('[data-fam="maniglia-ventilazione"]').click();
  await vent.getByRole('button', { name: /AVVIA LA VENTILAZIONE/i }).click();
  await vent.locator(CLOSE).click({ timeout: 2000 }).catch(() => {});
  await vent.waitForTimeout(4000);
  await vent.getByTestId('cat-occlusione').click();
  await expect(fatto).toHaveClass(/is-done/);
  await vent.waitForTimeout(3500);
  if (SHOTS) await vent.screenshot({ path: `${SHOTS}/tour-occlusione.png` });

  await finoA('neuro-level');
  await finoA('neuro-state');
  expect(errors).toEqual([]);
});
