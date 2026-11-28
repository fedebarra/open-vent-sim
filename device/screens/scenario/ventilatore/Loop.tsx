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
import { attiRecenti, BLOCCO_SEC, motoreCopre } from './motore'
import type { Translate } from '../../../i18n'

type Punto = { paw: number; flusso: number; volume: number }

const COLORE_PV = '#ffb300'
const COLORE_FV = '#4caf50'

function campiona(stato: (t: number) => StatoVentilatore, tFine: number, durata: number, passi = 160): Punto[] {
  const out: Punto[] = []
  for (let i = 0; i <= passi; i++) {
    const t = tFine - durata + (durata * i) / passi
    if (t < 0) continue
    out.push(puntoOnda(t, stato(t)))
  }
  return out
}

/** Un tratto della storia della macchina: da `o` (la sua `origineMacchina`) in poi, lo stato `s`. */
export type Tratto = { o: number; s: StatoVentilatore }

/**
 * Ricorda gli stati con cui la macchina ha dato gli atti. Dopo una regolazione gli atti partono da `origineMacchina`
 * con lo stato nuovo, e quelli di prima restano dello stato vecchio; `statoAl` se ne scorda appena arriva lo stato
 * dopo, il loop no: i due atti più tenui sono ancora di prima. Per ogni origine tiene l'ultimo stato visto.
 */
export function ricordaStato(storia: Tratto[], s: StatoVentilatore, ora: number): Tratto[] {
  const o = s.origineMacchina ?? 0
  if (o > ora) return storia
  const ultimo = storia[storia.length - 1]
  if (ultimo && ultimo.o === o) return ultimo.s === s ? storia : [...storia.slice(0, -1), { o, s }]
  return [...storia.filter((x) => x.o < o), { o, s }].slice(-8)
}

/** Lo stato dell'istante `t` secondo la storia; prima del tratto più vecchio, quello che dice `al`. */
export function statoDallaStoria(storia: Tratto[], al: (t: number) => StatoVentilatore, t: number): StatoVentilatore {
  let s: StatoVentilatore | undefined
  for (const x of storia) if (x.o <= t) s = x.s
  return s ?? al(t)
}

/**
 * L'inizio dell'atto in corso all'istante `t`, con lo stato di quell'istante. Dove c'è il motore è l'inizio vero di
 * un atto erogato: quelli dati dal paziente (PS, CPAP, NEURO, gli atti innescati) non stanno su nessuna griglia. Gli
 * atti di un blocco sono quelli che vi finiscono, e quello in corso finisce dopo `t`: si guarda anche il blocco dopo.
 * Lo stato vale dalla sua `origineMacchina`: un atto suo che comincerebbe prima non c'è stato.
 * Altrimenti, la griglia della macchina da `origineMacchina`.
 */
export function inizioAtto(al: (t: number) => StatoVentilatore, t: number): number {
  const s = al(t)
  const o = s.origineMacchina ?? 0
  if (motoreCopre(s)) {
    // i due blocchi coprono gli atti che finiscono dall'inizio del blocco di `t` a 40 s dopo: anche quelli lenti
    const fino = Math.floor(t / BLOCCO_SEC) * BLOCCO_SEC + 2 * BLOCCO_SEC - 1e-3
    let meglio = -Infinity
    for (const a of attiRecenti(fino, s, Infinity)) if (a.inizio <= t && a.inizio > meglio) meglio = a.inizio
    // prima dell'origine lo stato di adesso non ha dato atti: lì vale quello di prima (dal controllato allo spontaneo
    // il motore nuovo si rifà un passato che sullo schermo non c'è stato)
    if (meglio > -Infinity) return o <= t ? Math.max(meglio, o) : meglio
  }
  const Ttot = Math.max(0.5, tempiRespiro(s).Ttot)
  return o + Math.floor((t - o) / Ttot) * Ttot
}

/** Sotto questa durata non è un atto: è lo scarto fra due griglie, e il loop sarebbe un punto. */
const ATTO_MINIMO = 0.05

/** Gli inizi dell'atto in corso e degli `n` prima, dal più recente: ognuno con lo stato di quando è stato dato. */
export function iniziAtti(al: (t: number) => StatoVentilatore, ora: number, n: number): number[] {
  const out = [inizioAtto(al, ora)]
  for (let k = 0; k < n; k++) {
    let prima = inizioAtto(al, out[k] - 1e-6)
    for (let i = 0; i < 4 && out[k] - prima < ATTO_MINIMO; i++) prima = inizioAtto(al, prima - 1e-6)
    out.push(prima)
  }
  return out
}

/**
 * `statoAl` dice lo stato di un istante: dopo una regolazione, fino all'atto dopo, quello di prima (`seguiRegolazione`
 * in `onde.ts`). Senza, il loop si disegna con lo stato di adesso.
 */
export function Loop({ stato, statoAl, clock, t }: { stato: StatoVentilatore; statoAl?: (t: number) => StatoVentilatore; clock: () => number; t: Translate }) {
  const pvRef = useRef<HTMLCanvasElement>(null)
  const fvRef = useRef<HTMLCanvasElement>(null)
  const statoRef = useRef(stato)
  statoRef.current = stato
  const statoAlRef = useRef(statoAl)
  statoAlRef.current = statoAl
  const [riferimento, setRiferimento] = useState<Punto[] | null>(null)
  const riferimentoRef = useRef(riferimento)
  riferimentoRef.current = riferimento
  const ultimoRef = useRef<Punto[]>([])
  const storiaRef = useRef<Tratto[]>([])

  useEffect(() => {
    let raf = 0
    const disegna = () => {
      raf = requestAnimationFrame(disegna)
      const ora = clock()
      const adesso = statoAlRef.current ?? (() => statoRef.current)
      storiaRef.current = ricordaStato(storiaRef.current, adesso(ora), ora)
      const storia = storiaRef.current
      const al = (tt: number) => statoDallaStoria(storia, adesso, tt)
      // L'ultimo atto chiuso e i due prima, ognuno con lo stato e sulla griglia di quando è stato dato
      const inizi = iniziAtti(al, ora, 3)
      const inizio = inizi[0]
      const atti = [0, 1, 2].map((k) => campiona(al, inizi[k], inizi[k] - inizi[k + 1]))
      ultimoRef.current = atti[0]
      const corrente = campiona(al, ora, Math.max(0.05, ora - inizio), 80)
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
