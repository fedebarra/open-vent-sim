/**
 * Lo stato del ventilatore, e i numeri che ne discendono.
 *
 * ## Una funzione, non un ciclo
 *
 * Nel simulatore d'origine tutto questo stava in `updateSimulationState`: una
 * `useCallback` di trecentocinquanta righe che leggeva quindici pezzi di stato
 * React, ne scriveva altri sei con `setQualcosa` mentre calcolava, e girava
 * dentro un `setInterval` ogni due secondi. Funziona in un'app dove la macchina
 * e la schermata sono la stessa cosa. Qui no: la fisica gira **in regia**, che è
 * l'unico produttore dell'istantanea (§118), e i device disegnano da quello che
 * ricevono — come l'ECG, che si disegna dal ritmo e non dai battuti.
 *
 * Quindi qui non c'è nessun ciclo e nessuno stato: `misura()` prende lo stato e
 * restituisce i numeri, `avanza()` prende i consumabili e restituisce i
 * consumabili un po' più consumati. Chi tiene il tempo sta fuori.
 *
 * ## Il passo entra nelle formule
 *
 * Tutte le funzioni che consumano o inseguono un bersaglio prendono `dtSec`.
 * L'originale aveva il due secondi del tick moltiplicato dentro le formule, in
 * sei posti diversi: il giorno che qualcuno cambia il tick, l'agente si consuma
 * al doppio della velocità e nessuna prova se ne accorge, perché non c'era
 * niente da misurare. Qui il tick è un argomento, e le prove lo variano apposta.
 *
 * ## Che cosa non è modellato, detto qui
 *
 * In modalità controllate il ventilatore **tiene la sua cadenza**: uno sforzo
 * del paziente che cade in espirazione lascia una tacca, non fa partire un atto
 * assistito. È una semplificazione, e si vede: in assistita-controllata vera il
 * paziente tachipnoico trascina su la frequenza della macchina. Sta qui scritto
 * perché il giorno che serve, si aggiunge sapendo che mancava — non si scopre
 * guardando una curva e chiedendosi se è un difetto.
 */

import {
  assistito,
  frazioneInspiratoria,
  TEMPERATURA_AMBIENTE,
  MISURE_VUOTE,
  type Ambiente,
  type Disinfezione,
  type Impostazioni,
  type InterfacciaAltoFlusso,
  type Misure,
  type Modalita,
  type Respiro,
} from './parametri'
import {
  DRIVE_ASSENTE,
  PMUSC_MASSIMA,
  driveEfficace,
  quotaEfficace,
  type Drive,
  type ImpostazioniAsincronia,
} from './asincronie'
import {
  bersaglioEt,
  consumaAgente,
  consumaCalce,
  etAgenteProssimo,
  fiAgenteDa,
  fiCO2,
  macRaggiunta,
  type StatoGas,
} from './gas'
import { rumore } from './caso'
import { attiRecenti, campioneMotore, letturaCurvaLenta, motoreCopre } from './motore'
import type { Circuito } from '../../paziente/presidiFigura'

/**
 * Il polmone del paziente, e quanto tira.
 *
 * Compliance e resistenza sono **del paziente**, non della macchina: è la
 * distinzione che il simulatore d'origine perdeva tenendole in mezzo alle
 * impostazioni. Da qui discende che le cambia la regia quando cambia il quadro
 * clinico — un broncospasmo alza la resistenza — e che il ventilatore le
 * *misura*, non le decide.
 */
export interface Fisiologia {
  /** ml/cmH₂O. */
  compliance: number
  /**
   * La compliance della **parete toracica**, in ml/cmH₂O.
   *
   * È del paziente come tutto il resto di questo record, e non una costante:
   * decide **quanta** della pressione delle vie aeree arriva alla pleura
   * (`trasmissioneToracica`), cioè quanto il circolo sente la ventilazione.
   * Nell'adulto sano sta fra 150 e 200 (Gattinoni, *AJRCCM* 1998); l'obeso
   * patologico e l'addome teso la dimezzano o peggio (Pelosi, *Chest* 1998;
   * Malbrain, consensus IAH/ACS, *Intensive Care Med* 2006), e **la parete più
   * rigida trasmette di più**, che è il contrario di quello che sembra.
   */
  complianceParete: number
  /**
   * Quanto polmone c'è **da riaprire**, da 0 a 1.
   *
   * È la manopola che decide da che parte va la compliance quando si alza la
   * PEEP: verso l'alto se c'è alveolo chiuso che si riapre, verso il basso se
   * c'è solo alveolo aperto che si distende. Gattinoni (*NEJM* 2006) misura che
   * la quota reclutabile varia enormemente da paziente a paziente — è la
   * differenza fra il **recruiter** e il **non-recruiter**, e sono due malati
   * diversi con la stessa diagnosi scritta sopra. Zero non vuol dire polmone
   * sano: vuol dire che alzando la PEEP non si guadagna niente e si paga e
   * basta, che è il caso della broncopneumopatia iperinflata.
   */
  reclutabilita: number
  /** cmH₂O/l/s. */
  resistenza: number
  /** Quanto trattiene in espirazione: il grugnito, 0–1. */
  sforzoEspiratorio: number
  /** La «scodella» espiratoria dell'ostruito, 0–1. */
  limitazioneFlusso: number
  /** Le secrezioni che fanno gorgogliare le curve, 0–1. */
  secrezioni: number
  /** Quale quadro è stato scelto in regia, se ne è stato scelto uno. */
  preset: PresetFisiologia | null
  /**
   * Le oscillazioni cardiache sul flusso, 0–1 (facoltativo, 0 se manca).
   *
   * Il cuore batte contro il polmone e lascia sul flusso un'increspatura a ogni
   * sistole; con un trigger a flusso molto sensibile basta a far partire un
   * atto — è l'auto-trigger vero, quello che non ha bisogno di una perdita.
   */
  oscillazioniCardiache?: number
  /**
   * La pressione di apertura delle vie aeree, cmH₂O (facoltativa, 0 se manca).
   *
   * Sotto questa pressione le piccole vie si chiudono e il polmone resta
   * isolato dal ventilatore (Chen, *AJRCCM* 2018): con la PEEP più bassa la
   * pressione motrice letta è più alta di quella vera, e la pausa espiratoria
   * non vede l'aria intrappolata. Si trova con la curva a basso flusso.
   */
  aperturaVie?: number
  /**
   * La pressione esofagea a fine espirazione, cmH₂O (facoltativa).
   *
   * Manca = cinque, più la quota della PEEP che arriva alla parete. L'obeso e
   * l'addome teso stanno a quindici-venti: è lì che la PL espiratoria va
   * negativa e la PEEP guidata dalla Pes ha senso (Talmor, *NEJM* 2008).
   */
  pesBasale?: number
  /**
   * La perdita della maschera in NIV, l/min a 10 cmH₂O (facoltativa).
   *
   * Manca = la perdita piccola e casuale di sempre, solo sul display. Scritta
   * (anche zero) è una perdita **vera** nel motore: un orifizio, il flusso che
   * cresce con √Paw. La macchina la stima e la toglie, ma non del tutto: con una
   * perdita grande il flusso non scende mai alla soglia di ciclaggio e la PS
   * resta in inspirazione fino al tempo massimo; con una perdita che cambia il
   * trigger parte da solo; oltre il flusso massimo la pressione non arriva.
   */
  perditaMaschera?: number | null
}

export type PresetFisiologia =
  | 'normale'
  | 'bpco'
  | 'ards'
  | 'covid'
  | 'anafilassi'
  | 'edema-polmonare'
  | 'polmonite'
  | 'fibroscopia'

/**
 * Gli otto quadri, con il drive che ci va insieme.
 *
 * Il drive sta nel preset e non a parte perché un ARDS a quattordici atti al
 * minuto non è un ARDS: la frequenza spontanea fa parte del quadro tanto quanto
 * la compliance, e sceglierli separatamente vuol dire poterli sbagliare.
 *
 * ## La parete, e da dove escono i suoi numeri
 *
 * `complianceParete` è arrivata il 12 settembre 2026 col materiale del giro
 * 4-bis, e non è una manopola in più: è la metà del conto che dice quanto della
 * pressione delle vie aeree arriva al cuore. I valori non sono scelti a gusto.
 *
 * * Dove la letteratura misura la **parete**, si mette quella: nell'adulto sano
 *   150-200 ml/cmH₂O (Gattinoni, *AJRCCM* 1998), e qui si prende il mezzo, 175.
 *   Il polmone è l'organo malato nella broncopneumopatia, nella polmonite,
 *   nell'anafilassi e in fibroscopia: la gabbia resta quella.
 * * Dove la letteratura misura il **rapporto** — l'ARDS, dove Gattinoni e
 *   Pelosi trovano che alla pleura arriva il 20-30% — la parete si ricava da
 *   lì, perché il dato primario è quello: `C_w = C_rs / 0,25` fa 120 sull'ARDS
 *   (C_rs 30) e 130 sul covid (35). Non è un aggiustamento: un ARDS ha davvero
 *   la parete rigida — bilancio idrico positivo, edema, addome teso — ed è la
 *   ragione fisica per cui quel rapporto si misura così.
 * * L'edema polmonare e la polmonite stanno in mezzo, e il loro rapporto esce
 *   dal 20% scarso che è il bordo basso della stessa banda.
 */
export const PRESET_FISIOLOGIA: Record<
  PresetFisiologia,
  { fisiologia: Omit<Fisiologia, 'preset'>; drive: Drive }
