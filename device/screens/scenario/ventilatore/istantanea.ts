/**
 * Il blocco del ventilatore dentro l'istantanea, e chi lo cambia.
 *
 * ## Un produttore solo, anche qui
 *
 * L'istantanea la scrive la regia, sempre intera, mai a pezzi (§118). Il
 * ventilatore non fa eccezione, e anzi è il caso in cui la regola pesa di più:
 * un apparecchio ha decine di manopole, e se ogni device applicasse le proprie
 * due schermi dello stesso ventilatore mostrerebbero due macchine diverse dopo
 * il primo tocco.
 *
 * Quindi: i device mandano `AzioneVentilatore`, la regia chiama `applica()` e
 * riscrive il blocco. Questa funzione è **pura** — stato dentro, stato fuori —
 * e sta qui e non dentro `RegiaScreen` per la ragione di sempre: dentro una
 * schermata si verificherebbe solo aprendo un browser e provando trenta
 * comandi a mano.
 *
 * ## Perché le misure viaggiano invece di ricalcolarsi
 *
 * Le curve i device se le disegnano da soli, dai parametri — come l'ECG dal
 * ritmo — perché sono una funzione del tempo e vengono uguali dappertutto. Le
 * **misure** no: l'EtCO₂ che sale piano, l'agente che si lava dal circuito,
 * l'acqua che cala sono grandezze che inseguono, e inseguire vuol dire
 * dipendere da dove si era un attimo fa. Due schermi collegati in momenti
 * diversi partirebbero da due «attimi fa» diversi e scriverebbero due numeri
 * diversi accanto alla stessa curva. Le calcola la regia, una volta, e
 * viaggiano.
 *
 * ## L'errore di riempimento
 *
 * `applica()` non scrive niente in nessun registro: restituisce **anche** il
 * nome dell'evento da annotare, e chi tiene il registro lo annota. Un motore
 * che sa fare il log è un motore che il giorno dopo lo fa due volte, da due
 * chiamanti diversi.
 */

import { valuta, MODALITA_CON_APNEA, LIMITI_INIZIALI, SILENZIO_SECONDI, conLimiteDellAgente, type AllarmeAttivo, type LimitiAllarme, spostaLimite } from './allarmi'
import type { AzioneVentilatore } from './azioni'
import { regolaPrvc, PRVC_PROVA } from './prvc'
import { attiRecenti, motoreCopre } from './motore'
import type { Circuito } from '../../paziente/presidiFigura'
import { DRIVE_ASSENTE, driveEfficace, type Drive, type ImpostazioniAsincronia } from './asincronie'
import type { TranslationKey } from '../../../i18n/it'
import {
  FISIOLOGIA_NORMALE,
  POTENZA_MASSIMA,
  PRESET_FISIOLOGIA,
  POTENZA_MINIMA,
  RECLUTAMENTO_SECONDI,
  STATO_UMIDIFICATORE_INIZIALE,
  avanza,
  esitoManovra,
  misura,
  type Fisiologia,
  type Manovra,
  type Paziente,
  type PresetFisiologia,
  type StatoAltoFlusso,
  type StatoUmidificatore,
  type StatoVentilatore,
} from './fisica'
import {
  ERRORE_RIEMPIMENTO,
  FLUSH_SECONDI,
  MASSIMO_AGENTI,
  RIEMPIMENTO_SECONDI,
  STATO_GAS_INIZIALE,
  bersaglioEt,
  gasChiusi,
  macDi,
  riempi,
  type Consumabile,
  type StatoGas,
} from './gas'
import {
  IMPOSTAZIONI_INIZIALI,
  MISURE_VUOTE,
  MODALITA_PER_AMBIENTE,
  PARAMETRI,
  type Ambiente,
  type Impostazioni,
  type Misure,
  type Modalita,
  type Respiro,
} from './parametri'

/**
 * Tutto quello che di un ventilatore viaggia fino agli schermi.
 *
 * È lo stato della macchina più quello che la macchina sta misurando. Niente
 * differenziali: chi si collega a metà scenario deve trovare esattamente quello
 * che vedono gli altri, e chi si riconnette dopo un buco di rete non deve
 * ricostruire niente.
 */
