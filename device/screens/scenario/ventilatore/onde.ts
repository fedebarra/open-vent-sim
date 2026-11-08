/**
 * Le tre curve: pressione, flusso, volume.
 *
 * ## Una funzione del tempo, come le sorgenti del monitor
 *
 * Si chiede `puntoOnda(t)` e si ottengono i tre valori a quell'istante. Nessuno
 * stato interno, nessun accumulo, nessun `Math.random()`: la stessa `t` dà lo
 * stesso punto, sempre. È la forma che hanno già le sorgenti del monitor
 * (`sources.ts`), ed è quella che permette a `npm run prove` di contare i
 * cicli, misurare le ampiezze e accorgersi che una curva è sparita — cosa che
 * guardando lo schermo non si distingue da «sta andando piano».
 *
 * Le tre curve escono **insieme**. Il simulatore d'origine chiamava il
 * generatore una volta per curva, e siccome il rumore era casuale, la pressione
 * e il flusso raccontavano due respiri diversi: sul paziente vero è la stessa
 * aria nello stesso tubo, e quando gorgoglia gorgogliano tutte e due.
 *
 * ## Chi cicla la macchina
 *
 * In VC, PC e SIMV la cadenza è quella impostata. In PS e CPAP la detta il
 * paziente: il ciclo macchina **è** il ciclo spontaneo, e senza drive entra la
 * frequenza di backup. Da questa scelta discende tutto il resto — le asincronie
 * sono quello che si vede quando i due treni non coincidono, e in PS un treno
 * solo c'è.
 *
 * ## Lo sforzo che non fa partire niente
 *
 * Quando il paziente ha un drive e la macchina tiene la sua cadenza, gli sforzi
 * che cadono in espirazione lasciano una **tacca** su flusso e pressione senza
 * far partire un atto. Succede anche senza che nessuno abbia chiesto
 * un'asincronia dalla regia, ed è giusto così: un paziente che respira sotto un
 * volume controllato è asincrono per costruzione. Le impostazioni della regia
 * (`asincronia`) scelgono quale figura mettere sopra a una quota degli atti, e
 * di quanto marcarla.
 */

import { attiRecenti, campioneMotore, curvaLenta, motoreCopre } from './motore'
import { MISURE_VUOTE, assistito } from './parametri'
import { rumore } from './caso'
import {
  driveEfficace,
  pmusc,
  PMUSC_MASSIMA,
} from './asincronie'
import {
  RECLUTAMENTO_PRESSIONE,
  costanteTempo,
  esitoManovra,
  polmoneOra,
  secrezioniEfficaci,
  tempiRespiro,
  trasmissioneToracica,
  volumeCorrenteAtteso,
  type StatoVentilatore,
} from './fisica'

/** Un istante di tutte e tre le curve. Volume in ml, flusso in l/min, Paw in cmH₂O. */
export interface PuntoOnda {
  paw: number
  flusso: number
  volume: number
}

const FERMO: PuntoOnda = { paw: 0, flusso: 0, volume: 0 }

/**
 * Il punto delle tre curve a `tSec`.
 *
 * `tSec` è il tempo del ventilatore — quello che scorre da quando è stato
 * acceso — e non l'ora del giorno: due schermi che disegnano lo stesso
 * apparecchio partono dallo stesso zero e disegnano la stessa cosa.
 */
export function puntoOnda(tSec: number, stato: StatoVentilatore): PuntoOnda {
  if (!stato.ventilando) return FERMO
  if (stato.ambiente === 'alto-flusso') return FERMO

  // **Il polmone com'è a questa PEEP.** La curva e i numeri del display devono
  // dire la stessa cosa, e da quando la compliance dipende dalla PEEP
  // (`complianceA`) l'unico modo è risolverla qui, una volta, in cima: tutto
  // quello che riceve `stato` più sotto la trova già sistemata.
  stato = polmoneOra(stato)

  if (stato.manovra) return inPausa(stato, tSec)
  if (stato.ambiente === 'anestesia' && stato.respiro === 'manuale') return aPallone(tSec, stato)

  // **Dalla 3.2 le curve le fa il motore** (`motore.ts`): l'equazione del moto
  // integrata, con lo sforzo del paziente dentro. Quello che resta qui sotto
  // sono le manovre tenute e il pallone, che di un integratore non hanno
  // bisogno.
  if (motoreCopre(stato)) {
    const c = campioneMotore(tSec, stato)
    return conRumore({ paw: c.paw, flusso: c.flusso, volume: c.volume }, tSec, stato)
  }
  return FERMO
}

