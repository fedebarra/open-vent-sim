import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNewer, pickDownload } from '../electron/update-pick.mjs';

test('version comparison', () => {
  assert.equal(isNewer('3.3.0', '3.2.0'), true);
  assert.equal(isNewer('v3.10.0', '3.9.2'), true);
  assert.equal(isNewer('3.2.0', '3.2.0'), false);
  assert.equal(isNewer('3.1.9', '3.2.0'), false);
});

test('the right download for each computer', () => {
  const release = { html_url: 'https://example/rel', assets: [
    'OpenVentSim-3.3.0-mac-arm64.dmg', 'OpenVentSim-3.3.0-mac-x64.dmg', 'OpenVentSim-3.3.0-mac-arm64.zip',
    'OpenVentSim-3.3.0-win-x64.exe', 'OpenVentSim-3.3.0-portable.exe', 'latest.yml',
  ].map((name) => ({ name, browser_download_url: `https://dl/${name}` })) };
  assert.equal(pickDownload(release, 'darwin', 'arm64'), 'https://dl/OpenVentSim-3.3.0-mac-arm64.dmg');
  assert.equal(pickDownload(release, 'darwin', 'x64'), 'https://dl/OpenVentSim-3.3.0-mac-x64.dmg');
  assert.equal(pickDownload(release, 'win32', 'x64', true), 'https://dl/OpenVentSim-3.3.0-portable.exe');
  assert.equal(pickDownload(release, 'win32', 'x64', false), 'https://dl/OpenVentSim-3.3.0-win-x64.exe');
  assert.equal(pickDownload({ html_url: 'https://example/rel', assets: [] }, 'linux', 'x64'), 'https://example/rel');
});
