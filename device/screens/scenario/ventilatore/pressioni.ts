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

export function pressioneAlveolare(tSec: number, stato: StatoVentilatore): number {
  const p = puntoOnda(tSec, stato)
  if (stato.manovra) return p.paw
  const ora = polmoneOra(stato)
  return stato.impostazioni.peep + p.volume / Math.max(1, ora.fisiologia.compliance) - pressioneMuscolare(tSec, stato)
}

export function pressioneMuscolare(tSec: number, stato: StatoVentilatore): number {
  if (!stato.ventilando) return 0
  return pmusc(tSec, stato.drive, stato.sfasamentoSpontaneo ?? 0)
}
