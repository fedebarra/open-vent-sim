/**
 * The update check without Electron: what is known, when to look again.
 * Used by electron/updates.mjs and tested with a fake GitHub and a fake installer.
 *
 * phase: idle | checking | none | available (to download by hand) | downloading | ready (restart to install) | error
 */
import { isNewer, pickDownload, releaseNotes } from './update-pick.mjs';

export const CHECK_EVERY = 4 * 60 * 60 * 1000; // all well: look again every four hours
export const RETRY_AFTER = 5 * 60 * 1000;      // no network: try again soon

/**
 * @param current installed version
 * @param fetchRelease () => the latest GitHub release, throws when unreachable
 * @param installer electron-updater's autoUpdater, or null where the download is by hand
 */
export function createUpdates({ current, fetchRelease, installer = null, onChange = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let state = { current, phase: 'idle', version: '', notes: { it: [], en: [] }, auto: !!installer };
  let url = '';
  let timer = null;
  let running = null;

  const set = (patch) => { state = { ...state, ...patch }; onChange(state); };
  /** Once a version has been found, a later failure must not hide it. */
  const found = () => state.phase === 'available' || state.phase === 'ready';

  if (installer) {
    installer.autoDownload = true;
    installer.autoInstallOnAppQuit = true;
    installer.on('error', () => {
      if (state.phase === 'ready') return;
      set({ phase: 'error' });
      plan(RETRY_AFTER);
    });
    installer.on('update-downloaded', (info) => set({ phase: 'ready', version: info?.version || state.version }));
  }

  function plan(ms) {
    if (timer) clearTimer(timer);
    timer = setTimer(() => { timer = null; void check(); }, ms);
    timer?.unref?.();
  }

  async function look() {
    if (installer) {
      const r = await installer.checkForUpdates();
      const v = r?.updateInfo?.version;
      if (!v || !isNewer(v, current)) { set({ phase: 'none' }); return; }
      if (state.phase !== 'ready') set({ phase: 'downloading', version: v });
      // The news are a courtesy: without them the update goes on.
      try {
        const rel = await fetchRelease();
        if (String(rel?.tag_name).replace(/^v/, '') === v) set({ notes: releaseNotes(rel.body) });
      } catch { /* no notes */ }
      return;
    }
    const rel = await fetchRelease();
    const v = String(rel?.tag_name || '').replace(/^v/, '');
    if (!v) throw new Error('no release');
    if (!isNewer(v, current)) { set({ phase: 'none' }); return; }
    url = pickDownload(rel);
    set({ phase: 'available', version: v, notes: releaseNotes(rel.body) });
  }

  /** Looks now; never throws. Two checks never run together. */
  function check() {
    if (running) return running;
    if (state.phase === 'ready' || state.phase === 'downloading') return Promise.resolve(state);
    if (!found()) set({ phase: 'checking' });
    running = look()
      .then(() => plan(state.phase === 'error' ? RETRY_AFTER : CHECK_EVERY), () => {
        if (!found()) set({ phase: 'error' });
        plan(RETRY_AFTER);
      })
      .then(() => { running = null; return state; });
    return running;
  }

  return { check, state: () => state, url: () => url };
}
