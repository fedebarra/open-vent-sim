/**
 * La vista EIT: l'immagine della fetta del torace, le curve regionali, il PEEP
 * trial.
 *
 * Il modello sta in `eit.ts`; qui si disegna. L'immagine si guarda come sul
 * monitor vero: ventrale in alto, il destro del paziente a sinistra, il nero è
 * dove non arriva aria e il chiaro dove ne arriva di più. In «dinamica» ogni
 * pixel si accende col volume di adesso, e il pendelluft — il dorsale che si
 * gonfia mentre il ventrale si svuota — si vede come un'onda che scende.
 *
 * (Aggiunta della 3.2, sul modello del simulatore di Piraino.)
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { StatoVentilatore } from './fisica'
import { polmoneOra } from './fisica'
import type { Translate } from '../../../i18n'
import {
  LATO,
  STRATI,
  immagineTidal,
  istanteEit,
  maschera,
  provaPeep,
  quadroEit,
  type ProvaPeep,
} from './eit'

const COLORE_GLOBALE = '#e2e8f0'
const COLORE_VENTRALE = '#22d3ee'
const COLORE_DORSALE = '#fb923c'
const FINESTRA_SEC = 12

/** Dal valore 0–1 al colore: nero, blu, bianco — la scala delle macchine vere. */
function colore(v: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, v))
  if (x < 0.5) {
    const u = x / 0.5
    return [Math.round(10 + u * 20), Math.round(15 + u * 60), Math.round(30 + u * 160)]
  }
  const u = (x - 0.5) / 0.5
  return [Math.round(30 + u * 200), Math.round(75 + u * 170), Math.round(190 + u * 60)]
}

export function Eit({ stato, clock, t }: { stato: StatoVentilatore; clock: () => number; t: Translate }) {
  const immagineRef = useRef<HTMLCanvasElement>(null)
  const curveRef = useRef<HTMLCanvasElement>(null)
  const provaRef = useRef<HTMLCanvasElement>(null)
  const statoRef = useRef(stato)
  statoRef.current = stato
  const [dinamica, setDinamica] = useState(false)
  const dinamicaRef = useRef(dinamica)
  dinamicaRef.current = dinamica
  const [numeri, setNumeri] = useState<{ ventrale: number; centro: number; pendelluft: number } | null>(null)
  const [prova, setProva] = useState<ProvaPeep | null>(null)

  useEffect(() => {
    let raf = 0
    let ultimoNumeri = 0
    const disegna = () => {
      raf = requestAnimationFrame(disegna)
      const s = statoRef.current
      const ora = clock()
      const q = quadroEit(ora, s)
      if (!q) return
      disegnaImmagine(immagineRef.current, q, dinamicaRef.current ? istanteEit(ora, s, q) : null)
      const punti: ReturnType<typeof istanteEit>[] = []
      for (let k = 0; k <= 240; k++) punti.push(istanteEit(ora - FINESTRA_SEC + (FINESTRA_SEC * k) / 240, s, q))
      disegnaCurve(curveRef.current, punti)
      if (ora - ultimoNumeri > 1) {
        ultimoNumeri = ora
        setNumeri({
          ventrale: q.regioni.ventrale,
          centro: q.regioni.centro,
          pendelluft: Math.max(0, ...punti.map((p) => p.pendelluft)),
        })
      }
    }
    raf = requestAnimationFrame(disegna)
    return () => cancelAnimationFrame(raf)
  }, [clock])

  useEffect(() => {
    if (prova) disegnaProva(provaRef.current, prova, t)
  }, [prova, t])

  // Il trial si rifà se cambia il paziente: un grafico di un altro polmone è peggio di nessuno.
  const impronta = useMemo(() => JSON.stringify(stato.fisiologia), [stato.fisiologia])
  useEffect(() => setProva(null), [impronta])

  const faiProva = () => {
    const s = polmoneOra({ ...statoRef.current, manovra: null })
    // La pressione motrice del trial è quella di adesso, se si può leggere; se no dodici.
    const motrice = Math.max(6, Math.min(20, s.modalita === 'PC' || s.modalita === 'PRVC' ? s.impostazioni.pressureTarget : 12))
    setProva(provaPeep(statoRef.current.fisiologia, motrice))
  }

  return (
    <div className="simvent__loop simvent__eit" data-testid="eit">
      <div className="simvent__loop-quadri">
        <figure>
          <figcaption>{t(dinamica ? 'vent.eit.dinamica' : 'vent.eit.tidal')}</figcaption>
          <canvas ref={immagineRef} className="simvent__eit-immagine" />
          <div className="simvent__eit-numeri">
            <span>{t('vent.eit.ventrale')} <b>{numeri ? Math.round(numeri.ventrale) : '––'}%</b></span>
            <span>{t('vent.eit.dorsale')} <b>{numeri ? Math.round(100 - numeri.ventrale) : '––'}%</b></span>
            <span>{t('vent.eit.centro')} <b data-testid="eit-centro">{numeri ? Math.round(numeri.centro) : '––'}%</b></span>
            <span>{t('vent.eit.pendelluft')} <b>{numeri ? Math.round(numeri.pendelluft) : '––'} ml</b></span>
          </div>
        </figure>
        <figure>
          <figcaption>
            {t('vent.eit.regionali')}{' '}
            <i style={{ color: COLORE_GLOBALE }}>■ {t('vent.eit.globale')}</i>{' '}
            <i style={{ color: COLORE_VENTRALE }}>■ {t('vent.eit.ventrale')}</i>{' '}
            <i style={{ color: COLORE_DORSALE }}>■ {t('vent.eit.dorsale')}</i>
          </figcaption>
          <canvas ref={curveRef} />
          {prova && (
            <>
              <figcaption>
                {t('vent.eit.prova')} — {t('vent.eit.incrocio')}{' '}
                <b data-testid="eit-incrocio">{prova.incrocio === null ? '––' : prova.incrocio}</b> cmH₂O · ΔP {prova.motrice}
              </figcaption>
              <canvas ref={provaRef} />
            </>
          )}
        </figure>
      </div>
      <div className="simvent__loop-comandi">
        <button type="button" onClick={() => setDinamica((x) => !x)}>
          {t(dinamica ? 'vent.eit.tidal' : 'vent.eit.dinamica')}
        </button>
        <button type="button" data-testid="eit-prova" onClick={faiProva}>
          {t('vent.eit.prova')}
        </button>
        {prova && <button type="button" onClick={() => setProva(null)}>{t('vent.eit.chiudi')}</button>}
        <span className="simvent__loop-legenda">{prova ? t('vent.eit.prova.hint') : ''}</span>
      </div>
    </div>
  )
}

