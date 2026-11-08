/**
 * I gas dell'anestesia: quello che si consuma, e quello che si respira indietro.
 *
 * ## Perché i consumabili sono oggetti e non barre
 *
 * La cartuccia del vaporizzatore che si svuota e il canister della calce che
 * vira al viola sono, in aula, **le due sole cose che si vedono senza leggere**.
 * Un anestesista guarda la finestrella del vaporizzatore mille volte al giorno e
 * non legge mai una percentuale; se in simulazione gli si mette una barra col
 * numero accanto, gli si insegna a guardare un posto che sulla macchina vera non
 * esiste. Da qui la decisione 7 del piano: il livello del liquido e i granuli
 * sono l'indicatore, il numero sta accanto.
 *
 * Questo file tiene i **conti**; il disegno sta nel componente. Ma le grandezze
 * sono pensate per essere disegnate: `livelli` è una frazione da 0 a 1 perché
 * quella frazione è l'altezza del liquido nella finestrella, e `calceResidua`
 * è una frazione perché è la quota di granuli ancora bianchi, contata dal fondo.
 *
 * ## La calce contata al dritto
 *
 * Nella sorgente il campo si chiama `sodaLimeRemainingPercent` e **cresce**
 * mentre la calce si consuma: parte da zero e arriva a cento quando è finita.
 * Un campo che si chiama «residuo» e misura il consumato è la specie di
 * inversione che nessuno nota finché non la legge qualcun altro, e allora
 * disegna il canister al contrario. Qui `calceResidua` va da 1 (fresca) a 0
 * (esaurita), e chi la disegna non deve chiedersi niente.
 *
 * ## L'interlock del riempimento
 *
 * Riempire una cartuccia o cambiare il canister si fa **a gas chiusi**. Farlo a
 * gas aperti non è impedito e non produce nessun avviso a schermo: l'azione
 * riesce, e resta scritta nel registro come errore. La regola vive nel
 * comportamento e nel debriefing, non in un cartello sul device — è la stessa
 * ragione per cui il device non etichetta le asincronie.
 */

import { rumore } from './caso'
import { MAC40, macPerEta } from '../anestesia/modelli'
import type { TranslationKey } from '../../../i18n/it'

export type Agente = 'sevoflurano' | 'desflurano' | 'isoflurano' | 'protossido'

export interface DefinizioneAgente {
  etichetta: TranslationKey
  /** La sigla sulla pillola in testa allo schermo. */
  sigla: string
  /**
   * Il colore, che non è una scelta grafica: è quello della ghiera e
   * dell'etichetta sulla bottiglia, ed è come si riconosce un vaporizzatore
   * dall'altra parte della sala. Giallo sevo, blu des, viola iso.
   */
  colore: string
  /** MAC a 40 anni, in percentuale di volume: quella del motore dell'anestesia. */
  mac: number
}

export const AGENTI: Record<Agente, DefinizioneAgente> = {
  sevoflurano: { etichetta: 'vent.gas.sevoflurano', sigla: 'SEVO', colore: '#eab308', mac: MAC40.sevoflurano },
  desflurano: { etichetta: 'vent.gas.desflurano', sigla: 'DES', colore: '#3b82f6', mac: MAC40.desflurano },
  isoflurano: { etichetta: 'vent.gas.isoflurano', sigla: 'ISO', colore: '#a855f7', mac: MAC40.isoflurano },
  protossido: { etichetta: 'vent.gas.protossido', sigla: 'N₂O', colore: '#9ca3af', mac: 104 },
}

/** L'ordine dei vaporizzatori sul carrello, dal più usato. */
export const ORDINE_AGENTI: Agente[] = ['sevoflurano', 'desflurano', 'isoflurano', 'protossido']

/** Quanti vaporizzatori si possono montare insieme. Due, come sulla macchina. */
export const MASSIMO_AGENTI = 2

/** Lo stato dei gas: che cosa c'è montato, quanto ne resta, che cosa esce. */
export interface StatoGas {
  /** Gli agenti montati, in ordine: il primo è il primario. */
  agenti: Agente[]
  /** Quanto liquido resta in ogni cartuccia, da 0 a 1. */
  livelli: Record<Agente, number>
  /** I granuli ancora buoni, da 1 (fresca) a 0 (esaurita). */
  calceResidua: number
  /** Se il vaporizzatore sta erogando. */
  erogazione: boolean
  /** Fino a quando dura il flush di ossigeno, nel tempo del ventilatore. */
  flushFinoA: number
  /**
   * L'età del paziente scritta sulla macchina, in anni (§402). Le macchine
   * vere la chiedono per dare la MAC corretta per l'età (Mapleson 1996): senza,
   * 5,5% di desflurano a 58 anni si leggeva 0,8 MAC invece di 0,93. Assente,
   * la MAC è quella dei quarant'anni, come prima.
   */
  etaAnni?: number
}

