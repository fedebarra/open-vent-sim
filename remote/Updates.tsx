/**
 * A newer version of the desktop app: on the first screen a panel, then a line;
 * on the console only a small badge, so that nothing covers a lesson.
 */
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../src/contexts/LanguageContext';

interface UpdateState {
  current: string;
  phase: 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error';
  version: string;
  notes: { it: string[]; en: string[] };
  auto: boolean;
}

const U = {
  it: {
    version: 'Versione', check: 'Controlla aggiornamenti', checking: 'Controllo…', none: 'Sei aggiornato',
    error: 'Non riesco a controllare: serve internet. Riprovo da solo.',
    downloading: (v: string) => `Scarico la ${v}…`,
    title: (v: string) => `È disponibile Open Vent Sim ${v}`, have: (v: string) => `Hai la ${v}.`, news: 'Novità',
    ready: 'È già scaricata: riavvia per installarla adesso, oppure si installa alla chiusura dell’app.',
    manual: 'Si installa sopra a questa: impostazioni e scenari salvati restano.',
    download: 'Scarica', restart: 'Riavvia ora', later: 'Più tardi', badge: (v: string) => `${v} disponibile`,
    lesson: 'Riavviando si chiude la sessione in corso e i ventilatori si scollegano.', restartAnyway: 'Chiudi la sessione e riavvia',
  },
  en: {
    version: 'Version', check: 'Check for updates', checking: 'Checking…', none: 'You are up to date',
    error: 'Could not check: internet is needed. It will try again by itself.',
    downloading: (v: string) => `Downloading ${v}…`,
    title: (v: string) => `Open Vent Sim ${v} is available`, have: (v: string) => `You have ${v}.`, news: 'What’s new',
    ready: 'Already downloaded: restart to install it now, or it installs when you quit the app.',
    manual: 'Install it over this one: saved settings and scenarios stay.',
    download: 'Download', restart: 'Restart now', later: 'Later', badge: (v: string) => `${v} available`,
    lesson: 'Restarting ends the current session and disconnects the ventilators.', restartAnyway: 'End the session and restart',
  },
};

function useUpdates() {
  const bridge = (window as any).ovsDesktop;
  const [state, setState] = useState<UpdateState | null>(null);
  useEffect(() => {
    if (!bridge?.updateState) return;
    let alive = true;
    const read = () => bridge.updateState().then((s: UpdateState | null) => { if (alive) setState(s); }, () => {});
    const off = bridge.onUpdateChanged?.(read);
    read();
    return () => { alive = false; off?.(); };
  }, [bridge]);
  const { language } = useLanguage();
  const lang = language === 'it' ? 'it' as const : 'en' as const;
  return { state, bridge, u: U[lang], lang };
}

const Panel: React.FC<{ state: UpdateState; lang: 'it' | 'en'; inSession?: boolean; onClose: () => void; onAct: () => void }> = ({ state, lang, inSession, onClose, onAct }) => {
  const u = U[lang];
  const ready = state.phase === 'ready';
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={u.title(state.version)} data-testid="update-panel" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-full overflow-y-auto rounded-2xl bg-slate-900 border border-slate-600 p-6 text-left text-base text-slate-100 shadow-2xl">
        <h2 className="text-2xl font-bold">{u.title(state.version)}</h2>
        <p className="text-slate-400 mt-1">{u.have(state.current)} {ready ? u.ready : u.manual}</p>
        {state.notes[lang].length > 0 && <>
          <h3 className="font-semibold mt-4 mb-1">{u.news}</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300 max-h-64 overflow-y-auto">{state.notes[lang].map((n) => <li key={n}>{n}</li>)}</ul>
        </>}
        {ready && inSession && <p className="mt-4 text-amber-300">{u.lesson}</p>}
        <div className="flex flex-wrap justify-end gap-3 mt-6">
          <button data-testid="update-later" onClick={onClose} className="px-5 py-3 rounded-xl bg-slate-700">{u.later}</button>
          <button data-testid="update-act" onClick={() => { onAct(); onClose(); }} className="px-5 py-3 rounded-xl bg-teal-500 text-slate-900 font-semibold">
            {!ready ? u.download : inSession ? u.restartAnyway : u.restart}
          </button>
        </div>
      </div>
    </div>
  );
};

const offered = (s: UpdateState) => s.phase === 'available' || s.phase === 'ready';

/** First screen: the panel once, then the line at the bottom. */
export const LauncherUpdates: React.FC = () => {
  const { state, bridge, u, lang } = useUpdates();
  const [open, setOpen] = useState(false);
  const key = state && offered(state) ? `${state.version}` : '';
  useEffect(() => {
    if (!key) return;
    // "Later" holds until the app is started again, even coming back to this screen.
    try { if (sessionStorage.getItem('ovs-update-seen') === key) return; } catch { /* shown again */ }
    setOpen(true);
  }, [key]);
  if (!state) return null;
  const close = () => { try { sessionStorage.setItem('ovs-update-seen', key); } catch { /* ignore */ } setOpen(false); };
  return (
    <div className="mt-10 min-h-12 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-slate-400" data-testid="update-line">
      <span>{u.version} {state.current}</span>
      {offered(state)
        ? <button data-testid="update-open" onClick={() => setOpen(true)} className="px-4 py-2.5 rounded-full bg-teal-500 text-slate-900 font-semibold">{u.badge(state.version)}</button>
        : <>
          {state.phase === 'none' && <span data-testid="update-none">✓ {u.none}</span>}
          {state.phase === 'error' && <span className="text-amber-400" data-testid="update-error">{u.error}</span>}
          {state.phase === 'checking' && <span>{u.checking}</span>}
          {state.phase === 'downloading' && <span>{u.downloading(state.version)}</span>}
          {(state.phase === 'none' || state.phase === 'error') &&
            <button data-testid="update-check" onClick={() => bridge.checkUpdates()} className="px-3 py-2.5 underline hover:text-slate-200">{u.check}</button>}
        </>}
      {open && offered(state) && <Panel state={state} lang={lang} onClose={close} onAct={() => bridge.actUpdate()} />}
    </div>
  );
};

/** Console: a badge in the header, nothing by itself. */
export const ConsoleUpdates: React.FC = () => {
  const { state, bridge, u, lang } = useUpdates();
  const [open, setOpen] = useState(false);
  if (!state || !offered(state)) return null;
  return <>
    <button data-testid="update-open" onClick={() => setOpen(true)} className="px-3 py-1.5 rounded-lg border border-teal-500 text-teal-300">{u.badge(state.version)}</button>
    {open && <Panel state={state} lang={lang} inSession onClose={() => setOpen(false)} onAct={() => bridge.actUpdate()} />}
  </>;
};
