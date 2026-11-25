import { test, expect, type Page } from '@playwright/test';
import { launchServer, startIcuVentilation } from './helpers';

let srv: any;
test.beforeEach(async () => { srv = await launchServer('1234'); });
test.afterEach(async () => { await srv.close(); });
const SHOTS = process.env.OVS_SHOTS;

/** A real finger: touch events through CDP, so touch-action and pointer capture count. */
async function dito(p: Page, fam: string, dx: number) {
  const b = (await p.locator(`[data-fam="${fam}"]`).boundingBox())!;
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / 8, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const soglia = (p: Page, k: string, e: string) => p.locator(`[data-fam="soglia-${k}-${e}"]`);

for (const [nome, viewport] of [['tablet', { width: 1180, height: 820 }], ['phone', { width: 430, height: 932 }]] as const) {
  test(`alarm limits by touch: drag, fine step, yellow then red, reset (${nome})`, async ({ browser }) => {
    const regia = await (await browser.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 900 } })).newPage();
    const vent = await (await browser.newContext({ locale: 'it-IT', viewport, hasTouch: true })).newPage();
    const errors: string[] = [];
    for (const pg of [regia, vent]) pg.on('pageerror', (e) => errors.push(e.message));
    await regia.goto(srv.regiaUrl('127.0.0.1'));
    await vent.goto(`http://127.0.0.1:${srv.port}/?role=vent&pin=1234`);
    await startIcuVentilation(vent);
    await vent.locator('[data-fam="maniglia-allarmi"]').click();
    const riga = vent.locator('[data-fam="limite-pPeak"]');
    await expect(riga).toBeVisible();
    await expect(riga).not.toHaveClass(/--(giallo|rosso)/);
    // the drawer slides in: a finger aimed at a moving tab misses it
    await vent.locator('.simvent__cassetto').evaluate((e) => Promise.all(e.getAnimations().map((x) => x.finished)));
    if (SHOTS) await vent.waitForTimeout(3000);
    if (SHOTS) await vent.screenshot({ path: `${SHOTS}/allarmi-${nome}.png` });

    // the high yellow comes down below the peak (about 16): a yellow warning
    const largo = (await vent.locator('[data-pista="pPeak"]').boundingBox())!.width;
    await soglia(vent, 'pPeak', 'preAlto').scrollIntoViewIfNeeded();
    await dito(vent, 'soglia-pPeak-preAlto', (-21 / 70) * largo);
    await expect(soglia(vent, 'pPeak', 'preAlto')).toHaveAttribute('aria-valuenow', /1[345]/);
    await expect(riga).toHaveClass(/--giallo/);
    await expect(vent.locator('.simvent__allarme')).toHaveClass(/--giallo/);

    // the fine step, and two quick taps are two steps
    const v = Number(await soglia(vent, 'pPeak', 'preAlto').getAttribute('aria-valuenow'));
    await vent.locator('[data-fam="limite-meno"]').dblclick();
    await expect(soglia(vent, 'pPeak', 'preAlto')).toHaveAttribute('aria-valuenow', String(v - 2));

    // the red goes below too and pushes nothing past it
    await dito(vent, 'soglia-pPeak-alto', (-26 / 70) * largo);
    await expect(riga).toHaveClass(/--rosso/);
    await expect(vent.locator('.simvent__allarme')).not.toHaveClass(/--giallo/);
    if (SHOTS) await vent.screenshot({ path: `${SHOTS}/allarmi-${nome}-rosso.png` });

    // the console sees the same red limit
    await regia.getByTestId('tab-alarms').click();
    await expect(regia.getByTestId('alarm-pPeak')).toContainText(String(await soglia(vent, 'pPeak', 'alto').getAttribute('aria-valuenow')));

    // one row back, then all
    await vent.locator('[data-fam="ripristina-pPeak"]').click();
    await expect(soglia(vent, 'pPeak', 'preAlto')).toHaveAttribute('aria-valuenow', '35');
    await expect(soglia(vent, 'pPeak', 'alto')).toHaveAttribute('aria-valuenow', '40');
    await expect(riga).not.toHaveClass(/--(giallo|rosso)/);
    await soglia(vent, 'measuredFrequency', 'alto').scrollIntoViewIfNeeded();
    await dito(vent, 'soglia-measuredFrequency-alto', 60);
    await expect(soglia(vent, 'measuredFrequency', 'alto')).not.toHaveAttribute('aria-valuenow', '35');
    await vent.locator('[data-fam="limiti-ripristina"]').click();
    await expect(soglia(vent, 'measuredFrequency', 'alto')).toHaveAttribute('aria-valuenow', '35');
    expect(errors).toEqual([]);
  });
}
