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

import { campioneA, tracciatoPer } from './tracciati'
import { assistito } from './parametri'
import { rumore } from './caso'
import {
  attoAsincrono,
  driveEfficace,
  durataSforzoSec,
  indiceAtto,
  periodoSpontaneoSec,
  pmusc,
  quotaEfficace,
  PMUSC_MASSIMA,
  type TipoAsincronia,
} from './asincronie'
import {
  RECLUTAMENTO_PRESSIONE,
  attiSpontaneiSimv,
  volumeSpontaneo,
  costanteTempo,
  polmoneOra,
  sighDiQuestoAtto,
  secrezioniEfficaci,
  tempiRespiro,
  trasmissioneToracica,
  volumeCorrenteAtteso,
  type StatoVentilatore,
} from './fisica'

/**
 * Quanto è **piccola** una tacca: la parte dello sforzo che si vede sulle curve
 * quando l'atto non parte.
 *
 * Numeri trovati guardando, non calcolati: la prima versione moltiplicava lo
 * sforzo per 0,35 sul flusso, e con una resistenza normale e uno sforzo forte
 * la tacca usciva **più alta dell'atto erogato** — cioè non una tacca, un
 * respiro. Sulle figure di de Haro uno sforzo inefficace è una deflessione di
 * pochi litri al minuto e di un centimetro d'acqua scarso: si riconosce perché
 * è nel posto sbagliato, non perché è grande.
 *
 * La divisione per la resistenza resta, e va nel verso giusto: più il paziente
 * è ostruito, meno flusso gli esce da uno sforzo che non arriva al trigger.
 */