> = {
  normale: {
    fisiologia: { compliance: 60, complianceParete: 175, reclutabilita: 0.15, resistenza: 8, sforzoEspiratorio: 0, limitazioneFlusso: 0, secrezioni: 0 },
    drive: { frequenza: 14, intensita: 0.7 },
  },
  bpco: {
    fisiologia: { compliance: 70, complianceParete: 175, reclutabilita: 0, resistenza: 20, sforzoEspiratorio: 0, limitazioneFlusso: 0.7, secrezioni: 0.3 },
    drive: { frequenza: 22, intensita: 0.2 },
  },
  ards: {
    fisiologia: { compliance: 30, complianceParete: 120, reclutabilita: 0.5, resistenza: 12, sforzoEspiratorio: 0, limitazioneFlusso: 0, secrezioni: 0 },
    drive: { frequenza: 25, intensita: 0.5 },
  },
  covid: {
    fisiologia: { compliance: 35, complianceParete: 130, reclutabilita: 0.35, resistenza: 10, sforzoEspiratorio: 0, limitazioneFlusso: 0, secrezioni: 0 },
    drive: { frequenza: 28, intensita: 0.6 },
  },
  anafilassi: {
    fisiologia: { compliance: 40, complianceParete: 175, reclutabilita: 0.1, resistenza: 25, sforzoEspiratorio: 0, limitazioneFlusso: 0.4, secrezioni: 0 },
    drive: { frequenza: 28, intensita: 0.7 },
  },
  'edema-polmonare': {
    fisiologia: { compliance: 30, complianceParete: 150, reclutabilita: 0.5, resistenza: 15, sforzoEspiratorio: 0, limitazioneFlusso: 0, secrezioni: 0 },
    drive: { frequenza: 26, intensita: 0.4 },
  },
  polmonite: {
    fisiologia: { compliance: 35, complianceParete: 175, reclutabilita: 0.2, resistenza: 14, sforzoEspiratorio: 0, limitazioneFlusso: 0, secrezioni: 0.6 },
    drive: { frequenza: 24, intensita: 0.3 },
  },
  fibroscopia: {
    fisiologia: { compliance: 40, complianceParete: 175, reclutabilita: 0.1, resistenza: 35, sforzoEspiratorio: 0.5, limitazioneFlusso: 0, secrezioni: 0 },
    drive: { frequenza: 10, intensita: 0.8 },
  },
}

export const FISIOLOGIA_NORMALE: Fisiologia = {
  ...PRESET_FISIOLOGIA.normale.fisiologia,
  preset: 'normale',
}

/**
 * Le manovre che si tengono premute.
 *
 * Le prime due **misurano** e durano cinque secondi. La terza non misura
 * niente: **reclutamento sostenuto**, la pressione tenuta a 35-45 cmH₂O per un
 * minuto o due (ART Investigators, *JAMA* 2017). È una terapia, non uno
 * strumento, e a differenza delle pause può **interrompersi da sé** quando il
 * paziente non la regge (`RECLUTAMENTO_SECONDI`, `motivoInterruzione`).
 */
export type Manovra =
  | 'pausa-inspiratoria'
  | 'pausa-espiratoria'
  | 'reclutamento'
  /** La curva pressione-volume a basso flusso: trova la pressione di apertura. */
  | 'curva-lenta'
  /** Il rapporto reclutamento/inflazione di Chen, da PEEP alta a PEEP bassa. */
  | 'rapporto-ri'
  | null

/** Sotto questa PEEP il rapporto R/I non si fa: non c'è un gradino di dieci. */
export const PEEP_MINIMA_RI = 10
/** La PEEP bassa del rapporto R/I, cmH₂O (Chen, *AJRCCM* 2020). */
export const PEEP_BASSA_RI = 5

/**
 * Quanto dura il reclutamento sostenuto, in secondi.
 *
 * Un minuto: dentro l'1-2 minuti della fonte, e abbastanza perché in aula il
 * transitorio emodinamico si veda per intero — la caduta in cinque-dieci
 * secondi, il plateau, e poi il ritorno che ne chiede altri quindici-trenta
 * (`TAU_TORACE` in `interazioni.ts`). Chi conduce può sempre rilasciarla prima,
 * e il paziente può interromperla da sé.
 */
export const RECLUTAMENTO_SECONDI = 60

/** La pressione a cui il reclutamento sostenuto tiene le vie aeree, cmH₂O. */
export const RECLUTAMENTO_PRESSIONE = 40

// Qui c'era un secondo `MANOVRA_SECONDI`, che valeva 2 e non lo importava
// nessuno: la durata vera è quella di `istantanea.ts`, cinque secondi, ed è
// quella che `batti()` usa per depositare l'esito e che la barra di
// avanzamento anima. Due costanti con lo stesso nome e due valori diversi
// sono una trappola per chi legge: la prima che si trova sembra la risposta.

/** Lo stato dell'apparecchio ad alto flusso, che di ventilazione non ha niente. */
export interface StatoAltoFlusso {
  interfaccia: InterfacciaAltoFlusso
  disinfezione: Disinfezione
  /** Se sta ancora scaldando: il flusso parte quando arriva in temperatura. */
  inRiscaldamento: boolean
}

export const STATO_ALTO_FLUSSO_INIZIALE: StatoAltoFlusso = {
  interfaccia: 'adulto',
  disinfezione: 'pulito',
  inRiscaldamento: false,
}

/**
 * L'umidificatore, che c'è su tutti e tre i ventilatori.
 *
 * **La camera dell'acqua sta qui e non nell'alto flusso.** Prima era un campo
 * di `StatoAltoFlusso`, e quindi in terapia intensiva l'umidificatore era una
 * manopola della temperatura che non produceva niente: si girava fra 31 e 39
 * gradi e non cambiava una misura, non consumava acqua, non compariva da
 * nessuna parte. L'acqua è dell'umidificatore, non dell'apparecchio, e
 * l'apparecchio ad alto flusso ne ha uno dentro come gli altri ne hanno uno
 * attaccato.
 *
 * ## La potenza
 *
 * Da 1 a 5, e muove due cose. **L'acqua**, che se ne va più in fretta più si
 * scalda. E **le secrezioni**, che si accumulano: umidificare troppo bagna il
 * circuito e le vie aeree, e sulle curve compaiono i denti di sega che dicono
 * «aspira». Sopra la tacca di mezzo l'accumulo cresce, e più si sta alti più
 * cresce in fretta; abbassando la manopola — o spegnendo — **rientra**, che è
 * il gesto che questo apparecchio deve insegnare. Non è istantaneo in nessuno
 * dei due versi: le secrezioni ci mettono minuti ad arrivare e minuti ad
 * andarsene, ed è il tempo che rende il gesto una decisione invece che un
 * riflesso.
 */
export interface StatoUmidificatore {
  /** Acceso o spento. Spento, non consuma e non protegge. */
  acceso: boolean
  /** Da 1 a 5. */
  potenza: number
  /** L'acqua nella camera, da 1 a 0. */
  acqua: number
  /**
   * Le secrezioni che l'umidificazione eccessiva ha accumulato, 0–1.
   *
   * Si somma a quelle del paziente e si vede sulle curve. Sale finché la
   * potenza sta sopra la tacca di mezzo, scende sotto — spento compreso.
   */
  accumulo: number
  /**
   * Quando l'acqua deve essere finita, nel tempo del ventilatore, o mai.
   *
   * **Non è un consumo realistico, ed è voluto.** Una camera vera dura ore, e
   * in uno scenario da mezz'ora sarebbe un oggetto che non fa niente. Chi
   * allestisce sceglie se l'acqua deve finire durante il caso; se sì, il
   * momento lo tira a sorte l'avvio, dentro i quindici minuti dopo — così due
   * aule dello stesso scenario non se lo aspettano nello stesso istante.
   */
  finisceA: number | null
}

/** Quanta acqua consuma al secondo, alla potenza massima. */
export const CONSUMO_ACQUA_PIENO = 1 / (45 * 60)

/** Il flusso del whisper a 10 cmH₂O, in L/min: quello scritto sulla porta espiratoria. */
export const WHISPER_L_MIN_A_10 = 25

/** Quanto esce dal whisper durante un'inspirazione di `tiSec` alla pressione data, in mL. */
export function perditaDelWhisper(pressione: number, tiSec: number): number {
  const flusso = WHISPER_L_MIN_A_10 * Math.sqrt(Math.max(0, pressione) / 10)
  return (flusso * 1000 * Math.max(0, tiSec)) / 60
}

export const STATO_UMIDIFICATORE_INIZIALE: StatoUmidificatore = {
  acceso: true,
  potenza: 3,
  acqua: 1,
  accumulo: 0,
  finisceA: null,
}

/** La potenza più bassa e la più alta: sono i due fermi della manopola. */
export const POTENZA_MINIMA = 1
export const POTENZA_MASSIMA = 5

/**
 * Le secrezioni che si vedono davvero, contando l'umidificatore.
 *
 * Quelle del paziente sono il quadro clinico e restano; sopra ci si somma
 * quanto l'umidificazione manca. A potenza piena non aggiunge niente, spento
 * aggiunge tutto: è la ragione clinica per cui l'umidificatore si accende, e
 * l'unico modo di farla vedere su un apparecchio è farla comparire sulle
 * curve. Il totale non passa 1 — oltre non c'è più curva, c'è rumore.
 */
export function secrezioniEfficaci(stato: StatoVentilatore): number {
  const proprie = stato.fisiologia.secrezioni
  const u = stato.umidificatore
  if (!u || stato.ambiente === 'anestesia') return proprie
  return Math.min(1, proprie + u.accumulo)
}

/**
 * La tacca oltre la quale l'umidificazione è troppa: il 3 su 5.
 *
 * Sotto o uguale, l'accumulo rientra; sopra, cresce in proporzione a quanto si
 * è saliti. Tre è il valore con cui la macchina si accende, e un paziente coi
 * polmoni puliti non deve gorgogliare solo perché nessuno ha toccato la
 * manopola — è il difetto che le prove hanno trovato alla prima stesura.
 */
export const QUOTA_SUFFICIENTE = 0.6

/**
 * Quanto in fretta le secrezioni si accumulano e rientrano, al secondo.
 *
 * Tarata perché a potenza piena si vedano in cinque minuti e spegnendo
 * rientrino in tre: sono i tempi di uno scenario, non quelli di un reparto.
 */
export const VELOCITA_ACCUMULO = 0.005

/** Che cosa sa il ventilatore del paziente che ha attaccato. */
export interface Paziente {
  pesoKg: number | null
  /** L'EtCO₂ che il paziente ha: se c'è, il capnografo insegue quella. */
  etco2: number | null
  /** La saturazione arriva dal monitor: il ventilatore la mostra e basta. */
  spo2: number | null
  /**
   * La frequenza e la media arteriosa, **dal monitor**.
   *
   * Un ventilatore non ha un bracciale: questi due numeri arrivano dallo stesso
   * collegamento da cui arriva la saturazione, che qui c'è già ed è la stessa
   * scelta di modellazione (in reparto i ventilatori moderni li leggono dal
   * monitor sulla rete). Servono a una cosa sola: i **criteri d'interruzione**
   * del reclutamento sostenuto (`motivoInterruzione`), che senza la pressione
   * sarebbero mezzi.
   *
   * `null` quando in stanza non c'è un monitor che li misura, e allora quei due
   * criteri non scattano — l'apparecchio non inventa quello che non gli arriva.
   */
  heartRate: number | null
  map: number | null
}