export const STATO_GAS_INIZIALE: StatoGas = {
  agenti: ['sevoflurano'],
  livelli: { sevoflurano: 1, desflurano: 1, isoflurano: 1, protossido: 1 },
  calceResidua: 1,
  erogazione: false,
  flushFinoA: 0,
}

/** Quanto dura il flush d'ossigeno, in secondi: si tiene premuto e va da sé. */
export const FLUSH_SECONDI = 30

/** Il flusso di riferimento del consumo: a dieci litri una cartuccia dura un'ora. */
const FGF_RIFERIMENTO = 10
const DURATA_CARTUCCIA_SEC = 3600

/**
 * Quanto liquido resta dopo `dtSec` secondi a quel flusso.
 *
 * Il consumo è proporzionale al flusso di gas fresco, che è la cosa vera e
 * anche quella didattica: chi tiene otto litri al minuto per tutto il caso
 * consuma otto volte più agente di chi chiude a uno, e in aula lo vede
 * succedere nella finestrella.
 */
export function consumaAgente(livello: number, fgf: number, dtSec: number): number {
  if (livello <= 0 || fgf <= 0 || dtSec <= 0) return Math.max(0, livello)
  const alSecondo = (fgf / FGF_RIFERIMENTO) * (1 / DURATA_CARTUCCIA_SEC)
  return Math.max(0, livello - alSecondo * dtSec)
}

/** Le due durate della calce, in ore, fra flusso alto e flusso basso. */
const CALCE_ORE_FGF_ALTO = 8
const CALCE_ORE_FGF_BASSO = 2
const CALCE_FGF_ALTO = 6
const CALCE_FGF_BASSO = 0.5

/**
 * Quanta calce resta dopo `dtSec` secondi.
 *
 * Più il flusso è basso più si respira dentro il circuito, e più calce passa
 * nei polmoni del paziente: sotto mezzo litro al minuto un canister dura due
 * ore, sopra i sei litri ne dura otto perché quasi tutto se ne va allo scarico.
 * È il rovescio esatto del consumo dell'agente, ed è la ragione per cui i bassi
 * flussi si insegnano insieme alla calce.
 */
export function consumaCalce(residua: number, fgf: number, dtSec: number): number {
  if (residua <= 0 || dtSec <= 0) return Math.max(0, residua)
  let riespirazione = 0
  if (fgf < CALCE_FGF_BASSO) riespirazione = 1
  else if (fgf < CALCE_FGF_ALTO)
    riespirazione = 1 - (fgf - CALCE_FGF_BASSO) / (CALCE_FGF_ALTO - CALCE_FGF_BASSO)
  const ore = CALCE_ORE_FGF_ALTO - riespirazione * (CALCE_ORE_FGF_ALTO - CALCE_ORE_FGF_BASSO)
  const alSecondo = ore > 0 ? 1 / (ore * 3600) : 0.01
  return Math.max(0, residua - alSecondo * dtSec)
}

/** La costante di tempo del lavaggio: quanto conta il flusso sulla salita dell'Et. */
const LAVAGGIO = 0.025
const LAVAGGIO_FGF_MINIMO = 0.5

/**
 * L'Et-agente al prossimo istante, che insegue il bersaglio.
 *
 * Primo ordine, con la velocità legata al flusso di gas fresco: a bassi flussi
 * il circuito si lava piano e l'agente ci mette minuti ad arrivare, ad alti
 * flussi arriva subito. Il passo `dtSec` entra nell'esponenziale e non nella
 * moltiplicazione, così la stessa curva esce uguale che la regia ticchetti ogni
 * due secondi o ogni decimo — un motore che dipende da quanto spesso lo si
 * chiama è un motore che cambia comportamento il giorno che si cambia il tick.
 */
export function etAgenteProssimo(
  et: number,
  bersaglio: number,
  fgf: number,
  dtSec: number,
): number {
  const k = Math.max(LAVAGGIO_FGF_MINIMO, fgf) * LAVAGGIO
  const avvicinamento = 1 - Math.exp(-k * Math.max(0, dtSec))
  return Math.max(0, et + (bersaglio - et) * avvicinamento)
}

/**
 * La concentrazione inspirata, dall'espirata e dal bersaglio.
 *
 * Durante il lavaggio l'inspirata sta **sopra** l'espirata — è l'agente che sta
 * entrando — e a regime le due coincidono. È una semplificazione dichiarata:
 * serve a far vedere la forbice Fi/Et che si apre quando si alza il
 * vaporizzatore e si chiude quando il paziente è saturo, che è quello che si
 * guarda davvero.
 */
export function fiAgenteDa(et: number, bersaglio: number): number {
  if (bersaglio <= et) return et
  return et + (bersaglio - et) * 0.6
}

