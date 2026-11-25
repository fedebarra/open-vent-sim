/**
 * Updates, straight from the GitHub releases of the repository: checked at every
 * start, again every few hours, and soon after when there was no network.
 *
 *  - Windows installer (NSIS): electron-updater downloads the new version in the
 *    background; the page offers to restart, otherwise it installs on quit.
 *  - macOS and the Windows portable .exe: the app is not signed (macOS) or cannot
 *    replace itself (portable), so the page offers the right download.
 *
 * Nothing pops up over a lesson: the first screen and the console show it
 * (remote/Updates.tsx). Only a check asked from the menu answers with a dialog.
 */
import { app, BrowserWindow, dialog, ipcMain, powerMonitor, shell } from 'electron';
import updater from 'electron-updater';
import { isReleaseUrl } from './update-pick.mjs';
import { createUpdates } from './update-state.mjs';

const LATEST = 'https://api.github.com/repos/fedebarra/open-vent-sim/releases/latest';

async function fetchRelease() {
  const r = await fetch(LATEST, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'open-vent-sim-updater' },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return r.json();
}

let updates = null;

function act() {
  const { phase } = updates.state();
  // Silent, and opened again at the end: no setup wizard to click through.
  if (phase === 'ready') setImmediate(() => updater.autoUpdater.quitAndInstall(true, true));
  else if (phase === 'available' && isReleaseUrl(updates.url())) shell.openExternal(updates.url());
}

/** @param fromLocal tells whether an IPC event comes from a page of this app */
export function setupUpdates(fromLocal) {
  ipcMain.handle('ovs:update-state', (e) => (fromLocal(e) && updates ? updates.state() : null));
  ipcMain.handle('ovs:update-check', (e) => (fromLocal(e) && updates ? updates.check() : null));
  ipcMain.handle('ovs:update-act', (e) => { if (fromLocal(e) && updates) act(); });

  if (!app.isPackaged || process.env.OVS_NO_UPDATE_CHECK) return;
  const installer = process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_DIR;
  updates = createUpdates({
    current: app.getVersion(),
    fetchRelease,
    installer: installer ? updater.autoUpdater : null,
    onChange: () => {
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send('ovs:update-changed');
    },
  });
  // A laptop opened again in another place: the network needs a moment.
  powerMonitor.on('resume', () => setTimeout(() => updates.check(), 15000));
  updates.check();
}

/** From the Mac menu: a check asked by the user always gets an answer. */
export async function checkFromMenu(win) {
  const it = app.getLocale().toLowerCase().startsWith('it');
  const show = (message, buttons = ['OK']) => {
    const opts = { type: 'info', message, buttons, defaultId: 0, cancelId: buttons.length - 1 };
    return win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts);
  };
  const s = updates ? await updates.check() : null;
  if (s?.phase === 'available' || s?.phase === 'ready') {
    const ready = s.phase === 'ready';
    const { response } = await show(
      it ? `È disponibile Open Vent Sim ${s.version} (hai la ${s.current}).` : `Open Vent Sim ${s.version} is available (you have ${s.current}).`,
      [ready ? (it ? 'Riavvia ora' : 'Restart now') : (it ? 'Scarica' : 'Download'), it ? 'Più tardi' : 'Later']);
    if (response === 0) act();
  } else if (s?.phase === 'none') {
    await show(it ? `Sei aggiornato: Open Vent Sim ${s.current} è l’ultima versione.` : `You are up to date: Open Vent Sim ${s.current} is the latest version.`);
  } else {
    await show(it ? 'Non riesco a controllare: GitHub non risponde. Verifica la connessione a internet.' : 'Could not check: GitHub does not answer. Check the internet connection.');
  }
}
