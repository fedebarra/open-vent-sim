/**
 * Live waveform mirror for the director console. The ventilator sends its
 * snapshot; the curves are regenerated here with the same engine and the same
 * clock (time since the machine was switched on), so they match the learner's
 * screen breath for breath.
 */
import React, { useEffect, useRef } from 'react';
import type { VentIstantanea } from '../device/remoteTypes';
import { orologio, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { puntoOnda } from '../device/screens/scenario/ventilatore/onde';

const TRACES = [
  { key: 'paw' as const, label: 'Paw', unit: 'cmH₂O', color: '#ffb300' },
  { key: 'flusso' as const, label: 'Flow', unit: 'L/min', color: '#4caf50' },
  { key: 'volume' as const, label: 'Vol', unit: 'mL', color: '#00b0ff' },
];
const SECONDS_ON_SCREEN = 12;

export const MiniWaves: React.FC<{ ist: VentIstantanea | null; height?: number }> = ({ ist, height = 270 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const istRef = useRef(ist);
  istRef.current = ist;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    const ranges = TRACES.map(() => ({ min: 0, max: 1 }));

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, w, h);
      const s = istRef.current;
      const active = !!s && s.ventilando && s.ambiente !== 'alto-flusso';
      const rowH = h / TRACES.length;
      if (!s || !active) {
        ctx.fillStyle = 'rgba(148,163,184,.8)'; ctx.font = '13px system-ui, Arial'; ctx.textAlign = 'center';
        ctx.fillText(s ? (s.ambiente === 'alto-flusso' ? '— high flow —' : '— standby —') : '…', w / 2, h / 2);
        ctx.textAlign = 'left';
        return;
      }
      const stato = statoDa(s);
      const now = orologio(s);
      // sweep: x position of "now"; left of it the latest seconds, right of it the older ones
      const pos = ((now % SECONDS_ON_SCREEN) / SECONDS_ON_SCREEN) * w;
      const cols = Math.max(2, Math.floor(w / 2));
      const values = TRACES.map(() => new Array<number>(cols));
      for (let c = 0; c < cols; c++) {
        const x = (c / cols) * w;
        const age = x <= pos ? (pos - x) : (pos + w - x);
        const t = now - (age / w) * SECONDS_ON_SCREEN;
        const p = t >= 0 ? puntoOnda(t, stato) : null;
        TRACES.forEach((tr, k) => { values[k][c] = p ? (p as any)[tr.key] : NaN; });
      }
      TRACES.forEach((tr, k) => {
        const vs = values[k].filter(Number.isFinite);
        if (vs.length) {
          const mn = Math.min(...vs), mx = Math.max(...vs), pad = Math.max(1, (mx - mn) * 0.15);
          ranges[k].min += (Math.min(0, mn - pad) - ranges[k].min) * 0.08;
          ranges[k].max += (mx + pad - ranges[k].max) * 0.08;
        }
        const { min, max } = ranges[k];
        const y0 = k * rowH;
        const yOf = (v: number) => y0 + rowH - 4 - ((v - min) / Math.max(1e-6, max - min)) * (rowH - 18);
        ctx.strokeStyle = 'rgba(148,163,184,.18)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, yOf(0)); ctx.lineTo(w, yOf(0)); ctx.stroke();
        ctx.fillStyle = tr.color; ctx.font = '11px system-ui, Arial';
        ctx.fillText(`${tr.label} (${tr.unit})`, 6, y0 + 12);
        ctx.strokeStyle = tr.color; ctx.lineWidth = 1.6; ctx.beginPath();
        let pen = false;
        for (let c = 0; c < cols; c++) {
          const x = (c / cols) * w;
          if (x > pos && x < pos + 14) { pen = false; continue; }
          const v = values[k][c];
          if (!Number.isFinite(v)) { pen = false; continue; }
          const y = yOf(v);
          if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
        }
        ctx.stroke();
      });
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} data-testid="regia-waves" style={{ width: '100%', height, display: 'block', borderRadius: 10 }} />;
};
