/**
 * Updates, straight from the GitHub releases of the repository, checked at every start.
 *
 *  - Windows installer (NSIS): electron-updater downloads the new version in the
 *    background and offers to restart; otherwise it installs itself on quit.
 *  - macOS and the Windows portable .exe: the app is not signed (macOS) or cannot
 *    replace itself (portable), so it only says that a new version exists and
 *    opens the right download (the DMG for this Mac's chip, the portable .exe).
 *
 * Offline, or with GitHub unreachable, nothing is shown: the check fails silently.
 */
import { app, dialog, shell } from 'electron';
import updater from 'electron-updater';
import { isNewer, pickDownload } from './update-pick.mjs';

const OWNER = 'fedebarra';
const REPO = 'open-vent-sim';

const it = () => app.getLocale().toLowerCase().startsWith('it');
const T = {
  readyTitle: () => (it() ? 'Aggiornamento pronto' : 'Update ready'),
  ready: (v) => (it() ? `Open Vent Sim ${v} è stato scaricato.` : `Open Vent Sim ${v} has been downloaded.`),
  readyDetail: () => (it() ? 'Riavvia per installarlo adesso, oppure verrà installato alla chiusura dell’app.' : 'Restart to install it now, or it will be installed when you quit the app.'),
  restart: () => (it() ? 'Riavvia ora' : 'Restart now'),
  later: () => (it() ? 'Più tardi' : 'Later'),
  newTitle: () => (it() ? 'Nuova versione disponibile' : 'New version available'),
  available: (v, cur) => (it() ? `È disponibile Open Vent Sim ${v} (hai la ${cur}).` : `Open Vent Sim ${v} is available (you have ${cur}).`),
  availableDetail: () => (it() ? 'Scaricala dal repository GitHub e installala sopra a questa: impostazioni e scenari salvati restano.' : 'Download it from the GitHub repository and install it over this one: saved settings and scenarios stay.'),
  download: () => (it() ? 'Scarica' : 'Download'),
};

async function notifyOnly(getWin) {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'open-vent-sim-updater' },
  });
  if (!r.ok) return;
  const release = await r.json();
  const latest = String(release.tag_name || '').replace(/^v/, '');
  if (!latest || !isNewer(latest, app.getVersion())) return;
  const win = getWin();
  const opts = {
    type: 'info', title: T.newTitle(), message: T.available(latest, app.getVersion()), detail: T.availableDetail(),
    buttons: [T.download(), T.later()], defaultId: 0, cancelId: 1,
  };
  const { response } = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts);
  if (response === 0) shell.openExternal(pickDownload(release));
}

function autoInstall(getWin) {
  const { autoUpdater } = updater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', () => { /* offline or no release: nothing to say */ });
  autoUpdater.on('update-downloaded', async (info) => {
    const win = getWin();
    const opts = {
      type: 'info', title: T.readyTitle(), message: T.ready(info?.version ?? ''), detail: T.readyDetail(),
      buttons: [T.restart(), T.later()], defaultId: 0, cancelId: 1,
    };
    const { response } = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts);
    if (response === 0) setImmediate(() => autoUpdater.quitAndInstall());
  });
  return autoUpdater.checkForUpdates();
}

export function checkForUpdates(getWin) {
  if (!app.isPackaged || process.env.OVS_NO_UPDATE_CHECK) return;
  const installer = process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_DIR;
  Promise.resolve()
    .then(() => (installer ? autoInstall(getWin) : notifyOnly(getWin)))
    .catch(() => { /* silent */ });
}