export interface VentIstantanea {
  ambiente: Ambiente
  modalita: Modalita
  respiro: Respiro
  ventilando: boolean
  impostazioni: Impostazioni
  fisiologia: Fisiologia
  drive: Drive
  asincronia: ImpostazioniAsincronia | null
  manovra: Manovra
  /**
   * Quando la manovra in corso è cominciata, nel tempo del ventilatore.
   *
   * Una pausa **dura**: cinque secondi tenuti, e solo alla fine l'apparecchio
   * scrive i numeri. Il device disegna la barra di avanzamento da qui, e
   * `batti()` chiude la manovra e deposita l'esito quando il tempo è passato —
   * come sulla macchina vera, dove il tasto si tiene e la misura arriva dopo.
   */
  manovraDa: number | null
  /**
   * L'ultima misura di manovra completata, o niente.
   *
   * Sta nell'istantanea e non nel device: due schermi della stessa macchina
   * devono leggere gli stessi numeri, e chi si collega dopo deve trovare
   * l'ultima misura fatta, non un pannello vuoto.
   */
  manovraEsito: {
    manovra: Exclude<Manovra, null>
    valori: Record<string, number | null>
    aSec: number
    /**
     * Perché la manovra è finita **prima**, o niente se è arrivata in fondo.
     *
     * È la chiave di traduzione del motivo (`vent.stop.*`): l'apparecchio non
     * si limita a mollare la pressione, dice **che cosa ha visto**. Vale solo
     * per il reclutamento sostenuto; le pause non si interrompono da sé.
     */
    interrotta?: TranslationKey | null
  } | null
  /**
   * Dov'era il paziente quando la manovra tenuta è cominciata.
   *
   * Serve ai criteri d'interruzione, che guardano le **cadute** e non solo le
   * soglie: si fissa premendo e si butta lasciando (`motivoInterruzione`).
   */
  baseManovra: BaseManovra | null
  /**
   * Quando è stato completato l'ultimo autotest, nel tempo del ventilatore,
   * o niente se su questa accensione non è mai stato fatto.
   *
   * L'animazione dei passaggi è del device che lo lancia; il **fatto** — la
   * macchina è stata provata, e quando — è della macchina, e viaggia.
   */
  autotestA: number | null
  gas: StatoGas | null
  altoFlusso: StatoAltoFlusso | null
  /**
   * L'umidificatore: c'è in terapia intensiva, non invasiva e alto flusso.
   *
   * La camera dell'acqua sta qui e non in `altoFlusso` perché è
   * dell'umidificatore, non dell'apparecchio — e finché stava là, in terapia
   * intensiva l'umidificatore era una manopola della temperatura che non
   * produceva niente.
   */
  umidificatore: StatoUmidificatore | null
  /**
   * Come è montata la linea (§602): `hme` o `umidificatore` in terapia intensiva, `bitubo`
   * o `monotubo` in NIV, niente dove non si sceglie. Parte da quello del setup; si cambia
   * solo in standby, e dopo l'autotest va rifatto. Assente in un'istantanea di prima.
   */
  circuito?: Circuito | null
  /**
   * Quando è cominciato il cambio di un consumabile, o niente.
   *
   * **Cambiare una cartuccia o un canister dura mezzo minuto**, come la pausa
   * tenuta dura cinque secondi: il device disegna l'operazione che avanza, e
   * `batti()` la conclude allo scadere. Prima era istantaneo, e premere il
   * pulsante col paziente attaccato riempiva tutto come se niente fosse.
   */
  riempimentoDa: number | null
  /** Che cosa si sta cambiando, finché dura. */
  riempimentoCosa: Consumabile | null
  paziente: Paziente
  /** Il seme delle irregolarità: uguale su tutti gli schermi, o le onde divergono. */
  seme: number
  /**
   * L'origine del treno spontaneo, spostata perché la fase non salti.
   *
   * Viaggia nell'istantanea come il seme, e per la stessa ragione: se ogni
   * schermo se la calcolasse per conto suo, l'iPad e il monitor in sala
   * disegnerebbero due atti diversi dello stesso paziente. Chi la muove è
   * `batti()`, quando la frequenza spontanea cambia — vedi `fisica.ts`.
   */
  sfasamentoSpontaneo: number
  /**
   * La frequenza per cui lo sfasamento qui sopra è stato calcolato.
   *
   * Serve solo a `batti()` per accorgersi che la frequenza è cambiata: senza,
   * dovrebbe confrontarsi con un'istantanea precedente che non ha.
   */
  frequenzaFase: number
  /**
   * OVS 3.3: da quando si aspetta il respiro del paziente, per l'allarme
   * d'apnea. `chiave` è la condizione (modalità, standby…) in cui il conto è
   * cominciato: cambiandola il conto riparte, come sulla macchina vera.
   */
  apneaDa?: { chiave: string; sec: number } | null
  /** OVS 3.1: frazione d'atto non ancora contata dal regolatore PRVC. */
  prvcAtti?: number
  misure: Misure
  allarmi: AllarmeAttivo[]
  limiti: LimitiAllarme
  /** Fino a quando gli allarmi tacciono, nel tempo del ventilatore (secondi). */
  silenziatoFinoA: number
  /**
   * Quando l'apparecchio è stato acceso, in millisecondi epoch.
   *
   * Da qui ogni schermo ricava il **suo** tempo del ventilatore, e siccome
   * partono tutti dallo stesso istante disegnano lo stesso punto della stessa
   * curva. Un orologio locale per schermo darebbe tre onde sfasate dello stesso
   * paziente, ed è il difetto che sullo specchio si vede subito.
   */
  accesoDa: number
}

/** I circuiti che si scelgono in quell'ambiente, il predefinito per primo (§602). */
export const CIRCUITI_PER_AMBIENTE: Record<Ambiente, Circuito[]> = {
  invasiva: ['hme', 'umidificatore'],
  niv: ['bitubo', 'monotubo'],
  'alto-flusso': [],
  anestesia: [],
}

/** Il circuito scelto se vale in quell'ambiente, se no il predefinito, o niente. */
export function circuitoDellAmbiente(ambiente: Ambiente, scelto?: string | null): Circuito | null {
  const possibili = CIRCUITI_PER_AMBIENTE[ambiente] ?? []
  return possibili.find((c) => c === scelto) ?? possibili[0] ?? null
}

/**
 * L'apparecchio col circuito del setup, o con quello che la regia sceglie prima dell'avvio.
 * È una premessa del caso e non un gesto dei discenti: l'autotest resta com'è. L'umidificatore
 * segue, spento col filtro HME e acceso con l'umidificatore.
 */
export function conCircuito(istantanea: VentIstantanea, scelto?: string | null): VentIstantanea {
  const circuito = circuitoDellAmbiente(istantanea.ambiente, scelto)
  if (circuito === (istantanea.circuito ?? null)) return istantanea
  const u = istantanea.umidificatore
  return {
    ...istantanea,
    circuito,
    umidificatore: u && circuito ? { ...u, acceso: circuito !== 'hme' } : u,
  }
}

/** Il registro di chi accende l'umidificatore sopra il filtro HME: si lascia fare e si annota. */
export const ERRORE_HME_E_UMIDIFICATORE = 'errore-hme-e-umidificatore'

/** Il tempo del ventilatore adesso, in secondi. */
export function orologio(istantanea: VentIstantanea, adessoMs = Date.now()): number {
  return Math.max(0, (adessoMs - istantanea.accesoDa) / 1000)
}

