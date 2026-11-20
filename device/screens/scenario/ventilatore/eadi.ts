/**
 * L'attività elettrica del diaframma (EAdi), in microvolt.
 *
 * ## Lo stesso sforzo, prima della meccanica
 *
 * Il motore ha già lo sforzo del paziente: la Pmus. L'EAdi è la stessa cosa
 * vista **un passo prima**, quando è ancora un comando nervoso che arriva al
 * muscolo, e non un segnale a parte: si ricava dallo sforzo, non da un
 * generatore suo. Il legame è un rapporto, l'**efficienza neuromeccanica**
 * (NME, cmH₂O/µV): quanta pressione fa il diaframma per ogni microvolt.
 *
 * > **EAdi(t) = EAdi tonica + Pmus⁺(t + δ) / NME**
 *
 * * La NME è del paziente e resta la sua al cambiare del supporto e del modo
 *   (Bellani, *Crit Care Med* 2013, DOI `10.1097/CCM.0b013e31827caba0`), ma
 *   varia molto da un paziente all'altro. Durante il respiro corrente sta
 *   intorno a uno; con l'occlusione si legge più alta (1,4-2,6 negli adulti
 *   neurochirurgici, Yao, *Eur J Med Res* 2024, DOI `10.1186/s40001-023-01601-w`;
 *   1,8 nei bambini in terapia intensiva contro 3,7 in sala operatoria, Crulli,
 *   *Crit Care* 2021, DOI `10.1186/s13054-021-03647-w`). È bassa nel diaframma
 *   debole e in chi non riesce a staccarsi dal ventilatore (0,38 contro 0,71,
 *   Doorduin, *Anesthesiology* 2018, DOI `10.1097/ALN.0000000000002256`) e nel
 *   torace iperinsufflato: lo stesso sforzo meccanico chiede un comando molto
 *   più grande. È il messaggio clinico: un EAdi alto è un paziente che lavora,
 *   anche quando la Paw non lo dice.
 * * `δ` è il ritardo elettromeccanico: il potenziale arriva qualche decina di
 *   millisecondi prima della forza. È il vantaggio che un trigger sul segnale
 *   nervoso ha su quello pneumatico.
 * * La parte **tonica** è l'attività che resta in espirazione: bassa
 *   nell'adulto, sale quando il polmone si chiude a fine espirazione e il
 *   diaframma «frena» per tenerlo aperto.
 *
 * ## Che cosa lo toglie
 *
 * * Il **curaro** blocca la giunzione: niente potenziale, niente forza (è la
 *   `forza` del drive, che scala già la Pmus — e quindi anche l'EAdi).
 * * La **sedazione** abbassa il comando: è il drive stesso che scende.
 * * La **lesione del frenico** spegne il diaframma ma non i muscoli
 *   accessori: la Pmus non sparisce del tutto, l'EAdi sì. È il caso in cui
 *   il paziente tira e il catetere non vede niente.
 *
 * ## Il catetere
 *
 * Il segnale lo legge un catetere nell'esofago, e il catetere può essere messo
 * male. Gli errori che si vedono al letto sono pochi e riconoscibili:
 *
 * * **troppo profondo** — il segnale cala, e può comparire un muscolo
 *   espiratorio: gli addominali che spingono fanno salire l'EAdi in
 *   espirazione;
 * * **troppo superficiale** — il cuore è vicino: l'ECG entra nel segnale,
 *   l'EAdi minima sale molto sopra il vero (è artefatto, non attività tonica)
 *   e i picchi diventano erratici;
 * * **staccato** — solo rumore: picco e minimo coincidono.
 *
 * Il device mostra il segnale così come il catetere lo legge, errori compresi:
 * riconoscerli è compito di chi guarda.
 */

import { rumore } from './caso'
import type { Fisiologia } from './fisica'

/** Dove sta il catetere, se c'è. */
export type CatetereEAdi = 'giusto' | 'profondo' | 'superficiale' | 'staccato'

export const CATETERI_EADI: CatetereEAdi[] = ['giusto', 'profondo', 'superficiale', 'staccato']