/** Tutto quello che serve per sapere che cosa sta facendo questa macchina. */
export interface StatoVentilatore {
  ambiente: Ambiente
  modalita: Modalita
  respiro: Respiro
  /** Falso: standby. Nessuna onda, nessuna misura, nessun allarme. */
  ventilando: boolean
  impostazioni: Impostazioni
  fisiologia: Fisiologia
  drive: Drive
  asincronia: ImpostazioniAsincronia | null
  manovra: Manovra
  gas: StatoGas | null
  altoFlusso: StatoAltoFlusso | null
  /** L'umidificatore: c'è sui tre ventilatori, non in anestesia. */
  umidificatore: StatoUmidificatore | null
  /**
   * Come è montata la linea (§602). Conta in NIV: col monotubo il whisper perde apposta, e
   * il ventilatore lo sa solo se l'autotest l'ha calibrato. Assente vale il bitubo.
   */
  circuito?: Circuito | null
  /** Vero se l'autotest è stato fatto dopo l'ultimo cambio di circuito. */
  perditaCalibrata?: boolean
  paziente: Paziente
  /** Il seme delle irregolarità: cambia il rumore, non il comportamento. */
  seme: number
  /**
   * Di quanto è spostata l'origine del **treno spontaneo**, in secondi.
   *
   * Le curve sono funzioni pure del tempo condiviso, e la fase del respiro del
   * paziente si ricava con `tSec % periodo`. Finché il periodo è fermo va
   * bene; quando cambia — ed è quello che fa la rampa dell'addormentamento,
   * che sposta la frequenza ogni due secondi per trenta secondi — il modulo
   * **salta**: a t=100 con periodo 4 la fase è 0, un istante dopo con periodo
   * 4,13 è 2,9, e la traccia si trova di colpo a metà di un atto che non ha
   * mai cominciato. Sul pallone dell'anestesia, dove la curva è fatta solo di
   * questo, si vedeva come atti che si spezzano e ripartono a caso.
   *
   * Lo sfasamento è la riparazione: a ogni cambio di frequenza `batti()` lo
   * ricalcola perché la fase resti dov'era, e la curva prosegue senza saltare.
   * Sta nell'istantanea, quindi tutti gli schermi disegnano lo stesso atto.
   */
  sfasamentoSpontaneo: number
  /**
   * Quando è cominciata la manovra tenuta, nel tempo del ventilatore
   * (facoltativo). La pausa ferma l'ultimo atto **prima** di questo istante, e
   * lo sforzo del paziente che cade dentro la pausa è il test di occlusione.
   */
  manovraDa?: number | null
}

/** Da cmH₂O a mmHg. Le pressioni del torace si misurano in acqua, la PVC no. */
export const MMHG_PER_CMH2O = 1 / 1.36

/**
 * Quanta pressione delle vie aeree arriva al torace, da 0 a 1.
 *
 * **È la ragione per cui la pressione venosa centrale oscilla poco in un
 * polmone rigido anche quando le pressioni sono alte**, ed è il numero che
 * spiega perché la stessa pressione di picco vuol dire cose diverse su due
 * pazienti diversi.
 *
 * ## Una riga sola, e la riga di prima era sbagliata
 *
 * Fino al 12 settembre 2026 qui c'era `C / (C + 200)`, con `C` la compliance
 * del **sistema respiratorio** e duecento una costante senza fonte. La
 * frazione trasmessa però è `C_L / (C_L + C_w)`, dove `C_L` è la compliance
 * del **solo polmone** — e le due non sono la stessa cosa. Mettendoci dentro
 * l'identità delle elastanze in serie, `1/C_L = 1/C_rs − 1/C_w`, il conto si
 * semplifica fino a sparire:
 *
 * > **frazione trasmessa = C_rs / C_w**
 *
 * Su un polmone normale (C_rs 60, parete 175) fa **0,34** dove la riga vecchia
 * diceva 0,23; in ARDS (30 su 120) fa 0,25, dentro il 20-30% che Gattinoni
 * misura. *(Gattinoni, AJRCCM 1998; Pelosi, Chest 1998; Malbrain, ICM 2006.)*
 *
 * Il tetto a 0,9 non è prudenza: sopra, la formula direbbe che la pleura riceve
 * più di quanto l'alveolo ha, e lì il modello ha smesso di sapere.
 */
export function trasmissioneToracica(f: Fisiologia): number {
  const cRs = Math.max(1, f.compliance)
  const cW = Math.max(1, f.complianceParete)
  return Math.min(0.9, cRs / cW)
}

/**
 * Quanto di negativo lo sforzo del paziente mette nella pleura, per cmH₂O.
 *
 * `ΔP_pl ≈ −0,7 × P_musc`: il resto se lo mangia l'elastanza della parete, che
 * si deve deformare perché il torace si espanda. *(Pinsky, Ann Am Thorac Soc
 * 2018; Brochard, Intensive Care Med 2017.)*
 */
export const FRAZIONE_PLEURICA_SFORZO = 0.7

/**
 * La pressione muscolare **media sul ciclo**, in cmH₂O.
 *
 * `P_musc` di picco è `intensita × PMUSC_MASSIMA`; la pressione media che ne
 * esce è quel picco per la frazione inspiratoria, dimezzata perché lo sforzo
 * sale e scende dentro l'inspirazione invece di stare al massimo per tutta.
 *
 * **Media, e non picco, ed è una scelta dichiarata.** Il circolo di
 * `starling.ts` è allo stato stazionario: non ha un battito dentro l'atto
 * respiratorio, quindi non può ricevere un picco. Il prezzo lo si paga sul
 * postcarico del sinistro, che di uno sforzo vigoroso sente la media e non i
 * cinque-sette millimetri di picco della fonte: quella metà è **fasica**, ed è
 * fuori da questo modello come già ci stanno il polso paradosso e il
 * tamponamento (vedi l'intestazione di `starling.ts`).
 */
export function pMuscMedia(stato: PerPressioni): number {
  const picco = Math.max(0, driveEfficace(stato.drive).intensita) * PMUSC_MASSIMA
  if (picco <= 0) return 0
  const { Ttot, Ti } = tempiRespiro(stato as StatoVentilatore)
  return (picco * (Ti / Math.max(0.1, Ttot))) / 2
}

/**
 * L'auto-PEEP di adesso, in cmH₂O — **senza doverla andare a misurare**.
 *
 * È lo stesso conto che `esitoManovra` fa alla pausa espiratoria, tirato fuori
 * perché serve anche a chi non tiene premuto niente: la pressione che il
 * circolo sente è quella **totale**, e l'aria che non esce ci sta dentro. È da
 * qui che le asincronie arrivano all'emodinamica senza che nessuno le nomini —
 * breath stacking, doppio trigger e ciclaggio precoce accorciano
 * l'espirazione, l'aria si accumula, e il gradino di pressione intratoracica
 * lo fa il polmone da sé.
 */
export function autoPeep(stato: PerPressioni): number {
  return autoPeepDi(polmoneOra(stato))
}

/**
 * Lo stesso conto, su uno stato **già sistemato**: è quello che gira dentro
 * `polmoneOra`, e che quindi non può risistemarlo un'altra volta senza
 * chiamarsi all'infinito.
 */
function autoPeepDi(stato: PerPressioni): number {
  const { Ttot, Ti } = tempiRespiro(stato as StatoVentilatore)
  const RC = costanteTempo(stato.fisiologia)
  const Te = Ttot - Ti
  const trattenuto = RC > 0 ? Math.exp(-Te / RC) : 0
  const vt = volumeCorrenteAtteso(stato as StatoVentilatore)
  return (vt * trattenuto) / Math.max(1, stato.fisiologia.compliance)
}

/**
 * Quello che serve per i conti di pressione: un ventilatore, o la sua istantanea.
 *
 * I device non hanno uno `StatoVentilatore` in mano — hanno la `VentIstantanea`,
 * che di quello è il sottoinsieme che viaggia. Chiedere solo i campi che
 * servono lascia passare tutti e due senza copiare niente.
 */
export type PerPressioni = Pick<
  StatoVentilatore,
  'modalita' | 'impostazioni' | 'fisiologia' | 'drive' | 'asincronia'
>

/**
 * La pressione **attorno al cuore**, in mmHg: quella che il circolo sente.
 *
 * È il numero che il giro 4-bis è venuto a prendere. Tre pezzi:
 *
 * 1. quello che la macchina spinge, `P_media_vie` più l'auto-PEEP, ridotto
 *    della frazione che la parete lascia passare (`trasmissioneToracica`);
 * 2. quello che il paziente **toglie** tirando, `0,7 × P_musc` (punto 6 del
 *    materiale): in pressione di supporto minima il segno può ribaltarsi, ed è
 *    lì che sta l'edema polmonare da svezzamento;
 * 3. la conversione in millimetri di mercurio, perché il circolo parla quella
 *    lingua e il ventilatore no.
 *
 * Positiva vuol dire che il torace **stringe** il cuore: il ritorno venoso si
 * riduce, la PVC misurata sale, e il postcarico del sinistro si alleggerisce.
 * Negativa è il respiro spontaneo, che fa esattamente il contrario.
 */
export function pressioneIntratoracica(stato: PerPressioni, pMediaVie: number): number {
  // Anche la **frazione trasmessa** è del polmone di adesso: un polmone
  // reclutato è più cedevole e ne lascia passare di più, ed è una delle cose
  // che rende la PEEP alta peggiore di quanto la sola pressione direbbe.
  const ora = polmoneOra(stato)
  const totale = pMediaVie + autoPeepDi(ora)
  const dallaMacchina = totale * trasmissioneToracica(ora.fisiologia)
  const dalloSforzo = FRAZIONE_PLEURICA_SFORZO * pMuscMedia(ora)
  return (dallaMacchina - dalloSforzo) * MMHG_PER_CMH2O
}

