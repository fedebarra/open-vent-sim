import { test, expect, type Page } from '@playwright/test';
import { launchServer, startIcuVentilation } from './helpers';

let srv: any;
test.beforeEach(async () => { srv = await launchServer('1234'); });
test.afterEach(async () => { await srv.close(); });
const SHOTS = process.env.OVS_SHOTS;

for (const [nome, viewport] of [['tablet', { width: 1180, height: 820 }], ['phone', { width: 430, height: 932 }]] as const) {
  test(`a setting changes only when confirmed (${nome})`, async ({ browser }) => {
    const regia = await (await browser.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 900 } })).newPage();
    const vent: Page = await (await browser.newContext({ locale: 'it-IT', viewport, hasTouch: true })).newPage();
    const errors: string[] = [];
    for (const pg of [regia, vent]) pg.on('pageerror', (e) => errors.push(e.message));
    await regia.goto(srv.regiaUrl('127.0.0.1'));
    // the machine's own PEEP, as it leaves the device: not what the screen shows
    await vent.addInitScript(() => {
      const send = WebSocket.prototype.send;
      WebSocket.prototype.send = function (d: any) {
        const m = /"impostazioni":(\{[^}]*\})/.exec(String(d));
        if (m) (window as any).__imp = JSON.parse(m[1]);
        return send.call(this, d);
      };
    });
    await vent.goto(`http://127.0.0.1:${srv.port}/?role=vent&pin=1234`);
    await startIcuVentilation(vent);
    const imp = (k: string) => vent.evaluate((x) => (window as any).__imp?.[x], k);
    const tile = vent.locator('[data-fam="manopola-peep"]');
    const corpo = tile.locator('.simvent__manopola-corpo');
    const nastro = vent.locator('[data-fam="nastro-peep"]');
    await expect.poll(() => imp('peep')).toBe(5);

    // nothing moves when the tape opens
    const dove = async () => JSON.stringify(await vent.locator('.simvent__manopola').evaluateAll((e) => e.map((x) => x.getBoundingClientRect().toJSON())));
    await corpo.scrollIntoViewIfNeeded();
    const prima = await dove();
    await corpo.click();
    await expect(nastro).toBeVisible();
    expect(await dove()).toBe(prima);
    const b = (await nastro.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(viewport.width);

    // drag: pending, the machine unchanged
    const p = (await nastro.locator('.simvent__nastro-pista').boundingBox())!;
    const cdp = await vent.context().newCDPSession(vent);
    const x = p.x + p.width / 2 + 25, y = p.y + 20;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - i * 7.5, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(nastro.locator('[data-fam="nastro-valore"]')).toHaveText('8');
    await expect(tile).toHaveClass(/--attesa/);
    if (SHOTS) await vent.screenshot({ path: `${SHOTS}/nastro-${nome}.png` });
    await vent.waitForTimeout(1200);
    expect(await imp('peep')).toBe(5);

    // Esc, outside and time all cancel
    await vent.keyboard.press('Escape');
    await expect(nastro).toHaveCount(0);
    await corpo.click();
    await nastro.getByRole('button', { name: '+' }).click();
    await vent.locator('.simvent__testata').click({ position: { x: 200, y: 10 } });
    await expect(nastro).toHaveCount(0);
    await corpo.click();
    await nastro.getByRole('button', { name: '+' }).click();
    await expect(nastro).toHaveCount(0, { timeout: 8000 });
    await expect(corpo).toContainText('5');
    await vent.waitForTimeout(700);
    expect(await imp('peep')).toBe(5);

    // the tick, the second tap and Enter confirm
    await corpo.click();
    await nastro.getByRole('button', { name: '+' }).click();
    await nastro.locator('.simvent__passi-conferma').click();
    await expect.poll(() => imp('peep')).toBe(6);
    await corpo.click();
    await nastro.getByRole('button', { name: '+' }).click();
    await corpo.click();
    await expect.poll(() => imp('peep')).toBe(7);
    await corpo.click();
    await vent.keyboard.press('ArrowRight');
    await vent.keyboard.press('Enter');
    await expect.poll(() => imp('peep')).toBe(8);
    await expect(nastro).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
