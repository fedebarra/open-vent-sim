/**
 * Trimmed from the Scenario Creator anestesia/modelli.ts: only what the
 * ventilator needs (MAC at 40 years and its age correction).
 */

export type AgenteAlogenato = 'sevoflurano' | 'desflurano' | 'isoflurano'

/**
 * MAC a 40 anni di Mapleson 1996 (PMID 8777094), vol%. La legge anche il
 * ventilatore (`ventilatore/gas.ts`): con due tabelle «1 MAC» sulla macchina
 * era 2,0% di sevo e il BIS scendeva sotto il plateau di Kreuer (§398).
 */
export const MAC40: Record<AgenteAlogenato, number> = { sevoflurano: 1.8, desflurano: 6.6, isoflurano: 1.17 }

/**
 * ke0 dalla fine espirazione al BIS, Kreuer 2009 (PMID 19711188): lavora
 * direttamente sull'Et misurato, come il motore, ed è per questo che si
 * preferisce al 0,48 di Mourisse (A.4, disaccordi).
 */
export const KE0_ALOGENATO: Record<AgenteAlogenato, number> = {
  sevoflurano: 0.24,
  desflurano: 0.54,
  isoflurano: 0.16,
}

/**
 * La MAC a quell'età (Mapleson: circa il 6% in meno ogni decade).
 */
export function macPerEta(agente: AgenteAlogenato, etaAnni: number): number {
  return MAC40[agente] * Math.pow(10, -0.00269 * (etaAnni - 40))
}