/** Lo stato che serve al motore, estratto dall'istantanea. */
export function statoDa(istantanea: VentIstantanea): StatoVentilatore {
  return {
    ambiente: istantanea.ambiente,
    modalita: istantanea.modalita,
    respiro: istantanea.respiro,
    ventilando: istantanea.ventilando,
    impostazioni: istantanea.impostazioni,
    fisiologia: istantanea.fisiologia,
    drive: istantanea.drive,
    asincronia: istantanea.asincronia,
    manovra: istantanea.manovra,
    gas: istantanea.gas,
    altoFlusso: istantanea.altoFlusso,
    umidificatore: istantanea.umidificatore ?? null,
    circuito: istantanea.circuito ?? null,
    perditaCalibrata: istantanea.autotestA !== null,
    paziente: istantanea.paziente,
    seme: istantanea.seme,
    sfasamentoSpontaneo: istantanea.sfasamentoSpontaneo ?? 0,
    manovraDa: istantanea.manovraDa ?? null,
  }
}

/**
 * Un ventilatore appena acceso in quell'ambiente.
 *
 * Parte **fermo**, ed è la stessa scelta del monitor spento: l'apparecchio in
 * stanza c'è prima che qualcuno lo colleghi, e accenderlo è un gesto che
 * appartiene a chi sta al letto. In anestesia parte anche **a pallone**, perché
 * è così che comincia ogni induzione.
 */
export function istantaneaIniziale(
  ambiente: Ambiente,
  accesoDa = Date.now(),
  paziente: Paziente = { pesoKg: null, etco2: null, spo2: null, heartRate: null, map: null },
  scelto?: string | null,
): VentIstantanea {
  const anestesia = ambiente === 'anestesia'
  const circuito = circuitoDellAmbiente(ambiente, scelto)
  return {
    ambiente,
    modalita: MODALITA_PER_AMBIENTE[ambiente][0],
    // §665 (l'utente: «deve partire in VC e non in manuale»): anche la macchina d'anestesia nasce sul
    // selettore meccanico, in standby; il pallone la porta in manuale da sé al primo atto
    respiro: 'meccanica',
    ventilando: false,
    impostazioni: { ...IMPOSTAZIONI_INIZIALI },
    fisiologia: { ...FISIOLOGIA_NORMALE },
    drive: { ...DRIVE_ASSENTE },
    asincronia: null,
    manovra: null,
    manovraDa: null,
    manovraEsito: null,
    baseManovra: null,
    autotestA: null,
    gas: anestesia ? { ...STATO_GAS_INIZIALE, livelli: { ...STATO_GAS_INIZIALE.livelli } } : null,
    altoFlusso:
      ambiente === 'alto-flusso'
        ? { interfaccia: 'adulto', disinfezione: 'pulito', inRiscaldamento: false }
        : null,
    // L'umidificatore c'è sui tre ventilatori e non in anestesia: là il
    // circuito è chiuso e l'umidità la fa la calce.
    // Col filtro HME l'umidificatore resta spento: tutti e due sono un errore (§602).
    umidificatore: anestesia ? null : { ...STATO_UMIDIFICATORE_INIZIALE, acceso: circuito !== 'hme' },
    circuito,
    riempimentoDa: null,
    riempimentoCosa: null,
    paziente,
    seme: 1,
    sfasamentoSpontaneo: 0,
    frequenzaFase: 0,
    misure: { ...MISURE_VUOTE },
    allarmi: [],
    limiti: { ...LIMITI_INIZIALI },
    silenziatoFinoA: 0,
    accesoDa,
  }
}

/**
 * Il battito della regia: misura, consuma, guarda gli allarmi.
 *
 * Si chiama a intervalli qualunque — `dtSec` entra nelle formule — e non ha
 * memoria propria: quello che deve ricordare sta dentro l'istantanea che le si
 * passa. Restituisce sempre un oggetto nuovo, perché l'istantanea si sostituisce
 * intera.
 */
/**
 * Sposta l'origine del treno spontaneo perché la fase resti dov'è.
 *
 * Si chiama a ogni battito e non fa niente finché la frequenza non cambia.
 * Quando cambia — la rampa, un nuovo stato clinico, la regia che gira la
 * manopola — calcola a che punto del respiro era il paziente e sceglie
 * l'origine che rimette quel punto lì con il periodo nuovo.
 *
 * Frequenza a zero non ha fase: si tiene lo sfasamento com'è, così un paziente
 * che si riaddormenta e si risveglia riprende da dove aveva lasciato invece di
 * ripartire da un atto tagliato a metà.
 */
function riallineaFase(istantanea: VentIstantanea, tSec: number): VentIstantanea {
  const nuova = driveEfficace(istantanea.drive).frequenza
  const vecchia = istantanea.frequenzaFase ?? 0
  if (nuova === vecchia) return istantanea
  // OVS 3.1: un paziente che **riprende** a respirare non riparte in fase con
  // la macchina. Con l'origine a zero e la stessa frequenza dei due treni ogni
  // sforzo cadeva dentro l'atto meccanico e restava invisibile — la
  // decurarizzazione a 12 su una macchina a 12 non mostrava niente. Il primo
  // sforzo cade a metà espirazione.
  if (nuova > 0 && vecchia <= 0 && istantanea.ventilando) {
    const ciclo = 60 / Math.max(1, Number(istantanea.impostazioni.frequency) || 12)
    return { ...istantanea, sfasamentoSpontaneo: tSec - (tSec % ciclo) + ciclo * 0.6, frequenzaFase: nuova }
  }
  if (nuova <= 0 || vecchia <= 0) return { ...istantanea, frequenzaFase: nuova }
  const periodoVecchio = 60 / vecchia
  const periodoNuovo = 60 / nuova
  const sfasamento = istantanea.sfasamentoSpontaneo ?? 0
  // **Si tiene fermo l'istante dentro l'atto, non la frazione di ciclo.**
  //
  // Conservare la frazione sembrava la cosa giusta e non lo era: la forma
  // dell'inspirazione non si allunga col ciclo — dura al massimo un secondo,
  // sempre — quindi tenendo ferma la frazione un atto cominciato mezzo secondo
  // fa si ritrovava di colpo a metà espirazione. Il paziente che rallenta non
  // stira il respiro che sta facendo: lo finisce, e il prossimo arriva più
  // tardi. La prova lo misura come scalino sulla curva.
  const dentro = (((tSec - sfasamento) % periodoVecchio) + periodoVecchio) % periodoVecchio
  return {
    ...istantanea,
    sfasamentoSpontaneo: tSec - (dentro % periodoNuovo),
    frequenzaFase: nuova,
  }
}

