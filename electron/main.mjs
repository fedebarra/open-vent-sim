/**
 * Open Vent Sim desktop app (Windows / macOS).
 *
 * The window always loads the web app from a small server inside the app:
 *  - at start a private one on 127.0.0.1 (nothing reachable from outside)
 *    showing the launcher: Instructor / Ventilator / On my own;
 *  - "Instructor" starts the classroom server on the LAN (port 8787) and opens
 *    the director console; the learners connect to it.
 *  - "Ventilator" listens for instructor beacons on the LAN and navigates the
 *    window to the chosen instructor's server.
 */
import { app, BrowserWindow, ipcMain, shell, dialog, Menu } from 'electron';
import path from 'node:path';
import dgram from 'node:dgram';
import { fileURLToPath } from 'node:url';
import { startServer, BEACON_PORT, DEFAULT_PORT } from '../server/ovs-server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(here, '..', 'dist');

let win = null;
let localServer = null;   // 127.0.0.1, launcher + solo
let lanServer = null;     // 0.0.0.0, classroom
let listener = null;      // UDP beacon listener

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

async function createWindow() {
  localServer = await startServer({ port: 0, host: '127.0.0.1', beacon: false, distDir });
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 680,
    backgroundColor: '#0f172a',
    title: 'Open Vent Sim',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(here, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  // External links (manual, donations) open in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  await win.loadURL(`http://127.0.0.1:${localServer.port}/?desktop=1`);
}

// ------------------------------------------------------------------ IPC --
/** Only pages served by this app's own servers may drive it. */
function fromLocal(event) {
  try { const u = new URL(event.senderFrame.url); return u.hostname === '127.0.0.1' || u.hostname === 'localhost'; } catch { return false; }
}

ipcMain.handle('ovs:start-regia', async (event) => {
  if (!fromLocal(event)) throw new Error('not allowed');
  if (!lanServer) {
    lanServer = await startServer({ port: DEFAULT_PORT, host: '0.0.0.0', distDir });
  }
  return lanServer.regiaUrl('127.0.0.1');
});

ipcMain.handle('ovs:server-info', (event) => !fromLocal(event) ? null : lanServer ? {
  port: lanServer.port, pin: lanServer.pin, addresses: lanServer.addresses.map((a) => a.address), name: lanServer.sessionName,
} : null);

ipcMain.handle('ovs:start-discovery', (event) => {
  stopDiscovery();
  const sender = event.sender;
  listener = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  listener.on('message', (buf, rinfo) => {
    try {
      const m = JSON.parse(String(buf));
      if (m && m.ovs && m.port) sender.send('ovs:discovered', { name: String(m.name || 'Open Vent Sim'), host: rinfo.address, port: Number(m.port), seen: Date.now() });
    } catch { /* not ours */ }
  });
  listener.on('error', () => stopDiscovery());
  listener.bind(BEACON_PORT);
  return true;
});

function stopDiscovery() { if (listener) { try { listener.close(); } catch { /* ignore */ } listener = null; } }
ipcMain.handle('ovs:stop-discovery', () => { stopDiscovery(); return true; });

ipcMain.handle('ovs:home', async () => {
  if (win && localServer) await win.loadURL(`http://127.0.0.1:${localServer.port}/?desktop=1`);
  return true;
});

// ------------------------------------------------------------- lifecycle --
app.whenReady().then(async () => {
  Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([
    { role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
  ]) : null);
  try { await createWindow(); }
  catch (e) { dialog.showErrorBox('Open Vent Sim', String(e?.stack || e)); app.quit(); }
});

app.on('window-all-closed', async () => {
  stopDiscovery();
  await Promise.allSettled([lanServer?.close(), localServer?.close()]);
  app.quit();
});
