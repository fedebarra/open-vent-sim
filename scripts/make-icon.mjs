// Renders build/icon.png (1024×1024) from an inline SVG with Playwright.
import { chromium } from '@playwright/test';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0ea5e9"/><stop offset="1" stop-color="#0369a1"/></linearGradient></defs>
<rect x="64" y="64" width="896" height="896" rx="200" fill="url(#g)"/>
<g transform="translate(212 196) scale(25)" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
<rect x="3" y="3" width="14" height="10" rx="1.5"/><path d="M5 10h2l1-4.5h3.2l.8 4.5H15"/><path d="M10 13v6.5"/><path d="M6.5 21.5L10 19.5l3.5 2"/>
<path d="M17 6.5c2.4 0 3.8 1.2 3.8 3.2v2.1c0 1.5-.9 2.4-2.3 2.4"/><path d="M17 9.5c1.1 0 1.6.5 1.6 1.4"/></g></svg>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
await p.locator('svg').screenshot({ path: 'build/icon.png', omitBackground: true });
await b.close();
console.log('build/icon.png');
