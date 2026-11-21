/**
 * Il catetere dell'EAdi, in centimetri: dove sta, dove dovrebbe stare, e che
 * cosa leggono i suoi elettrodi.
 *
 * ## La profondità di partenza
 *
 * Si misura la distanza naso–lobo dell'orecchio–xifoide (NEX) e la si
 * moltiplica per 0,9 se il catetere passa dal naso, per 0,8 se passa dalla
 * bocca; si aggiunge una costante che dipende dal calibro. È una regola
 * anatomica: porta gli elettrodi all'altezza del diaframma.
 *
 * ## Gli elettrodi
 *
 * Il catetere porta una fila di elettrodi a distanza fissa (la distanza
 * interelettrodica, `ied`); fra un elettrodo e l'altro si legge una
 * derivazione. Qui le derivazioni sono quattro, dalla più alta (verso la bocca)
 * alla più bassa (verso lo stomaco). Due cose cambiano lungo la fila:
 *
 * * **il cuore** sta sopra il diaframma: in alto l'ECG ha onde P e QRS grandi;
 *   scendendo le P spariscono e il QRS cala;
 * * **il diaframma** si legge dove gli elettrodi lo attraversano: la sua
 *   attività è più forte nelle derivazioni che gli stanno a cavallo.
 *
 * Se l'attività sta nelle derivazioni di mezzo il catetere è a posto. Se sta in
 * alto il catetere è entrato troppo (il diaframma è salito verso la bocca,
 * rispetto alla fila): si tira fuori, un passo interelettrodico alla volta. Se
 * sta in basso si spinge dentro. Mai più di quattro passi: oltre, la misura di
 * partenza era sbagliata.
 */

import type { CatetereEAdi } from './eadi'

export type ViaCatetere = 'nasale' | 'orale'

/** Il calibro del catetere: la costante della regola e la distanza fra gli elettrodi, cm. */
export interface Calibro {
  nome: string
  costante: number
  ied: number
}

/** I calibri dall'adulto al bambino (il neonato è fuori portata). */
export const CALIBRI: Calibro[] = [
  { nome: '16 Fr', costante: 18, ied: 1.6 },
  { nome: '12 Fr', costante: 15, ied: 1.2 },
  { nome: '8 Fr', costante: 8, ied: 0.8 },
]

/** Il calibro che si monta a quel peso. */
export function calibroPerPeso(pesoKg: number | null | undefined): Calibro {
  const kg = pesoKg ?? 70
  if (kg >= 30) return CALIBRI[0]
  if (kg >= 12) return CALIBRI[1]
  return CALIBRI[2]
}

/** La NEX di un paziente di quel peso quando la regia non l'ha scritta, cm. */
export function nexPerPeso(pesoKg: number | null | undefined): number {
  const kg = Math.max(3, pesoKg ?? 70)
  // Cresce con la taglia e si ferma nell'adulto: 50 cm a 70 kg, 30 a 12 kg.
  return Math.round(Math.min(56, 18 + 7.6 * Math.log(kg)))
}

/** La profondità di inserzione dalla NEX: la regola. cm. */
export function profonditaCalcolata(nex: number, via: ViaCatetere, calibro: Calibro): number {
  return Math.round((nex * (via === 'nasale' ? 0.9 : 0.8) + calibro.costante) * 10) / 10
}

/** Fino a quanto il catetere si può spingere o tirare, cm. */
export const PROFONDITA_MINIMA = 10
export const PROFONDITA_MASSIMA = 90

/**
 * Quanto è fuori posto, in passi interelettrodici: positivo troppo dentro,
 * negativo troppo fuori.
 */
export function scarto(cm: number, giusta: number, calibro: Calibro): number {
  return (cm - giusta) / calibro.ied
}

/**
 * Come legge il catetere a quella profondità. A un passo dal giusto legge
 * bene; oltre, troppo profondo o troppo superficiale; oltre cinque passi gli
 * elettrodi non vedono più il diaframma.
 */
export function letturaDaProfondita(cm: number, giusta: number, calibro: Calibro): Exclude<CatetereEAdi, never> {
  const s = scarto(cm, giusta, calibro)
  if (Math.abs(s) > 5) return 'staccato'
  if (s > 1) return 'profondo'
  if (s < -1) return 'superficiale'
  return 'giusto'
}

