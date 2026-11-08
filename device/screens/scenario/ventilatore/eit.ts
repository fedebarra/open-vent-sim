/**
 * L'EIT: dove va l'aria dentro il torace.
 *
 * ## Perché un polmone a strati
 *
 * Il motore (`motore.ts`) ha un compartimento solo: sa quanto entra, non
 * **dove**. La tomografia a impedenza elettrica è l'immagine del dove — una
 * fetta del torace all'altezza del quinto spazio, ventrale in alto — e quello
 * che insegna sta tutto nella differenza fra davanti e dietro: a PEEP bassa il
 * polmone dorsale, schiacciato dal peso di quello sopra, è chiuso e l'aria va
 * davanti; a PEEP alta il dorsale si riapre e il ventrale si sovradistende.
 *
 * Qui il polmone è fatto di `STRATI` fette orizzontali, dalla più ventrale alla
 * più dorsale. Ogni fetta sente la pressione delle vie aeree **meno** il peso
 * di quello che ha sopra (la pressione sovrapposta, Gattinoni/Pelosi, *AJRCCM*
 * 1994): una fetta con la pressione di distensione sotto zero si chiude, una
 * troppo in alto si sovradistende. Il gradiente cresce con la reclutabilità
 * (il polmone edematoso pesa), con la parete rigida e con la Pes alta
 * dell'obeso. Non è un polmone vero: è il modello più piccolo che fa vedere le
 * tre cose che l'EIT fa vedere al letto — la distribuzione, il PEEP trial e il
 * pendelluft.
 *
 * ## Il PEEP trial
 *
 * Una discesa di PEEP da 24 a 4 a pressione motrice costante; per ogni fetta si
 * tiene la compliance migliore, e a ogni gradino la perdita rispetto alla
 * migliore si conta come **collasso** se la PEEP è sotto quella della fetta e
 * come **sovradistensione** se è sopra (Costa, *Intensive Care Med* 2009).
 * L'incrocio delle due curve è la PEEP che le bilancia. Il modello non ha
 * isteresi: la discesa e la salita danno la stessa curva, e su un paziente vero
 * non è così — è il motivo per cui il trial si fa **dopo** un reclutamento e
 * **scendendo**.
 *
 * ## Il pendelluft
 *
 * Con uno sforzo forte il diaframma tira prima le fette dorsali, e quelle si
 * prendono aria **da quelle ventrali** prima che arrivi quella del ventilatore
 * (Yoshida, *AJRCCM* 2013): il volume totale non cambia, il dorsale sale e il
 * ventrale scende. Sulla curva globale non si vede niente; sulle due regionali
 * si vede una forbice all'inizio di ogni sforzo. È uno dei meccanismi della
 * lesione da sforzo (P-SILI), e lo fa vedere solo l'EIT.
 */

import { attiRecenti, campioneMotore, motoreCopre } from './motore'
import { polmoneOra, type Fisiologia, type StatoVentilatore } from './fisica'

/** Le fette del polmone, dalla ventrale alla dorsale. */
export const STRATI = 8
/** Il lato dell'immagine, in pixel: la griglia delle macchine vere. */
export const LATO = 32

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/**
 * Il gradiente della pressione sovrapposta, cmH₂O, dalla fetta più ventrale
 * alla più dorsale.
 *
 * Tre-sei nel polmone sano; dieci-venti nell'ARDS edematoso; di più
 * con la parete rigida o con la Pes dell'obeso, che schiaccia il dorsale da
 * fuori.
 */
export function gradiente(f: Fisiologia): number {
  const r = clamp01(f.reclutabilita ?? 0)
  const pes = typeof f.pesBasale === 'number' && f.pesBasale > 5 ? (f.pesBasale - 5) * 0.6 : 0
  const parete = Math.max(0, (175 - (f.complianceParete || 175)) / 175) * 4
  return 3 + 20 * r + pes + parete
}

