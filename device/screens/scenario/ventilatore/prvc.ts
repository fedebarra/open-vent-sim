/**
 * PRVC — pressione regolata, volume controllato.
 *
 * L'atto è quello della pressione controllata; quello che cambia è chi decide
 * la pressione. La macchina parte da un atto di prova a 10 cmH₂O sopra la PEEP,
 * misura il volume che ne è uscito e corregge la pressione dell'atto dopo, al
 * massimo di 3 cmH₂O per volta, finché il corrente arriva a quello impostato.
 * È la rampa che si vede accendendo la modalità, ed è la ragione per cui la si
 * insegna: se la compliance cala la pressione **sale da sola**, e chi guarda
 * solo il volume non se ne accorge.
 *
 * (Aggiunta di Open Vent Sim 3.1; il resto del motore tratta PRVC come PC.)
 *
 * Dalla 3.2 il volume che il regolatore legge è quello **erogato dal motore**,
 * la media degli ultimi atti: se il paziente tira, l'atto porta più volume e
 * la macchina abbassa la pressione — è il PRVC che «toglie» il supporto a chi
 * ha fame d'aria, e si vede solo se il regolatore guarda gli atti veri.
 */
import { polmoneOra, tempiRespiro, volumeCorrenteAtteso, type StatoVentilatore } from './fisica'
import { statoDa, type VentIstantanea } from './istantanea'
import { attiRecenti, motoreCopre } from './motore'

/**
 * Il volume che il regolatore misura, ml: gli ultimi tre atti del motore a un
 * istante fisso (il regime, lo stesso per tutti gli schermi), o il conto
 * analitico dove il motore non c'è.
 */
function volumeMisurato(stato: StatoVentilatore): number {
  if (!motoreCopre(stato)) return volumeCorrenteAtteso(stato)
  const ultimi = attiRecenti(60, stato, 20).slice(-3)
  if (!ultimi.length) return volumeCorrenteAtteso(stato)
  return ultimi.reduce((x, a) => x + a.vti, 0) / ultimi.length
}

export const PRVC_PROVA = 10
export const PRVC_PASSO = 3
export const PRVC_MIN = 5
export const PRVC_MAX = 40

/** Un passo del regolatore: dato il volume dell'ultimo atto, la pressione del prossimo. */
export function prossimaPressione(pressione: number, volumeErogato: number, volumeObiettivo: number, compliance: number): number {
  const delta = (volumeObiettivo - volumeErogato) / Math.max(1, compliance)
  const passo = Math.max(-PRVC_PASSO, Math.min(PRVC_PASSO, delta))
  return Math.round(Math.max(PRVC_MIN, Math.min(PRVC_MAX, pressione + passo)) * 10) / 10
}

/**
 * Fa avanzare il regolatore per gli atti passati in `dtSec`.
 * Conta anche le frazioni d'atto (`prvcAtti`), perché il battito è ogni due
 * secondi e un atto ne dura cinque.
 */
export function regolaPrvc(ist: VentIstantanea, dtSec: number): VentIstantanea {
  if (ist.modalita !== 'PRVC' || !ist.ventilando || ist.manovra || dtSec <= 0) return ist
  const { Ttot } = tempiRespiro(statoDa(ist))
  let atti = (ist.prvcAtti ?? 0) + dtSec / Math.max(0.5, Ttot)
  let pressione = ist.impostazioni.pressureTarget
  while (atti >= 1) {
    const stato = polmoneOra(statoDa({ ...ist, impostazioni: { ...ist.impostazioni, pressureTarget: pressione } }))
    const prossima = prossimaPressione(pressione, volumeMisurato(stato), ist.impostazioni.volume, stato.fisiologia.compliance)
    atti -= 1
    // Arrivato: gli atti che restano non cambiano più niente, e un recupero
    // lungo non deve rifare il motore per ognuno.
    if (prossima === pressione) {
      atti = atti % 1
      break
    }
    pressione = prossima
  }
  return { ...ist, prvcAtti: atti, impostazioni: { ...ist.impostazioni, pressureTarget: pressione } }
}
