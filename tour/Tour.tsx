/**
 * Guided familiarization tour over the live simulator.
 *
 * Ported from the Scenario Creator ("familiarizzazione/Guida.tsx"):
 *  - one card per step with "Step n of N" and progress dots;
 *  - the part being discussed lights up and the rest dims, but everything
 *    stays touchable — the light is a hint, not a gate;
 *  - "Try it" ticks by itself when the learner does it;
 *  - "Next" always works: an unfinished step never blocks anyone;
 *  - the guide can be hidden to a tab on the left edge and reopened.
 *
 * It only observes: the app state through `context`, the page through DOM
 * selectors (`data-tour` attributes) and clicks. It never changes the app.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../src/contexts/LanguageContext';
import { stepsFor, TOUR_STEPS, TourContext, TourStep } from './steps';
import { tourStrings } from './strings';
import './tour.css';

export type { TourContext } from './steps';

const MEASURE_MS = 250;
const MARGIN = 6;

interface Rect { top: number; left: number; width: number; height: number }

const visibleRect = (el: Element, inViewport: boolean): DOMRect | null => {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  // Drawers parked off-screen (translateX(-105%)) are not "there".
  if (r.right <= 0 || r.bottom <= 0) return null;
  if (inViewport && (r.left >= window.innerWidth || r.top >= window.innerHeight)) return null;
  const cs = window.getComputedStyle(el);
  if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return null;
  return r;
};

/** First visible element for a list of selectors (or the union of all matches). */
export function findTarget(target: string[] | undefined, union = false): { el: Element; rect: Rect } | null {
  if (!target?.length) return null;
  for (const inViewport of [true, false]) {
    if (union) {
      const rects: DOMRect[] = [];
      let first: Element | null = null;
      for (const s of target) {
        let list: NodeListOf<Element>;
        try { list = document.querySelectorAll(s); } catch { continue; }
        list.forEach((el) => {
          if (el.closest('.ovs-tour')) return;
          const r = visibleRect(el, inViewport);
          if (r) { rects.push(r); first ??= el; }
        });
      }
      if (rects.length && first) {
        const top = Math.min(...rects.map((r) => r.top));
        const left = Math.min(...rects.map((r) => r.left));
        const bottom = Math.max(...rects.map((r) => r.bottom));
        const right = Math.max(...rects.map((r) => r.right));
        return { el: first, rect: { top, left, width: right - left, height: bottom - top } };
      }
      continue;
    }
    for (const s of target) {
      let list: NodeListOf<Element>;
      try { list = document.querySelectorAll(s); } catch { continue; }
      for (const el of Array.from(list)) {
        if (el.closest('.ovs-tour')) continue;
        const r = visibleRect(el, inViewport);
        if (r) return { el, rect: { top: r.top, left: r.left, width: r.width, height: r.height } };
      }
    }
  }
  return null;
}

export interface TourProps {
  active: boolean;
  onClose: () => void;
  context: TourContext;
}