/** Quanta fetta è aperta a quella pressione di distensione, 0–1. */
function aperta(pDistensione: number): number {
  return 1 / (1 + Math.exp(-(pDistensione + 1) / 1.5))
}

/** Quanto la fetta rende ancora, 0–1, con quella pressione di fine inspirazione. */
function resa(pFine: number): number {
  const x = Math.max(0, (pFine - 26) / 8)
  return 1 / (1 + x * x)
}

/** La compliance tidalica di una fetta, in unità di fetta (si scala dopo). */
function complianceFetta(sopra: number, peepTotale: number, pFine: number): number {
  const ee = aperta(peepTotale - sopra)
  const ei = aperta(pFine - sopra)
  // Il tessuto aperto a fine espirazione rende quanto la sovradistensione gli
  // lascia; quello che si apre durante l'atto rende meno — si apre tardi, e si
  // richiude a ogni espirio (il reclutamento tidalico).
  return ee * resa(pFine - sopra) + Math.max(0, ei - ee) * 0.4
}

/** La pressione sovrapposta della fetta `i`. */
function sopraDi(G: number, i: number): number {
  return G * ((i + 0.5) / STRATI)
}

export interface Regioni {
  /** La quota del corrente che va a ogni fetta, somma 1. */
  quote: number[]
  /** Quanto di ogni fetta è aperto a fine espirazione, 0–1. */
  aperte: number[]
  /** Il centro della ventilazione, % dal ventrale (0) al dorsale (100). */
  centro: number
  /** Quota del corrente nella metà ventrale, %. */
  ventrale: number
}

/** Dove va il corrente, a questa PEEP totale e con questa pressione di fine inspirazione. */
export function regioni(f: Fisiologia, peepTotale: number, pFine: number): Regioni {
  const G = gradiente(f)
  const c = Array.from({ length: STRATI }, (_, i) => complianceFetta(sopraDi(G, i), peepTotale, pFine))
  const somma = c.reduce((a, b) => a + b, 0) || 1
  const quote = c.map((x) => x / somma)
  const centro = quote.reduce((a, q, i) => a + q * ((i + 0.5) / STRATI), 0) * 100
  const ventrale = quote.slice(0, STRATI / 2).reduce((a, b) => a + b, 0) * 100
  return { quote, aperte: Array.from({ length: STRATI }, (_, i) => aperta(peepTotale - sopraDi(G, i))), centro, ventrale }
}

export interface PassoPeep {
  peep: number
  /** La compliance globale a quel gradino, ml/cmH₂O. */
  compliance: number
  /** Collasso e sovradistensione, % (Costa 2009). */
  collasso: number
  sovradistensione: number
}

export interface ProvaPeep {
  passi: PassoPeep[]
  /** La PEEP dove le due curve si incrociano, interpolata; null se non si incrociano. */
  incrocio: number | null
  /** La PEEP con la compliance globale più alta. */
  miglioreCompliance: number
  motrice: number
}

/**
 * La discesa di PEEP, a pressione motrice costante.
 *
 * La compliance assoluta si tara sul paziente: alla PEEP di riferimento (5) e
 * con questa pressione motrice la somma delle fette vale la compliance
 * dichiarata, così i numeri del trial stanno nella scala dei numeri del display.
 */
