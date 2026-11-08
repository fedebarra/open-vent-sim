/**
 * Le due pressioni che sul display non ci sono e che spiegano tutte le altre.
 *
 * * **Palv** — la pressione negli alveoli: quella che il ritorno elastico ci
 *   mette, meno quella che il diaframma toglie, `Palv = PEEP + V/C − Pmus`.
 *   È la stessa cosa di `Paw − R · V̇` nel modello a un compartimento, ma senza
 *   lo scalino che il cambio di fase lascia sulla Paw: in inspirazione sta sotto
 *   la Paw, in espirazione sopra, a flusso zero (le pause) coincide. È quella che fa vedere l'auto-PEEP
 *   prima di misurarla: a fine espirazione non torna alla PEEP.
 * * **Pmus** — lo sforzo del paziente, in cmH₂O: il treno spontaneo di
 *   `asincronie.ts`. Messo sotto le curve dice *quando* il paziente tira
 *   rispetto alla macchina, che è tutta la lettura delle asincronie.
 *
 * (Aggiunta di Open Vent Sim 3.1, sullo spunto delle tracce di ventsim.cc.)
 */
import { pmusc } from './asincronie'
import { polmoneOra, type StatoVentilatore } from './fisica'
import { puntoOnda } from './onde'
import { campioneMotore, motoreCopre } from './motore'

export function pressioneAlveolare(tSec: number, stato: StatoVentilatore): number {
  if (!stato.manovra && motoreCopre(stato)) return campioneMotore(tSec, polmoneOra(stato)).palv
  const p = puntoOnda(tSec, stato)
  if (stato.manovra) return p.paw
  const ora = polmoneOra(stato)
  return stato.impostazioni.peep + p.volume / Math.max(1, ora.fisiologia.compliance) - pressioneMuscolare(tSec, stato)
}

export function pressioneMuscolare(tSec: number, stato: StatoVentilatore): number {
  if (!stato.ventilando) return 0
  // Lo sforzo è del paziente: durante una pausa continua uguale.
  const senza = stato.manovra ? { ...stato, manovra: null } : stato
  if (motoreCopre(senza)) return campioneMotore(tSec, polmoneOra(senza)).pmus
  return pmusc(tSec, stato.drive, stato.sfasamentoSpontaneo ?? 0)
}

/**
 * La pressione **esofagea**: la parete toracica che si gonfia, meno lo sforzo,
 * più il battito del cuore che le sta sopra. `Pes = Pes,base + V/Ccw − Pmus`.
 *
 * (Aggiunta della 3.2, sul modello del simulatore di Piraino rivisto da
 * Bellani.) Col motore spento — il pallone, l'alto flusso — non c'è.
 */
export function pressioneEsofagea(tSec: number, stato: StatoVentilatore): number | null {
  if (!stato.ventilando) return null
  if (!stato.manovra) return motoreCopre(stato) ? campioneMotore(tSec, polmoneOra(stato)).pes : null
  // ## In pausa la Pes resta dov'era, e lo sforzo la scava
  //
  // A vie aeree chiuse il volume non cambia: la parete sta dove l'ha lasciata
  // l'ultimo istante prima della pausa, e lo sforzo la tira giù quanto tira giù
  // la Paw. È la metà esofagea del test di occlusione.
  if (stato.manovra !== 'pausa-inspiratoria' && stato.manovra !== 'pausa-espiratoria') return null
  const senza = polmoneOra({ ...stato, manovra: null })
  if (!motoreCopre(senza)) return null
  const da = stato.manovraDa ?? tSec
  const prima = campioneMotore(da, senza)
  return prima.pes + prima.pmus - campioneMotore(tSec, senza).pmus
}

/** La transpolmonare, `PL = Paw − Pes`: quello che il polmone sente davvero. */
export function pressioneTranspolmonare(tSec: number, stato: StatoVentilatore): number | null {
  if (!stato.ventilando) return null
  if (!stato.manovra) return motoreCopre(stato) ? campioneMotore(tSec, polmoneOra(stato)).pl : null
  const pes = pressioneEsofagea(tSec, stato)
  return pes === null ? null : puntoOnda(tSec, stato).paw - pes
}