/**
 * Le tre curve come funzioni separate, per chi disegna.
 *
 * Il canvas chiede una curva per volta, e chiederle tutte e tre a ogni pixel
 * costerebbe tre volte il conto. Qui il punto si calcola una volta per istante
 * e si tiene da parte: chi disegna le tre tracce sullo stesso `t` paga una
 * volta sola.
 */
/**
 * Quanto dura il trigger: i cento millisecondi in cui il paziente **tira**.
 *
 * Sono l'unico punto della curva dove si legge quanto è sensibile la macchina:
 * la pressione scende sotto la PEEP e il flusso va negativo prima che arrivi
 * qualunque cosa dal ventilatore.
 */
export const TRIGGER_SEC = 0.1

/**
 * Se questo istante cade **dentro il trigger** di un atto assistito.
 *
 * Serve a chi disegna: quel tratto di flusso si colora di bianco, perché è
 * l'apparecchio che dice «questo atto l'ha chiesto il paziente». Sulla carta e
 * nelle modalità controllate non vuol dire niente e torna falso.
 */
export function nelTrigger(tSec: number, stato: StatoVentilatore): boolean {
  if (!stato.ventilando) return false
  // Col motore il tratto è quello vero: lo sforzo che ha aperto l'atto, fino
  // all'istante in cui la macchina l'ha sentito — anche in controllata, quando
  // il trigger è aperto.
  if (!stato.manovra && motoreCopre(stato)) return campioneMotore(tSec, polmoneOra(stato)).inTrigger
  if (!assistito(stato.modalita, stato.impostazioni.psLevel)) return false
  const { Ttot } = tempiRespiro(polmoneOra(stato))
  if (!isFinite(Ttot) || Ttot <= 0) return false
  const tau = ((tSec % Ttot) + Ttot) % Ttot
  return tau < TRIGGER_SEC
}

/**
 * Quanto il respiro sposta la pressione **dentro il torace**, in cmH₂O.
 *
 * Positivo vuol dire che il torace è in pressione — l'insufflazione della
 * macchina — e negativo che è in depressione, cioè il paziente che tira. È la
 * grandezza che governa le interazioni cuore-polmone, e la prima che si vede è
 * la **pressione venosa centrale**: oscilla al contrario a seconda di chi muove
 * l'aria.
 *
 * * **Il paziente che respira da solo** abbassa la pressione intratoracica in
 *   inspirazione: la PVC **scende** e risale in espirazione.
 * * **La macchina che insuffla** la alza: il picco della PVC cade
 *   nell'inspirazione, e il minimo — quello che si legge — a fine espirazione.
 * * **In assistita** le due si sommano con il segno che hanno, e su uno sforzo
 *   forte l'oscillazione diventa enorme.
 *
 * A fine espirazione passiva valgono zero tutt'e due, ed è per questo che la
 * PVC si legge lì: non è una convenzione, è l'unico istante in cui il torace
 * non sta spingendo né tirando.
 *
 * Quanto della pressione delle vie aeree arriva dentro lo dice
 * `trasmissioneToracica`, cioè la compliance: un polmone rigido ne trasmette
 * poca anche a pressioni alte. Lo sforzo del paziente invece **è già** una
 * pressione pleurica e passa intero.
 */
export function oscillazioneToracica(stato: StatoVentilatore, tSec: number): number {
  const daPaziente = pmusc(tSec, stato.drive, stato.sfasamentoSpontaneo)
  if (!stato.ventilando) return -daPaziente
  const ora = polmoneOra(stato)
  const inManuale = ora.ambiente === 'anestesia' && ora.respiro === 'manuale'
  const base = inManuale ? ora.impostazioni.apl : ora.impostazioni.peep
  const sopraLaBase = Math.max(0, puntoOnda(tSec, ora).paw - base)
  return sopraLaBase * trasmissioneToracica(ora.fisiologia) - daPaziente
}

