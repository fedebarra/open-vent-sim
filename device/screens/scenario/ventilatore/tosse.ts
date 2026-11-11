/**
 * OVS: i tempi della tosse che in Scenario Creator stanno in `fotoreale/moti.ts` (lo schermo del paziente), qui da
 * soli: OVS non ha il paziente fotorealistico. Stessi valori e stessa sequenza degli scoppi, così ventilatore,
 * monitor e paziente vedono gli stessi colpi. In SSC `istantanea.ts` li importa da `../fotoreale/moti`.
 */

/** Il colpo sul volto, in secondi: prima l'inspirazione, poi lo scoppio. Qui serve solo `inspira`. */
export const TOSSE = { inspira: 0.25, apre: 0.14, tiene: 0.12, torna: 0.36, svanisce: 0.08 }

/**
 * §674: l'accesso di tosse: più colpi di fila, senza respiro in mezzo, ognuno un po' più debole del prima (il polmone
 * si svuota). Il primo scoppio dopo l'inspirazione (`TOSSE.inspira`), gli altri a 0,42-0,62 s l'uno dall'altro.
 * Il caso viene dal numero del colpo, così tutti gli schermi vedono gli stessi scoppi.
 */
export const ACCESSO_TOSSE = { intervallo: [0.42, 0.62], cala: 0.85, colpi: [3, 6] } as const

export function scoppiTosse(colpi: number, seme: number): number[] {
  const out = [TOSSE.inspira]
  let a = (seme * 2654435761) >>> 0
  for (let i = 1; i < Math.max(1, colpi); i++) {
    a = (Math.imul(a ^ (a >>> 15), 2246822507) + 0x6d2b79f5) >>> 0
    const r = a / 4294967296
    out.push(out[i - 1] + ACCESSO_TOSSE.intervallo[0] + (ACCESSO_TOSSE.intervallo[1] - ACCESSO_TOSSE.intervallo[0]) * r)
  }
  return out
}

/** §674: quanto è forte il colpo `i` dell'accesso, da 1 (il primo) in giù. */
export const forzaColpo = (i: number) => ACCESSO_TOSSE.cala ** i

/** §674: quanto dopo l'inizio del colpo nella regia lo vede il ventilatore, in secondi. */
export const RITARDO_TOSSE_SEC = 0.25
