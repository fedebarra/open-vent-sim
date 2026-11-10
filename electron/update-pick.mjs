/** Pure helpers of the update check (electron/updates.mjs), kept apart so they can be tested without Electron. */

const RELEASES = 'https://github.com/fedebarra/open-vent-sim/releases/latest';

/** True if version a is newer than b ("3.10.0" > "3.9.2"). */
export function isNewer(a, b) {
  const pa = String(a).replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

/** The release asset this computer should download, or the release page. */
export function pickDownload(release, platform = process.platform, arch = process.arch, portable = !!process.env.PORTABLE_EXECUTABLE_DIR) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const find = (f) => assets.find((a) => f(String(a.name || '')))?.browser_download_url;
  let url;
  if (platform === 'darwin') url = find((n) => n.endsWith('.dmg') && n.includes(arch === 'arm64' ? 'arm64' : 'x64'));
  else if (platform === 'win32') url = portable ? find((n) => /portable\.exe$/i.test(n)) : find((n) => n.endsWith('.exe') && !/portable/i.test(n));
  return url || release?.html_url || RELEASES;
}
