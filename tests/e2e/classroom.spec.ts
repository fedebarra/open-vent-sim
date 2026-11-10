import { test, expect } from '@playwright/test';
import { launchServer, startIcuVentilation, expectNum, num } from './helpers';
import { readFileSync } from 'fs';

const VERSION = JSON.parse(readFileSync('package.json', 'utf8')).version;

let srv: any;
test.beforeAll(async () => { srv = await launchServer('1234'); });
test.afterAll(async () => { await srv.close(); });

test('director drives a learner ventilator end to end, and records the session', async ({ browser }) => {
  const regiaCtx = await browser.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 900 } });
  const ventCtx = await browser.newContext({ locale: 'it-IT', viewport: { width: 1366, height: 860 } });
  const regia = await regiaCtx.newPage();
  const vent = await ventCtx.newPage();
  const errors: string[] = [];
  for (const pg of [regia, vent]) pg.on('pageerror', (e) => errors.push(e.message));

  // director console
  await regia.goto(srv.regiaUrl('127.0.0.1'));
  await expect(regia.getByTestId('regia-pin')).toHaveText('1234');
  await expect(regia.getByTestId('vent-qr')).toBeVisible();

  // learner: plain address → PIN screen, wrong PIN first
  await vent.goto(`http://127.0.0.1:${srv.port}/`);
  await expect(vent.getByTestId('join-title')).toBeVisible();
  await vent.getByTestId('pin-input').fill('0000');
  await expect(vent.getByTestId('join-wrong')).toBeVisible();
  await vent.getByTestId('pin-input').fill('1234');
  await expect(vent.getByTestId('mode-icu')).toBeVisible();
  await expect(vent.getByTestId('remote-badge')).toContainText('Collegato alla regia');
  await expect(regia.getByTestId('vent-list')).toContainText('Ventilatore');

  // start recording before the learner begins
  await regia.getByTestId('rec-start').click();
  await expect(vent.getByTestId('rec-badge')).toBeVisible();

  // a learner linked to the console only enters weight and age: the lung is the instructor's call
  await vent.getByTestId('mode-icu').click();
  await vent.getByTestId('icu-invasive').click();
  await expect(vent.getByTestId('patient-from-director')).toBeVisible();
  await expect(vent.getByTestId('patient-preset-ards')).toHaveCount(0);
  await expect(vent.getByTestId('opt-didattica')).toHaveCount(0);
  await vent.getByTestId('patient-confirm').click();
  await vent.locator('[data-fam="maniglia-ventilazione"]').click();
  await vent.getByRole('button', { name: /AVVIA LA VENTILAZIONE/i }).click();
  await expect(regia.getByTestId('vent-list')).toContainText('ventila');
  await expectNum(regia, 'PEEP', (n) => n === 5);
  await expect(regia.getByTestId('regia-log')).toContainText(/Ventilatore|Ventilator/);

  // teaching traces are hidden on the ventilator until the director enables them
  await expect(vent.getByTestId('vista-palv')).toHaveCount(0);
  await regia.getByTestId('tab-machine').click();
  await regia.getByTestId('opt-didattica').check();
  await expect(vent.getByTestId('vista-palv')).toBeVisible();

  // machine command: PEEP 10
  await regia.getByTestId('tab-machine').click();
  await regia.getByTestId('param-peep').fill('10');
  await regia.getByTestId('param-send-peep').click();
  await expectNum(regia, 'PEEP', (n) => n === 10, 'PEEP set remotely');

  // 3.3: alarm limits from the console — one step up, then back to the start-up preset
  await regia.getByTestId('tab-alarms').click();
  await expect(regia.getByTestId('alarm-pPeak')).toContainText('10');
  await regia.getByTestId('alarm-pPeak-basso-plus').click();
  await expect(regia.getByTestId('alarm-pPeak')).toContainText('11', { timeout: 10_000 });
  await regia.getByTestId('alarms-reset').click();
  await expect(regia.getByTestId('alarm-pPeak')).not.toContainText('11', { timeout: 10_000 });
  await expect(regia.getByTestId('regia-log')).toContainText(/Limiti d’allarme riportati/);

  // patient preset ARDS
  await regia.getByTestId('tab-patient').click();
  await regia.getByTestId('preset-ards').click();
  await expectNum(regia, 'C', (n) => n > 0 && n < 45, 'ARDS compliance');

  // asynchrony preset (name never shown to learners)
  await regia.getByTestId('tab-async').click();
  await regia.getByTestId('async-preset-fame-d-aria').click();
  await expect(regia.getByTestId('async-current')).toContainText('Fame di flusso');
  await expect(vent.locator('body')).not.toContainText('Fame di flusso');

  // gradual change: SpO2 to 85 over 30 s
  await regia.getByTestId('tab-patient').click();
  await regia.getByTestId('sl-spo2').fill('85');
  await regia.getByTestId('ramp-select').selectOption('30');
  await regia.getByTestId('patient-apply').click();
  await expectNum(regia, 'SpO₂', (n) => n < 96, 'SpO2 falls during the ramp');

  // 3.2: mechanics pictures — on, recognised from the snapshot, off again
  await regia.getByTestId('tab-mechanics').click();
  await regia.getByTestId('quadro-obesita').click();
  await expect(regia.getByTestId('quadro-obesita')).toHaveClass(/bg-sky-900/, { timeout: 10_000 });
  await regia.getByTestId('quadro-obesita').click();
  await expect(regia.getByTestId('quadro-obesita')).not.toHaveClass(/bg-sky-900/, { timeout: 10_000 });

  // recruitment manoeuvre from the lung tab
  await regia.getByTestId('tab-lung').click();
  await regia.getByTestId('recruit-start').click();
  await expect(regia.getByTestId('recruit-start')).toContainText(/Reclutamento in corso/);

  // Wi-Fi blip: every connection drops; both sides recover on their own
  srv.dropConnections();
  await expect(vent.getByTestId('remote-badge')).toContainText('Collegato alla regia', { timeout: 30_000 });
  await expect(regia.getByTestId('vent-list').locator('li')).toHaveCount(1);
  await expect(regia.getByTestId('vent-list')).toContainText('ventila', { timeout: 30_000 });

  // director reload: state and log are back
  await regia.reload();
  await expectNum(regia, 'PEEP', (n) => n === 10, 'state after director reload');

  // second learner on a tablet; broadcast reaches both
  const tabletCtx = await browser.newContext({ locale: 'it-IT', viewport: { width: 1180, height: 820 }, hasTouch: true });
  const tablet = await tabletCtx.newPage();
  tablet.on('pageerror', (e) => errors.push(e.message));
  await tablet.goto(`http://127.0.0.1:${srv.port}/?role=vent&pin=1234`);
  // 3.3: it first shows the machine already on; the group detaches to get one of its own
  await expect(tablet.getByTestId('device-mirror')).toBeVisible({ timeout: 15_000 });
  await tablet.locator('[data-tour="esci"]').click();
  await tablet.getByTestId('mirror-detach').click();
  await expect(regia.getByTestId('vent-list').locator('li')).toHaveCount(2);
  await startIcuVentilation(tablet);
  await regia.getByTestId('send-to').selectOption('all');
  await regia.getByTestId('tab-events').click();
  await regia.getByTestId('event-fire-normal').click();
  await regia.getByTestId('send-to').selectOption('one');
  await expectNum(regia, 'C', (n) => n >= 45, 'normal lung after broadcast');

  // stop recording → session log opens, with sheet, trends and actions
  // recording survived the director reload above
  await expect(regia.getByTestId('rec-stop')).toBeVisible();
  await regia.getByTestId('tab-machine').click();
  await regia.getByTestId('param-peep').fill('8');
  await regia.getByTestId('param-send-peep').click();
  await regia.getByTestId('param-peep').fill('9');
  await regia.getByTestId('param-send-peep').click();
  await vent.waitForTimeout(6000);
  await regia.getByTestId('rec-stop').click();
  await expect(regia.getByTestId('registro')).toBeVisible();
  await expect(regia.getByTestId('registro-table')).toContainText(/PEEP/);
  await regia.getByTestId('registro-close').click();

  expect(errors).toEqual([]);
  await Promise.all([regiaCtx.close(), ventCtx.close(), tabletCtx.close()]);
});