/** Dove la regia mette il catetere quando sceglie un errore di partenza: scarto in passi. */
export const SCARTO_DI_PARTENZA: Record<'giusto' | 'profondo' | 'superficiale', number> = {
  giusto: 0,
  profondo: 3,
  superficiale: -3,
}

/** Una derivazione: quanto pesa il diaframma, quanto sono grandi P e QRS (0-1). */
export interface Derivazione {
  diaframma: number
  p: number
  qrs: number
}

/**
 * Le quattro derivazioni, dall'alta alla bassa, a quella profondità.
 *
 * La derivazione `i` sta a `(i − 1,5)` passi dal centro della fila; il
 * diaframma sta alla profondità giusta. Con il catetere troppo dentro il centro
 * della fila è sotto il diaframma, e il diaframma cade sulle derivazioni alte.
 */
export function derivazioni(cm: number, giusta: number, calibro: Calibro): Derivazione[] {
  const s = scarto(cm, giusta, calibro)
  return [0, 1, 2, 3].map((i) => {
    // Dove sta il diaframma rispetto a questa derivazione, in passi: zero, ci sta sopra.
    const d = i - 1.5 + s
    const diaframma = Math.exp(-0.5 * (d / 0.9) ** 2)
    // Quanto è in alto la derivazione rispetto al diaframma, in passi (positivo: sopra).
    const sopra = -d
    const p = Math.min(1, Math.max(0, 0.15 + 0.3 * sopra))
    const qrs = Math.min(1, Math.max(0.15, 0.55 + 0.15 * sopra))
    return { diaframma, p, qrs }
  })
}

/** Le due derivazioni dove il diaframma si legge di più: quelle che si evidenziano. */
export function derivazioniForti(dv: Derivazione[]): number[] {
  return dv
    .map((x, i) => ({ i, w: x.diaframma }))
    .filter((x) => x.w > 0.2)
    .sort((a, b) => b.w - a.w)
    .slice(0, 2)
    .map((x) => x.i)
    .sort((a, b) => a - b)
}

/** Quanto sfila il catetere che la regia «stacca»: oltre i cinque passi, il diaframma non si vede. */
export const SCARTO_SFILATO = -7

/** La profondità giusta per quel paziente, per la via da cui è passato il catetere. cm. */
export function profonditaGiusta(
  fis: { nexCm?: number; catetereVia?: ViaCatetere },
  pesoKg: number | null | undefined,
): number {
  const nex = typeof fis.nexCm === 'number' && fis.nexCm > 0 ? fis.nexCm : nexPerPeso(pesoKg)
  return profonditaCalcolata(nex, fis.catetereVia ?? 'nasale', calibroPerPeso(pesoKg))
}

/**
 * Il catetere a quella profondità: i due campi da scrivere nella fisiologia,
 * la profondità e la lettura che ne viene. Chiunque lo muova — la regia o il
 * discente — passa da qui.
 */
export function catetereA(
  cm: number,
  fis: { nexCm?: number; catetereVia?: ViaCatetere },
  pesoKg: number | null | undefined,
): { catetereCm: number; catetereEAdi: CatetereEAdi } {
  const c = Math.round(Math.min(PROFONDITA_MASSIMA, Math.max(PROFONDITA_MINIMA, cm)) * 10) / 10
  return { catetereCm: c, catetereEAdi: letturaDaProfondita(c, profonditaGiusta(fis, pesoKg), calibroPerPeso(pesoKg)) }
}

/** Dove la regia mette il catetere quando sceglie come montarlo. */
export function catetereMontato(
  come: CatetereEAdi,
  fis: { nexCm?: number; catetereVia?: ViaCatetere },
  pesoKg: number | null | undefined,
): { catetereCm: number; catetereEAdi: CatetereEAdi } {
  const passi = come === 'staccato' ? SCARTO_SFILATO : SCARTO_DI_PARTENZA[come]
  return catetereA(profonditaGiusta(fis, pesoKg) + passi * calibroPerPeso(pesoKg).ied, fis, pesoKg)
}