export function batti(istantanea: VentIstantanea, tSec: number, dtSec: number): VentIstantanea {
  // ## La fase del respiro spontaneo non salta quando la frequenza cambia
  //
  // Va fatto **prima** di tutto il resto: le misure e le onde di questo giro
  // devono già vedere l'origine giusta. La rampa dell'addormentamento sposta
  // la frequenza a ogni battito, e senza questa correzione `tSec % periodo`
  // manda la traccia a metà di un atto che non è mai cominciato — sul pallone
  // dell'anestesia, dove la curva è fatta solo di questo, si vedeva come atti
  // che si spezzano e ripartono a caso.
  //
  // Il conto è: dov'era la fase con il periodo vecchio, lì deve restare con
  // quello nuovo. `origine = t − fase · periodoNuovo`.
  istantanea = riallineaFase(istantanea, tSec)
  istantanea = regolaPrvc(istantanea, dtSec)
  const stato = statoDa(istantanea)
  const misure = misura(stato, tSec, dtSec, istantanea.misure)
  const consumati = avanza(stato, dtSec, tSec)

  // Il flush d'ossigeno finisce da sé: trenta secondi e la FiO₂ torna dov'era.
  // Non è un'azione di nessuno, quindi non passa da `applica()` — succede.
  let gas = consumati.gas
  if (gas && gas.flushFinoA > 0 && tSec >= gas.flushFinoA) gas = { ...gas, flushFinoA: 0 }

  let prossima: VentIstantanea = {
    ...istantanea,
    gas,
    altoFlusso: consumati.altoFlusso,
    umidificatore: consumati.umidificatore,
    misure,
  }

  // ## Il consumabile si cambia in mezzo minuto, e solo allora è pieno
  //
  // Stessa forma della manovra qui sotto: il device disegna l'operazione che
  // avanza, e chi tiene il tempo la conclude. Non è un'azione di nessuno —
  // succede — quindi non passa da `applica()`.
  if (
    prossima.riempimentoDa !== null &&
    prossima.riempimentoCosa !== null &&
    tSec - prossima.riempimentoDa >= RIEMPIMENTO_SECONDI
  ) {
    const esito = prossima.gas
      ? riempi(
          prossima.gas,
          prossima.riempimentoCosa,
          prossima.impostazioni.fgf,
          !prossima.ventilando,
        )
      : { stato: null, errore: true }
    prossima = {
      ...prossima,
      // Se nel frattempo qualcuno ha riaperto i gas, il cambio **non si
      // conclude**: il consumabile resta com'era. È la stessa regola di
      // prima, applicata alla fine invece che all'inizio, perché fra l'inizio
      // e la fine ci sono trenta secondi in cui la macchina può cambiare.
      gas: esito.stato ?? prossima.gas,
      riempimentoDa: null,
      riempimentoCosa: null,
    }
  }

  // ## La manovra finisce da sé, e solo allora dà i numeri
  //
  // Una pausa tenuta dura cinque secondi: prima il device mostra la barra che
  // avanza, e la misura non c'è — come sulla macchina vera, dove il numero
  // arriva quando l'occlusione si è assestata. Allo scadere l'esito si scrive
  // nell'istantanea (così lo leggono tutti gli schermi, anche chi si collega
  // dopo) e la manovra si rilascia: non è un'azione di nessuno, quindi non
  // passa da `applica()` — succede.
  //
  // Il **reclutamento sostenuto** dura un minuto invece di cinque secondi, e in
  // più può finire prima: se il paziente non la regge, l'apparecchio molla la
  // pressione e **dice perché** (`motivoInterruzione`).
  if (prossima.manovra && prossima.manovraDa != null) {
    const tenuta = tSec - prossima.manovraDa
    const quanto = prossima.manovra === 'reclutamento' ? RECLUTAMENTO_SECONDI : MANOVRA_SECONDI
    // ## I criteri guardano la **risposta**, non il punto di partenza
    //
    // I primi secondi non contano: la pressione deve prima arrivare, e il
    // circolo ci mette il suo tempo (`TAU_TORACE`, quattro secondi). Senza
    // questa grazia un paziente già al limite faceva scattare l'interruzione al
    // primo battito — misurato nell'app su uno stato a media 60: la manovra
    // finiva a **zero secondi**, cioè l'aula non vedeva mai la pressione salire,
    // e la lezione («guarda che cosa succede al monitor») non c'era.
    const stop =
      prossima.manovra === 'reclutamento' && tenuta >= GRAZIA_MANOVRA_SECONDI
        ? motivoInterruzione(prossima, prossima.baseManovra, misure)
        : null
    if (stop !== null || tenuta >= quanto) {
      const esito = esitoManovra(statoDa(prossima), prossima.manovra, misure, tSec)
      prossima = {
        ...prossima,
        manovraEsito: {
          manovra: prossima.manovra,
          valori: { ...esito, secondi: Math.round(tenuta * 10) / 10 },
          aSec: tSec,
          interrotta: stop,
        },
        manovra: null,
        manovraDa: null,
        baseManovra: null,
      }
    }
  }

  // Le istantanee di prima della 3.3 non hanno il limite d'apnea, o ce l'hanno senza tempo
  // (l'interruttore del §668): si completa con quello di fabbrica.
  const salvati = prossima.limiti
  const limiti = conLimiteDellAgente(
    salvati.apnea?.alto != null
      ? salvati
      : { ...salvati, apnea: { ...LIMITI_INIZIALI.apnea, acceso: salvati.apnea?.acceso ?? true } },
    prossima.gas?.agenti[0],
  )
  const apneaDa = attesaRespiro(prossima, tSec)
  const apneaSec = apneaDa ? Math.max(0, tSec - apneaDa.sec) : null
  return { ...prossima, limiti, apneaDa, allarmi: valuta(statoDa(prossima), misure, limiti, apneaSec) }
}