function prepara(canvas: HTMLCanvasElement | null): { ctx: CanvasRenderingContext2D; w: number; h: number } | null {
  if (!canvas) return null
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  return { ctx, w, h }
}

const OFF = typeof document !== 'undefined' ? document.createElement('canvas') : null

function disegnaImmagine(
  canvas: HTMLCanvasElement | null,
  q: NonNullable<ReturnType<typeof quadroEit>>,
  adesso: ReturnType<typeof istanteEit> | null,
) {
  const c = prepara(canvas)
  if (!c || !OFF) return
  const { ctx, w, h } = c
  const tidal = immagineTidal(q.regioni)
  const m = maschera()
  // In dinamica ogni fetta si accende col suo volume di adesso: la parte
  // ventrale e quella dorsale prendono la loro curva, il pendelluft compreso.
  let fattore: number[] | null = null
  if (adesso) {
    const v = q.regioni.ventrale / 100
    const pieno = Math.max(50, q.vt)
    const ventr = adesso.ventrale / Math.max(1, pieno * v)
    const dors = adesso.dorsale / Math.max(1, pieno * (1 - v))
    fattore = Array.from({ length: STRATI }, (_, i) => Math.max(0, i < STRATI / 2 ? ventr : dors))
  }
  OFF.width = LATO
  OFF.height = LATO
  const octx = OFF.getContext('2d')
  if (!octx) return
  const img = octx.createImageData(LATO, LATO)
  for (let k = 0; k < LATO * LATO; k++) {
    const p = m[k]
    let v = tidal[k]
    if (fattore) v *= Math.min(1.3, fattore[p.fetta])
    const [r, g, b] = p.peso > 0 ? colore(v) : [0, 0, 0]
    img.data[k * 4] = r
    img.data[k * 4 + 1] = g
    img.data[k * 4 + 2] = b
    img.data[k * 4 + 3] = 255
  }
  octx.putImageData(img, 0, 0)
  const lato = Math.min(w, h)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(OFF, (w - lato) / 2, (h - lato) / 2, lato, lato)
  ctx.fillStyle = '#8a97ad'
  ctx.font = '10px system-ui, sans-serif'
  ctx.fillText('V', (w - lato) / 2 + 4, (h - lato) / 2 + 12)
  ctx.fillText('D', (w - lato) / 2 + 4, (h + lato) / 2 - 4)
  ctx.fillText('R', (w - lato) / 2 + 4, h / 2)
  ctx.fillText('L', (w + lato) / 2 - 10, h / 2)
}

