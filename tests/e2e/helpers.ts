import { expect, type Page } from '@playwright/test';
// @ts-ignore – plain JS module
import { startServer } from '../../server/ovs-server.mjs';

export async function launchServer(pin = '1234') {
  return startServer({ port: 0, host: '127.0.0.1', beacon: false, pin });
}

/** Learner path: ICU ventilator → invasive → confirm patient → standby drawer → start ventilation. */
export async function startIcuVentilation(p: Page) {
  await p.getByTestId('mode-icu').click();
  await p.getByTestId('icu-invasive').click();
  await p.getByTestId('patient-confirm').click();
  await p.getByRole('button', { name: 'STANDBY' }).click();
  await p.getByRole('button', { name: /AVVIA LA VENTILAZIONE/i }).click();
}

export async function num(regia: Page, key: string): Promise<number> {
  return Number(await regia.getByTestId(`num-${key}`).innerText());
}

export async function expectNum(regia: Page, key: string, pred: (n: number) => boolean, msg?: string) {
  await expect.poll(async () => pred(await num(regia, key)), { message: msg ?? key, timeout: 20_000 }).toBe(true);
}
