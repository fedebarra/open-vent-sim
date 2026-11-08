/**
 * Come si chiamano le cose del ventilatore, in un posto solo.
 *
 * ## Perché una tabella e non una chiave costruita a pezzi
 *
 * `t(\`vent.mode.${modalita}\`)` sarebbe più corto e spegnerebbe il
 * compilatore: le chiavi del dizionario sono un **tipo**, e una chiave composta
 * a pezzi è una stringa qualunque. In questa casa una chiave che manca è un
 * errore di compilazione (`i18n/en.ts` non è più `Partial`), e vale la pena
 * scrivere qualche tabella per non perdere quella garanzia.
 *
 * ## Perché **qui** e non dentro le schermate
 *
 * Perché sono tre a chiederle: il device, il pannello della regia e il
 * registro. Le prime due se le erano scritte ciascuna la sua, ed erano già
 * divergenti di una voce — è la specie di doppione che marcisce senza che
 * nessuno lo veda finché non si aggiunge una modalità e ne compare una sola.
 */

import type { TranslationKey } from '../../../i18n/it'
import { AGENTI, ERRORE_RIEMPIMENTO, type Agente } from './gas'
import { ERRORE_HME_E_UMIDIFICATORE } from './istantanea'
import { ALLARMI, type ChiaveAllarme } from './allarmi'
import { PARAMETRI, type Ambiente, type ChiaveParametro, type Disinfezione, type InterfacciaAltoFlusso, type Modalita, type Respiro } from './parametri'
import type { Manovra } from './fisica'
import type { PresetFisiologia } from './fisica'
import type { TipoAsincronia } from './asincronie'

export const NOME_AMBIENTE: Record<Ambiente, TranslationKey> = {
  anestesia: 'vent.env.anestesia',
  invasiva: 'vent.env.invasiva',
  niv: 'vent.env.niv',
  'alto-flusso': 'vent.env.altoFlusso',
}

export const NOME_MODALITA: Record<Modalita, TranslationKey> = {
  VC: 'vent.mode.VC',
  PC: 'vent.mode.PC',
  PRVC: 'vent.mode.PRVC',
  PS: 'vent.mode.PS',
  SIMV: 'vent.mode.SIMV',
  CPAP: 'vent.mode.CPAP',
  AF: 'vent.mode.AF',
}

export const NOME_RESPIRO: Record<Respiro, TranslationKey> = {
  meccanica: 'vent.breath.meccanica',
  manuale: 'vent.breath.manuale',
}

/** I motivi per cui una manovra si interrompe: le chiavi che il registro accetta. */
export const MOTIVI_STOP: string[] = [
  'vent.stop.pressione',
  'vent.stop.bradicardia',
  'vent.stop.saturazione',
  'vent.stop.barotrauma',
]

export const NOME_MANOVRA: Record<Exclude<Manovra, null>, TranslationKey> = {
  'pausa-inspiratoria': 'vent.manovra.inspiratoria',
  'pausa-espiratoria': 'vent.manovra.espiratoria',
  reclutamento: 'vent.manovra.reclutamento',
}

export const NOME_PRESET: Record<PresetFisiologia, TranslationKey> = {
  normale: 'vent.preset.normale',
  bpco: 'vent.preset.bpco',
  ards: 'vent.preset.ards',
  covid: 'vent.preset.covid',
  anafilassi: 'vent.preset.anafilassi',
  'edema-polmonare': 'vent.preset.edemaPolmonare',
  polmonite: 'vent.preset.polmonite',
  fibroscopia: 'vent.preset.fibroscopia',
}

export const NOME_ASINCRONIA: Record<TipoAsincronia, TranslationKey> = {
  'sforzo-inefficace': 'vent.async.sforzoInefficace',
  'doppio-ciclo': 'vent.async.doppioCiclo',
  'reverse-trigger': 'vent.async.reverseTrigger',
  'fame-di-flusso': 'vent.async.fameDiFlusso',
  'ciclaggio-precoce': 'vent.async.ciclaggioPrecoce',
  'ciclaggio-ritardato': 'vent.async.ciclaggioRitardato',
  'auto-trigger': 'vent.async.autoTrigger',
}

export const NOME_INTERFACCIA: Record<InterfacciaAltoFlusso, TranslationKey> = {
  adulto: 'vent.af.adulto',
  pediatrica: 'vent.af.pediatrica',
  junior: 'vent.af.junior',
}