/**
 * La pressione media delle vie aeree di una ventilazione **ordinaria**, in cmH₂O.
 *
 * Volume corrente giusto, PEEP a cinque, rapporto 1:2: attorno a otto. È
 * l'ancoraggio di tutto il giro 4-bis — il paziente che l'autore ha scritto è
 * ventilato così, e a quella pressione il modello deve restituire i numeri
 * dello scenario cifra per cifra. Quello che si calcola è **la differenza**
 * rispetto a qui, mai un valore assoluto.
 */
export const PMEDIA_RIFERIMENTO = 8

/** E la PEEP che ci va insieme: il fondo della U delle resistenze polmonari. */
export const PEEP_RIFERIMENTO = 5

/**
 * Quanto le resistenze polmonari cambiano col volume del polmone: la U.
 *
 * Il minimo è alla capacità funzionale residua. Salendo verso la capacità
 * polmonare totale i vasi **alveolari** vengono schiacciati — sono le zone 1 e
 * 2 di West, e per questo la PEEP alta è postcarico per il destro; scendendo
 * sotto la FRC comandano la tortuosità dei vasi extra-alveolari e la
 * vasocostrizione ipossica dei territori che si chiudono. *(Vieillard-Baron,
 * Intensive Care Med 2001 e AJRCCM 2016.)*
 *
 * L'asse è la **PEEP totale**, non il volume in millilitri, e non per comodità:
 * quello che schiaccia un capillare alveolare è la pressione che lo distende,
 * e in un polmone da ARDS trecento millilitri in più distendono quanto
 * seicento in un polmone normale. Contare i millilitri direbbe che il baby lung
 * si sovradistende **meno**, che è il contrario.
 *
 * I due coefficienti: a dieci sopra il riferimento — PEEP 15 su un paziente
 * scritto a 5 — le resistenze salgono del **25%**, che è quanto i lavori sulla
 * PEEP misurano fra 5 e 15; a PEEP zero salgono del 15%, per l'atelettasia e la
 * vasocostrizione ipossica. **Uno al riferimento**, sempre: un paziente
 * ventilato come l'autore l'ha pensato non paga nessun sovrapprezzo.
 *
 * Il primo coefficiente era 0,4, e si è misurato che era troppo: con il destro
 * di questo modello — che è cinque volte più sensibile del sinistro, e deve
 * esserlo — un +40% di resistenze si mangiava da solo tutto il gradino, e la
 * strada del **ritorno venoso** non si vedeva più. Fra le due letture della
 * banda, quella bassa lascia parlare tutt'e due i meccanismi.
 */
export function fattorePvrDaVolume(peepTotale: number, peepRiferimento = PEEP_RIFERIMENTO): number {
  const sopra = Math.max(0, peepTotale - peepRiferimento) / 10
  const sotto = Math.max(0, peepRiferimento - peepTotale) / 10
  return 1 + 0.25 * sopra * sopra + 0.6 * sotto * sotto
}

/**
 * La compliance **a quella PEEP**, in ml/cmH₂O: reclutamento contro
 * sovradistensione.
 *
 * ## Il criterio, che è il punto 5 del materiale del giro 4-bis
 *
 * `C_rs = V_T / (P_plat − PEEP)`: se alzando la PEEP di 3-5 cmH₂O la compliance
 * **sale**, prevale il reclutamento — c'è alveolo chiuso che si riapre; se
 * **scende** e la pressione motrice cresce a parità di volume, domina la
 * sovradistensione. *(Gattinoni, N Engl J Med 2006; Caironi, AJRCCM 2015.)* Non
 * è una curiosità: è il modo in cui la PEEP si titola al letto, e finché la
 * compliance era una costante per quadro la manopola girava a vuoto — la
 * pressione motrice restava identica a tutti i gradini (misurato al giro 4:
 * 8,3 a PEEP 5, 10 e 15).
 *
 * ## La forma, e i tre pezzi
 *
 * * **Il reclutamento** sale e satura: gli alveoli che si possono riaprire si
 *   riaprono quasi tutti entro una decina di cmH₂O, e oltre non ce n'è più.
 *   Quanto valga lo dice `reclutabilita`, che è del paziente.
 * * **La sovradistensione** cresce come il quadrato: è la parte piatta della
 *   curva pressione-volume, dove ogni cmH₂O in più costa e non rende. Non
 *   dipende da quanto polmone c'era da riaprire — **si paga comunque**.
 * * **Il derecruitment** sotto il riferimento: scendendo verso lo zero il
 *   polmone che si era riaperto si richiude, e la compliance cala. Anche questo
 *   in proporzione a `reclutabilita`: un polmone che non ha niente da riaprire
 *   non ha niente da richiudere.
 *
 * **Uno al riferimento**, sempre: un paziente ventilato come l'autore l'ha
 * pensato ha la compliance che l'autore ha scritto, e da lì si misura la
 * differenza. È la stessa regola dell'ancoraggio della P_it.
 *
 * Quello che ne esce, sui quadri: un ARDS reclutabile (30 ml/cmH₂O) guadagna un
 * quarto portando la PEEP da 5 a 10 e comincia a perdere sopra i 15; lo stesso
 * ARDS con `reclutabilita` zero — il **non-recruiter** — perde il 17% già a
 * PEEP 15, con la pressione motrice che sale. Sono due pazienti diversi con la
 * stessa diagnosi, ed è quello che la manovra di pausa deve far vedere.
 */
export function complianceA(f: Fisiologia, peepTotale: number): number {
  const d = peepTotale - PEEP_RIFERIMENTO
  const r = Math.max(0, Math.min(1, f.reclutabilita))
  const guadagno = r * (1 - Math.exp(-Math.max(0, d) / 5))
  const perdita = (Math.max(0, d) / 22) ** 2
  const collasso = r * Math.min(1, Math.max(0, -d) / PEEP_RIFERIMENTO) * 0.6
  return Math.max(3, (f.compliance * (1 + guadagno - collasso)) / (1 + perdita))
}

/**
 * Il polmone **com'è adesso**: lo stesso, con la compliance alla PEEP di adesso.
 *
 * Tutto quello che il ventilatore calcola — volume, plateau, costante di tempo,
 * auto-PEEP, curve — deve usare questa e non quella dichiarata, o il numero sul
 * display e la traccia disegnata smettono di essere d'accordo. Per questo lo
 * risolvono le funzioni **pubbliche**, in una riga sola in cima, e tutto quello
 * che chiamano dopo riceve lo stato già sistemato.
 *
 * ## Due giri, e perché non uno
 *
 * La PEEP che conta è quella **totale**, e l'auto-PEEP dipende dalla compliance
 * — cioè da quello che si sta cercando. Si gira due volte: la compliance alla
 * PEEP impostata dà l'aria che non esce, e l'aria che non esce dà la compliance
 * vera. Il secondo giro sposta pochissimo su un polmone normale e parecchio su
 * un ostruito, che è esattamente il paziente per cui serve.
 */
export function polmoneOra<T extends PerPressioni>(stato: T): T {
  const f = stato.fisiologia
  const peep = stato.impostazioni.peep
  const primo = { ...stato, fisiologia: { ...f, compliance: complianceA(f, peep) } }
  const intrinseca = autoPeepDi(primo)
  return { ...stato, fisiologia: { ...f, compliance: complianceA(f, peep + intrinseca) } }
}

/**
 * Il tempo inspiratorio di un **sigh**, in secondi.
 *
 * Due e mezzo: la fonte dice «inspirio prolungato a 2-3 s», ed è metà della
 * ragione per cui il sigh si sente — un atto alto e **lungo** alza la pressione
 * media molto più di un atto alto e corto, e la pressione media è quella che il
 * circolo riceve. *(PROTECTION Trial, AJRCCM 2021.)*
 */
export const TI_SIGH = 2.5

/**
 * Se **quest'atto** è un sigh, lo stato che lo eroga e il suo tempo inspiratorio.
 *
 * `null` quando il sigh è spento, quando la modalità non ha un atto controllato
 * su cui appoggiarlo, o quando questo atto è uno qualunque. L'atto si sceglie
 * dal suo **indice**, non dall'orologio: così due schermi della stessa macchina
 * sospirano sullo stesso atto, come per tutto il resto delle onde.
 *
 * Quello che cambia è il volume — o la pressione motrice, che è la stessa cosa
 * detta dall'altro capo — perché l'alveolo arrivi a `sighPressure`, e il tempo
 * inspiratorio, che si allunga.
 */
export function sighDiQuestoAtto<T extends PerPressioni>(
  stato: T,
  indiceAtto: number,
  Ttot: number,
): { stato: T; Ti: number } | null {
  const imp = stato.impostazioni
  if (!(imp.sighRate > 0)) return null
  if (stato.modalita !== 'VC' && stato.modalita !== 'PC' && stato.modalita !== 'PRVC' && stato.modalita !== 'SIMV') return null
  const ogni = Math.max(1, Math.round(60 / (imp.sighRate * Math.max(0.5, Ttot))))
  if (indiceAtto % ogni !== 0) return null
  const motrice = Math.max(0, imp.sighPressure - imp.peep)
  return {
    stato: {
      ...stato,
      impostazioni: {
        ...imp,
        volume: motrice * Math.max(1, stato.fisiologia.compliance),
        pressureTarget: motrice,
      },
    },
    Ti: Math.min(Ttot * 0.7, TI_SIGH),
  }
}

/** La costante di tempo del sistema respiratorio, in secondi: RC = C · R. */
export function costanteTempo(f: Fisiologia): number {
  return (f.compliance / 1000) * Math.max(0.1, f.resistenza)
}

/** Il periodo del ciclo macchina, in secondi. */
export function periodoCicloSec(stato: StatoVentilatore): number {
  const { modalita, impostazioni } = stato
  const drive = driveEfficace(stato.drive)
  if (modalita === 'PS' || modalita === 'CPAP') {
    if (drive.frequenza > 0) return 60 / drive.frequenza
    // Apnea: entra la frequenza di backup, che è il motivo per cui esiste.
    return 60 / Math.max(1, impostazioni.backupFrequency)
  }
  return 60 / Math.max(1, impostazioni.frequency)
}

