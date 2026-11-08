/**
 * I loop: pressione–volume e flusso–volume dell'ultimo atto.
 *
 * Si disegnano campionando lo stesso motore delle curve sugli ultimi secondi:
 * l'atto più recente pieno, i due prima più tenui, così si vede se il loop si
 * sposta. «Tieni come riferimento» congela l'atto di adesso in grigio: si
 * cambia la PEEP o il volume e si confrontano i due anelli sullo stesso
 * quadro — è il confronto che al letto si fa a memoria.
 *
 * (Aggiunta di Open Vent Sim 3.1.)
 */
import { useEffect, useRef, useState } from 'react'
import type { StatoVentilatore } from './fisica'
import { tempiRespiro } from './fisica'
import { puntoOnda } from './onde'
import type { Translate } from '../../../i18n'

type Punto = { paw: number; flusso: number; volume: number }

const COLORE_PV = '#ffb300'
const COLORE_FV = '#4caf50'

function campiona(stato: StatoVentilatore, tFine: number, durata: number, passi = 160): Punto[] {
  const out: Punto[] = []
  for (let i = 0; i <= passi; i++) {
    const t = tFine - durata + (durata * i) / passi
    if (t < 0) continue
    out.push(puntoOnda(t, stato))
  }
  return out
}

export function Loop({ stato, clock, t }: { stato: StatoVentilatore; clock: () => number; t: Translate }) {
  const pvRef = useRef<HTMLCanvasElement>(null)
  const fvRef = useRef<HTMLCanvasElement>(null)
  const statoRef = useRef(stato)
  statoRef.current = stato
  const [riferimento, setRiferimento] = useState<Punto[] | null>(null)
  const riferimentoRef = useRef(riferimento)
  riferimentoRef.current = riferimento
  const ultimoRef = useRef<Punto[]>([])

  useEffect(() => {
    let raf = 0
    const disegna = () => {
      raf = requestAnimationFrame(disegna)
      const s = statoRef.current
      const ora = clock()
      const Ttot = Math.max(0.5, tempiRespiro(s).Ttot)
      // L'atto che si sta chiudendo adesso, e i due prima.
      const inizio = Math.floor(ora / Ttot) * Ttot
      const atti = [0, 1, 2].map((k) => campiona(s, inizio - k * Ttot, Ttot))
      ultimoRef.current = atti[0]
      const corrente = campiona(s, ora, Math.max(0.05, ora - inizio), 80)
      const tutti = [...atti.flat(), ...corrente, ...(riferimentoRef.current ?? [])]
      const vMax = Math.max(100, ...tutti.map((p) => p.volume)) * 1.1
      const pMax = Math.max(10, ...tutti.map((p) => p.paw)) * 1.1
      const pMin = Math.min(0, ...tutti.map((p) => p.paw))
      const fAbs = Math.max(10, ...tutti.map((p) => Math.abs(p.flusso))) * 1.1
      quadro(pvRef.current, (p) => [p.paw, p.volume], [pMin, pMax], [0, vMax], 'Paw cmH₂O', 'Vol ml', COLORE_PV, atti, corrente, riferimentoRef.current)
      quadro(fvRef.current, (p) => [p.volume, p.flusso], [0, vMax], [-fAbs, fAbs], 'Vol ml', t('vent.wave.flusso') + ' l/min', COLORE_FV, atti, corrente, riferimentoRef.current)
    }
    raf = requestAnimationFrame(disegna)
    return () => cancelAnimationFrame(raf)
  }, [clock, t])

  return (
    <div className="simvent__loop" data-testid="loop">
      <div className="simvent__loop-quadri">
        <figure><figcaption>{t('vent.loop.pv')}</figcaption><canvas ref={pvRef} /></figure>
        <figure><figcaption>{t('vent.loop.fv')}</figcaption><canvas ref={fvRef} /></figure>
      </div>
      <div className="simvent__loop-comandi">
        <button type="button" data-testid="loop-riferimento" onClick={() => setRiferimento(ultimoRef.current.slice())}>
          {t('vent.loop.tieni')}
        </button>
        {riferimento && (
          <button type="button" onClick={() => setRiferimento(null)}>{t('vent.loop.togli')}</button>
        )}
        <span className="simvent__loop-legenda">{riferimento ? t('vent.loop.legenda') : ''}</span>
      </div>
    </div>
  )
}

function quadro(
  canvas: HTMLCanvasElement | null,
  xy: (p: Punto) => [number, number],
  rx: [number, number],
  ry: [number, number],
  etX: string,
  etY: string,
  colore: string,
  atti: Punto[][],
  corrente: Punto[],
  riferimento: Punto[] | null,
) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  const m = 34
  const X = (v: number) => m + ((v - rx[0]) / (rx[1] - rx[0] || 1)) * (w - m - 10)
  const Y = (v: number) => h - m - ((v - ry[0]) / (ry[1] - ry[0] || 1)) * (h - m - 10)
  // assi
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(X(Math.max(rx[0], 0)), 8); ctx.lineTo(X(Math.max(rx[0], 0)), h - m)
  ctx.moveTo(m, Y(Math.max(ry[0], 0))); ctx.lineTo(w - 8, Y(Math.max(ry[0], 0)))
  ctx.stroke()
  ctx.fillStyle = '#8a97ad'
  ctx.font = '11px system-ui, sans-serif'
  ctx.fillText(etX, w - 8 - ctx.measureText(etX).width, h - m + 16)
  ctx.fillText(etY, m + 4, 18)
  const traccia = (pts: Punto[], col: string, larg: number, alfa: number) => {
    if (pts.length < 2) return
    ctx.globalAlpha = alfa
    ctx.strokeStyle = col
    ctx.lineWidth = larg
    ctx.beginPath()
    pts.forEach((p, i) => { const [a, b] = xy(p); if (i) ctx.lineTo(X(a), Y(b)); else ctx.moveTo(X(a), Y(b)) })
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  if (riferimento) traccia(riferimento, '#cbd5e1', 2, 0.55)
  traccia(atti[2], colore, 1.5, 0.18)
  traccia(atti[1], colore, 1.5, 0.35)
  traccia(atti[0], colore, 2.2, 0.75)
  traccia(corrente, '#ffffff', 2.4, 1)
}