test('stand-alone use: no badge, device runs', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${srv.port}/`);
  await page.getByText('Usa senza regia').click();
  await expect(page.getByTestId('mode-icu')).toBeVisible();
  await expect(page.getByTestId('remote-badge')).toHaveCount(0);
  // the footer shows the real version, and no start-screen button is a dead end
  await expect(page.locator('footer')).toContainText(`Open Vent Sim v${VERSION}`);
  await expect(page.getByRole('button', { name: /Registra Sessione|Record Session/ })).toHaveCount(0);
  await page.getByTestId('mode-icu').click();
  await page.getByTestId('icu-invasive').click();
  await expect(page.getByTestId('exercise-settings')).toBeVisible();
  await expect(page.getByTestId('opt-didattica')).not.toBeChecked();
  await page.getByTestId('opt-didattica').check();
  await page.getByTestId('patient-confirm').click();
  await page.locator('[data-fam="maniglia-ventilazione"]').click();
  await page.getByRole('button', { name: /AVVIA LA VENTILAZIONE/i }).click();
  await expect(page.locator('.simvent').first()).toBeVisible();
  // 3.1: Palv/Pmus lanes, loops with reference, PRVC available
  await page.getByTestId('vista-palv').click();
  await expect(page.getByTestId('vista-palv')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('vista-loop').click();
  await expect(page.getByTestId('loop')).toBeVisible();
  await page.getByTestId('loop-riferimento').click();
  await expect(page.getByText(/In grigio: il riferimento/)).toBeVisible();
  // 3.2: EIT view and the PEEP trial
  await page.getByTestId('vista-eit').click();
  await expect(page.getByTestId('eit')).toBeVisible();
  await expect(page.getByTestId('eit-centro')).not.toHaveText('––');
  await page.getByTestId('eit-prova').click();
  await expect(page.getByTestId('eit-incrocio')).toHaveText(/\d/);
});

test('instructor console with a wrong key says so', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${srv.port}/?role=regia&key=wrong`);
  await expect(page.getByText(/Chiave regia non valida/)).toBeVisible();
});