/**
 * Da quando l'apparecchio aspetta un atto del paziente, o nulla dove non lo
 * aspetta (controllata, standby, manuale, manovra).
 *
 * Il motore ricalcola i blocchi con il drive **di adesso**, quindi chiedergli
 * «quando è stato l'ultimo atto» a drive spento risponderebbe «mai»: il conto
 * si tiene nell'istantanea e avanza solo in avanti, battito dopo battito.
 */
function attesaRespiro(ist: VentIstantanea, tSec: number): VentIstantanea['apneaDa'] {
  const stato = statoDa(ist)
  if (!motoreCopre(stato) || stato.manovra || !MODALITA_CON_APNEA.includes(stato.modalita)) return null
  const chiave = `${stato.ambiente}|${stato.modalita}|${stato.respiro}|${ist.accesoDa}`
  const prima = ist.apneaDa && ist.apneaDa.chiave === chiave ? ist.apneaDa.sec : tSec
  let ultimo = prima
  for (const a of attiRecenti(tSec, stato, 20)) if (a.innescato && a.inizio > ultimo) ultimo = a.inizio
  return { chiave, sec: Math.min(tSec, ultimo) }
}

/** Il passo per cui il battito è tarato, e il più lungo che fa in una volta. */
export const PASSO_BATTITO_SEC = 2
/**
 * Oltre questo il recupero si ferma: una regia rimasta sospesa per un'ora non
 * deve ricalcolare l'ora intera in un colpo solo, né scaricare il vaporizzatore
 * di un'ora in cui nessuno guardava.
 */
export const RECUPERO_MASSIMO_SEC = 15 * 60

/**
 * Il battito da `daSec` a `aSec`, in passi da non più di `PASSO_BATTITO_SEC`.
 *
 * Il tempo si misura dall'orologio, non si conta dai colpi: un battito che
 * arriva dopo un minuto (la scheda nascosta, il Worker che non c'è) recupera
 * il minuto intero, invece di farne passare due secondi. `prima` prepara ogni
 * passo — la rampa del respiro spontaneo, che si legge all'istante del passo.
 * Senza un battito precedente (`daSec` nullo, o un orologio ripartito) vale un
 * passo solo.
 */
export function battiFino(
  istantanea: VentIstantanea,
  daSec: number | null,
  aSec: number,
  prima: (istantanea: VentIstantanea, tSec: number) => VentIstantanea = (i) => i,
): VentIstantanea {
  const trascorso =
    daSec === null || aSec <= daSec ? PASSO_BATTITO_SEC : Math.min(aSec - daSec, RECUPERO_MASSIMO_SEC)
  const passi = Math.max(1, Math.ceil(trascorso / PASSO_BATTITO_SEC - 1e-9))
  const dt = trascorso / passi
  let ist = istantanea
  for (let i = passi - 1; i >= 0; i--) {
    const t = aSec - i * dt
    ist = batti(prima(ist, t), t, dt)
  }
  return ist
}

/** Quanto dura una pausa tenuta prima che la misura arrivi, in secondi. */
export const MANOVRA_SECONDI = 5

/**
 * Quanti secondi passano prima che i criteri d'interruzione comincino a
 * guardare.
 *
 * Cinque: il tempo perché la pressione arrivi al circolo (la costante di salita
 * è quattro secondi) e la risposta sia una risposta invece che il punto di
 * partenza. Restano ben dentro i «cinque-dieci secondi» in cui la fonte misura
 * la caduta, quindi un paziente che crolla davvero si interrompe comunque
 * mentre sta crollando.
 */
export const GRAZIA_MANOVRA_SECONDI = 5

/**
 * I criteri d'interruzione del reclutamento sostenuto, e quale è scattato.
 *
 * Quattro, e sono quelli che si insegnano prima di lasciar fare la manovra a
 * qualcuno — media sotto 60 o caduta di oltre 30 dal basale; bradicardia sotto
 * 50; desaturazione sotto l'85% o calo di oltre cinque punti; pressione delle
 * vie aeree oltre il limite d'allarme, che è il sospetto di barotrauma.
 * *(Nielsen, Intensive Care Med 2005; ART Investigators, JAMA 2017.)*
 *
 * ## Perché il **basale**, e non solo le soglie
 *
 * «Media sotto 60» non basta: un paziente che sta a 65 e scende a 62 non è in
 * pericolo, e uno che sta a 110 e crolla a 75 lo è eccome, pur restando sopra
 * ogni soglia. La caduta si misura da dove il paziente stava **quando la
 * manovra è cominciata** (`baseManovra`), che è l'unico basale che vuol dire
 * qualcosa. È la stessa idea dell'ancoraggio del giro 4-bis, applicata a un
 * allarme invece che a un modello.
 *
 * Torna la chiave di traduzione del motivo, o `null` se si può continuare. Se
 * in stanza non c'è un monitor i due criteri circolatori non scattano: un
 * apparecchio non inventa quello che non gli arriva.
 */