export function creaOnde(stato: StatoVentilatore): {
  paw: (t: number) => number
  flusso: (t: number) => number
  volume: (t: number) => number
} {
  // Risolto una volta sola qui: `creaOnde` lo tiene per tutta la durata delle
  // tre funzioni che restituisce, e `puntoOnda` lo ritroverebbe uguale.
  const ora = polmoneOra(stato)
  let ultimoT = Number.NaN
  let ultimo: PuntoOnda = FERMO
  const a = (t: number): PuntoOnda => {
    if (t !== ultimoT) {
      ultimo = puntoOnda(t, ora)
      ultimoT = t
    }
    return ultimo
  }
  return {
    paw: (t) => a(t).paw,
    flusso: (t) => a(t).flusso,
    volume: (t) => a(t).volume,
  }
}

/**
 * La pausa tenuta: tutto si ferma dove sta.
 *
 * In pausa inspiratoria la pressione scende dal picco al plateau e ci resta, il
 * flusso è zero e il volume è quello dentro; in pausa espiratoria la pressione
 * è la PEEP totale — quella impostata più l'aria che non è uscita — e il volume
 * è zero. Sono le due immagini che si guardano al letto, e devono essere
 * immobili: una curva che si muove durante una pausa vuol dire che la pausa non
 * c'è.
 */
function inPausa(stato: StatoVentilatore, tSec: number): PuntoOnda {
  const { impostazioni: imp, fisiologia: fis } = stato
  const vt = volumeCorrenteAtteso(stato)
  // Il reclutamento sostenuto è una pressione **tenuta**: la traccia è una riga
  // dritta in alto, il flusso è zero e il polmone sta pieno a quella pressione.
  // Sul vetro si vede per quello che è — un minuto in cui non succede niente,
  // mentre sul monitor accanto succede tutto.
  if (stato.manovra === 'reclutamento') {
    const dentro = Math.max(0, RECLUTAMENTO_PRESSIONE - imp.peep) * Math.max(1, fis.compliance)
    return { paw: RECLUTAMENTO_PRESSIONE, flusso: 0, volume: dentro }
  }
  const senza = { ...stato, manovra: null }
  const conMotore = motoreCopre(senza)
  const da = stato.manovraDa ?? tSec
  const dentro = Math.max(0, tSec - da)
  // La curva lenta: cinque litri al minuto dalla PEEP, e la curva statica del
  // polmone che si disegna da sé — col ginocchio, se le vie aeree erano chiuse.
  if (stato.manovra === 'curva-lenta') return curvaLenta(dentro, senza)
  // Il rapporto R/I: la PEEP scende di colpo a quella bassa per un respiro, e
  // il polmone si svuota del volume che la PEEP alta teneva dentro.
  if (stato.manovra === 'rapporto-ri') {
    const esito = esitoManovra(senza, 'rapporto-ri', MISURE_VUOTE)
    const esce = typeof esito.volumeEsalato === 'number' ? esito.volumeEsalato : 0
    const bassa = typeof esito.peepBassa === 'number' ? esito.peepBassa : imp.peep
    const tau = Math.max(0.1, costanteTempo(fis))
    const resta = Math.exp(-dentro / tau)
    return { paw: bassa, flusso: -((esce / 1000 / tau) * resta) * 60, volume: esce * resta }
  }
  // Col motore la pausa ferma **l'ultimo atto prima della pausa**: il plateau
  // è la pressione alveolare a fine inspirazione, la PEEP totale quella a fine
  // espirazione — con dentro l'aria che non è uscita, atto dopo atto. E lo
  // sforzo del paziente non si ferma con la macchina: a vie chiuse la Paw scende
  // quanto la Pmus, ed è il test di occlusione che si legge sulla curva.
  const ultimo = conMotore ? attiRecenti(da, senza, 20).at(-1) : undefined
  const sforzo = conMotore ? campioneMotore(tSec, senza).pmus : 0
  if (stato.manovra === 'pausa-inspiratoria') {
    if (ultimo) return { paw: ultimo.palvFineInsp - sforzo, flusso: 0, volume: ultimo.vti }
    return { paw: imp.peep + vt / Math.max(1, fis.compliance), flusso: 0, volume: vt }
  }
  if (ultimo) return { paw: (ultimo.vieChiuse ? imp.peep : ultimo.peepTotale) - sforzo, flusso: 0, volume: 0 }
  const { Ttot, Ti } = tempiRespiro(stato)
  const RC = costanteTempo(fis)
  const trattenuto = RC > 0 ? Math.exp(-(Ttot - Ti) / RC) : 0
  return { paw: imp.peep + (vt * trattenuto) / Math.max(1, fis.compliance), flusso: 0, volume: 0 }
}