function disegnaCurve(canvas: HTMLCanvasElement | null, punti: ReturnType<typeof istanteEit>[]) {
  const c = prepara(canvas)
  if (!c || punti.length < 2) return
  const { ctx, w, h } = c
  const max = Math.max(50, ...punti.map((p) => p.globale)) * 1.1
  const min = Math.min(0, ...punti.map((p) => Math.min(p.ventrale, p.dorsale)))
  const X = (i: number) => 6 + (i / (punti.length - 1)) * (w - 12)
  const Y = (v: number) => h - 8 - ((v - min) / (max - min || 1)) * (h - 16)
  const linea = (f: (p: ReturnType<typeof istanteEit>) => number, col: string, larg: number) => {
    ctx.strokeStyle = col
    ctx.lineWidth = larg
    ctx.beginPath()
    punti.forEach((p, i) => (i ? ctx.lineTo(X(i), Y(f(p))) : ctx.moveTo(X(i), Y(f(p)))))
    ctx.stroke()
  }
  linea((p) => p.globale, COLORE_GLOBALE, 1.6)
  linea((p) => p.ventrale, COLORE_VENTRALE, 1.4)
  linea((p) => p.dorsale, COLORE_DORSALE, 1.4)
}

function disegnaProva(canvas: HTMLCanvasElement | null, prova: ProvaPeep, t: Translate) {
  const c = prepara(canvas)
  if (!c) return
  const { ctx, w, h } = c
  const m = 30
  const peeps = prova.passi.map((p) => p.peep)
  const pMin = Math.min(...peeps)
  const pMax = Math.max(...peeps)
  // La PEEP cresce verso destra; il trial è stato fatto scendendo.
  const X = (p: number) => m + ((p - pMin) / (pMax - pMin || 1)) * (w - m - 10)
  const Y = (v: number) => h - m - (v / 100) * (h - m - 10)
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.beginPath()
  ctx.moveTo(m, 8)
  ctx.lineTo(m, h - m)
  ctx.lineTo(w - 8, h - m)
  ctx.stroke()
  ctx.fillStyle = '#8a97ad'
  ctx.font = '10px system-ui, sans-serif'
  for (const p of peeps) if (p % 4 === 0) ctx.fillText(String(p), X(p) - 5, h - m + 12)
  ctx.fillText('PEEP', w - 34, h - m + 24)
  ctx.fillText('%', 6, 14)
  const serie = (f: (p: ProvaPeep['passi'][number]) => number, col: string, scala = 1) => {
    ctx.strokeStyle = col
    ctx.lineWidth = 2
    ctx.beginPath()
    prova.passi.forEach((p, i) => (i ? ctx.lineTo(X(p.peep), Y(f(p) * scala)) : ctx.moveTo(X(p.peep), Y(f(p) * scala))))
    ctx.stroke()
    ctx.fillStyle = col
    prova.passi.forEach((p) => ctx.fillRect(X(p.peep) - 2, Y(f(p) * scala) - 2, 4, 4))
  }
  serie((p) => p.collasso, COLORE_DORSALE)
  serie((p) => p.sovradistensione, COLORE_VENTRALE)
  // La compliance sulla stessa scala, come percentuale della migliore.
  const cMax = Math.max(1, ...prova.passi.map((p) => p.compliance))
  serie((p) => (p.compliance / cMax) * 100, COLORE_GLOBALE)
  if (prova.incrocio !== null) {
    ctx.strokeStyle = '#facc15'
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(X(prova.incrocio), 8)
    ctx.lineTo(X(prova.incrocio), h - m)
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.fillStyle = COLORE_DORSALE
  ctx.fillText(t('vent.eit.collasso'), m + 4, 20)
  ctx.fillStyle = COLORE_VENTRALE
  ctx.fillText(t('vent.eit.sovradistensione'), w - 110, 20)
  ctx.fillStyle = COLORE_GLOBALE
  ctx.fillText(t('vent.eit.compliance'), w / 2 - 30, 20)
}
