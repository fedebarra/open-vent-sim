import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DeviceApp } from './device/DeviceApp';
import './index.css';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { launchInfo } from './remote/link';
import { LinkedDevice } from './remote/VentRemote';
import { RegiaApp } from './remote/RegiaApp';
import { JoinScreen, DesktopLauncher } from './remote/Launcher';

/**
 * Decides what this window is:
 *   ?role=regia&key=…  → director console
 *   ?role=vent&pin=…   → ventilator linked to the director
 *   served by the classroom server without role → PIN screen
 *   desktop app start  → choose Instructor / Ventilator / On my own
 *   anything else      → stand-alone simulator (as before)
 */
const Root: React.FC = () => {
  const info = launchInfo();
  const desktop = (window as any).ovsDesktop;
  const [mode, setMode] = useState<'decide' | 'join' | 'launcher' | 'solo' | 'vent'>(() => {
    if (info.role === 'regia' && info.key) return 'decide';
    if (info.role === 'vent' && info.pin) return 'vent';
    if (desktop?.isLauncher) return 'launcher';
    return 'decide';
  });
  const [pin, setPin] = useState(info.pin || '');
  // Where «On my own» was chosen from: that is where «Change mode» goes back to.
  const [soloDa, setSoloDa] = useState<'launcher' | 'join' | null>(null);

  useEffect(() => {
    if (mode !== 'decide' || info.role === 'regia') return;
    if (!info.served) { setMode('solo'); return; }
    // Is this page served by the Open Vent Sim classroom server?
    fetch('./api/info', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMode(j && j.app === 'open-vent-sim' ? 'join' : 'solo'))
      .catch(() => setMode('solo'));
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (info.role === 'regia' && info.key) return <RegiaApp wsUrl={info.wsUrl} regiaKey={info.key} />;
  if (mode === 'launcher') return <DesktopLauncher onSolo={() => { setSoloDa('launcher'); setMode('solo'); }} />;
  if (mode === 'join') return (
    <JoinScreen wsUrl={info.wsUrl} host={window.location.host}
      onJoined={(p) => { history.replaceState(null, '', `?role=vent&pin=${p}`); setPin(p); setMode('vent'); }}
      onSolo={() => { setSoloDa('join'); setMode('solo'); }} />
  );
  if (mode === 'vent') return <LinkedDevice wsUrl={info.wsUrl} pin={pin} />;
  if (mode === 'solo') return new URLSearchParams(window.location.search).has('legacy') ? <App /> : <DeviceApp onCambiaModalita={soloDa ? () => setMode(soloDa) : undefined} />;
  return <div style={{ minHeight: '100vh', background: '#0f172a' }} />;
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element to mount to');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <Root />
    </LanguageProvider>
  </React.StrictMode>
);