export function provaPeep(f: Fisiologia, motrice = 12, da = 24, a = 4, passo = 2): ProvaPeep {
  const G = gradiente(f)
  const peeps: number[] = []
  for (let p = da; p >= a - 1e-9; p -= passo) peeps.push(p)
  const fette = (p: number) => Array.from({ length: STRATI }, (_, i) => complianceFetta(sopraDi(G, i), p, p + motrice))
  const rif = fette(5).reduce((x, y) => x + y, 0) || 1
  const scala = Math.max(1, f.compliance) / rif
  const tabella = peeps.map((p) => fette(p).map((c) => c * scala))
  const migliori = Array.from({ length: STRATI }, (_, i) => {
    let best = 0
    let dove = peeps[0]
    tabella.forEach((riga, k) => {
      if (riga[i] > best + 1e-9) {
        best = riga[i]
        dove = peeps[k]
      }
    })
    return { best, dove }
  })
  const totaleMigliore = migliori.reduce((x, m) => x + m.best, 0) || 1
  const passi: PassoPeep[] = tabella.map((riga, k) => {
    const p = peeps[k]
    let coll = 0
    let sovra = 0
    riga.forEach((c, i) => {
      const perso = Math.max(0, migliori[i].best - c)
      if (p < migliori[i].dove) coll += perso
      else if (p > migliori[i].dove) sovra += perso
    })
    return {
      peep: p,
      compliance: Math.round(riga.reduce((x, y) => x + y, 0) * 10) / 10,
      collasso: Math.round((coll / totaleMigliore) * 1000) / 10,
      sovradistensione: Math.round((sovra / totaleMigliore) * 1000) / 10,
    }
  })
  // ## L'incrocio
  //
  // Dove le due curve si tagliano, interpolato fra i due gradini. Ma sotto
  // l'uno per cento tutt'e due sono rumore, e su un polmone che ha un tratto
  // largo senza né collasso né sovradistensione il primo decimo di collasso
  // deciderebbe l'incrocio a caso: lì l'incrocio è il **mezzo del tratto
  // pulito**, che è come lo legge chi guarda il grafico.
  const SOGLIA = 1
  let incrocio: number | null = null
  const ultimoSovra = passi.reduce((p, x) => (x.sovradistensione >= SOGLIA ? x.peep : p), Number.NaN)
  const primoColl = passi.find((x) => x.collasso >= SOGLIA)?.peep ?? Number.NaN
  const pulitiDa = Number.isNaN(ultimoSovra) ? da : ultimoSovra - passo
  const pulitiA = Number.isNaN(primoColl) ? a : primoColl + passo
  if (pulitiDa - pulitiA >= passo - 1e-9) {
    incrocio = Math.round(((pulitiDa + pulitiA) / 2) * 10) / 10
  } else {
    for (let k = 1; k < passi.length; k++) {
      const d0 = passi[k - 1].collasso - passi[k - 1].sovradistensione
      const d1 = passi[k].collasso - passi[k].sovradistensione
      if (d0 <= 0 && d1 > 0) {
        const u = d0 === d1 ? 0 : -d0 / (d1 - d0)
        incrocio = Math.round((passi[k - 1].peep + (passi[k].peep - passi[k - 1].peep) * u) * 10) / 10
        break
      }
    }
  }
  const migliore = passi.reduce((m, x) => (x.compliance > m.compliance ? x : m), passi[0])
  return { passi, incrocio, miglioreCompliance: migliore.peep, motrice }
}

// ## L'immagine

/**
 * La maschera del torace: due polmoni ellittici, il destro a sinistra
 * nell'immagine (si guarda dai piedi, come la TC), il cuore che scava il
 * sinistro davanti. Per ogni pixel, quanto c'è di polmone (0–1) e a quale
 * fetta appartiene.
 */
interface Pixel {
  peso: number
  fetta: number
}

let MASCHERA: Pixel[] | null = null

export function maschera(): Pixel[] {
  if (MASCHERA) return MASCHERA
  const out: Pixel[] = []
  const alto = 5
  const basso = 28
  for (let y = 0; y < LATO; y++) {
    for (let x = 0; x < LATO; x++) {
      const cx = x + 0.5
      const cy = y + 0.5
      const destro = ((cx - 10) / 7) ** 2 + ((cy - 16.5) / 11) ** 2
      const sinistro = ((cx - 22) / 7) ** 2 + ((cy - 16.5) / 11) ** 2
      const cuore = ((cx - 19) / 5) ** 2 + ((cy - 10) / 4.5) ** 2
      let peso = 0
      if (destro < 1) peso = 1 - destro * 0.3
      else if (sinistro < 1 && cuore > 1) peso = 1 - sinistro * 0.3
      const fetta = Math.min(STRATI - 1, Math.max(0, Math.floor(((cy - alto) / (basso - alto)) * STRATI)))
      out.push({ peso, fetta })
    }
  }
  MASCHERA = out
  return out
}