export function motivoInterruzione(
  istantanea: VentIstantanea,
  base: BaseManovra | null,
  misure: Misure,
): TranslationKey | null {
  const p = istantanea.paziente
  if (p.map !== null && (p.map < 60 || (base?.map != null && base.map - p.map > 30))) {
    return 'vent.stop.pressione'
  }
  if (p.heartRate !== null && p.heartRate < 50) return 'vent.stop.bradicardia'
  if (p.spo2 !== null && (p.spo2 < 85 || (base?.spo2 != null && base.spo2 - p.spo2 > 5))) {
    return 'vent.stop.saturazione'
  }
  const picco = misure.pPeak
  const tetto = istantanea.limiti.pPeak?.alto ?? null
  if (picco !== null && tetto !== null && picco > tetto) return 'vent.stop.barotrauma'
  return null
}

/** Dov'era il paziente quando la manovra è cominciata: il metro delle cadute. */
export interface BaseManovra {
  map: number | null
  spo2: number | null
}

/**
 * Una richiesta di un device, applicata.
 *
 * Restituisce l'istantanea nuova e — quando c'è — il nome dell'evento da
 * mettere nel registro **oltre** all'azione stessa: oggi è solo il riempimento
 * a gas aperti, che riesce e resta scritto.
 *
 * Le azioni che non hanno senso adesso non fanno niente e non protestano: un
 * device che ha in mano un'istantanea di mezzo secondo fa può chiedere di
 * togliere un vaporizzatore che nel frattempo è già stato tolto, e trattarlo
 * come un errore vorrebbe dire far comparire un avviso per una corsa fra due
 * messaggi.
 */