/**
 * Ventilazione manuale: il pallone, e il paziente che respira dentro.
 *
 * La Paw **non è rumore**. Segue la frequenza spontanea: ogni atto
 * un'oscillazione che scende sotto il livello dell'APL — è il paziente che
 * tira — e risale quando espira. Quando dalla regia il drive si spegne con una
 * rampa (frequenza da 15 a 0 in trenta secondi: l'addormentamento), gli atti si
 * diradano e la traccia si appiattisce sull'APL da sola, senza che nessuno
 * cambi modalità. È lo stesso comando che governa le asincronie, ed è la
 * ragione per cui il drive è un parametro e non un interruttore.
 */
function aPallone(tSec: number, stato: StatoVentilatore): PuntoOnda {
  const { impostazioni: imp, fisiologia: fis } = stato
  const drive = driveEfficace(stato.drive)
  const base = imp.apl
  if (drive.frequenza <= 0 || drive.intensita <= 0) {
    return conRumore({ paw: base, flusso: 0, volume: 0 }, tSec, stato)
  }

  const periodo = 60 / drive.frequenza
  const durata = Math.min(1, periodo * 0.4)
  // Lo sfasamento è quello che tiene la fase ferma quando la frequenza cambia:
  // senza, la rampa dell'addormentamento spezzava gli atti a metà. Vedi
  // `istantanea.riallineaFase`.
  const dentro = (((tSec - stato.sfasamentoSpontaneo) % periodo) + periodo) % periodo
  const RC = costanteTempo(fis)
  const ampiezza = drive.intensita * PMUSC_MASSIMA
  const picco = fis.compliance * ampiezza

  let volume: number
  let flussoMlSec: number
  let paw: number
  if (dentro < durata) {
    const fase = (Math.PI * dentro) / (2 * durata)
    volume = picco * Math.sin(fase)
    flussoMlSec = picco * (Math.PI / (2 * durata)) * Math.cos(fase)
    paw = base - ampiezza * Math.sin((Math.PI * dentro) / durata) * 0.8
  } else {
    const fuori = dentro - durata
    volume = picco * Math.exp(-fuori / Math.max(0.1, RC))
    flussoMlSec = -(volume / Math.max(0.1, RC))
    // In espirazione il pallone si rigonfia: la pressione risale un poco sopra
    // l'APL, e con un espirio attivo — il grugnito — risale di più.
    paw = base + (volume / Math.max(1, fis.compliance)) * (0.2 + fis.sforzoEspiratorio * 0.6)
  }

  return conRumore({ paw, flusso: (flussoMlSec / 1000) * 60, volume }, tSec, stato)
}

/**
 * Le secrezioni, che si sentono sulle curve prima che nel tubo.
 *
 * Oscillazioni veloci su flusso e pressione, **le stesse** su tutte e due
 * perché è la stessa aria: quando la curva del flusso comincia a fare i denti
 * di sega, l'aspirazione è la manovra giusta, e riconoscerlo da lì è una delle
 * cose che questo apparecchio serve a insegnare.
 */
function conRumore(p: PuntoOnda, tSec: number, stato: StatoVentilatore): PuntoOnda {
  // **Non sono solo quelle del paziente.** Un umidificatore spento o a potenza
  // bassa asciuga le vie aeree e le secrezioni si addensano: `secrezioniEfficaci`
  // somma quello che manca all'umidificazione al quadro clinico, ed è il modo
  // in cui quella manopola si vede — sulle curve, non in una scritta.
  const s = secrezioniEfficaci(stato)
  if (s <= 0) return p
  const oscillazione = rumore(stato.seme, tSec, 15) + 0.5 * rumore(stato.seme + 1, tSec, 8)
  return {
    paw: p.paw + oscillazione * s * 0.5,
    flusso: p.flusso + oscillazione * s * 4,
    volume: p.volume,
  }
}
