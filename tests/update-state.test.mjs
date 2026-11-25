import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createUpdates, CHECK_EVERY, RETRY_AFTER } from '../electron/update-state.mjs';
import { isReleaseUrl, releaseNotes } from '../electron/update-pick.mjs';

const body = "### What's new in 4\n- **Bold** and [link](http://x)\n\n---\n### Novità della 4\r\n- **Uno**: due\r\n\ntesto\n";
const rel = (v) => ({ tag_name: `v${v}`, body, html_url: 'https://github.com/fedebarra/open-vent-sim/releases/tag/x', assets: [] });
const timers = () => { const t = []; return { t, setTimer: (f, ms) => { t.push(ms); return {}; }, clearTimer: () => {} }; };

test('release notes in two languages, and only our own pages', () => {
  assert.deepEqual(releaseNotes(body), { en: ['Bold and link'], it: ['Uno: due'] });
  assert.deepEqual(releaseNotes(undefined), { en: [], it: [] });
  assert.equal(isReleaseUrl('https://github.com/fedebarra/open-vent-sim/releases/download/v1/a.dmg'), true);
  assert.equal(isReleaseUrl('https://github.com.evil/fedebarra/open-vent-sim/releases/'), false);
});

test('by hand: offline retries soon, then offers, and a later failure does not hide it', async () => {
  const k = timers(); let next = () => { throw new Error('offline'); };
  const u = createUpdates({ current: '3.9.1', fetchRelease: async () => next(), ...k });
  assert.equal((await u.check()).phase, 'error'); assert.equal(k.t.at(-1), RETRY_AFTER);
  next = () => rel('3.9.1');
  assert.equal((await u.check()).phase, 'none'); assert.equal(k.t.at(-1), CHECK_EVERY);
  next = () => rel('3.10.0');
  const s = await u.check();
  assert.equal(s.phase, 'available'); assert.equal(s.version, '3.10.0'); assert.ok(isReleaseUrl(u.url()));
  next = () => { throw new Error('offline'); };
  assert.equal((await u.check()).phase, 'available'); assert.equal(k.t.at(-1), RETRY_AFTER);
});

test('installer: downloads, a broken download retries, ready stays ready', async () => {
  const k = timers(); const inst = new EventEmitter(); let calls = 0;
  inst.checkForUpdates = async () => { calls++; return { updateInfo: { version: '4.0.0' } }; };
  const u = createUpdates({ current: '3.9.1', installer: inst, fetchRelease: async () => rel('4.0.0'), ...k });
  assert.equal((await u.check()).phase, 'downloading'); assert.deepEqual(u.state().notes.it, ['Uno: due']);
  inst.emit('error', new Error('net')); assert.equal(u.state().phase, 'error'); assert.equal(k.t.at(-1), RETRY_AFTER);
  await u.check(); inst.emit('update-downloaded', { version: '4.0.0' });
  assert.equal(u.state().phase, 'ready');
  inst.emit('error', new Error('x')); await u.check();
  assert.equal(u.state().phase, 'ready'); assert.equal(calls, 2);
});

test('two checks never run together', async () => {
  let n = 0; const u = createUpdates({ current: '1.0.0', fetchRelease: async () => { n++; return rel('1.0.0'); }, ...timers() });
  await Promise.all([u.check(), u.check()]); assert.equal(n, 1);
});