export function applica(
  istantanea: VentIstantanea,
  azione: AzioneVentilatore,
  tSec: number,
): { istantanea: VentIstantanea; registro?: string } {
  switch (azione.tipo) {
    case 'modalita': {
      if (!MODALITA_PER_AMBIENTE[istantanea.ambiente].includes(azione.modalita)) return { istantanea }
      // PRVC parte dall'atto di prova e da lì si regola da sé (prvc.ts).
      if (azione.modalita === 'PRVC' && istantanea.modalita !== 'PRVC') {
        return { istantanea: { ...istantanea, modalita: 'PRVC', prvcAtti: 0, impostazioni: { ...istantanea.impostazioni, pressureTarget: PRVC_PROVA } } }
      }
      return { istantanea: { ...istantanea, modalita: azione.modalita } }
    }

    case 'respiro': {
      // Il selettore esiste solo in anestesia: altrove il pallone non c'è, e
      // accettarlo lo stesso vorrebbe dire poter mettere una terapia intensiva
      // in uno stato che non esiste su nessuna macchina.
      if (istantanea.ambiente !== 'anestesia') return { istantanea }
      return {
        istantanea: {
        ...istantanea,
        respiro: azione.respiro,
        manovra: null,
        manovraDa: null,
        baseManovra: null,
      },
      }
    }

    case 'standby':
      // Fermare l'apparecchio lascia cadere la manovra tenuta: una pausa su una
      // macchina in standby è una lettura che non vuol dire niente.
      return {
        istantanea: {
          ...istantanea,
          ventilando: azione.ventilando,
          manovra: azione.ventilando ? istantanea.manovra : null,
          manovraDa: azione.ventilando ? istantanea.manovraDa : null,
          baseManovra: azione.ventilando ? istantanea.baseManovra : null,
        },
      }

    case 'parametro': {
      const attuale = istantanea.impostazioni[azione.chiave]
      // Il tipo deve combaciare: un numero dove va una stringa — o il contrario
      // — è un messaggio malformato, e si butta invece di scriverlo dentro.
      if (typeof attuale !== typeof azione.valore) return { istantanea }
      return {
        istantanea: {
          ...istantanea,
          impostazioni: macEdEtInsieme(
            { ...istantanea.impostazioni, [azione.chiave]: azione.valore },
            azione.chiave,
            istantanea.gas,
          ),
        },
      }
    }

    case 'autotest':
      // Si fa da fermi: una macchina che ventila non si mette a provare le
      // valvole. Il device che lo lancia mostra i passaggi; qui resta il fatto.
      if (istantanea.ventilando) return { istantanea }
      return { istantanea: { ...istantanea, autotestA: tSec } }

    case 'silenzia':
      return { istantanea: { ...istantanea, silenziatoFinoA: tSec + SILENZIO_SECONDI } }

    case 'manovra': {
      if (!istantanea.ventilando) return { istantanea }
      // Cominciare fa partire il conto dei cinque secondi; lasciare prima del
      // tempo annulla e **non** produce nessuna misura: una pausa interrotta
      // non ha misurato niente. L'esito lo deposita `batti()`, allo scadere.
      if (azione.manovra === null) {
        return { istantanea: { ...istantanea, manovra: null, manovraDa: null, baseManovra: null } }
      }
      return {
        istantanea: {
          ...istantanea,
          manovra: azione.manovra,
          manovraDa: tSec,
          // Il basale si fissa **premendo**: da qui si misurano le cadute.
          baseManovra: { map: istantanea.paziente.map, spo2: istantanea.paziente.spo2 },
        },
      }
    }

    case 'gas-agente': {
      const gas = istantanea.gas
      if (!gas) return { istantanea }
      const montato = gas.agenti.includes(azione.agente)
      if (azione.monta === montato) return { istantanea }
      let agenti: typeof gas.agenti
      if (azione.monta) {
        // Due vaporizzatori è il massimo del carrello. Il terzo non scalza uno
        // di quelli montati: sulla macchina vera non c'è il posto, e basta.
        if (gas.agenti.length >= MASSIMO_AGENTI) return { istantanea }
        agenti = [...gas.agenti, azione.agente]
      } else {
        agenti = gas.agenti.filter((a) => a !== azione.agente)
      }
      return { istantanea: { ...istantanea, gas: { ...gas, agenti } } }
    }

    case 'gas-erogazione': {
      if (!istantanea.gas) return { istantanea }
      return {
        istantanea: { ...istantanea, gas: { ...istantanea.gas, erogazione: azione.erogazione } },
      }
    }

    case 'gas-flush': {
      if (!istantanea.gas) return { istantanea }
      return {
        istantanea: { ...istantanea, gas: { ...istantanea.gas, flushFinoA: tSec + FLUSH_SECONDI } },
      }
    }

    case 'riempi': {
      const gas = istantanea.gas
      if (!gas) return { istantanea }
      // **A gas aperti non comincia nemmeno.** Il tentativo resta nel
      // registro — serviva al debriefing e serve ancora — ma la macchina non
      // si lascia riempire: versare agente col circuito in pressione non è una
      // cattiva idea, è una cosa che non si fa.
      if (!gasChiusi(gas, istantanea.impostazioni.fgf, !istantanea.ventilando)) {
        return { istantanea, registro: ERRORE_RIEMPIMENTO }
      }
      // Già in corso: premere di nuovo non ricomincia da capo, o si potrebbe
      // tenere il canister in aria per sempre premendo ogni ventinove secondi.
      if (istantanea.riempimentoDa !== null) return { istantanea }
      return {
        istantanea: {
          ...istantanea,
          riempimentoDa: tSec,
          riempimentoCosa: azione.consumabile,
        },
      }
    }

    case 'limite': {
      const prossimo = spostaLimite(azione.chiave, istantanea.limiti[azione.chiave], azione.estremo, azione.verso)
      return { istantanea: { ...istantanea, limiti: { ...istantanea.limiti, [azione.chiave]: prossimo } } }
    }

    case 'allarme':
      return {
        istantanea: {
          ...istantanea,
          limiti: {
            ...istantanea.limiti,
            [azione.chiave]: { ...istantanea.limiti[azione.chiave], acceso: azione.acceso },
          },
        },
      }

    case 'limiti-iniziali':
      return {
        istantanea: {
          ...istantanea,
          limiti: conLimiteDellAgente({ ...LIMITI_INIZIALI }, istantanea.gas?.agenti[0]),
        },
      }

    case 'interfaccia': {
      const af = istantanea.altoFlusso
      if (!af) return { istantanea }
      return { istantanea: { ...istantanea, altoFlusso: { ...af, interfaccia: azione.interfaccia } } }
    }

    case 'umidificatore': {
      const u = istantanea.umidificatore
      if (!u) return { istantanea }
      const prossima = { ...istantanea, umidificatore: { ...u, acceso: azione.acceso } }
      // Umidificatore e filtro HME insieme: più resistenza e più condensa. Non si impedisce,
      // si annota, come gli altri errori voluti.
      if (azione.acceso && istantanea.circuito === 'hme') {
        return { istantanea: prossima, registro: ERRORE_HME_E_UMIDIFICATORE }
      }
      return { istantanea: prossima }
    }

    case 'circuito': {
      // Si cambia da fermi, e il circuito nuovo va riprovato: la compliance e la perdita
      // dell'autotest erano di quello di prima (§602, decisione dell'utente).
      if (istantanea.ventilando || istantanea.circuito === azione.circuito) return { istantanea }
      if (!(CIRCUITI_PER_AMBIENTE[istantanea.ambiente] ?? []).includes(azione.circuito)) return { istantanea }
      return { istantanea: { ...istantanea, circuito: azione.circuito, autotestA: null } }
    }

    case 'potenza': {
      const u = istantanea.umidificatore
      if (!u) return { istantanea }
      // Fra i due fermi della manopola, e sempre un intero: cinque tacche, non
      // un cursore continuo — è così che sta scritto sull'apparecchio.
      const potenza = Math.round(
        Math.min(POTENZA_MASSIMA, Math.max(POTENZA_MINIMA, azione.potenza)),
      )
      return { istantanea: { ...istantanea, umidificatore: { ...u, potenza } } }
    }

    case 'disinfezione': {
      const af = istantanea.altoFlusso
      if (!af) return { istantanea }
      return { istantanea: { ...istantanea, altoFlusso: { ...af, disinfezione: 'pulito' } } }
    }
  }
}

/**
 * Se il paziente è attaccato alla macchina che lo scenario propone.
 *
 * Una macchina può stare in stanza senza ventilare nessuno: all'inizio di un'induzione
 * l'ambiente è «anestesia» e il paziente respira da sé. Lo dice la regolazione: chi ventila
 * ha una modalità o dei numeri, e il dispositivo che si dichiara in standby non ventila.
 */
export function attaccatoAllaMacchina(ventilazione: Record<string, unknown> | null | undefined): boolean {
  if (!ventilazione || ambienteDaScenario(ventilazione.environment as string | undefined) === null) return false
  if (/stand[- ]?by/i.test(String(ventilazione.device ?? ''))) return false
  const numero = (k: string) => typeof ventilazione[k] === 'number'
  return Boolean(ventilazione.mode) || numero('rate') || numero('tidal_volume_ml') || numero('peep') || numero('fio2_percent')
}

/**
 * L'ambiente proposto dallo scenario, tradotto in quello di casa.
 *
 * Lo scenario **propone** e la regia decide (decisione 3 del piano): questa
 * funzione fa solo la prima metà. I nomi dello schema sono in inglese perché
 * l'archivio e la generazione lo sono; qui dentro si parla italiano, e la
 * conversione sta in un posto solo — se ce ne fossero due, il giorno che si
 * aggiunge un ambiente ne resterebbe indietro una.
 */
