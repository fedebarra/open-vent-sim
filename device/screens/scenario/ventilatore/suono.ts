/**
 * La voce del ventilatore: il respiro e gli allarmi, **sintetizzati**.
 *
 * ## Il respiro segue il flusso, non un campione
 *
 * Un soffio il cui volume è il flusso di quell'istante: Ti, pause,
 * tosse e asincronie ne escono da sé. A ogni cambio di fase scatta una valvola.
 * Da registrazioni di confronto vengono le misure — quanta energia in ogni banda,
 * i modi del corpo della macchina, la durata dello scatto —: il segnale è generato
 * qui ogni volta, e non c'è nessun campione di nessuno.
 *
 * ## Gli allarmi
 *
 * Due motivi nostri: il rosso insiste ogni pochi secondi, il giallo è più rado e
 * più dolce. Il silenzio ferma gli allarmi e non il respiro.
 */

import type { GravitaAllarme } from './allarmi'

export type FaseRespiro = 'insp' | 'esp' | 'ferma'

export interface Volumi {
  respiro: number
  allarmi: number
}

export const VOLUMI_INIZIALI: Volumi = { respiro: 0.5, allarmi: 0.7 }

/** Ogni quanto si aggiornano volume e timbro, ms. */
export const PASSO_SUONO_MS = 20

/** Quanto è forte il soffio a quel flusso (l/min), da 0 a 1. */
export function forzaSoffio(flusso: number): number {
  const x = Math.abs(flusso)
  if (!Number.isFinite(x) || x < 1) return 0
  // La turbolenza cresce ripida col flusso. L'espirazione esce dalla valvola, non
  // dalla turbina: un poco più piano, e sfuma più in fretta.
  return flusso > 0 ? Math.min(1, 0.85 * (x / 50) ** 0.8) : 0.55 * Math.min(1, (x / 45) ** 1.6)
}

/** Quanto si spostano in alto le risonanze a quel flusso, in cent: il getto più forte è più acuto. */
export function timbroSoffio(flusso: number): number {
  return 160 * (Math.min(1, Math.abs(Number.isFinite(flusso) ? flusso : 0) / 90) - 0.5)
}

/** Un filtro della catena: tipo, Hz, guadagno dB, Q. */
type Filtro = [BiquadFilterType, number, number, number]

/** Sotto i 450 Hz quasi niente; sopra, piatto per terzi d'ottava con le gobbe del condotto e un'aria attorno ai 9 kHz. */
const COMUNE: Filtro[] = [
  ['highpass', 475, 0, 3.5],
  ['highpass', 450, 0, 0.9],
  ['highpass', 440, 0, 0.9],
  ['lowpass', 10800, 0, 1],
  ['lowpass', 10800, 0, 0.7],
  ['lowpass', 11000, 0, 0.6],
]
const INSPIRAZIONE: Filtro[] = [
  ...COMUNE,
  ['peaking', 530, 1, 5],
  ['peaking', 690, 5, 5],
  ['peaking', 875, 5, 6],
  ['peaking', 1290, -4, 4],
  ['peaking', 1560, 5, 6],
  ['peaking', 3600, 3, 4],
  ['peaking', 5400, -3, 2],
  ['peaking', 8900, 3, 1.6],
]
const ESPIRAZIONE: Filtro[] = [
  ...COMUNE,
  ['peaking', 500, 4, 5],
  ['peaking', 705, 3, 5],
  ['peaking', 1400, -4, 1.5],
  ['peaking', 4900, -6, 1.6],
  ['peaking', 8900, 4.5, 1.6],
]

/** I modi che suonano quando la valvola batte: Hz, ampiezza, smorzamento in secondi. */
const MODI: [number, number, number][] = [
  [122, 0.2, 0.03],
  [186, 0.13, 0.024],
  [492, 0.4, 0.03],
  [838, 0.36, 0.026],
  [1630, 0.15, 0.017],
  [3850, 0.1, 0.009],
  [7500, 0.12, 0.007],
]