export const Tour: React.FC<TourProps> = ({ active, onClose, context }) => {
  const { language } = useLanguage();
  const s = tourStrings(language);
  const lang: 'it' | 'en' = language === 'it' ? 'it' : 'en';

  const envKey = `${context.screen}|${context.icuChoice}|${context.ambiente}|${context.vent?.ambiente ?? ''}`;
  const [currentId, setCurrentId] = useState<string>(TOUR_STEPS[0].id);
  // Steps already shown stay in the list, so "n/N" only moves forward.
  const [seen, setSeen] = useState<string[]>([]);
  const steps = useMemo(() => {
    const now = new Set(stepsFor(context).map((st) => st.id));
    return TOUR_STEPS.filter((st) => now.has(st.id) || seen.includes(st.id));
  }, [envKey, seen]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(true);
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Restart from the beginning every time the tour is (re)opened.
  useEffect(() => { if (active) { setCurrentId(TOUR_STEPS[0].id); setSeen([]); setOpen(true); } }, [active]);

  // If the current step stops applying (e.g. the start screen is gone), move to the next one that does.
  const index = useMemo(() => {
    const i = steps.findIndex((st) => st.id === currentId);
    if (i >= 0) return i;
    const order = TOUR_STEPS.findIndex((st) => st.id === currentId);
    const next = steps.findIndex((st) => TOUR_STEPS.findIndex((x) => x.id === st.id) > order);
    return next >= 0 ? next : steps.length - 1;
  }, [steps, currentId]);
  const step: TourStep = steps[index];
  const last = index >= steps.length - 1;

  useEffect(() => { if (step && step.id !== currentId) setCurrentId(step.id); }, [step, currentId]);
  useEffect(() => { if (step && !seen.includes(step.id)) setSeen((p) => [...p, step.id]); }, [step, seen]);

  // ---- per-step state: the context when it started, and "done"
  const ctxRef = useRef(context);
  ctxRef.current = context;
  const startCtx = useRef<TourContext>(context);
  const startedAt = useRef(Date.now());
  const completedRef = useRef(false);
  useEffect(() => {
    startCtx.current = ctxRef.current;
    startedAt.current = Date.now();
    completedRef.current = false;
    setCompleted(false);
  }, [step?.id]);

  const markDone = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setCompleted(true);
  }, []);

  // state- and action-based completion
  useEffect(() => {
    if (!active || !step?.done) return;
    const { state, action } = step.done;
    try { if (state && state(context, startCtx.current)) markDone(); } catch { /* ignore */ }
    if (action) {
      const match = typeof action === 'string' ? (k: string) => k === action : action;
      if (context.actions.some((a) => a.at >= startedAt.current && match(a.kind))) markDone();
    }
  }, [active, step, context, markDone]);

  // click-based completion (capture phase: before the app possibly removes the element)
  useEffect(() => {
    if (!active || !step?.done?.click) return;
    const sels = step.done.click;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || t.closest('.ovs-tour')) return;
      if (sels.some((q) => { try { return !!t.closest(q); } catch { return false; } })) markDone();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active, step, markDone]);

  // auto-advance for the screen-by-screen start-up steps
  useEffect(() => {
    if (!active || !completed || !step?.auto || last) return;
    const id = window.setTimeout(() => setCurrentId(steps[Math.min(index + 1, steps.length - 1)].id), 900);
    return () => window.clearTimeout(id);
  }, [active, completed, step, last, steps, index]);

  // bring an off-screen target into view once per step
  useEffect(() => {
    if (!active || !step?.target) return;
    const id = window.setTimeout(() => {
      const found = findTarget(step.target, step.union);
      if (!found) return;
      const r = found.el.getBoundingClientRect();
      if (r.bottom > window.innerHeight || r.top < 0 || r.right > window.innerWidth) {
        try { found.el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch { /* ignore */ }
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [active, step]);

  // measure the target (the UI moves: drawers, modals, animations) and check "appears"
  useEffect(() => {
    if (!active || !step) return;
    const measure = () => {
      const found = findTarget(step.target, step.union);
      if (found) {
        const r = found.rect;
        setRect((p) => (p && Math.abs(p.top - r.top) < 1 && Math.abs(p.left - r.left) < 1 && Math.abs(p.width - r.width) < 1 && Math.abs(p.height - r.height) < 1 ? p : r));
        setMissing(false);
      } else {
        setRect(null);
        setMissing(!!step.target);
      }
      if (step.done?.appears) {
        try { if (document.querySelector(step.done.appears)) markDone(); } catch { /* ignore */ }
      }
    };
    measure();
    const id = window.setInterval(measure, MEASURE_MS);
    window.addEventListener('resize', measure);
    return () => { window.clearInterval(id); window.removeEventListener('resize', measure); };
  }, [active, step, markDone]);

  const next = useCallback(() => { if (last) onClose(); else setCurrentId(steps[index + 1].id); }, [last, onClose, steps, index]);
  const back = useCallback(() => { if (index > 0) setCurrentId(steps[index - 1].id); }, [steps, index]);

  // keyboard: Esc closes, arrows move (ignored while typing in a field)
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowRight' && open) { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' && open) { e.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, open, next, back, onClose]);

  if (!active || !step) return null;
  const text = step[lang];
  // Put the card where it covers nothing: beside the target if there is room,
  // otherwise in the larger gap above or below it.
  const h = window.innerHeight || 1;
  const w = window.innerWidth || 1;
  let position: 'center' | 'top' | 'bottom' | 'left' | 'right' = 'center';
  let sideWidth = 0;
  if (step.card !== 'center' && rect) {
    const spaceLeft = rect.left - MARGIN - 16;
    const spaceRight = w - (rect.left + rect.width) - MARGIN - 16;
    const spaceAbove = rect.top - MARGIN;
    const spaceBelow = h - (rect.top + rect.height) - MARGIN;
    const vertical = Math.max(spaceAbove, spaceBelow);
    const side = Math.max(spaceLeft, spaceRight);
    if (vertical < 220 && side >= 300) {
      position = spaceRight >= spaceLeft ? 'right' : 'left';
      sideWidth = Math.min(440, side);
    } else {
      position = spaceAbove > spaceBelow ? 'top' : 'bottom';
    }
  }
  const cardStyle: React.CSSProperties | undefined = sideWidth
    ? { width: sideWidth, ...(position === 'right' ? { right: 12, left: 'auto' } : { left: 12 }), transform: 'translateY(-50%)', top: '50%', maxHeight: 'calc(100vh - 32px)' }
    : undefined;

  return createPortal(
    <div className="ovs-tour" data-step={step.id} data-index={index}>
      {!open && (
        <button type="button" className="ovs-tour__tab" onClick={() => setOpen(true)} aria-label={`${s.badge} — ${s.tab}`}>
          <span>{s.badge}</span>
        </button>
      )}
      {open && rect && (
        <div className="ovs-tour__light" aria-hidden="true"
          style={{ top: rect.top - MARGIN, left: rect.left - MARGIN, width: rect.width + MARGIN * 2, height: rect.height + MARGIN * 2 }} />
      )}
      {open && !rect && <div className="ovs-tour__veil" aria-hidden="true" />}
      {open && (
        <section className={`ovs-tour__card ovs-tour__card--${position}`} style={cardStyle} role="dialog" aria-modal="false" aria-labelledby="ovs-tour-title" data-testid="tour-card">
          <header className="ovs-tour__head">
            <span className="ovs-tour__count">
              <strong className="ovs-tour__badge">{s.badge}</strong>
              <span data-testid="tour-progress">{index + 1}/{steps.length}</span>
            </span>
            <span className="ovs-tour__head-buttons">
              <button type="button" className="ovs-tour__icon" onClick={() => setOpen(false)} aria-label={s.hide} title={s.hide}>–</button>
              <button type="button" className="ovs-tour__icon" onClick={onClose} aria-label={s.exit} title={s.exit} data-testid="tour-exit">✕</button>
            </span>
          </header>
          <div className="ovs-tour__dots" aria-hidden="true">
            {steps.map((st, i) => <span key={st.id} className={i < index ? 'is-done' : i === index ? 'is-here' : ''} />)}
          </div>
          <h2 id="ovs-tour-title">{text.title}</h2>
          <p>{text.body}</p>
          {text.tryIt && (
            <p className={`ovs-tour__try ${completed ? 'is-done' : ''}`} data-testid="tour-try">
              <span className="ovs-tour__mark" aria-hidden="true">{completed ? '✓' : '▶'}</span>
              <span><strong>{completed ? s.doneTick : s.tryIt}</strong> {text.tryIt}</span>
            </p>
          )}
          {missing && <p className="ovs-tour__missing">{s.missing}</p>}
          {index === 0 && <p className="ovs-tour__keys">{s.keys}</p>}
          <footer className="ovs-tour__buttons">
            <button type="button" className="ovs-tour__btn" onClick={onClose}>{s.exit}</button>
            {index > 0 && <button type="button" className="ovs-tour__btn" onClick={back} data-testid="tour-back">‹ {s.back}</button>}
            <button type="button" className={`ovs-tour__btn ovs-tour__btn--next ${completed ? 'is-ready' : ''}`} onClick={next} data-testid="tour-next">
              {last ? s.done : `${s.next} ›`}
            </button>
          </footer>
        </section>
      )}
    </div>,
    document.body,
  );
};

export default Tour;