const TACCA_FLUSSO = 0.08
const TACCA_PAW = 0.1

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

  if (stato.manovra) return inPausa(stato)
  if (stato.ambiente === 'anestesia' && stato.respiro === 'manuale') return aPallone(tSec, stato)

  return conRumore(respiroMeccanico(tSec, stato), tSec, stato)
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
function inPausa(stato: StatoVentilatore): PuntoOnda {
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
  if (stato.manovra === 'pausa-inspiratoria') {
    return { paw: imp.peep + vt / Math.max(1, fis.compliance), flusso: 0, volume: vt }
  }
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
/**
 * La forza che il curaro lascia al diaframma, da 0 a 1. Per gli sforzi che non
 * seguono il treno spontaneo — il reverse triggering, la fame di flusso — e
 * che su un paziente bloccato non ci sono.
 */
function forzaDi(stato: StatoVentilatore): number {
  return Math.min(1, Math.max(0, stato.drive.forza ?? 1))
}

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

/** Un atto meccanico, con sopra quello che il paziente ci mette. */
function respiroMeccanico(tSec: number, stato: StatoVentilatore): PuntoOnda {
  const { Ttot, Ti: TiOrdinario, Tif: TifOrdinario } = tempiRespiro(stato)
  const indice = Math.floor(tSec / Ttot)
  const tau = tSec - indice * Ttot

  // ## Il sigh, quando quest'atto è un sigh
  //
  // Lo stesso conto di `misura`, sullo stesso indice d'atto: il numero che il
  // display scrive e l'atto alto che la traccia disegna sono lo stesso atto.
  // Erano due conti separati, e sarebbero andati a finire d'accordo per caso.
  const sigh = sighDiQuestoAtto(stato, indice, Ttot)
  if (sigh) stato = sigh.stato
  const TiBase = sigh ? sigh.Ti : TiOrdinario
  const TifBase = sigh ? sigh.Ti * (TifOrdinario / Math.max(0.01, TiOrdinario)) : TifOrdinario

  const impostazione = stato.asincronia
  // La quota la corregge il trigger: vedi `asincronie.quotaEfficace`. Senza
  // questa riga la manopola della sensibilità non cambiava una curva.
  const conTrigger =
    impostazione === null
      ? null
      : { ...impostazione, quota: quotaEfficace(impostazione, stato.impostazioni.triggerFlow) }
  const scelto = attoAsincrono(indice, conTrigger, stato.seme)
  const tipo: TipoAsincronia | null = scelto && impostazione ? impostazione.tipo : null
  const grado = impostazione?.grado ?? 1

  let Ti = TiBase
  let Tif = TifBase
  if (tipo === 'ciclaggio-precoce') {
    Ti = TiBase * 0.6
    Tif = TifBase * 0.6
  } else if (tipo === 'ciclaggio-ritardato') {
    Ti = Math.min(TiBase * 1.6, Ttot * 0.85)
    Tif = Math.min(TifBase * 1.6, Ti)
  }

  let p = curvaBase(tau, Ti, Tif, Ttot, stato)

  // ### Doppio ciclo: il secondo atto parte dove il primo doveva espirare
  //
  // Il volume del primo non è ancora uscito, e quello del secondo ci si somma:
  // in volume controllato il corrente accumulato può raddoppiare, ed è quello
  // che il monitoraggio deve mostrare (`frequenzaErogata` e `volumeInspired` in
  // `fisica.ts` fanno il conto corrispondente).
  const scattaDoppio = tipo === 'doppio-ciclo' || (tipo === 'fame-di-flusso' && grado >= 4)
  if (scattaDoppio && tau > Ti && tau <= Ti * 2) {
    const vt = volumeCorrenteAtteso(stato)
    const secondo = curvaBase(tau - Ti, Ti, Tif, Ttot, stato)
    p = {
      paw: secondo.paw + vt / Math.max(1, stato.fisiologia.compliance),
      flusso: secondo.flusso,
      volume: secondo.volume + vt,
    }
  }

  // ### Auto-trigger: un atto che nessuno ha chiesto, in mezzo all'espirazione
  const inizioAuto = Ti + (Ttot - Ti) / 2
  if (tipo === 'auto-trigger' && tau > inizioAuto && tau <= inizioAuto + Ti) {
    p = curvaBase(tau - inizioAuto, Ti, Tif, Ttot, stato)
  }

  // ### Fame di flusso: la pressione si scava mentre il flusso resta quello
  //
  // Vale in volume controllato, dove il flusso è fisso per costruzione: il
  // paziente ne chiede di più e non lo ottiene, e la Paw si incurva verso il
  // basso. I quattro gradi della fig. 2 sono quattro profondità della stessa
  // concavità; al quarto lo sforzo è tale da strappare un secondo atto.
  if (tipo === 'fame-di-flusso' && tau <= Ti) {
    const scavo = PMUSC_MASSIMA * Math.max(0.3, stato.drive.intensita) * forzaDi(stato) * (Math.min(4, grado) / 4)
    p = { ...p, paw: p.paw - scavo * Math.sin((Math.PI * tau) / Ti) }
  }

  // ### Reverse triggering: è la macchina che innesca il diaframma
  //
  // Lo sforzo non ha una frequenza sua — è agganciato al ciclo macchina, con un
  // ritardo — e per questo si vede in pazienti profondamente sedati, che un
  // drive spontaneo non ce l'hanno.
  if (tipo === 'reverse-trigger') {
    const ritardo = Ti * 0.5
    const durata = Math.min(0.8, Ttot * 0.3)
    const dentro = tau - ritardo
    if (dentro > 0 && dentro < durata) {
      const forza =
        PMUSC_MASSIMA * Math.max(0.3, stato.drive.intensita) * forzaDi(stato) * Math.sin((Math.PI * dentro) / durata)
      p = {
        paw: p.paw - forza * 0.5,
        flusso: p.flusso + (forza / Math.max(0.1, stato.fisiologia.resistenza)) * 60 * 0.3,
        volume: p.volume,
      }
    }
  }

  // ### SIMV: fra un atto obbligato e l'altro, il paziente respira
  //
  // È tutta la differenza fra una modalità che **garantisce** e una che
  // **impone**: in volume o pressione controllata lo sforzo che cade in
  // espirazione lascia solo una tacca (qui sotto), perché la macchina non gli
  // apre; in SIMV gli apre, e quell'atto c'è — con il supporto se il PS è
  // acceso, con il solo diaframma se è a zero, ed è il motivo per cui là in
  // mezzo si vede un atto piccolo. La forma è quella della pressione di
  // supporto, che è esattamente quello che la macchina eroga in quel momento;
  // il conto corrispondente sui numeri lo fanno `attiSpontaneiSimv` e
  // `volumeSpontaneo` in `fisica.ts`.
  const spontaneiSimv = attiSpontaneiSimv(stato)
  let attoSpontaneo = false
  if (stato.modalita === 'SIMV' && tau > Ti && spontaneiSimv > 0) {
    // **Quanti ne ospita questo ciclo.** Il paziente fa venti sforzi al minuto
    // e la macchina gliene prende dodici — è la *S* di SIMV, gli obbligati sono
    // sincronizzati con lo sforzo — quindi gli atti spontanei sono otto, e
    // otto devono restare: disegnarne uno per ogni sforzo che cade in
    // espirazione ne farebbe dodici, e la curva direbbe un numero diverso da
    // quello scritto sul display. Il conto si spalma sull'indice del ciclo, in
    // modo che la stessa sessione riguardata due volte li metta negli stessi
    // punti.
    const perCiclo = (spontaneiSimv * Ttot) / 60
    const quanti = Math.floor((indice + 1) * perCiclo) - Math.floor(indice * perCiclo)
    const periodoSpont = periodoSpontaneoSec(stato.drive)
    // Il primo sforzo che cade **dopo** l'atto obbligato: uno sforzo dentro
    // l'inspirazione della macchina l'atto ce l'ha già.
    const kPrimo = Math.ceil((indice * Ttot + Ti - stato.sfasamentoSpontaneo) / periodoSpont)
    const k = indiceAtto(tSec, stato.drive, stato.sfasamentoSpontaneo)
    if (quanti > 0 && k >= kPrimo && k < kPrimo + quanti) {
      const dentro = tSec - (k * periodoSpont + stato.sfasamentoSpontaneo)
      const TiSpont = Math.max(0.2, Math.min(durataSforzoSec(stato.drive) * 1.4, (Ttot - Ti) * 0.6))
      if (dentro >= 0 && dentro < TiSpont * 2) {
        p = supporto(dentro, TiSpont, stato)
        attoSpontaneo = true
      }
    }
  }

  // ### Gli sforzi che non arrivano al trigger
  //
  // Il treno spontaneo va avanti per conto suo: quello che cade in espirazione
  // lascia la tacca, e non fa partire niente. Se dalla regia è stato chiesto
  // «sforzi inefficaci», negli atti scelti la tacca è più marcata — è la stessa
  // cosa, resa visibile a chi guarda da lontano.
  const spontanea = stato.modalita === 'PS' || stato.modalita === 'CPAP'
  if (!spontanea && !attoSpontaneo && driveEfficace(stato.drive).frequenza > 0 && tau > Ti) {
    const pm = pmusc(tSec, stato.drive, stato.sfasamentoSpontaneo)
    if (pm > 0) {
      const marca = tipo === 'sforzo-inefficace' ? 1.6 : 1
      p = {
        paw: p.paw - pm * TACCA_PAW * marca,
        flusso: p.flusso + (pm / Math.max(0.1, stato.fisiologia.resistenza)) * 60 * TACCA_FLUSSO * marca,
        volume: p.volume,
      }
    }
  }

  // ### In pressione di supporto, lo sforzo inefficace è un atto che non c'è
  //
  // Lì la macchina non ha una cadenza sua: se lo sforzo non arriva al trigger,
  // non succede niente — resta la linea di base con la tacca, e la frequenza
  // erogata scende sotto quella spontanea. È il segno che si legge sui numeri
  // prima che sulle onde.
  if (spontanea && tipo === 'sforzo-inefficace') {
    const pm = pmusc(tSec, stato.drive, stato.sfasamentoSpontaneo)
    p = {
      paw: stato.impostazioni.peep - pm * TACCA_PAW * 1.6,
      flusso: (pm / Math.max(0.1, stato.fisiologia.resistenza)) * 60 * TACCA_FLUSSO * 1.6,
      volume: 0,
    }
  }

  return p
}

/** L'atto pulito, senza niente sopra: quello che la macchina farebbe da sola. */
function curvaBase(
  tau: number,
  Ti: number,
  Tif: number,
  Ttot: number,
  stato: StatoVentilatore,
): PuntoOnda {
  const { impostazioni: imp, fisiologia: fis, modalita } = stato
  const C = Math.max(1, fis.compliance)
  const R = Math.max(0.1, fis.resistenza)

  if (modalita === 'VC' || (modalita === 'SIMV' && imp.psLevel === 0)) {
    const vt = volumeCorrenteAtteso(stato)
    if (tau <= Tif && Tif > 0) {
      const flussoLs = vt / 1000 / Tif
      const volume = (vt * tau) / Tif
      return { paw: imp.peep + flussoLs * R + volume / C, flusso: flussoLs * 60, volume }
    }
    if (tau <= Ti) return { paw: imp.peep + vt / C, flusso: 0, volume: vt }
    // Da dove parte: il plateau, e flusso zero — è la pausa appena finita.
    return espirazione(tau - Ti, vt, stato, imp.peep + vt / C, 0)
  }

  if (modalita === 'PS' || modalita === 'CPAP') {
    return supporto(tau, Ti, stato)
  }

  // ### Pressione controllata: il tracciato registrato, riscalato
  //
  // Qui il modello analitico non basta: la spalla del flusso decelerante e il
  // modo in cui la pressione si appoggia al plateau sono la firma della
  // modalità, e si ottengono interpolando la registrazione vera. Si riscala la
  // pressione sulla motrice impostata e il volume sulla compliance del
  // paziente; il flusso segue il volume, perché è la sua derivata.
  const tracciato = tracciatoPer('PC')
  const campione = campioneA(tracciato, (tau / Ttot) * tracciato.durataCicloMs)
  const peepBase = tracciato.impostazioni.peep ?? 5
  const motriceBase = tracciato.picchi.paw - peepBase
  const fattoreP = motriceBase > 0 ? imp.pressureTarget / motriceBase : 1
  const volumeAtteso = imp.pressureTarget * C
  const fattoreV = tracciato.picchi.volume > 0 ? volumeAtteso / tracciato.picchi.volume : 1
  return {
    paw: imp.peep + (campione.paw - peepBase) * fattoreP,
    flusso: campione.flusso * fattoreV,
    volume: campione.volume * fattoreV,
  }
}

/**
 * L'atto in pressione di supporto: il paziente tira, la macchina accompagna.
 *
 * I cento millisecondi iniziali sono il trigger — la pressione scende sotto la
 * PEEP e il flusso va negativo, ed è l'unico posto dove si vede quanto è
 * sensibile la macchina. Poi la pressione sale con il tempo di salita
 * impostato, il polmone si riempie con la sua costante di tempo, e il termine
 * `Pmusc` è lo sforzo che continua a tirare: senza quello la curva del flusso
 * sarebbe quella di un atto in pressione controllata, cioè di un paziente che
 * non sta facendo niente.
 */
function supporto(tau: number, Ti: number, stato: StatoVentilatore): PuntoOnda {
  const { impostazioni: imp, fisiologia: fis, modalita } = stato
  const C = Math.max(1, fis.compliance)
  const R = Math.max(0.1, fis.resistenza)
  const RC = costanteTempo(fis)
  const supportoCm = modalita === 'CPAP' ? 0 : imp.psLevel
  const TRIGGER = TRIGGER_SEC

  if (tau < TRIGGER) {
    const avanzamento = tau / TRIGGER
    return {
      paw: imp.peep - (1 - avanzamento),
      flusso: -imp.triggerFlow * (1 - avanzamento),
      volume: 0,
    }
  }

  const dentro = tau - TRIGGER
  const pmuscMax = driveEfficace(stato.drive).intensita * PMUSC_MASSIMA
  // Lo stesso numero che il display scrive come volume minuto degli atti
  // spontanei: sta in `fisica.ts` in un posto solo.
  const bersaglio = volumeSpontaneo(stato)
  const salita = Math.max(0.01, imp.inspiratoryRiseTimeSeconds / 3)

  if (dentro < Ti) {
    const volume = bersaglio * (1 - Math.exp(-dentro / Math.max(0.05, RC)))
    const pVent = supportoCm * (1 - Math.exp(-dentro / salita))
    const pAlv = volume / C
    const sostegno = pmuscMax * Math.sin((Math.PI * dentro) / Math.max(0.1, Ti))
    return {
      paw: imp.peep + pVent,
      flusso: ((pVent - pAlv) / R + sostegno / R) * 60,
      volume,
    }
  }

  const allaFine = bersaglio * (1 - Math.exp(-Ti / Math.max(0.05, RC)))
  // Da dove parte: la pressione delle vie aeree e il flusso **nell'istante del
  // ciclaggio**, così la traccia prosegue invece di saltare. Il flusso di fine
  // inspirazione è la soglia di ciclaggio, ed è il numero che quella manopola
  // decide: passargli il valore giusto è quello che rende la curva continua.
  const pVentFine = supportoCm * (1 - Math.exp(-Ti / salita))
  const pAlvFine = allaFine / C
  const flussoFine = ((pVentFine - pAlvFine) / R) * 60
  return espirazione(dentro - Ti, allaFine, stato, imp.peep + pVentFine, flussoFine)
}

/**
 * L'espirazione: passiva, e con la scodella di chi non riesce a buttare fuori.
 *
 * `limitazioneFlusso` è il collasso delle vie aeree dell'ostruito: il flusso
 * parte alto e crolla subito, poi si trascina in una coda lunga. È la forma che
 * si chiama «scodella» e che si riconosce da lontano, e siccome la coda non fa
 * in tempo a tornare a zero prima dell'atto dopo, è anche il modo in cui
 * l'auto-PEEP si vede sulla curva invece che in una manovra.
 */
/**
 * Quanto ci mette la valvola espiratoria ad aprirsi e la Paw a tornare giù.
 *
 * Sono i due tempi della **macchina**, non del polmone, e per questo sono corti
 * e fissi: quaranta millisecondi perché il flusso passi da quello di fine
 * inspirazione al picco espiratorio, centoventi perché la pressione delle vie
 * aeree torni alla PEEP.
 */
const VALVOLA_FLUSSO = 0.04
const VALVOLA_PAW = 0.12

/**
 * L'espirazione: il polmone si svuota, e la macchina apre.
 *
 * ## La Paw torna alla PEEP, non segue l'alveolo
 *
 * Era il difetto che faceva «saltare» le curve, e non era il disegno: in
 * espirazione la pressione delle vie aeree veniva calcolata come
 * `PEEP + volume/C`, cioè la pressione **alveolare**, che decade con la
 * costante di tempo del polmone — una coda lunga per tutta l'espirazione. Ma la
 * Paw non è la pressione alveolare: appena la valvola si apre l'apparecchio
 * tiene la PEEP, e la traccia torna alla linea di base e ci resta. Con la
 * formula vecchia, al ciclaggio la pressione **saltava** dal livello di
 * supporto (15) alla pressione alveolare (12,5) con uno scalino netto, una
 * volta per respiro: è lo scalino che si vedeva.
 *
 * Adesso parte da dov'era e scende alla PEEP con la costante della valvola. Il
 * grugnito — l'espirio attivo — resta, perché quello **alza** davvero la Paw.
 *
 * ## E il flusso non salta più a gradino
 *
 * Al ciclaggio il flusso passava da quello di fine inspirazione (positivo, la
 * soglia) al picco espiratorio (molto negativo) in un istante: una riga
 * verticale. Su una macchina vera ci mette qualche decina di millisecondi, e
 * quel tratto ripido ma continuo è quello che si vede sulle curve.
 */
function espirazione(
  te: number,
  volumeIniziale: number,
  stato: StatoVentilatore,
  pawIniziale: number | null = null,
  flussoIniziale = 0,
): PuntoOnda {
  const { impostazioni: imp, fisiologia: fis } = stato
  const C = Math.max(1, fis.compliance)
  const RC = Math.max(0.05, costanteTempo(fis) * (1 + 2 * fis.limitazioneFlusso))
  const volume = volumeIniziale * Math.exp(-te / RC)
  const punta = 1 + fis.limitazioneFlusso * 2 * Math.exp(-te / 0.15)
  const grugnito = (volume / C) * fis.sforzoEspiratorio * 0.5
  const daInizio = pawIniziale ?? imp.peep
  const apertura = 1 - Math.exp(-te / VALVOLA_FLUSSO)
  const espiratorio = -((volume / 1000) / RC) * 60 * punta
  return {
    paw: imp.peep + (daInizio - imp.peep) * Math.exp(-te / VALVOLA_PAW) + grugnito,
    flusso: flussoIniziale + (espiratorio - flussoIniziale) * apertura,
    volume,
  }
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