/** L'immagine tidalica: per pixel, la quota del corrente (0–1, normalizzata al massimo). */
export function immagineTidal(reg: Regioni): Float32Array {
  const m = maschera()
  const pixelPerFetta = new Array(STRATI).fill(0)
  for (const p of m) if (p.peso > 0) pixelPerFetta[p.fetta] += p.peso
  const out = new Float32Array(LATO * LATO)
  let max = 0
  m.forEach((p, k) => {
    if (p.peso <= 0) return
    const v = (reg.quote[p.fetta] / Math.max(1e-6, pixelPerFetta[p.fetta])) * p.peso
    out[k] = v
    max = Math.max(max, v)
  })
  if (max > 0) for (let k = 0; k < out.length; k++) out[k] /= max
  return out
}

// ## Le curve regionali, dal motore

export interface IstanteEit {
  /** ΔZ globale, in ml equivalenti. */
  globale: number
  ventrale: number
  dorsale: number
  /** Quanto, di questo istante, è pendelluft: ml spostati da davanti a dietro. */
  pendelluft: number
}

/** Il quadro regionale di adesso: l'ultimo atto del motore dice PEEP totale e plateau. */
export function quadroEit(tSec: number, stato: StatoVentilatore): { regioni: Regioni; vt: number; pendelluft: number } | null {
  const ora = polmoneOra({ ...stato, manovra: null })
  if (!motoreCopre(ora)) return null
  const ultimo = attiRecenti(tSec, ora, 20).at(-1)
  const peepTot = ultimo ? ultimo.peepTotale : ora.impostazioni.peep
  const pFine = ultimo ? ultimo.palvFineInsp : ora.impostazioni.peep + 10
  const reg = regioni(ora.fisiologia, peepTot, pFine)
  const vt = ultimo ? Math.max(50, ultimo.vti) : 400
  return { regioni: reg, vt, pendelluft: ampiezzaPendelluft(ora, vt) }
}

/**
 * Quanto volume il pendelluft sposta al picco di uno sforzo, ml.
 *
 * Serve uno sforzo vero (sopra 4-5 cmH₂O) e un polmone disomogeneo — è la
 * differenza fra davanti e dietro a farlo; nel polmone sano a sforzo normale
 * resta sotto la soglia del vedere.
 */
function ampiezzaPendelluft(stato: StatoVentilatore, vt: number): number {
  const d = stato.drive
  if ((d.frequenza ?? 0) <= 0 || (d.intensita ?? 0) <= 0) return 0
  const forza = Math.min(1, Math.max(0, d.forza ?? 1))
  const sforzo = d.intensita * 10 * forza
  const disomogeneo = clamp01((gradiente(stato.fisiologia) - 3) / 15)
  return 0.25 * vt * disomogeneo * clamp01((sforzo - 4) / 6)
}

/** Le tre curve dell'EIT a `tSec`: globale, ventrale e dorsale. */
export function istanteEit(
  tSec: number,
  stato: StatoVentilatore,
  quadro: { regioni: Regioni; vt: number; pendelluft: number },
): IstanteEit {
  const ora = polmoneOra({ ...stato, manovra: null })
  const c = campioneMotore(tSec, ora)
  const volume = Math.max(0, c.vPolmone)
  const v = quadro.regioni.ventrale / 100
  // Il pendelluft vive mentre lo sforzo sale e il ventilatore non ha ancora
  // portato niente: si scioglie quando arriva il flusso della macchina.
  const sforzo = Math.max(0, c.pmus) / 10
  const arrivato = Math.min(1, Math.max(0, c.volume) / Math.max(50, quadro.vt * 0.5))
  const pend = quadro.pendelluft * Math.min(1, sforzo * 1.5) * (1 - arrivato)
  return { globale: volume, ventrale: volume * v - pend, dorsale: volume * (1 - v) + pend, pendelluft: pend }
}