/**
 * Lo stato della disinfezione, come si legge sull'apparecchio.
 *
 * Tre parole e non una spia colorata: «non sicuro» dev'essere leggibile da chi
 * non conosce la macchina, perché è l'unica di cui importa davvero.
 */
export const NOME_DISINFEZIONE: Record<Disinfezione, TranslationKey> = {
  pulito: 'vent.af.disinfezione.pulito',
  sporco: 'vent.af.disinfezione.sporco',
  'non-sicuro': 'vent.af.disinfezione.nonSicuro',
}

/** Le voci che una manovra restituisce, e come si chiamano a schermo. */
export const NOME_ESITO: Record<string, TranslationKey> = {
  pPeak: 'vent.param.pPeak',
  pPlateau: 'vent.param.pPlateau',
  peep: 'vent.param.peep',
  volumeInspirato: 'vent.param.volumeInspired',
  pressioneMotrice: 'vent.esito.motrice',
  compliance: 'vent.param.compliance',
  elastanza: 'vent.esito.elastanza',
  resistenza: 'vent.param.resistance',
  peepTotale: 'vent.esito.peepTotale',
  autoPeep: 'vent.esito.autoPeep',
  // Il reclutamento sostenuto non misura: lascia il verbale di quello che è
  // stato fatto — a che pressione e per quanto.
  pressione: 'vent.esito.pressione',
  secondi: 'vent.esito.secondi',
}

/**
 * Che cosa si legge nel registro di sessione, al posto del nome dell'azione.
 *
 * Il registro è **il documento del debriefing**: ci si torna sopra a freddo, e
 * chi lo legge non deve incontrare `vent-parametro:fio2`. È la regola per cui
 * gli identificatori non si mostrano — chi legge prosa non deve leggere i nomi
 * dei campi, o finisce per ricopiarli.
 *
 * Restituisce una o due chiavi, che chi disegna unisce con un punto in mezzo:
 * «Ventilatore · FiO₂», «Ventilatore · riempimento a gas aperti». Nulla vuol
 * dire che quell'azione non è del ventilatore, e la scrive qualcun altro.
 */
