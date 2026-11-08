// Bridge between the desktop app and the page. Exposed only on pages the app
// itself loads (its own local server, or an instructor's server on the LAN).
const { contextBridge, ipcRenderer } = require('electron');

const params = new URLSearchParams(location.search);

contextBridge.exposeInMainWorld('ovsDesktop', {
  isLauncher: params.get('desktop') === '1' && !params.get('role'),
  startRegia: () => ipcRenderer.invoke('ovs:start-regia'),
  serverInfo: () => ipcRenderer.invoke('ovs:server-info'),
  startDiscovery: () => ipcRenderer.invoke('ovs:start-discovery'),
  stopDiscovery: () => ipcRenderer.invoke('ovs:stop-discovery'),
  home: () => ipcRenderer.invoke('ovs:home'),
  openSecondScreen: () => ipcRenderer.invoke('ovs:open-second-screen'),
  onDiscovered: (fn) => {
    const h = (_e, found) => fn(found);
    ipcRenderer.on('ovs:discovered', h);
    return () => ipcRenderer.removeListener('ovs:discovered', h);
  },
});
