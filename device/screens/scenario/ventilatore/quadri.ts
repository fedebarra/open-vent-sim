/**
 * I quadri della meccanica: le cose del paziente che non sono un polmone.
 *
 * `PRESET_FISIOLOGIA` sceglie il polmone — «questo è un ARDS» — e
 * `PRESET_ASINCRONIA` il disaccordo con la macchina. Qui sta quello che resta,
 * e che il simulatore di Piraino (sim.rtmaven.com) mette su un pulsante: la
 * parete che pesa, le vie aeree che si chiudono, lo sforzo che strappa, il
 * respiro che non è mai uguale, il cuore che batte sul flusso. Ognuno **si
 * somma** a quello che c'è: un ARDS obeso è un ARDS con la parete dell'obeso,
 * non un altro paziente.
 *
 * Ogni quadro tocca soltanto i suoi campi, e «togli» li rimette a riposo
 * (`QUADRO_A_RIPOSO`): un pulsante che lascia in giro un pezzo di quadro che
 * non si vede più è un pulsante che inganna chi conduce.
 */

import type { Drive } from './asincronie'
import type { Fisiologia } from './fisica'

export type QuadroMeccanica =
  | 'obesita'
  | 'addome-teso'
  | 'chiusura-vie'
  | 'sforzo-vigoroso'
  | 'respiro-irregolare'
  | 'oscillazioni-cardiache'
  | 'grugnito'
  | 'espirio-attivo'

export interface Quadro {
  fisiologia?: Partial<Omit<Fisiologia, 'preset'>>
  drive?: Partial<Drive>
}

export const QUADRI_MECCANICA: Record<QuadroMeccanica, Quadro> = {
  // La parete pesa: la Pes a fine espirazione sta a quindici-venti e la PL
  // espiratoria va negativa — il polmone si chiude sotto il suo peso. Le vie
  // aeree si chiudono anche loro (Chen 2018 le trova soprattutto qui).
  obesita: { fisiologia: { complianceParete: 70, pesBasale: 16, aperturaVie: 9 } },
  // L'ipertensione addominale: parete rigida, Pes alta, niente chiusura.
  'addome-teso': { fisiologia: { complianceParete: 45, pesBasale: 18 } },
  // L'ARDS con le vie aeree chiuse: sotto i dodici il polmone è isolato.
  'chiusura-vie': { fisiologia: { aperturaVie: 12 } },
  // Il paziente che strappa: salita corta, Pmus alta, P0.1 sopra 4. È il
  // malato a rischio di P-SILI che in PS sembra stare bene.
  'sforzo-vigoroso': {
    drive: { frequenza: 28, intensita: 1, forma: { salita: 0.35, tenuta: 0.05, discesa: 0.35 } },
  },
  'respiro-irregolare': { drive: { variabilita: 0.8 } },
  // Il cuore sul flusso: con un trigger a 1 l/min fa partire atti da solo.
  'oscillazioni-cardiache': { fisiologia: { oscillazioniCardiache: 0.6 } },
  // La glottide che trattiene: l'espirio frenato, la PEEP fatta da sé.
  grugnito: { fisiologia: { sforzoEspiratorio: 0.7 } },
  // Gli addominali che spingono fuori l'aria.
  'espirio-attivo': { drive: { espirioAttivo: 0.7 } },
}

/** Quanto vale ogni campo quando nessun quadro lo tocca. */
export const QUADRO_A_RIPOSO: Required<Quadro> = {
  fisiologia: {
    complianceParete: 175,
    pesBasale: 0,
    aperturaVie: 0,
    oscillazioniCardiache: 0,
    sforzoEspiratorio: 0,
  },
  // `null` e non `undefined`: il comando passa in rete come JSON, e un campo
  // `undefined` sparirebbe per strada lasciando la forma di prima.
  drive: { forma: null, variabilita: 0, espirioAttivo: 0 },
}

/** Il quadro applicato: si somma a quello che c'è. */
export function conQuadro<T extends { fisiologia: Fisiologia; drive: Drive }>(v: T, q: QuadroMeccanica): T {
  const quadro = QUADRI_MECCANICA[q]
  return {
    ...v,
    fisiologia: { ...v.fisiologia, ...(quadro.fisiologia ?? {}) },
    drive: { ...v.drive, ...(quadro.drive ?? {}) },
  }
}

/** Il quadro tolto: i suoi campi tornano a riposo, il resto non si tocca. */
export function senzaQuadro<T extends { fisiologia: Fisiologia; drive: Drive }>(v: T, q: QuadroMeccanica): T {
  const quadro = QUADRI_MECCANICA[q]
  const fis: Record<string, unknown> = { ...v.fisiologia }
  for (const k of Object.keys(quadro.fisiologia ?? {})) fis[k] = (QUADRO_A_RIPOSO.fisiologia as Record<string, unknown>)[k]
  const drive: Record<string, unknown> = { ...v.drive }
  for (const k of Object.keys(quadro.drive ?? {})) {
    // Frequenza e intensità sono del drive, non del quadro: restano.
    if (k === 'frequenza' || k === 'intensita') continue
    drive[k] = (QUADRO_A_RIPOSO.drive as Record<string, unknown>)[k]
  }
  return { ...v, fisiologia: fis as unknown as Fisiologia, drive: drive as unknown as Drive }
}

/** Se il quadro è acceso adesso: tutti i suoi campi hanno il valore del quadro. */
export function quadroAcceso(v: { fisiologia: Fisiologia; drive: Drive }, q: QuadroMeccanica): boolean {
  const quadro = QUADRI_MECCANICA[q]
  const uguale = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  for (const [k, val] of Object.entries(quadro.fisiologia ?? {})) {
    if (!uguale((v.fisiologia as unknown as Record<string, unknown>)[k], val)) return false
  }
  for (const [k, val] of Object.entries(quadro.drive ?? {})) {
    if (k === 'frequenza' || k === 'intensita') continue
    if (!uguale((v.drive as unknown as Record<string, unknown>)[k], val)) return false
  }
  return true
}