export function voceRegistro(kind: string): TranslationKey[] | null {
  if (kind === ERRORE_RIEMPIMENTO) return ['vent.log.erroreRiempimento']
  if (kind === ERRORE_HME_E_UMIDIFICATORE) return ['vent.log.erroreHmeUmidificatore']
  // ## La macchina girata da chi conduce
  //
  // Stessa regola degli allarmi qui sotto, e per lo stesso motivo: **niente
  // prefisso `vent-`**, perché quello è la porta dei comandi e `applica()`
  // eseguirebbe il verbale come se fosse un ordine. (Provato per sbaglio: la
  // regia mandava `vent-parametro:peep` come riga, il canale lo rimandava
  // indietro come comando, e il quadro andava in pagina bianca.)
  //
  // Il titolo però è quello dell'apparecchio — «Ventilatore · parametro ·
  // PEEP» — perché al debriefing si cerca *la cosa*; chi l'ha girata sta nel
  // dettaglio (`dettaglioAzione`, «10 · da chi conduce»).
  if (kind.startsWith('regia-vent:')) return voceRegistro(kind.slice('regia-vent:'.length))
  // Gli allarmi che scattano e rientrano. Non hanno il prefisso `vent-` perché
  // quello è la porta dei **comandi** che `applica()` esegue, e una riga di
  // registro non è un comando; ma nel registro si leggono come tutto il resto.
  // ## La manovra che l'apparecchio ha interrotto
  //
  // Non ha il prefisso `vent-` per la stessa ragione degli allarmi: quella è la
  // porta dei comandi, e questa è una riga di registro. La coda **è già** una
  // chiave di traduzione (`vent.stop.*`), e si controlla invece di fidarsi: una
  // chiave sconosciuta stamperebbe sé stessa in mezzo al verbale.
  if (kind.startsWith('manovra-stop:')) {
    const motivo = kind.slice('manovra-stop:'.length)
    return ['vent.log.manovraInterrotta', MOTIVI_STOP.includes(motivo) ? (motivo as TranslationKey) : 'vent.log.ventilatore']
  }
  if (kind.startsWith('allarme-fine:')) {
    const chiave = kind.slice('allarme-fine:'.length) as ChiaveAllarme
    return ['vent.log.allarmeFine', ALLARMI[chiave]?.etichetta ?? 'vent.log.ventilatore']
  }
  if (kind.startsWith('allarme:')) {
    const [chiave, verso] = kind.slice('allarme:'.length).split(':')
    const nome = ALLARMI[chiave as ChiaveAllarme]?.etichetta ?? 'vent.log.ventilatore'
    // Il verso è metà dell'informazione: «volume minuto» non dice niente,
    // «volume minuto sotto il limite» dice che cosa è successo al paziente.
    if (verso === 'alto') return ['vent.log.allarmeAlto', nome]
    if (verso === 'basso') return ['vent.log.allarmeBasso', nome]
    return ['vent.log.allarmeScattato', nome]
  }
  if (!kind.startsWith('vent-')) return null

  const taglio = kind.indexOf(':')
  const testa = taglio < 0 ? kind : kind.slice(0, taglio)
  const coda = taglio < 0 ? '' : kind.slice(taglio + 1)

  switch (testa) {
    case 'vent-parametro':
      return ['vent.log.parametro', etichettaParametro(coda)]
    case 'vent-modalita':
      return ['vent.log.modalita', NOME_MODALITA[coda as Modalita] ?? 'vent.log.ventilatore']
    case 'vent-respiro':
      return ['vent.log.respiro', NOME_RESPIRO[coda as Respiro] ?? 'vent.log.ventilatore']
    case 'vent-avvia':
      return ['vent.log.avvia']
    case 'vent-standby':
      return ['vent.log.standby']
    case 'vent-autotest':
      return ['vent.log.autotest']
    case 'vent-manovra':
      return ['vent.log.manovra', NOME_MANOVRA[coda as Exclude<Manovra, null>] ?? 'vent.log.ventilatore']
    case 'vent-manovra-fine':
      return ['vent.log.manovraFine']
    case 'vent-gas-agente':
      return ['vent.log.agente', AGENTI[coda as Agente]?.etichetta ?? 'vent.log.ventilatore']
    case 'vent-gas-erogazione':
      return ['vent.log.erogazione']
    case 'vent-gas-flush':
      return ['vent.log.flush']
    case 'vent-riempi':
      return coda === 'calce'
        ? ['vent.log.riempi', 'vent.gas.calce']
        : ['vent.log.riempi', AGENTI[coda as Agente]?.etichetta ?? 'vent.gas.canister']
    case 'vent-limite':
      return ['vent.log.limite', ALLARMI[coda as ChiaveAllarme]?.etichetta ?? 'vent.log.ventilatore']
    case 'vent-allarme':
      return ['vent.log.allarme', ALLARMI[coda as ChiaveAllarme]?.etichetta ?? 'vent.log.ventilatore']
    case 'vent-interfaccia':
      return ['vent.log.interfaccia', NOME_INTERFACCIA[coda as InterfacciaAltoFlusso] ?? 'vent.log.ventilatore']
    case 'vent-silenzia':
      return ['vent.log.silenzia']
    case 'vent-umidificatore-on':
      return ['vent.log.umidificatoreOn']
    case 'vent-umidificatore-off':
      return ['vent.log.umidificatoreOff']
    case 'vent-potenza':
      return ['vent.log.potenza']
    case 'vent-disinfezione':
      return ['vent.log.disinfezione']
    case 'vent-circuito':
      return ['vent.log.circuito', CIRCUITI_DEL_REGISTRO.includes(coda) ? (`vent.circuito.${coda}` as TranslationKey) : 'vent.log.ventilatore']
    default:
      // Un'azione nuova che nessuno ha ancora nominato non stampa la sua
      // chiave: dice «Ventilatore» e basta. Una riga generica è meno utile di
      // una precisa, ma è pur sempre italiano.
      return ['vent.log.ventilatore']
  }
}

/** I circuiti che hanno un nome nel registro (§602): uno sconosciuto dice «Ventilatore». */
const CIRCUITI_DEL_REGISTRO = ['hme', 'umidificatore', 'bitubo', 'monotubo']

function etichettaParametro(chiave: string): TranslationKey {
  const def = PARAMETRI[chiave as ChiaveParametro]
  return def ? def.etichetta : 'vent.log.ventilatore'
}