/** I tempi dell'atto: tutto, inspirazione, insufflazione, pausa. */
export function tempiRespiro(stato: StatoVentilatore): {
  Ttot: number
  Ti: number
  Tif: number
  Tip: number
} {
  const Ttot = periodoCicloSec(stato)
  const frazione = frazioneInspiratoria(
    stato.modalita,
    stato.impostazioni.ratio,
    stato.impostazioni.psLevel,
  )
  let Ti = Ttot * frazione
  // **Negli atti assistiti il tempo inspiratorio non è una frazione: lo decide
  // la soglia di ciclaggio.**
  //
  // In VC e PC il rapporto I:E impone Ti, e la macchina stacca allo scadere. In
  // pressione di supporto no: la macchina stacca quando il flusso inspiratorio
  // è sceso a una **frazione del suo picco**, ed è la manopola che sta lì
  // accanto. Il flusso decade con la costante di tempo del sistema, quindi
  // `Ti = −RC · ln(soglia)`: con RC 0,5 s e soglia 25% fa 0,69 s, e portandola
  // al 70% scende a 0,18 — che è il ciclaggio precoce, quello vero, prodotto
  // dalla manopola invece che imposto dalla regia.
  //
  // Finché questo conto non c'era, `flowCycleOffPercent` era una manopola che
  // si girava senza che succedesse niente: Ti restava un terzo del ciclo
  // qualunque cosa dicesse. Le asincronie di ciclaggio della regia continuano a
  // moltiplicare **questo** Ti (`onde.ts`), e le due cose si compongono come si
  // compongono nella stanza: la soglia è come è regolata la macchina, la
  // forzatura è il paziente che non le va dietro.
  if (assistito(stato.modalita, stato.impostazioni.psLevel)) {
    const RC = costanteTempo(stato.fisiologia)
    const soglia = Math.min(0.95, Math.max(0.01, stato.impostazioni.flowCycleOffPercent / 100))
    const daSoglia = -RC * Math.log(soglia)
    // Gli estremi non sono prudenza: un atto assistito non dura meno di un
    // quarto di secondo — la macchina ha un tempo minimo — e non può prendersi
    // tutto il ciclo, o non resterebbe espirazione.
    Ti = Math.min(Ttot * 0.7, Math.max(0.25, daSoglia))
  }
  const inPausa =
    stato.modalita === 'VC' || stato.modalita === 'SIMV' ? stato.impostazioni.inspiratoryPausePercent / 100 : 0
  const Tip = Ti * inPausa
  return { Ttot, Ti, Tif: Ti - Tip, Tip }
}

/**
 * Il volume corrente che quell'atto porta dentro, in ml.
 *
 * In volume controllato è quello impostato, e basta. In pressione è la
 * pressione motrice per la compliance, **scontata di quanto il polmone fa in
 * tempo a riempirsi**: `1 − e^(−Ti/RC)`. L'originale metteva un 0,9 fisso, che
 * è la stessa cosa detta una volta sola e sbagliata dappertutto — con una
 * resistenza alta e un tempo inspiratorio corto il volume crolla, ed è
 * esattamente il quadro che in aula si deve poter far vedere.
 */
export function volumeCorrenteAtteso(stato: StatoVentilatore): number {
  const { modalita, impostazioni, fisiologia } = stato
  const RC = costanteTempo(fisiologia)
  const { Ti } = tempiRespiro(stato)
  const riempimento = RC > 0 ? 1 - Math.exp(-Ti / RC) : 1
  if (modalita === 'VC' || (modalita === 'SIMV' && impostazioni.psLevel === 0)) {
    return impostazioni.volume
  }
  if (modalita === 'CPAP') {
    // Nessun supporto: il volume è quello che il paziente si tira da solo.
    return volumeSpontaneo(stato)
  }
  const motrice = modalita === 'PC' || modalita === 'PRVC' ? impostazioni.pressureTarget : impostazioni.psLevel
  return motrice * fisiologia.compliance * riempimento
}

/**
 * Il volume di un atto **spontaneo**, in ml: quello che il paziente si tira da
 * solo più quello che il supporto gli mette sopra.
 *
 * In CPAP il supporto è zero per definizione e resta il solo diaframma — è il
 * caso per cui questa funzione è nata. In pressione di supporto e per gli atti
 * che in SIMV cadono fra un obbligato e l'altro c'è anche il PS, e il conto è
 * lo stesso: sta qui, in un posto solo, perché il volume scritto sul display e
 * quello disegnato sulla curva devono essere lo stesso numero
 * (`supporto()` in `onde.ts` lo usa come bersaglio).
 */
export function volumeSpontaneo(stato: StatoVentilatore): number {
  const supporto = stato.modalita === 'CPAP' ? 0 : Math.max(0, stato.impostazioni.psLevel)
  const pmuscMax = Math.max(0, driveEfficace(stato.drive).intensita) * PMUSC_MASSIMA
  return (supporto + pmuscMax * 0.5) * Math.max(1, stato.fisiologia.compliance)
}

/**
 * ## Gli atti che in SIMV il paziente si prende da sé
 *
 * La SIMV è **intermittente**: la macchina garantisce un numero di atti al
 * minuto e fra l'uno e l'altro lascia respirare. Un paziente con un drive più
 * veloce della frequenza impostata ne prende quanti ne vuole — dodici obbligati
 * e otto spontanei fanno venti, e venti è quello che conta chi guarda il torace
 * o il capnografo. Se il drive è più lento, o non c'è, restano i dodici della
 * macchina e non manca niente.
 *
 * È la decisione del 13 settembre 2026, applicata dove la modalità **accetta**
 * il trigger: su un paziente passivo comandano le variabili impostate dai
 * discenti, su un paziente con un drive suo il drive si vede — in SIMV come
 * atti, in volume e pressione controllata come asincronie, perché lì la
 * macchina non gli apre.
 */
export function attiSpontaneiSimv(stato: StatoVentilatore): number {
  if (stato.modalita !== 'SIMV') return 0
  const obbligati = Math.max(1, stato.impostazioni.frequency)
  return Math.max(0, driveEfficace(stato.drive).frequenza - obbligati)
}

/**
 * Quanti atti la macchina eroga davvero al minuto.
 *
 * Non è la frequenza impostata: gli sforzi inefficaci in pressione di supporto
 * ne tolgono, il doppio ciclo e l'auto-trigger ne aggiungono, e in SIMV il
 * paziente se ne prende in mezzo. È il numero che sul display non torna con
 * quello impostato, ed è il primo indizio che qualcosa non va — prima ancora di
 * guardare le onde.
 */
export function frequenzaErogata(stato: StatoVentilatore): number {
  const macchina = 60 / periodoCicloSec(stato)
  const spontanei = attiSpontaneiSimv(stato)
  const a = stato.asincronia
  if (!a || a.quota <= 0) return macchina + spontanei
  // **La quota che conta è quella corretta dal trigger.** Rendendo sensibile la
  // sensibilità gli sforzi passano, e la frequenza erogata risale verso quella
  // nativa del paziente: è il segno sui numeri che dice che la manovra ha
  // funzionato, e si legge prima che sulle curve.
  const quota = quotaEfficace(a, stato.impostazioni.triggerFlow)
  if (quota <= 0) return macchina + spontanei
  const spontanea = stato.modalita === 'PS' || stato.modalita === 'CPAP'
  if (a.tipo === 'sforzo-inefficace') {
    if (spontanea) return macchina * (1 - quota)
    // In SIMV gli sforzi che non arrivano al trigger tolgono atti **spontanei**:
    // gli obbligati partono lo stesso, ed è tutta la differenza fra una
    // modalità che garantisce e una che aspetta.
    return macchina + spontanei * (1 - quota)
  }
  if (a.tipo === 'doppio-ciclo' || a.tipo === 'auto-trigger') {
    return (macchina + spontanei) * (1 + quota)
  }
  return macchina + spontanei
}

/**
 * I numeri che l'apparecchio scrive, dallo stato in cui si trova.
 *
 * `precedenti` serve alle sole grandezze che inseguono: l'EtCO₂ che sale piano
 * quando si ipoventila, l'agente che si lava dal circuito, l'aria dell'alto
 * flusso che si scalda. Tutto il resto è funzione dello stato, e passare due
 * volte lo stesso stato dà due volte lo stesso numero.
 */
