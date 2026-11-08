/**
 * First screens of the classroom features:
 *  - JoinScreen: a learner opened the server address without the QR → type the PIN.
 *  - DesktopLauncher: desktop app start → "Instructor", "Ventilator" or "On my own".
 */
import React, { useEffect, useRef, useState } from 'react';
import { createLink } from './link';
import { rt } from './strings';
import { useLanguage } from '../src/contexts/LanguageContext';
import { DirectorIcon, LearnerDeviceIcon, SoloIcon } from '../components/icons';

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="absolute top-3 right-3 flex gap-1">
        {(['it', 'en'] as const).map((l) => (
          <button key={l} onClick={() => setLanguage(l)} className={`px-2 py-1 rounded text-sm ${language === l ? 'bg-sky-700' : 'bg-slate-800'}`}>{l === 'it' ? '🇮🇹 IT' : '🇬🇧 EN'}</button>
        ))}
      </div>
      <div className="text-4xl font-bold mb-1">🫁 Open Vent Sim</div>
      {children}
    </div>
  );
};

/** Four big digit boxes – easy on a tablet. */
const PinInput: React.FC<{ value: string; onChange: (v: string) => void; onEnter: () => void }> = ({ value, onChange, onEnter }) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input ref={ref} data-testid="pin-input" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter(); }}
        className="absolute inset-0 opacity-0" aria-label="PIN" />
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`w-16 h-20 rounded-xl border-2 flex items-center justify-center text-4xl font-mono ${i === value.length ? 'border-sky-400' : 'border-slate-600'} bg-slate-900`}>{value[i] || ''}</div>
        ))}
      </div>
    </div>
  );
};

export const JoinScreen: React.FC<{ wsUrl: string; onJoined: (pin: string) => void; onSolo: () => void; host?: string }> = ({ wsUrl, onJoined, onSolo, host }) => {
  const { language } = useLanguage();
  const s = rt(language);
  const [pin, setPin] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'wrong' | 'offline'>('idle');

  const tryJoin = () => {
    if (pin.length !== 4 || state === 'checking') return;
    setState('checking');
    // Verify the PIN with the server before entering the simulator.
    let settled = false;
    const link = createLink({
      url: wsUrl, role: 'vent', pin,
      onStatus: (st) => {
        if (settled) return;
        if (st === 'online') { settled = true; link.close(); onJoined(pin); }
        if (st === 'denied') { settled = true; link.close(); setState('wrong'); setPin(''); }
      },
      onMessage: () => {},
    });
    setTimeout(() => { if (!settled) { settled = true; link.close(); setState('offline'); } }, 6000);
  };

  useEffect(() => { if (pin.length === 4 && state !== 'checking') tryJoin(); }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Shell>
      <h1 className="text-2xl mt-6 mb-2" data-testid="join-title">{s.joinTitle}</h1>
      {host && <div className="text-slate-400 font-mono text-sm mb-2">{host}</div>}
      <p className="text-slate-300 mb-6 text-center max-w-md">{s.joinSubtitle}</p>
      <PinInput value={pin} onChange={(v) => { setPin(v); if (state === 'wrong') setState('idle'); }} onEnter={tryJoin} />
      <div className="h-8 mt-4 text-center">
        {state === 'checking' && <span className="text-slate-300">{s.joinChecking}</span>}
        {state === 'wrong' && <span className="text-red-400" data-testid="join-wrong">{s.joinWrongPin}</span>}
        {state === 'offline' && <span className="text-amber-400">{s.regiaOffline}</span>}
      </div>
      <button data-testid="join-button" onClick={tryJoin} disabled={pin.length !== 4} className="mt-2 px-8 py-3 rounded-xl bg-sky-600 disabled:bg-slate-700 text-lg font-semibold">{s.joinButton}</button>
      <button onClick={onSolo} className="mt-6 text-slate-400 underline">{s.joinSolo}</button>
    </Shell>
  );
};

// ------------------------------------------------------------ desktop app --

interface Found { name: string; host: string; port: number; seen: number }

const L = {
  it: {
    question: 'Come vuoi usare questo computer?',
    regia: 'Regia', regiaDesc: 'Sono l’istruttore. Questo computer guida gli altri.',
    vent: 'Ventilatore', ventDesc: 'Sono uno studente. Mi collego alla regia.',
    solo: 'Da solo', soloDesc: 'Uso il simulatore senza rete.',
    starting: 'Avvio della regia…',
    searching: 'Cerco una regia sulla rete…',
    found: 'Regie trovate (clicca per collegarti):',
    none: 'Nessuna regia trovata. Controlla che l’istruttore abbia aperto la regia e che siate sulla stessa Wi-Fi.',
    manual: 'Oppure scrivi l’indirizzo che vedi sullo schermo dell’istruttore:',
    connect: 'Collegati', back: '← Indietro',
    firewall: 'Se Windows chiede di consentire l’accesso alla rete, scegli «Consenti» (anche reti private).',
    error: 'Non riesco ad avviare la regia:',
  },
  en: {
    question: 'How will you use this computer?',
    regia: 'Instructor', regiaDesc: 'I run the session. This computer drives the others.',
    vent: 'Ventilator', ventDesc: 'I am a learner. I connect to the instructor.',
    solo: 'On my own', soloDesc: 'Use the simulator without network.',
    starting: 'Starting the instructor console…',
    searching: 'Looking for an instructor on the network…',
    found: 'Instructors found (click to connect):',
    none: 'No instructor found. Make sure the instructor console is open and you are on the same Wi-Fi.',
    manual: 'Or type the address shown on the instructor’s screen:',
    connect: 'Connect', back: '← Back',
    firewall: 'If Windows asks to allow network access, choose “Allow” (private networks too).',
    error: 'Could not start the instructor console:',
  },
};