/** La fase, con un'isteresi: il rumore attorno allo zero non deve far scattare valvole. */
export function faseDa(flusso: number, prima: FaseRespiro): FaseRespiro {
  const alta = 6
  const bassa = 2
  if (prima === 'insp' && flusso > bassa) return 'insp'
  if (prima === 'esp' && flusso < -bassa) return 'esp'
  return flusso > alta ? 'insp' : flusso < -alta ? 'esp' : 'ferma'
}

/** Quanto è forte lo scatto passando da una fase all'altra: zero se non scatta. */
export function scattoFra(prima: FaseRespiro, dopo: FaseRespiro): number {
  if (prima === dopo) return 0
  if (dopo === 'insp') return 1
  if (prima === 'insp') return 0.55
  if (dopo === 'esp') return 0.4
  return 0
}

/** Una nota di un motivo: quando, quanto dura, a che altezza. */
type Nota = [inizio: number, durata: number, hz: number]

export const MOTIVI: Record<GravitaAllarme, { note: Nota[]; ogni: number; forza: number }> = {
  rosso: {
    note: [
      [0, 0.13, 784],
      [0.17, 0.13, 622],
      [0.34, 0.13, 784],
      [0.68, 0.13, 784],
      [0.85, 0.22, 932],
    ],
    ogni: 3.2,
    forza: 0.5,
  },
  giallo: {
    note: [
      [0, 0.22, 494],
      [0.32, 0.3, 587],
    ],
    ogni: 9,
    forza: 0.32,
  },
}

/** Porta il soffio al volume giusto rispetto allo scatto. */
const GUADAGNO = 0.2

export interface SuonoVentilatore {
  /** Va chiamata da un gesto dell'utente, o il browser non suona. */
  enable: () => void
  disable: () => void
  enabled: () => boolean
  setAlarm: (g: GravitaAllarme | null) => void
  setVolumi: (v: Volumi) => void
  /** Il flusso di adesso, l/min; nullo: muto. `scatti` falso: nessuna valvola. */
  setFlusso: (leggi: (() => number | null) | null, scatti?: boolean) => void
  dispose: () => void
}