/** L'efficienza neuromeccanica del respiro corrente quando non è scritta, cmH₂O/µV. */
export const NME_NORMALE = 1
/** E dove può stare: dal diaframma esausto dell'iperinsufflato al diaframma forte. */
export const NME_MINIMA = 0.1
export const NME_MASSIMA = 3

/** Il ritardo elettromeccanico, secondi: la forza segue il potenziale. */
export const RITARDO_ELETTROMECCANICO = 0.06

/**
 * Con il frenico spento quanto della Pmus resta, fatta dagli accessori:
 * scaleni, sternocleidomastoidei, intercostali. Una parte, non tutta.
 */
export const QUOTA_ACCESSORI = 0.3

/** La lesione del frenico, da 0 (integro) a 1 (bilaterale completa). */
export function lesioneFrenico(fis: Pick<Fisiologia, 'lesioneFrenico'>): number {
  return Math.min(1, Math.max(0, fis.lesioneFrenico ?? 0))
}

/**
 * Quanto della Pmus resta con quella lesione del frenico: il diaframma che
 * rimane, più gli accessori che lavorano al posto suo.
 */
export function quotaPmusFrenico(lesione: number): number {
  return 1 - (1 - QUOTA_ACCESSORI) * Math.min(1, Math.max(0, lesione))
}

/**
 * Di quella Pmus, quanta la fa il diaframma: il resto sono gli accessori, che
 * il catetere non vede.
 */
export function quotaDiaframma(lesione: number): number {
  const l = Math.min(1, Math.max(0, lesione))
  const resta = quotaPmusFrenico(l)
  return resta > 0 ? (1 - l) / resta : 0
}

/** La NME del paziente, nei suoi limiti. */
export function nmeDi(fis: Pick<Fisiologia, 'nme'>): number {
  const n = fis.nme
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(NME_MASSIMA, Math.max(NME_MINIMA, n)) : NME_NORMALE
}

/**
 * L'attività tonica, µV: quella che resta a fine espirazione.
 *
 * Mezzo microvolt nell'adulto con il polmone aperto. Sale con il polmone che
 * si chiude a ogni espirazione (la `recluta` del motore: polmone reclutabile e
 * PEEP che non lo tiene aperto) e con le atelettasie: il diaframma frena
 * l'espirazione per non perdere volume. Senza comando, niente tono.
 */
export function eadiTonica(dereclutamento: number, atelettasia: number, comando: number): number {
  if (comando <= 0) return 0
  const d = Math.min(1, Math.max(0, dereclutamento)) + 0.5 * Math.min(1, Math.max(0, atelettasia))
  return (0.5 + 3 * Math.min(1, d)) * Math.min(1, comando)
}

/**
 * Il QRS e l'onda P, come residuo sul segnale filtrato: una punta per battito.
 * Zero fra un battito e l'altro.
 */
function residuoEcg(t: number, frequenza: number, conP: boolean): number {
  if (frequenza <= 0) return 0
  const periodo = 60 / frequenza
  const u = ((t % periodo) + periodo) % periodo
  const vicino = (c: number) => {
    let d = u - c
    if (d > periodo / 2) d -= periodo
    if (d < -periodo / 2) d += periodo
    return d
  }
  const qrs = Math.exp(-0.5 * (vicino(0) / 0.018) ** 2)
  const p = conP ? 0.35 * Math.exp(-0.5 * (vicino(-0.16) / 0.03) ** 2) : 0
  return qrs + p
}

/** Che cosa fa il catetere al segnale: guadagno, rumore, cuore, addominali, base. */
interface Lettura {
  guadagno: number
  rumore: number
  ecg: number
  conP: boolean
  addominali: number
  base: number
}

const LETTURE: Record<CatetereEAdi, Lettura> = {
  giusto: { guadagno: 1, rumore: 0.25, ecg: 0, conP: false, addominali: 0, base: 0 },
  profondo: { guadagno: 0.55, rumore: 0.8, ecg: 1.5, conP: false, addominali: 0.9, base: 1 },
  superficiale: { guadagno: 0.5, rumore: 1.6, ecg: 14, conP: true, addominali: 0, base: 7 },
  staccato: { guadagno: 0, rumore: 0.35, ecg: 0, conP: false, addominali: 0, base: 0.3 },
}