export function misura(
  stato: StatoVentilatore,
  tSec: number,
  dtSec: number,
  precedenti: Misure | null,
): Misure {
  if (!stato.ventilando) return { ...MISURE_VUOTE }

  // **Il polmone com'è a questa PEEP**, non come è scritto nel quadro: da qui
  // in giù `fis` e tutto quello che riceve `stato` hanno la compliance vera
  // (`polmoneOra`), e il numero sul display combacia con la curva disegnata.
  stato = polmoneOra(stato)
  const statoMotore = stato
  const { impostazioni: imp, fisiologia: fis, ambiente, modalita } = stato
  const prima = precedenti ?? MISURE_VUOTE
  const m: Misure = { ...MISURE_VUOTE }

  // ## L'alto flusso non ventila: ha un flusso, un'acqua e una temperatura.
  if (ambiente === 'alto-flusso') {
    const bersaglio = stato.altoFlusso ? imp.temperature : TEMPERATURA_AMBIENTE
    m.deliveredTemperature = insegue(prima.deliveredTemperature ?? TEMPERATURA_AMBIENTE, bersaglio, dtSec, 15)
    m.waterLevelPercent = stato.umidificatore ? Math.round(stato.umidificatore.acqua * 100) : null
    m.spo2 = stato.paziente.spo2
    return m
  }

  // ## In manuale non c'è niente di meccanico da misurare, ma il paziente
  // respira: la frequenza spontanea e il capnogramma restano.
  const inManuale = ambiente === 'anestesia' && stato.respiro === 'manuale'

  // L'acqua della camera **anche in terapia intensiva**: l'umidificatore c'è
  // sui tre ventilatori, e senza questa riga il suo allarme non avrebbe niente
  // da guardare fuori dall'alto flusso.
  m.waterLevelPercent = stato.umidificatore ? Math.round(stato.umidificatore.acqua * 100) : null

  m.compliance = Math.round(fis.compliance)
  m.resistance = Math.round(fis.resistenza)
  const spontanea = driveEfficace(stato.drive).frequenza
  m.spontaneousRate = spontanea > 0 ? Math.round(spontanea) : 0

  // ## Il reclutamento sostenuto: la pressione tenuta, e basta
  //
  // Non è una misura e non è un atto: è una pressione ferma per un minuto. Il
  // display lo dice con i tre numeri che diventano lo stesso numero — picco,
  // plateau e media tutti alla pressione della manovra — e il circolo la riceve
  // per intero, che è il punto (`pressioneIntratoracica`).
  if (stato.manovra === 'reclutamento') {
    m.pPeak = arrotonda(RECLUTAMENTO_PRESSIONE)
    m.pPlateau = arrotonda(RECLUTAMENTO_PRESSIONE)
    m.pMean = arrotonda(RECLUTAMENTO_PRESSIONE)
    m.volumeInspired = Math.round(
      Math.max(0, RECLUTAMENTO_PRESSIONE - imp.peep) * Math.max(1, fis.compliance),
    )
    m.measuredFrequency = 0
  }

  if (!inManuale && !stato.manovra) {
    const { Ttot, Ti: TiOrdinario, Tif: TifOrdinario } = tempiRespiro(stato)
    // ## Il sigh, se quest'atto è un sigh
    //
    // Non una media spalmata su un minuto: **quest'atto**. Il circolo riceve la
    // pressione media dell'atto che sta passando, e un sigh è un transitorio —
    // sale in pochi secondi e ci mette mezzo minuto a tornare (`TAU_TORACE`).
    // Spalmarlo darebbe un gradino piccolo e permanente, che è un'altra cosa e
    // non insegna niente.
    const sigh = sighDiQuestoAtto(stato, Math.floor(tSec / Math.max(0.5, Ttot)), Ttot)
    if (sigh) stato = { ...stato, impostazioni: sigh.stato.impostazioni }
    const Ti = sigh ? sigh.Ti : TiOrdinario
    const Tif = sigh ? sigh.Ti * (TifOrdinario / Math.max(0.01, TiOrdinario)) : TifOrdinario
    const imp = stato.impostazioni
    const vt = volumeCorrenteAtteso(stato)
    const doppio = stato.asincronia?.tipo === 'doppio-ciclo' ? stato.asincronia.quota : 0

    const pAlveolare = imp.peep + vt / Math.max(1, fis.compliance)
    if (modalita === 'VC' || (modalita === 'SIMV' && imp.psLevel === 0)) {
      const flussoLs = Tif > 0 ? vt / 1000 / Tif : 0
      m.pPlateau = arrotonda(pAlveolare)
      m.pPeak = arrotonda(
        (imp.formaFlusso ?? 0) === 1
          ? piccoDecelerante(imp.peep, vt, Tif, fis.compliance, fis.resistenza)
          : pAlveolare + flussoLs * fis.resistenza,
      )
    } else if (modalita === 'PC' || modalita === 'PRVC' || (modalita === 'SIMV' && imp.psLevel > 0)) {
      m.pPeak = arrotonda(imp.peep + imp.pressureTarget)
      m.pPlateau = arrotonda(pAlveolare)
    } else if (modalita === 'PS') {
      // In apnea gli atti sono quelli di backup, al loro livello (`motore.ts`): il display lo segue.
      m.pPeak = arrotonda(imp.peep + (spontanea > 0 ? imp.psLevel : imp.backupPressure))
      m.pPlateau = null
    } else {
      // CPAP: la pressione è quella e resta quella, con il respiro sopra.
      m.pPeak = arrotonda(imp.peep + 1.5)
      m.pPlateau = null
    }

    // La pressione media è l'area sotto la curva divisa per il ciclo: in
    // pressione è il plateau per la frazione inspiratoria, in volume la media
    // fra picco e plateau. L'originale divideva per 2,2 e aggiungeva rumore.
    const mediaInsp =
      modalita === 'VC' || (modalita === 'SIMV' && imp.psLevel === 0)
        ? ((m.pPeak ?? 0) + (m.pPlateau ?? 0)) / 2
        : (m.pPeak ?? 0)
    m.pMean = arrotonda(imp.peep + (mediaInsp - imp.peep) * (Ti / Ttot))

    const frequenza = frequenzaErogata(stato)
    m.measuredFrequency = Math.round(frequenza)
    m.tiTtot = parseFloat((Ti / Ttot).toFixed(2))

    // Il doppio ciclo somma il volume del primo atto al secondo: sul display il
    // corrente sale, ed è il segno che il monitoraggio deve mostrare.
    const vtErogato = vt * (1 + doppio)
    m.volumeInspired = Math.round(vtErogato)

    // ## La perdita della maschera, e quella del whisper
    //
    // La maschera perde un po' attorno al bordo, a caso: è la perdita che si cerca e si
    // corregge, ed è quella che il ventilatore mostra. Il whisper del monotubo perde
    // **apposta**, tanto di più quanto più alta è la pressione (√P, come una porta tarata):
    // l'autotest lo calibra e il ventilatore lo toglie dal conto. Non calibrato, quel flusso
    // sembra entrato nel paziente e il volume corrente letto è più alto del vero (§602).
    // Se la regia ha scritto la perdita della maschera, è vera e la conta il
    // motore sugli atti (più sotto); se no, la piccola perdita di sempre.
    const perditaVera = ambiente === 'niv' && typeof fis.perditaMaschera === 'number'
    const perdita = ambiente === 'niv' && !perditaVera ? 0.03 + Math.abs(rumore(stato.seme, tSec, 0.2)) * 0.07 : 0
    const whisper =
      ambiente === 'niv' && stato.circuito === 'monotubo' && !stato.perditaCalibrata
        ? perditaDelWhisper(m.pPeak ?? imp.peep, Ti) / Math.max(1, vtErogato)
        : 0
    m.leakPercentage = ambiente === 'niv' ? parseFloat((perdita * 100).toFixed(1)) : null
    m.volumeExpired = Math.round(vtErogato * (1 - perdita) * (1 + whisper))
    // ## Il minuto, quando gli atti non sono tutti uguali
    //
    // In SIMV gli atti sono di due razze: gli obbligati portano il corrente
    // impostato, quelli che il paziente si prende in mezzo portano quello che
    // il supporto e il suo sforzo riescono a fare. Moltiplicare il corrente
    // della macchina per il totale darebbe a un paziente che respira venti
    // volte un volume minuto da venti atti pieni — che è il modo di far
    // sembrare ben ventilato uno che si sta stancando.
    const spontanei = attiSpontaneiSimv(stato)
    const obbligati = Math.max(0, frequenza - spontanei)
    const litri =
      (obbligati * (m.volumeExpired ?? 0) + spontanei * volumeSpontaneo(stato) * (1 - perdita)) / 1000
    m.volumeMinute = parseFloat(litri.toFixed(1))

    // ## Dalla 3.2 i numeri li misura il motore, sugli atti che ha erogato
    //
    // Come un ventilatore vero e come il simulatore di riferimento: il picco è
    // il massimo della Paw dell'atto, il corrente è l'integrale del flusso, la
    // frequenza è quella contata. Il conto analitico di sopra resta il ripiego
    // quando il motore non ha ancora atti da contare; quando li ha, la curva e
    // il numero sono la stessa cosa per costruzione.
    //
    // **Dove**, per ora: dove il conto analitico non sa che cosa succede — gli
    // atti che il paziente apre e chiude da sé (PS, CPAP, PAV) e l'assistita-
    // controllata. In VC e PC passive il conto analitico è la stessa fisica del
    // motore, e il sigh e l'ancoraggio della pressione media al circolo (giro
    // 4-bis) restano sui numeri dell'atto che hanno.
    const dalMotore =
      motoreCopre(statoMotore) &&
      (modalita === 'PS' || modalita === 'CPAP' || modalita === 'PAV' || imp.triggerControllata === 1)
    const atti = dalMotore ? attiRecenti(tSec, statoMotore, 20) : []
    // ## Nessun atto contato è un numero, non un ripiego (OVS 3.3)
    //
    // In CPAP senza respiro il conto analitico dava la frequenza di backup — 12
    // atti al minuto su una curva piatta — mentre il volume minuto era zero.
    // Passati venti secondi dall'accensione, quello che il motore non conta non
    // c'è: la frequenza è quella contata, e il minuto lo segue.
    if (dalMotore && atti.length < 2 && tSec >= 20 && modalita === 'CPAP') {
      m.measuredFrequency = atti.length * 3
      m.volumeMinute = parseFloat((((atti[0]?.vte ?? 0) * atti.length * 3) / 1000).toFixed(1))
    }
    if (atti.length >= 2) {
      const ultimi = atti.slice(-3)
      const media = (f: (a: (typeof atti)[number]) => number) => ultimi.reduce((x, a) => x + f(a), 0) / ultimi.length
      const contati = (60 * (atti.length - 1)) / Math.max(0.5, atti[atti.length - 1].inizio - atti[0].inizio)
      const vti = media((a) => a.vti)
      const vte = media((a) => a.vte)
      m.measuredFrequency = Math.round(contati)
      m.volumeInspired = Math.round(vti)
      m.volumeExpired = Math.round(vte * (1 - perdita) * (1 + whisper))
      m.volumeMinute = parseFloat((((m.volumeExpired ?? 0) * contati) / 1000).toFixed(1))
      m.tiTtot = parseFloat(
        (media((a) => a.fineInsp - a.inizio) / Math.max(0.5, 60 / Math.max(1, contati))).toFixed(2),
      )
      // ## La perdita vera: quello che la macchina ha dato e il paziente non ha preso
      //
      // Il VTi della macchina comprende il gas uscito dal bordo mentre spingeva;
      // il VTe è quello che il paziente restituisce. La differenza è la firma
      // della perdita: la percentuale è (VTi − VTe)/VTi, come la scrivono i
      // ventilatori; i litri al minuto sono tutto il gas perso nel ciclo.
      if (perditaVera) {
        const tutti = atti.slice(1)
        const durata = Math.max(0.5, atti[atti.length - 1].fine - atti[0].fine)
        const persi = tutti.reduce((x, a) => x + a.vPerso, 0)
        const vti = media((a) => a.vti + a.vPersoInsp)
        m.volumeInspired = Math.round(vti)
        m.leakPercentage = vti > 0 ? parseFloat(Math.max(0, ((vti - vte) / vti) * 100).toFixed(1)) : 0
        m.leakFlow = parseFloat(((persi / 1000) * (60 / durata)).toFixed(1))
      }
    }
    // La P0.1 e lo stress index li sa solo il motore: sono la forma della
    // curva, non il suo conto.
    if (motoreCopre(statoMotore)) {
      const recenti = atti.length ? atti : attiRecenti(tSec, statoMotore, 20)
      const ultimi = (vals: (number | null)[]) => {
        const v = vals.filter((x): x is number => typeof x === 'number').slice(-3)
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
      }
      const p01 = ultimi(recenti.map((a) => (a.innescato ? a.p01 : null)))
      m.p01 = p01 === null ? null : parseFloat(p01.toFixed(1))
      const si = ultimi(recenti.map((a) => a.stressIndex))
      m.stressIndex = si === null ? null : parseFloat(si.toFixed(2))
    }
    m.mlPerKg =
      stato.paziente.pesoKg && stato.paziente.pesoKg > 0
        ? parseFloat(((m.volumeExpired ?? 0) / stato.paziente.pesoKg).toFixed(1))
        : null
  }

  // ## L'EtCO₂, che segue la ventilazione
  //
  // Se il paziente ne ha una scritta nell'istantanea, il capnografo insegue
  // quella: la CO₂ è del paziente, e la regia resta l'unico produttore. Se non
  // c'è — il ventilatore usato da solo, per provarlo — si calcola dalla
  // ventilazione minuto, che è la relazione che in aula deve vedersi: si
  // abbassa la frequenza e la CO₂ sale.
  const bersaglioCo2 = stato.paziente.etco2 ?? co2DaVentilazione(m.volumeMinute, stato.paziente.pesoKg)
  // Due costanti di tempo, e non è un vezzo: quella del paziente vera — i
  // depositi di CO₂ — la fa già la regia (`interazioni.ts`), quindi quando il
  // valore arriva da lì il capnografo deve solo essere un capnografo: pochi
  // secondi, o il balzo del ROSC arriverebbe smorzato due volte. Il ripiego
  // calcolato qui, senza regia a monte, tiene la costante lenta perché fa da
  // fisiologia oltre che da strumento.
  const tauCo2 = stato.paziente.etco2 !== null ? 8 : 30
  m.etco2 = Math.round(insegue(prima.etco2 ?? bersaglioCo2, bersaglioCo2, dtSec, tauCo2))
  m.spo2 = stato.paziente.spo2

  // ## I gas dell'anestesia
  if (ambiente === 'anestesia' && stato.gas) {
    const gas = stato.gas
    const et = [prima.etAgentConcentration ?? 0, prima.etSecondaryAgentConcentration ?? 0]
    const prossimi = gas.agenti.map((_, i) => {
      const bersaglio = gas.erogazione && gas.livelli[gas.agenti[i]] > 0 ? bersaglioEt(imp.targetMac, gas.agenti, i, gas.etaAnni) : 0
      return parseFloat(etAgenteProssimo(et[i] ?? 0, bersaglio, imp.fgf, dtSec).toFixed(2))
    })
    m.etAgentConcentration = prossimi[0] ?? 0
    m.etSecondaryAgentConcentration = prossimi[1] ?? 0
    m.fiAgentConcentration = parseFloat(
      fiAgenteDa(prossimi[0] ?? 0, gas.erogazione ? bersaglioEt(imp.targetMac, gas.agenti, 0, gas.etaAnni) : 0).toFixed(2),
    )
    m.fiSecondaryAgentConcentration = parseFloat(
      fiAgenteDa(prossimi[1] ?? 0, gas.erogazione ? bersaglioEt(imp.targetMac, gas.agenti, 1, gas.etaAnni) : 0).toFixed(2),
    )
    m.mac = parseFloat(macRaggiunta(gas.agenti, prossimi, gas.etaAnni).toFixed(2))
    m.inspiratoryCo2 = inManuale ? null : fiCO2(gas.calceResidua, imp.fgf, tSec)
  }

  return m
}