export const DesktopLauncher: React.FC<{ onSolo: () => void }> = ({ onSolo }) => {
  const { language } = useLanguage();
  const l = L[language === 'it' ? 'it' : 'en'];
  const bridge = (window as any).ovsDesktop;
  const [step, setStep] = useState<'choose' | 'starting' | 'find'>('choose');
  const [error, setError] = useState('');
  const [found, setFound] = useState<Found[]>([]);
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (step !== 'find' || !bridge?.onDiscovered) return;
    const off = bridge.onDiscovered((f: Found) => setFound((prev) => [...prev.filter((x) => !(x.host === f.host && x.port === f.port)), f]));
    bridge.startDiscovery?.();
    const prune = setInterval(() => setFound((prev) => prev.filter((x) => Date.now() - x.seen < 8000)), 2000);
    return () => { off?.(); bridge.stopDiscovery?.(); clearInterval(prune); };
  }, [step, bridge]);

  const startRegia = async () => {
    setStep('starting');
    try { const url = await bridge.startRegia(); window.location.href = url; }
    catch (e) { setError(String((e as Error)?.message || e)); setStep('choose'); }
  };
  const goTo = (host: string, port: number) => { window.location.href = `http://${host}:${port}/?join=1`; };
  const goManual = () => {
    let v = manual.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!v) return;
    if (!/:\d+$/.test(v)) v += ':8787';
    window.location.href = `http://${v}/?join=1`;
  };

  if (step === 'starting') return <Shell><p className="mt-8 text-lg">{l.starting}</p><p className="mt-4 text-slate-400 text-sm max-w-md text-center">{l.firewall}</p></Shell>;

  if (step === 'find') return (
    <Shell>
      <button onClick={() => setStep('choose')} className="absolute top-3 left-3 text-slate-300 underline">{l.back}</button>
      <p className="mt-6 text-lg">{found.length ? l.found : l.searching}</p>
      <ul className="mt-3 space-y-2 w-full max-w-md" data-testid="found-list">
        {found.map((f) => (
          <li key={`${f.host}:${f.port}`}><button onClick={() => goTo(f.host, f.port)} className="w-full text-left px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 hover:border-sky-400">
            <div className="font-semibold">{f.name}</div><div className="text-xs text-slate-400 font-mono">{f.host}:{f.port}</div></button></li>
        ))}
      </ul>
      {!found.length && <p className="text-slate-500 text-sm max-w-md text-center mt-2">{l.none}</p>}
      <p className="mt-8 text-slate-300">{l.manual}</p>
      <div className="flex gap-2 mt-2">
        <input data-testid="manual-address" value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && goManual()} placeholder="192.168.1.20:8787" className="w-64 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 font-mono" />
        <button onClick={goManual} className="px-4 py-2 rounded-lg bg-sky-600">{l.connect}</button>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <p className="mt-6 mb-6 text-xl">{l.question}</p>
      {error && <p className="text-red-400 mb-4 max-w-lg text-center">{l.error} {error}</p>}
      <div className="grid gap-4 sm:grid-cols-3 w-full max-w-3xl">
        <Choice testId="choose-regia" icon={<DirectorIcon size={64} strokeWidth={1.3} />} title={l.regia} desc={l.regiaDesc} onClick={startRegia} />
        <Choice testId="choose-vent" icon={<LearnerDeviceIcon size={64} strokeWidth={1.3} />} title={l.vent} desc={l.ventDesc} onClick={() => setStep('find')} />
        <Choice testId="choose-solo" icon={<SoloIcon size={64} strokeWidth={1.3} />} title={l.solo} desc={l.soloDesc} onClick={onSolo} />
      </div>
    </Shell>
  );
};

const Choice: React.FC<{ icon: React.ReactNode; title: string; desc: string; onClick: () => void; testId: string }> = ({ icon, title, desc, onClick, testId }) => (
  <button data-testid={testId} onClick={onClick} className="rounded-2xl bg-slate-900 border-2 border-slate-700 hover:border-sky-400 p-6 text-left transition">
    <div className="mb-4 text-sky-300">{icon}</div>
    <div className="text-2xl font-bold">{title}</div>
    <div className="text-slate-400 mt-1">{desc}</div>
  </button>
);