/** Quello che il segnale vero diventa, letto da quel catetere. */
export interface IngressoEAdi {
  t: number
  /** La Pmus inspiratoria (solo la parte positiva) a `t + RITARDO_ELETTROMECCANICO`, cmH₂O. */
  pmusAvanti: number
  /** La spinta espiratoria in modulo a `t`, cmH₂O: gli addominali. */
  spintaEsp: number
  tonica: number
  nme: number
  /** Del totale della Pmus, la parte del diaframma (`quotaDiaframma`). */
  diaframma: number
  catetere: CatetereEAdi
  frequenzaCardiaca: number
  seme: number
}

/** L'EAdi del diaframma, senza catetere: quella vera. µV. */
export function eadiVera(pmusAvanti: number, tonica: number, nme: number, diaframma: number): number {
  return tonica + (Math.max(0, pmusAvanti) * Math.max(0, diaframma)) / Math.max(NME_MINIMA, nme)
}

/** L'EAdi come la legge il catetere, µV, mai sotto zero. */
export function eadiLetta(x: IngressoEAdi): number {
  const l = LETTURE[x.catetere]
  const vera = eadiVera(x.pmusAvanti, x.tonica, x.nme, x.diaframma)
  // L'inviluppo del segnale filtrato non è liscio: un'increspatura del dieci
  // per cento sull'attività, e un fondo di rumore che non dipende da lei.
  const increspa = 1 + 0.1 * rumore(x.seme + 53, x.t, 9)
  const fondo = l.rumore * (0.6 + 0.4 * rumore(x.seme + 59, x.t, 23))
  let v = l.guadagno * vera * increspa + Math.max(0, fondo) + l.base
  if (l.ecg > 0) v += l.ecg * residuoEcg(x.t, x.frequenzaCardiaca, l.conP) * (0.8 + 0.2 * rumore(x.seme + 61, x.t, 2))
  if (l.addominali > 0) v += l.addominali * Math.max(0, x.spintaEsp)
  // Troppo superficiale, i picchi diventano erratici: il segnale salta di
  // atto in atto.
  if (x.catetere === 'superficiale') v *= 1 + 0.35 * rumore(x.seme + 67, x.t, 0.7)
  return Math.max(0, v)
}

/** Picco e minimo dell'EAdi in un tratto, µV. */
export interface MisuraEAdi {
  picco: number
  minimo: number
}

/**
 * Picco e minimo da una serie di campioni: il picco è il massimo, il minimo
 * è il più basso della media mobile su `finestra` campioni — come lo legge
 * chi guarda, senza farsi ingannare da un buco di un campione.
 */
export function piccoEMinimo(campioni: ArrayLike<number>, finestra = 10): MisuraEAdi | null {
  const n = campioni.length
  if (n === 0) return null
  let picco = 0
  for (let i = 0; i < n; i++) picco = Math.max(picco, campioni[i])
  const w = Math.max(1, Math.min(n, finestra))
  let somma = 0
  for (let i = 0; i < w; i++) somma += campioni[i]
  let minimo = somma / w
  for (let i = w; i < n; i++) {
    somma += campioni[i] - campioni[i - w]
    minimo = Math.min(minimo, somma / w)
  }
  return { picco, minimo }
}

/**
 * La stima della pressione che l'assistenza neurale darebbe con quel livello:
 * `PEEP + livello × (EAdi − EAdi minima)`, cmH₂O, fino al tetto. È la curva che
 * si sovrappone alla Paw mentre si ventila in un altro modo: mostra quanto
 * aiuto chiede il diaframma, atto per atto, anche negli sforzi che la macchina
 * non vede.
 */
export function pressioneStimata(eadi: number, eadiMin: number, livello: number, peep: number, tetto: number): number {
  return Math.min(tetto, peep + Math.max(0, livello) * Math.max(0, eadi - eadiMin))
}
