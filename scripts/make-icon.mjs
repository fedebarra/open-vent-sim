// Renders the app icon (1024×1024: build/icon.png for the installers, public/icon.png
// for the favicon and the web app) from the Open Vent Sim mark: two pressure-support
// breaths of the flow curve, white on flat teal (`BrandMark` in components/icons.tsx).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const PATH = fs.readFileSync('components/icons.tsx', 'utf8').match(/export const BRAND_MARK_PATH = '([^']+)'/)[1];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
<defs><clipPath id="c"><rect x="4" y="4" width="92" height="92" rx="22"/></clipPath></defs>
<g transform="translate(64 64) scale(${896 / 92}) translate(-4 -4)">
<rect x="4" y="4" width="92" height="92" rx="22" fill="#0d9488"/>
<g clip-path="url(#c)"><path d="${PATH}" fill="none" stroke="#fff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/></g>
</g></svg>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
for (const out of ['build/icon.png', 'public/icon.png']) {
  await p.locator('svg').screenshot({ path: out, omitBackground: true });
  console.log(out);
}
await b.close();