export function creaSuono(): SuonoVentilatore {
  let ctx: AudioContext | null = null
  let soffio: GainNode | null = null
  let soffioEsp: GainNode | null = null
  let risonanze: BiquadFilterNode[] = []
  let ingressoScatti: GainNode | null = null
  let canaleRespiro: GainNode | null = null
  let canaleAllarmi: GainNode | null = null
  let rumore: AudioBuffer | null = null
  let acceso = false
  let volumi = VOLUMI_INIZIALI
  let allarme: GravitaAllarme | null = null
  let leggi: (() => number | null) | null = null
  let conScatti = true
  let fase: FaseRespiro = 'ferma'
  let tremolio = 0
  let ultimoScatto = 0
  let battito: number | undefined
  let giroAllarme: number | undefined
  let note: OscillatorNode[] = []

  const costruisci = () => {
    if (ctx) return ctx
    const C = typeof window === 'undefined' ? undefined : window.AudioContext
    if (!C) return null
    const c = new C({ latencyHint: 'interactive' })
    ctx = c
    // Sugli iPad l'interruttore del silenzioso non deve zittire l'apparecchio.
    try {
      const sessione = (navigator as unknown as { audioSession?: { type: string } }).audioSession
      if (sessione) sessione.type = 'playback'
    } catch { /* non c'è: pazienza */ }
    // Rumore rosa: la turbolenza ha la stessa energia in ogni ottava, quello bianco «frigge».
    // Cinque secondi, o l'orecchio riconosce il giro.
    rumore = c.createBuffer(1, c.sampleRate * 5, c.sampleRate)
    const d = rumore.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99765 * b0 + w * 0.099046
      b1 = 0.963 * b1 + w * 0.2965164
      b2 = 0.57 * b2 + w * 1.0526913
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25
    }
    canaleRespiro = c.createGain()
    canaleAllarmi = c.createGain()
    canaleRespiro.gain.value = volumi.respiro
    canaleAllarmi.gain.value = volumi.allarmi
    canaleRespiro.connect(c.destination)
    canaleAllarmi.connect(c.destination)
    // Il corpo della macchina: riflessioni cortissime, o il soffio sembra in cuffia.
    const somma = c.createGain()
    somma.connect(canaleRespiro)
    const corpo = c.createConvolver()
    const ir = c.createBuffer(1, Math.round(c.sampleRate * 0.14), c.sampleRate)
    const x = ir.getChannelData(0)
    for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.028))
    corpo.buffer = ir
    const quanto = c.createGain()
    quanto.gain.value = 0.22
    somma.connect(corpo)
    corpo.connect(quanto)
    quanto.connect(canaleRespiro)
    ingressoScatti = somma
    risonanze = []
    const ramo = (filtri: Filtro[], partenza: number) => {
      const src = c.createBufferSource()
      src.buffer = rumore
      src.loop = true
      let nodo: AudioNode = src
      for (const [tipo, hz, db, q] of filtri) {
        const f = c.createBiquadFilter()
        f.type = tipo
        f.frequency.value = hz
        f.Q.value = q
        f.gain.value = db
        nodo.connect(f)
        nodo = f
        if (tipo === 'peaking' && hz < 2000) risonanze.push(f)
      }
      const g = c.createGain()
      g.gain.value = 0
      nodo.connect(g)
      g.connect(somma)
      src.start(0, partenza)
      return g
    }
    soffio = ramo(INSPIRAZIONE, 0)
    soffioEsp = ramo(ESPIRAZIONE, 2.3)
    return c
  }

  /**
   * Una valvola che batte: un tic, poi il colpo coi suoi modi e una scia di aria.
   * Ogni colpo è un poco diverso dal precedente, come sulla macchina vera.
   */
  const scatta = (forza: number, pieno: boolean) => {
    if (!ctx || !ingressoScatti) return
    const r = ctx.sampleRate
    const buf = ctx.createBuffer(1, Math.round(r * 0.16), r)
    const d = buf.getChannelData(0)
    const t0 = 0.012
    const caso = () => 0.97 + Math.random() * 0.06
    const modi = MODI.map(([hz, a, tau]) => [hz * caso() * 2 * Math.PI, a * caso(), tau] as const)
    let basso = 0
    let aria = 0
    for (let i = 0; i < d.length; i++) {
      const t = i / r
      const w = Math.random() * 2 - 1
      basso += 0.45 * (w - basso)
      aria += 0.75 * (w - aria)
      let y = 0.05 * w * Math.exp(-t / 0.004)
      const u = t - t0
      if (u >= 0) {
        const attacco = Math.min(1, u / 0.0015)
        const scia = u < 0.018 ? 1 : Math.exp(-(u - 0.018) / 0.02)
        y += attacco * scia * (0.2 * basso + 0.1 * aria)
        if (pieno) for (const [om, a, tau] of modi) y += attacco * a * 0.62 * Math.sin(om * u) * Math.exp(-u / tau)
      }
      d[i] = y * forza
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ingressoScatti)
    src.start()
    src.onended = () => src.disconnect()
  }

  const aggiorna = () => {
    if (!ctx || !soffio || !soffioEsp || ctx.state !== 'running') return
    const nascosta = typeof document !== 'undefined' && document.hidden
    const v = acceso && !nascosta && leggi ? leggi() : null
    const flusso = v !== null && Number.isFinite(v) ? v : 0
    const t = ctx.currentTime
    // Un tremolio lieve e lento: un getto vero non è mai fermo.
    tremolio += (Math.random() - 0.5) * 0.06 - tremolio * 0.12
    const forza0 = forzaSoffio(flusso) * GUADAGNO * (1 + tremolio)
    soffio.gain.setTargetAtTime(flusso > 0 ? forza0 : 0, t, 0.012)
    soffioEsp.gain.setTargetAtTime(flusso < 0 ? forza0 : 0, t, flusso < 0 ? 0.012 : 0.03)
    const cent = timbroSoffio(flusso)
    for (const f of risonanze) f.detune.setTargetAtTime(cent, t, 0.05)
    if (v === null) {
      fase = 'ferma'
      return
    }
    const nuova = faseDa(flusso, fase)
    const forza = conScatti ? scattoFra(fase, nuova) : 0
    fase = nuova
    if (forza > 0 && t - ultimoScatto > 0.12) {
      ultimoScatto = t
      scatta(forza, nuova === 'insp')
    }
  }

  const zittisciAllarme = () => {
    if (giroAllarme !== undefined) window.clearInterval(giroAllarme)
    giroAllarme = undefined
    for (const o of note) { try { o.stop() } catch { /* già finita */ } }
    note = []
  }
  const suonaMotivo = (g: GravitaAllarme) => {
    if (!ctx || !canaleAllarmi || ctx.state !== 'running') return
    const m = MOTIVI[g]
    const t0 = ctx.currentTime + 0.02
    note = []
    for (const [inizio, durata, hz] of m.note) {
      // Due parziali: una nota piena, né un fischio né un'onda quadra.
      for (const [multiplo, quanto] of [[1, 1], [2, 0.28]]) {
        const o = ctx.createOscillator()
        o.type = 'triangle'
        o.frequency.value = hz * multiplo
        const gain = ctx.createGain()
        const t = t0 + inizio
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(m.forza * quanto, t + 0.012)
        gain.gain.setValueAtTime(m.forza * quanto, t + durata - 0.04)
        gain.gain.linearRampToValueAtTime(0, t + durata)
        o.connect(gain)
        gain.connect(canaleAllarmi)
        o.start(t)
        o.stop(t + durata + 0.02)
        o.onended = () => gain.disconnect()
        note.push(o)
      }
    }
  }
  const avviaAllarme = () => {
    zittisciAllarme()
    if (!acceso || !allarme || ctx?.state !== 'running') return
    const g = allarme
    suonaMotivo(g)
    giroAllarme = window.setInterval(() => suonaMotivo(g), MOTIVI[g].ogni * 1000)
  }

  return {
    enable: () => {
      const c = costruisci()
      if (!c) return
      acceso = true
      if (battito === undefined) battito = window.setInterval(aggiorna, PASSO_SUONO_MS)
      if (c.state === 'running') avviaAllarme()
      else void c.resume().then(avviaAllarme).catch(() => { /* non ancora permesso */ })
    },
    disable: () => {
      acceso = false
      zittisciAllarme()
      for (const g of [soffio, soffioEsp]) if (ctx && g) g.gain.setTargetAtTime(0, ctx.currentTime, 0.02)
    },
    enabled: () => acceso && ctx?.state === 'running',
    setAlarm: (g) => {
      if (g === allarme) return
      allarme = g
      avviaAllarme()
    },
    setVolumi: (v) => {
      volumi = v
      if (!ctx) return
      canaleRespiro?.gain.setTargetAtTime(v.respiro, ctx.currentTime, 0.03)
      canaleAllarmi?.gain.setTargetAtTime(v.allarmi, ctx.currentTime, 0.03)
    },
    setFlusso: (f, scatti = true) => {
      leggi = f
      conScatti = scatti
    },
    dispose: () => {
      acceso = false
      zittisciAllarme()
      if (battito !== undefined) window.clearInterval(battito)
      battito = undefined
      const c = ctx
      ctx = null
      if (c) void c.close().catch(() => {})
    },
  }
}

// I volumi sono di **questo** schermo: due tablet nella stessa stanza possono averli diversi.
const CHIAVE_VOLUMI = 'ovs-volumi-ventilatore'

export function leggiVolumi(): Volumi {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE_VOLUMI) ?? 'null')
    const buono = (x: unknown): x is number => typeof x === 'number' && x >= 0 && x <= 1
    if (v && buono(v.respiro) && buono(v.allarmi)) return { respiro: v.respiro, allarmi: v.allarmi }
  } catch { /* archivio assente o rovinato */ }
  return { ...VOLUMI_INIZIALI }
}

export function scriviVolumi(v: Volumi): void {
  try { localStorage.setItem(CHIAVE_VOLUMI, JSON.stringify(v)) } catch { /* pazienza */ }
}