/** Una MAC, in vol%: corretta per l'età quando la macchina la sa. */
export function macDi(agente: Agente, etaAnni?: number): number {
  if (agente === 'protossido' || etaAnni === undefined || !Number.isFinite(etaAnni)) return AGENTI[agente].mac
  return macPerEta(agente, etaAnni)
}

/** L'Et che serve per la MAC chiesta, diviso fra gli agenti montati. */
export function bersaglioEt(targetMac: number, agenti: Agente[], quale: number, etaAnni?: number): number {
  const attivi = agenti.length
  if (attivi === 0 || quale >= attivi) return 0
  return (targetMac / attivi) * macDi(agenti[quale], etaAnni)
}

/** La MAC raggiunta: ogni agente per quello che vale, sommati. */
export function macRaggiunta(agenti: Agente[], et: number[], etaAnni?: number): number {
  let somma = 0
  agenti.forEach((agente, i) => {
    const valore = et[i] ?? 0
    if (valore > 0) somma += valore / macDi(agente, etaAnni)
  })
  return somma
}

/**
 * La CO₂ inspirata, in mmHg: il numero che dice che la calce è finita.
 *
 * Non è mai zero — un filo di riespirazione c'è sempre — e sale quando i
 * granuli sono esauriti o quando il flusso è così basso che quasi tutta l'aria
 * ripassa dal canister. Cinque mmHg di CO₂ inspirata su un paziente in
 * anestesia è il segno che qualcosa nel circuito non torna, ed è il motivo per
 * cui questo numero sta nel gruppo di monitoraggio accanto all'EtCO₂.
 */
export function fiCO2(calceResidua: number, fgf: number, tSec: number): number {
  const consumata = 1 - calceResidua
  let base: number
  if (consumata > 0.85) base = 5 + (consumata - 0.85) * 33
  else if (consumata > 0.5 && fgf < 1) base = 2 + (consumata - 0.5) * 4
  else if (fgf < 0.75 && consumata > 0.2) base = 1
  else if (fgf < 1.5 && consumata > 0.1) base = 0.5
  else base = 0.15
  const oscillazione = rumore(7, tSec, 0.5) * 0.15
  return Math.min(20, Math.max(0, parseFloat((base + oscillazione).toFixed(1))))
}

/**
 * Se i gas sono chiusi, cioè se si può riempire senza combinare guai.
 *
 * Chiusi vuol dire: vaporizzatore che non eroga **e** niente flusso di gas
 * fresco. In standby vale lo stesso, perché a macchina ferma non passa niente.
 */
export function gasChiusi(stato: StatoGas, fgf: number, inStandby: boolean): boolean {
  if (inStandby) return true
  return !stato.erogazione && fgf <= 0
}

/** Il nome dell'evento che finisce nel registro quando si riempie a gas aperti. */
export const ERRORE_RIEMPIMENTO = 'errore-riempimento-gas-aperti'

/** Che cosa si riempie: una cartuccia, o il canister della calce. */
export type Consumabile = { cosa: 'cartuccia'; agente: Agente } | { cosa: 'calce' }

/**
 * Quanto dura il cambio di un consumabile, in secondi.
 *
 * **Mezzo minuto, e non è un'attesa finta.** Cambiare un canister di calce
 * vuol dire sganciarlo, toglierlo, prenderne uno nuovo e riagganciarlo; una
 * cartuccia si riempie versando. Finché era istantaneo, in aula si premeva il
 * pulsante col paziente attaccato e la macchina tornava piena come se niente
 * fosse — che è esattamente l'idea sbagliata di quel gesto. Trenta secondi
 * sono quello che ci vuole davvero, e sono anche il tempo in cui qualcuno deve
 * ventilare a mano.
 */
export const RIEMPIMENTO_SECONDI = 30

/**
 * Riempi. **Solo a gas chiusi.**
 *
 * Fino al §165 riusciva sempre e lasciava una riga nel registro: la regola
 * viveva nel debriefing, non nella macchina. Ma su una macchina vera non è una
 * cattiva idea, è una cosa che **non si fa** — si versa agente liquido con il
 * circuito in pressione — e un simulatore che la lascia fare insegna che si
 * può. Adesso a gas aperti non succede niente, e il tentativo resta nel
 * registro: quello serviva e serve ancora.
 *
 * Il vuoto restituito è `null`: chi chiama sa che non è cambiato niente.
 */
export function riempi(
  stato: StatoGas,
  consumabile: Consumabile,
  fgf: number,
  inStandby: boolean,
): { stato: StatoGas | null; errore: boolean } {
  if (!gasChiusi(stato, fgf, inStandby)) return { stato: null, errore: true }
  const prossimo: StatoGas =
    consumabile.cosa === 'calce'
      ? { ...stato, calceResidua: 1 }
      : { ...stato, livelli: { ...stato.livelli, [consumabile.agente]: 1 } }
  return { stato: prossimo, errore: false }
}