/**
 * L'esito di una pausa tenuta.
 *
 * È la manovra che trasforma un ventilatore in uno strumento di misura: la
 * pausa inspiratoria dà il plateau, e da lì compliance ed elastanza e — se si
 * conosce il picco — la resistenza; quella espiratoria dà la PEEP totale, e la
 * differenza con quella impostata è l'auto-PEEP, cioè l'aria che non è uscita.
 * Le due insieme sono il pacchetto che si legge in visita.
 */
export function esitoManovra(
  stato: StatoVentilatore,
  quale: Exclude<Manovra, null>,
  misureCorrenti: Misure,
  tSec?: number,
): Record<string, number | null> {
  // Il rapporto R/I guarda due PEEP, e la compliance la vuole a tutt'e due:
  // si calcola sul polmone dichiarato, prima di sistemarlo a questa PEEP.
  if (quale === 'rapporto-ri') return esitoRapportoRI(stato)
  // La manovra **misura**, e quello che misura è il polmone a questa PEEP: è la
  // ragione per cui la pausa inspiratoria a due PEEP diverse dà due compliance
  // diverse, che è tutto il criterio di reclutabilità (punto 5 del 4-bis).
  stato = polmoneOra(stato)
  const { impostazioni: imp, fisiologia: fis } = stato
  if (quale === 'curva-lenta') {
    const l = letturaCurvaLenta(stato, MANOVRA_DURATA_SEC)
    return {
      peep: arrotonda(imp.peep),
      aperturaVie: l.aperturaVie === null ? null : arrotonda(l.aperturaVie),
      complianceLenta: l.compliance === null ? null : arrotonda(l.compliance),
      pFinale: arrotonda(l.pFinale),
      volumeInspirato: Math.round(l.volume),
    }
  }
  // ## Col motore, la pausa misura l'ultimo atto vero
  //
  // Il plateau è la pressione alveolare a fine inspirazione dell'atto prima
  // della pausa, la PEEP totale quella a fine espirazione — con dentro l'aria
  // che non è uscita e le vie aeree che si chiudono. E se il paziente tira
  // mentre la pausa espiratoria tiene chiuso, quello è il **test di
  // occlusione**: la Paw scende quanto la Pes (Baydur 1982), e la caduta dice
  // lo sforzo (Bertoni, *Crit Care* 2019).
  const senza = { ...stato, manovra: null }
  if (tSec !== undefined && (quale === 'pausa-inspiratoria' || quale === 'pausa-espiratoria') && motoreCopre(senza)) {
    const da = stato.manovraDa ?? tSec - MANOVRA_DURATA_SEC
    const ultimo = attiRecenti(da, senza, 20).at(-1)
    if (ultimo) {
      if (quale === 'pausa-inspiratoria') {
        const vt = ultimo.vti
        const pplat = ultimo.palvFineInsp
        const ppeak = ultimo.pip
        const motrice = pplat - imp.peep
        const { Tif } = tempiRespiro(stato)
        const quadro = inVolume(stato) && (imp.formaFlusso ?? 0) === 0
        const flussoLs = quadro && Tif > 0 ? vt / 1000 / Tif : 0
        return {
          pPeak: arrotonda(ppeak),
          pPlateau: arrotonda(pplat),
          peep: arrotonda(imp.peep),
          volumeInspirato: Math.round(vt),
          pressioneMotrice: arrotonda(motrice),
          compliance: motrice > 0 ? arrotonda(vt / motrice) : null,
          elastanza: motrice > 0 && vt > 0 ? arrotonda(motrice / (vt / 1000)) : null,
          resistenza: flussoLs > 0 ? arrotonda((ppeak - pplat) / flussoLs) : null,
        }
      }
      // Con le vie aeree chiuse la pausa vede il circuito, non gli alveoli.
      const totale = ultimo.vieChiuse ? imp.peep : ultimo.peepTotale
      const out: Record<string, number | null> = {
        peep: arrotonda(imp.peep),
        peepTotale: arrotonda(totale),
        autoPeep: arrotonda(Math.max(0, totale - imp.peep)),
      }
      let massimo = 0
      let inizioSforzo: number | null = null
      for (let t = da; t <= tSec; t += 0.01) {
        const pm = campioneMotore(t, senza).pmus
        if (inizioSforzo === null && pm > 0.2) inizioSforzo = t
        massimo = Math.max(massimo, pm)
      }
      if (massimo > 0.5) {
        const pOcc = -massimo
        out.pOcc = arrotonda(pOcc)
        out.p01 = inizioSforzo === null ? null : arrotonda(campioneMotore(inizioSforzo + 0.1, senza).pmus)
        out.pmusStimata = arrotonda(0.75 * massimo)
        out.plDinamica = arrotonda(ultimo.pip - imp.peep + 0.66 * massimo)
        // Paw e Pes scendono insieme: nel modello lo stesso sforzo arriva a tutt'e due.
        out.rapportoOcclusione = 1
      }
      return out
    }
  }
  // ## Il reclutamento non misura niente
  //
  // Le altre due sono strumenti: si tengono per sapere un numero. Questa è una
  // terapia, e quello che lascia è il verbale di quello che è stato fatto —
  // a che pressione e per quanto. Se il paziente non l'ha retta il verbale lo
  // dice altrove (`manovraInterrotta` in `istantanea.ts`).
  if (quale === 'reclutamento') {
    return {
      pressione: arrotonda(RECLUTAMENTO_PRESSIONE),
      peep: arrotonda(imp.peep),
      secondi: RECLUTAMENTO_SECONDI,
      volumeInspirato: Math.round(
        Math.max(0, RECLUTAMENTO_PRESSIONE - imp.peep) * Math.max(1, fis.compliance),
      ),
    }
  }
  if (quale === 'pausa-inspiratoria') {
    const vt = volumeCorrenteAtteso(stato)
    const pplat = imp.peep + vt / Math.max(1, fis.compliance)
    const ppeak = misureCorrenti.pPeak ?? pplat
    const motrice = pplat - imp.peep
    const { Tif } = tempiRespiro(stato)
    const flussoLs = Tif > 0 ? vt / 1000 / Tif : 0
    return {
      pPeak: arrotonda(ppeak),
      pPlateau: arrotonda(pplat),
      peep: arrotonda(imp.peep),
      volumeInspirato: Math.round(vt),
      pressioneMotrice: arrotonda(motrice),
      compliance: motrice > 0 ? arrotonda(vt / motrice) : null,
      elastanza: motrice > 0 && vt > 0 ? arrotonda(motrice / (vt / 1000)) : null,
      resistenza: flussoLs > 0 ? arrotonda((ppeak - pplat) / flussoLs) : null,
    }
  }
  // La PEEP totale: quella impostata più quella intrinseca, che cresce quando
  // il tempo espiratorio non basta a svuotare — tre costanti di tempo. Il conto
  // sta in `autoPeep`, perché la stessa aria che non esce la sente anche il
  // circolo, e lì nessuno tiene premuto un tasto.
  const intrinseca = autoPeep(stato)
  return {
    peep: arrotonda(imp.peep),
    peepTotale: arrotonda(imp.peep + intrinseca),
    autoPeep: arrotonda(intrinseca),
  }
}