test('NIV: the console sets a real mask leak, and the ventilator shows it', async ({ browser }) => {
  const regiaCtx = await browser.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 900 } });
  const ventCtx = await browser.newContext({ locale: 'it-IT', viewport: { width: 1366, height: 860 } });
  const regia = await regiaCtx.newPage();
  const vent = await ventCtx.newPage();
  const errors: string[] = [];
  for (const pg of [regia, vent]) pg.on('pageerror', (e) => errors.push(e.message));
  await regia.goto(srv.regiaUrl('127.0.0.1'));
  await vent.goto(`http://127.0.0.1:${srv.port}/?role=vent&pin=1234`);
  await vent.getByTestId('mode-icu').click();
  await vent.getByTestId('icu-niv').click();
  await vent.getByTestId('patient-confirm').click();
  await vent.locator('[data-fam="maniglia-ventilazione"]').click();
  await vent.getByRole('button', { name: /AVVIA LA VENTILAZIONE/i }).click();
  await expect(regia.getByTestId('vent-list')).toContainText('ventila');
  // earlier tests may have left ventilators in the list: pick the NIV one
  await regia.getByTestId('vent-list').locator('li', { hasText: /Non Invasiva/ }).last().click();
  // a breathing patient, then a big leak from the mechanics tab
  await regia.getByTestId('tab-patient').click();
  await regia.getByTestId('sl-spont').fill('18');
  await regia.getByTestId('patient-apply').click();
  await regia.getByTestId('tab-mechanics').click();
  await regia.getByTestId('sl-mask-leak').fill('100');
  await expect(regia.getByTestId('opt-mask-leak')).toBeChecked();
  await regia.getByTestId('mech-apply').click();
  // the ventilator reads a real leak: well above the usual few percent
  await expect.poll(async () => {
    const txt = await vent.locator('.simvent__monitoraggio').innerText();
    const m = txt.match(/Perdita\s*\n?\s*(\d+)/);
    return m ? Number(m[1]) : 0;
  }, { timeout: 30_000 }).toBeGreaterThan(60);
  // the event library has the ready-made "mask displaced / refitted"
  await regia.getByTestId('tab-events').click();
  await regia.getByTestId('event-fire-maskseal').click();
  await expect.poll(async () => {
    const txt = await vent.locator('.simvent__monitoraggio').innerText();
    const m = txt.match(/Perdita\s*\n?\s*(\d+)/);
    return m ? Number(m[1]) : 999;
  }, { timeout: 30_000 }).toBeLessThan(25);
  // the console's own guided tour: opens, a tab step ticks when the tab is opened, Esc closes it
  await regia.getByTestId('regia-tour').click();
  await expect(regia.getByTestId('tour-card')).toContainText('La regia');
  for (let i = 0; i < 6; i++) await regia.keyboard.press('ArrowRight');
  await expect(regia.getByTestId('tour-card')).toContainText('Il paziente');
  await regia.getByTestId('tab-patient').click();
  await regia.keyboard.press('Escape');
  await expect(regia.getByTestId('tour-card')).toHaveCount(0);
  // the console opens a ventilator on a second screen; it joins the session by itself and,
  // since a machine is already on, shows that same machine (3.3) instead of asking again
  const [second] = await Promise.all([regia.waitForEvent('popup'), regia.getByTestId('second-screen').click()]);
  second.on('pageerror', (e) => errors.push(e.message));
  await expect(second.getByTestId('device-mirror')).toBeVisible({ timeout: 15_000 });
  await expect(second.getByTestId('remote-badge')).toContainText('Specchio di');
  await expect(regia.locator('[data-testid^="mirrors-"]')).toContainText('+1');
  // a tap on the mirror drives the machine: standby from the projector, the learner's screen follows
  await second.locator('[data-fam="maniglia-ventilazione"]').click();
  await second.getByRole('button', { name: /METTI IN STANDBY/i }).click();
  await expect(regia.getByTestId('vent-list')).toContainText('standby', { timeout: 10_000 });
  await expect(vent.locator('.simvent__pillola--ferma')).toBeVisible();
  // detaching from the mirror gives a ventilator of its own
  await second.locator('[data-tour="esci"]').click();
  await second.getByTestId('mirror-detach').click();
  await expect(second.getByTestId('mode-icu')).toBeVisible();
  expect(errors).toEqual([]);
  await Promise.all([regiaCtx.close(), ventCtx.close()]);
});