export function ambienteDaScenario(environment: string | null | undefined): Ambiente | null {
  switch (environment) {
    case 'anesthesia':
      return 'anestesia'
    case 'icu_invasive':
      return 'invasiva'
    case 'icu_niv':
      return 'niv'
    case 'high_flow':
      return 'alto-flusso'
    default:
      return null
  }
}

/**
 * La modalità che lo scenario scrive in prosa, in quella della macchina.
 * `null` quando non si riconosce: allora resta quella dell'apparecchio.
 */
export function modalitaDaScenario(testo: string | null | undefined): Modalita | null {
  const t = String(testo ?? '').trim().toLowerCase()
  if (!t) return null
  if (/simv/.test(t)) return 'SIMV'
  if (/cpap/.test(t)) return 'CPAP'
  if (/\bps\b|psv|support|supporto/.test(t)) return 'PS'
  if (/\bpc\b|pcv|pressometric|pressure.control|controllo di pressione|a pressione/.test(t)) return 'PC'
  if (/\bvc\b|vcv|volumetric|volume.control|controllo di volume|a volume/.test(t)) return 'VC'
  if (/alto flusso|high.flow|hfnc/.test(t)) return 'AF'
  return null
}

/**
 * La macchina regolata come la sezione 2 dice che va all'avvio (§388):
 * modalità, volume corrente, frequenza, PEEP e FiO₂.
 *
 * Lo scenario proponeva solo l'ambiente e la macchina partiva coi valori di
 * fabbrica — VC · FiO₂ 40% sotto uno scenario che scrive FiO₂ 100%, FR 12, Vt
 * 450. Un campo vuoto lascia quello di fabbrica; un valore fuori scala si
 * porta al bordo della manopola, come farebbe la mano; una modalità che
 * quell'apparecchio non ha si ignora (`applica`).
 */
export function conVentilazioneDelloScenario(
  ist: VentIstantanea,
  ventilazione: Record<string, unknown> | null | undefined,
): VentIstantanea {
  if (!ventilazione) return ist
  let fuori = ist
  const modalita = modalitaDaScenario(ventilazione.mode as string | undefined)
  if (modalita) fuori = applica(fuori, { tipo: 'modalita', modalita }, 0).istantanea
  const numeri: [keyof Impostazioni & ('volume' | 'frequency' | 'peep' | 'fio2'), unknown][] = [
    ['volume', ventilazione.tidal_volume_ml],
    ['frequency', ventilazione.rate],
    ['peep', ventilazione.peep],
    ['fio2', ventilazione.fio2_percent],
  ]
  for (const [chiave, grezzo] of numeri) {
    let valore = Number(grezzo)
    if (grezzo === null || grezzo === undefined || grezzo === '' || !Number.isFinite(valore)) continue
    // Una FiO₂ scritta come frazione (0,5) è il cinquanta per cento.
    if (chiave === 'fio2' && valore > 0 && valore <= 1) valore *= 100
    const def = PARAMETRI[chiave]
    const min = typeof def.min === 'number' ? def.min : -Infinity
    const max = typeof def.max === 'number' ? def.max : Infinity
    const giusto = Math.max(min, Math.min(max, Math.round(valore)))
    fuori = applica(fuori, { tipo: 'parametro', chiave, valore: giusto }, 0).istantanea
  }
  return fuori
}

/**
 * Il polmone che lo scenario descrive, sulla macchina appena allestita (§392).
 *
 * La sessione d'aula su una paziente con ARDS è partita su «Normale», con la
 * compliance di un sano: il plateau che il caso dice di tenere sotto i 27 non
 * c'era modo di vederlo salire. Il quadro lo deduce il server dalla scheda
 * (`domain/proposte_aula.py`) e qui si mette addosso, come farebbe il pulsante.
 *
 * **Il drive del quadro solo dove il paziente respira da sé.** In invasiva e in
 * anestesia chi arriva è sedato e passivo, e un ARDS che tira venticinque atti
 * contro la macchina sarebbe un'asincronia che nessuno ha deciso; in NIV e ad
 * alti flussi invece il respiro è il suo, e il quadro lo porta con sé.
 */
export function conPolmoneDelloScenario(
  ist: VentIstantanea,
  preset: string | null | undefined,
): VentIstantanea {
  if (!preset || !(preset in PRESET_FISIOLOGIA)) return ist
  const chiave = preset as PresetFisiologia
  const quadro = PRESET_FISIOLOGIA[chiave]
  const spontaneo = ist.ambiente === 'niv' || ist.ambiente === 'alto-flusso'
  return {
    ...ist,
    fisiologia: { ...quadro.fisiologia, preset: chiave },
    drive: spontaneo ? { ...quadro.drive } : ist.drive,
  }
}

/**
 * La MAC obiettivo e l'Et obiettivo sono lo stesso bersaglio scritto in due
 * unità (§402): girata una, l'altra la segue. Prima restavano separate — MAC
 * 0,7 accanto a «Et 5,5%» — e l'Et non muoveva niente, perché la macchina
 * lavora sulla MAC.
 */
function macEdEtInsieme(imp: Impostazioni, chiave: string, gas: StatoGas | null): Impostazioni {
  if (!gas || gas.agenti.length === 0) return imp
  if (chiave === 'targetMac') {
    return { ...imp, targetEtPrimaryAgent: Number(bersaglioEt(imp.targetMac, gas.agenti, 0, gas.etaAnni).toFixed(1)) }
  }
  if (chiave === 'targetEtPrimaryAgent') {
    const mac = (imp.targetEtPrimaryAgent * gas.agenti.length) / macDi(gas.agenti[0], gas.etaAnni)
    return { ...imp, targetMac: Math.max(0.1, Math.min(3, mac)) }
  }
  return imp
}