/** Quanto dura una manovra che misura, in secondi: lo stesso di `MANOVRA_SECONDI`. */
const MANOVRA_DURATA_SEC = 5

function inVolume(stato: StatoVentilatore): boolean {
  return stato.modalita === 'VC' || (stato.modalita === 'SIMV' && stato.impostazioni.psLevel === 0)
}

/**
 * Il volume che la PEEP alta tiene **riaperto**, in ml: quello che esce in più,
 * scendendo di PEEP, di quanto la compliance a PEEP bassa spiegherebbe.
 *
 * È la reclutabilità del paziente vista con un respiro (Chen, *AJRCCM* 2020):
 * cresce con la quota di polmone da riaprire e col gradino di PEEP, e satura —
 * oltre una decina di cmH₂O non c'è più niente da tenere aperto. Il gradino
 * conta dalla più alta fra la PEEP bassa e la pressione di apertura: sotto
 * quella le vie aeree sono chiuse e il polmone non si svuota.
 */
export function volumeReclutato(f: Fisiologia, peepAlta: number, peepBassa: number): number {
  const sotto = Math.max(peepBassa, f.aperturaVie ?? 0)
  const gradino = Math.max(0, peepAlta - sotto)
  const r = Math.max(0, Math.min(1, f.reclutabilita))
  return r * f.compliance * gradino * 1.2 * (1 - Math.exp(-gradino / 8))
}

/**
 * Il rapporto reclutamento/inflazione (Chen, *AJRCCM* 2020): da PEEP alta a
 * PEEP bassa in un respiro, il volume che esce in più di quanto la compliance a
 * PEEP bassa spiega è il **reclutato**; diviso per il gradino è la compliance
 * del polmone reclutato, e rapportata alla compliance a PEEP bassa dice se la
 * PEEP alta riapre (≥ 0,5) o soltanto gonfia (< 0,5).
 */
function esitoRapportoRI(stato: StatoVentilatore): Record<string, number | null> {
  const imp = stato.impostazioni
  const f = stato.fisiologia
  const alta = imp.peep
  if (alta < PEEP_MINIMA_RI) {
    return { peep: arrotonda(alta), peepBassa: null, volumeEsalato: null, volumeReclutato: null, rapportoRI: null }
  }
  const bassa = PEEP_BASSA_RI
  const sotto = Math.max(bassa, f.aperturaVie ?? 0)
  const gradino = Math.max(0, alta - sotto)
  const cBassa = complianceA(f, bassa)
  const reclutato = volumeReclutato(f, alta, bassa)
  const predetto = cBassa * gradino
  const esalato = predetto + reclutato
  const cRec = gradino > 0 ? reclutato / gradino : 0
  return {
    peep: arrotonda(alta),
    peepBassa: arrotonda(bassa),
    volumeEsalato: Math.round(esalato),
    volumePredetto: Math.round(predetto),
    volumeReclutato: Math.round(reclutato),
    complianceReclutata: arrotonda(cRec),
    complianceBassa: arrotonda(cBassa),
    rapportoRI: cBassa > 0 ? parseFloat((cRec / cBassa).toFixed(2)) : null,
  }
}

/**
 * I consumabili, un po' più consumati.
 *
 * Restituisce oggetti nuovi: chi tiene lo stato lo sostituisce, e nessuno
 * scrive dentro quello che gli è stato passato. È la stessa regola per cui
 * l'istantanea si riscrive intera invece di aggiornarla per pezzi.
 */
export function avanza(
  stato: StatoVentilatore,
  dtSec: number,
  tSec = 0,
): {
  gas: StatoGas | null
  altoFlusso: StatoAltoFlusso | null
  umidificatore: StatoUmidificatore | null
} {
  let gas = stato.gas
  if (gas && stato.ambiente === 'anestesia' && stato.ventilando) {
    const livelli = { ...gas.livelli }
    if (gas.erogazione) {
      for (const agente of gas.agenti) {
        livelli[agente] = consumaAgente(livelli[agente], stato.impostazioni.fgf, dtSec)
      }
    }
    gas = {
      ...gas,
      livelli,
      calceResidua: consumaCalce(gas.calceResidua, stato.impostazioni.fgf, dtSec),
    }
  }

  // ## L'acqua della camera
  //
  // **Non si consuma in modo realistico, ed è una scelta.** Una camera vera
  // dura ore: in uno scenario da mezz'ora sarebbe un disegno che non cambia
  // mai, e l'allarme «controlla l'acqua» non suonerebbe nemmeno una volta in
  // un corso intero. Qui comanda l'allestimento: si sceglie quanta acqua c'è
  // e **se deve finire durante il caso**; se deve, `finisceA` dice quando, e
  // il livello scende da lì fino a zero.
  //
  // La potenza entra lo stesso, perché è la cosa che si insegna: più si
  // scalda, più in fretta se ne va. Senza un istante d'esaurimento programmato
  // il consumo è quello della potenza e basta.
  let umidificatore = stato.umidificatore
  if (umidificatore && stato.ventilando) {
    // ## Le secrezioni si accumulano, e rientrano
    //
    // Gira **anche a umidificatore spento**, e deve: spegnerlo è il gesto con
    // cui si fanno rientrare, e se questo blocco si fermasse col motore
    // l'accumulo resterebbe lì per sempre a ricordare una manopola che
    // nessuno tiene più su.
    const quotaOra = umidificatore.acceso ? umidificatore.potenza / POTENZA_MASSIMA : 0
    const verso = quotaOra - QUOTA_SUFFICIENTE
    const accumulo = Math.min(
      1,
      Math.max(0, umidificatore.accumulo + verso * VELOCITA_ACCUMULO * dtSec),
    )
    umidificatore = { ...umidificatore, accumulo }
  }
  if (umidificatore && umidificatore.acceso && stato.ventilando) {
    let acqua: number
    if (umidificatore.finisceA !== null && umidificatore.finisceA > 0) {
      // Scende in linea retta fino all'istante scelto: chi guarda la camera
      // vede il pelo dell'acqua calare, che è il preavviso che l'allarme non dà.
      const restante = Math.max(0, umidificatore.finisceA - tSec)
      const totale = Math.max(1, umidificatore.finisceA)
      acqua = Math.min(umidificatore.acqua, restante / totale)
    } else {
      const quota = umidificatore.potenza / POTENZA_MASSIMA
      acqua = umidificatore.acqua - CONSUMO_ACQUA_PIENO * quota * dtSec
    }
    umidificatore = { ...umidificatore, acqua: Math.max(0, Math.min(1, acqua)) }
  }

  return { gas, altoFlusso: stato.altoFlusso, umidificatore }
}

/** Uno stato di partenza coerente: quello che si accende in aula. */
export function statoIniziale(
  ambiente: Ambiente,
  impostazioni: Impostazioni,
  modalita: Modalita,
): StatoVentilatore {
  return {
    ambiente,
    modalita,
    // §665 (l'utente: «deve partire in VC e non in manuale»): anche la macchina d'anestesia nasce sul
    // selettore meccanico, in standby; il pallone la porta in manuale da sé al primo atto
    respiro: 'meccanica',
    ventilando: false,
    impostazioni,
    fisiologia: FISIOLOGIA_NORMALE,
    drive: DRIVE_ASSENTE,
    asincronia: null,
    manovra: null,
    gas: null,
    altoFlusso: null,
    umidificatore: ambiente === 'anestesia' ? null : { ...STATO_UMIDIFICATORE_INIZIALE },
    paziente: { pesoKg: null, etco2: null, spo2: null, heartRate: null, map: null },
    seme: 1,
    sfasamentoSpontaneo: 0,
  }
}

/** Un valore che si avvicina al bersaglio con la sua costante di tempo. */
function insegue(valore: number, bersaglio: number, dtSec: number, tauSec: number): number {
  if (tauSec <= 0 || dtSec <= 0) return bersaglio
  return valore + (bersaglio - valore) * (1 - Math.exp(-dtSec / tauSec))
}

/**
 * L'EtCO₂ che ci si aspetta con quella ventilazione minuto.
 *
 * Quaranta è la normale, e la CO₂ è inversamente proporzionale alla
 * ventilazione alveolare: dimezzare la ventilazione raddoppia la CO₂. Il
 * riferimento è cento millilitri per chilo al minuto, che su settanta chili fa
 * i sette litri di uno ventilato. Senza un peso si prende sei litri.
 */
function co2DaVentilazione(volumeMinute: number | null, pesoKg: number | null): number {
  const riferimento = pesoKg && pesoKg > 0 ? (pesoKg * 100) / 1000 : 6
  if (!volumeMinute || volumeMinute <= 0) return 40
  return Math.min(90, Math.max(15, (40 * riferimento) / volumeMinute))
}

/**
 * Il picco di pressione in volume a flusso decelerante, cmH₂O.
 *
 * Il flusso parte da `2·VT/Tif` e scende a zero: la Paw è
 * `PEEP + V(t)/C + R·Q(t)`, e il massimo cade dove il ritorno elastico che
 * cresce pareggia il resistivo che cala — a `t* = Tif − RC`. Se la costante di
 * tempo è più lunga dell'inspirazione il picco è all'inizio, ed è tutto
 * resistivo.
 */
export function piccoDecelerante(peep: number, vtMl: number, Tif: number, C: number, R: number): number {
  if (Tif <= 0) return peep + vtMl / Math.max(1, C)
  const q0 = (2 * vtMl) / 1000 / Tif
  const tau = (R * Math.max(1, C)) / 1000
  const t = Math.max(0, Tif - tau)
  const v = q0 * (t - (t * t) / (2 * Tif)) * 1000
  return peep + v / Math.max(1, C) + R * q0 * (1 - t / Tif)
}

function arrotonda(v: number): number {
  return parseFloat(v.toFixed(1))
}
