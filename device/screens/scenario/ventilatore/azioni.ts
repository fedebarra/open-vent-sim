/**
 * Che cosa si può **fare** a questo apparecchio, detto una volta sola.
 *
 * ## Perché un vocabolario, e perché sta qui
 *
 * Un'azione dei discenti attraversa quattro anelli: il dito sul vetro, il
 * messaggio che sale nel canale, la regia che la applica riscrivendo
 * l'istantanea, il registro che la annota. Se ogni anello si inventa il proprio
 * nome, il tocco parte, si registra, e non cambia niente — e non se ne accorge
 * nessuno, perché ogni pezzo funziona.
 *
 * Quindi il nome dell'azione si scrive **qui**, e lo importano tutti e quattro:
 * il componente che la emette (§A2), il canale che la trasporta e la regia che
 * la esegue (§A3), il registro che la scrive. Aggiungerne una senza toccare
 * questo file non si può.
 *
 * ## Il componente non applica niente
 *
 * `<Ventilatore>` emette e basta: non tocca lo stato, non muove un parametro,
 * non silenzia un allarme. La regia è l'unico produttore dell'istantanea
 * (§118), e un device che si aggiustasse da solo mostrerebbe una macchina
 * diversa da quella che vede chi conduce — che è il difetto che quella regola
 * esiste per impedire.
 */

import type { ChiaveAllarme } from './allarmi'
import type { Manovra } from './fisica'
import type { Agente, Consumabile } from './gas'
import type { Circuito } from '../../paziente/presidiFigura'
import type {
  ChiaveImpostazione,
  InterfacciaAltoFlusso,
  Modalita,
  Respiro,
} from './parametri'

export type AzioneVentilatore =
  /** Il selettore di modalità. */
  | { tipo: 'modalita'; modalita: Modalita }
  /** Pallone o meccanica: esiste solo in anestesia. */
  | { tipo: 'respiro'; respiro: Respiro }
  /** Avvia o metti in standby. */
  | { tipo: 'standby'; ventilando: boolean }
  /** Una manopola girata. Il valore è già dentro gli estremi. */
  | { tipo: 'parametro'; chiave: ChiaveImpostazione; valore: number | string }
  /** Il tasto del silenzio: due minuti. */
  | { tipo: 'silenzia' }
  /** L'autotest completato. I passaggi li anima il device; il fatto viaggia. */
  | { tipo: 'autotest' }
  /** Una pausa tenuta, o lasciata. */
  | { tipo: 'manovra'; manovra: Manovra }
  /** Un vaporizzatore montato o tolto dal carrello. */
  | { tipo: 'gas-agente'; agente: Agente; monta: boolean }
  /** L'erogazione dell'agente, che è anche metà dell'interlock. */
  | { tipo: 'gas-erogazione'; erogazione: boolean }
  /** Il flush d'ossigeno: trenta secondi al cento per cento. */
  | { tipo: 'gas-flush' }
  /**
   * Riempi una cartuccia o cambia il canister.
   *
   * Non porta con sé se i gas erano aperti: quello lo sa la regia, che ha lo
   * stato vero, e sarebbe il device a poterlo dire sbagliato. Il device chiede
   * e basta — è la stessa ragione per cui non si manda mai un diff.
   */
  | { tipo: 'riempi'; consumabile: Consumabile }
  /** Un limite d'allarme spostato di un passo. */
  | { tipo: 'limite'; chiave: ChiaveAllarme; estremo: 'basso' | 'alto'; verso: 1 | -1 }
  /** Un allarme acceso o spento. */
  | { tipo: 'allarme'; chiave: ChiaveAllarme; acceso: boolean }
  /**
   * Tutti i limiti riportati a quelli con cui la macchina si accende (OVS 3.3): la regia lo
   * chiede quando un gruppo ha spostato tutto e il caso deve ripartire da un apparecchio pulito.
   */
  | { tipo: 'limiti-iniziali' }
  /** L'interfaccia dell'alto flusso: adulto, pediatrica, junior. */
  | { tipo: 'interfaccia'; interfaccia: InterfacciaAltoFlusso }
  /** L'umidificatore acceso o spento. */
  | { tipo: 'umidificatore'; acceso: boolean }
  /** La potenza dell'umidificatore, da 1 a 5. */
  | { tipo: 'potenza'; potenza: number }
  /**
   * Il ciclo di disinfezione dell'alto flusso, completato.
   *
   * Come l'autotest: i passaggi li anima il device, e qui viaggia **il fatto**.
   * Un apparecchio che passa da un paziente all'altro si disinfetta, e finché
   * quello stato non si poteva cambiare era una scritta che non serviva a
   * niente.
   */
  | { tipo: 'disinfezione' }
  /** Il circuito montato (§602): solo in standby, e l'autotest torna da rifare. */
  | { tipo: 'circuito'; circuito: Circuito }

/** Il nome con cui l'azione finisce nel registro. */
export function nomeAzione(azione: AzioneVentilatore): string {
  switch (azione.tipo) {
    case 'parametro':
      return `vent-parametro:${azione.chiave}`
    case 'modalita':
      return `vent-modalita:${azione.modalita}`
    case 'respiro':
      return `vent-respiro:${azione.respiro}`
    case 'standby':
      return azione.ventilando ? 'vent-avvia' : 'vent-standby'
    case 'autotest':
      return 'vent-autotest'
    case 'manovra':
      return azione.manovra ? `vent-manovra:${azione.manovra}` : 'vent-manovra-fine'
    case 'gas-agente':
      return `vent-gas-agente:${azione.agente}`
    case 'gas-erogazione':
      return 'vent-gas-erogazione'
    case 'gas-flush':
      return 'vent-gas-flush'
    case 'riempi':
      return azione.consumabile.cosa === 'calce'
        ? 'vent-riempi:calce'
        : `vent-riempi:${azione.consumabile.agente}`
    case 'limite':
      return `vent-limite:${azione.chiave}`
    case 'allarme':
      return `vent-allarme:${azione.chiave}`
    case 'limiti-iniziali':
      return 'vent-limiti-iniziali'
    case 'interfaccia':
      return `vent-interfaccia:${azione.interfaccia}`
    case 'silenzia':
      return 'vent-silenzia'
    case 'umidificatore':
      return azione.acceso ? 'vent-umidificatore-on' : 'vent-umidificatore-off'
    case 'potenza':
      return `vent-potenza:${azione.potenza}`
    case 'disinfezione':
      return 'vent-disinfezione'
    case 'circuito':
      return `vent-circuito:${azione.circuito}`
  }
}
