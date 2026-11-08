/**
 * Che cosa si regola su un ventilatore, che cosa si legge, e quando si vede.
 *
 * ## Le due colonne che l'originale teneva in un sacco solo
 *
 * Il simulatore da cui viene questo motore aveva un unico oggetto —
 * `AllParameters` — con dentro il volume corrente che si imposta e la pressione
 * di picco che si misura, mescolati. Funziona finché lo scrive e lo legge la
 * stessa schermata; qui no, perché **l'istantanea la produce solo la regia**
 * (§118) e i due gruppi viaggiano in modo diverso: le impostazioni sono una
 * decisione di qualcuno e si mandano, le misure sono una conseguenza e si
 * ricalcolano. Un campo che sta in mezzo finisce per essere riscritto da tutti
 * e due i lati, e vince l'ultimo che parla.
 *
 * Quindi: `Impostazioni` è quello che una mano gira, `Misure` è quello che
 * l'apparecchio scrive. La tabella `PARAMETRI` descrive tutti e due — etichetta,
 * unità, estremi, passo — perché a schermo sono tessere uguali, e chi guarda
 * distingue le une dalle altre dal fatto che le prime si toccano.
 *
 * ## `null` e non «--»
 *
 * L'originale metteva la stringa `'--'` dentro campi numerici per dire «questo
 * adesso non si misura» (la pressione di plateau senza pausa inspiratoria, i
 * ml/kg senza un peso). Una stringa in un campo di numeri passa tutti i
 * controlli e si rompe alla prima somma. Qui quel valore è `null`, e chi disegna
 * decide come si scrive: la trattina è una scelta di rendering, non un dato.
 *
 * ## I nomi delle chiavi restano quelli della sorgente
 *
 * `pPeak`, `flowCycleOffPercent`, `psLevel`: sono abbreviazioni cliniche, le
 * stesse che stanno stampate sulle macchine vere, e tradurle avrebbe reso
 * impossibile rileggere questo file accanto alla sorgente. Il resto —
 * funzioni, tipi, campi nostri — è in italiano come nel resto della casa.
 *
 * La sorgente non è più nel repository: `open-vent-sim-main/` è uscita a
 * integrazione finita (§331) e sta in `~/Developer/open-vent-sim-main`. I nomi
 * restano quelli perché sono quelli delle macchine, non perché una cartella
 * qui accanto li usava.
 */

import type { TranslationKey } from '../../../i18n/it'

/**
 * I quattro ambienti, che non sono quattro temi grafici.
 *
 * Cambiano quali parametri esistono, quali modalità si possono scegliere e che
 * cosa la macchina misura: in anestesia c'è un circuito chiuso con i gas e la
 * calce, in alto flusso non c'è nemmeno una PEEP da impostare. Lo scenario lo
 * **propone**, la regia lo decide — come per il monitor (HANDOVER §150).
 */
export type Ambiente = 'anestesia' | 'invasiva' | 'niv' | 'alto-flusso'

/** Le modalità di ventilazione. `AF` è l'alto flusso, che modalità non è. */
// OVS 3.1: PRVC — pressure-regulated volume control (a PC breath whose pressure adapts to reach the set volume).
export type Modalita = 'VC' | 'PC' | 'PRVC' | 'PS' | 'SIMV' | 'CPAP' | 'AF'

/**
 * Meccanica o manuale — cioè: chi spinge l'aria dentro.
 *
 * Vale solo in anestesia, dove il selettore sul respiratore è un oggetto vero e
 * l'induzione si fa a pallone. In terapia intensiva la domanda non esiste.
 */
export type Respiro = 'meccanica' | 'manuale'

/** L'interfaccia dell'alto flusso: cambia le portate e le temperature ammesse. */
export type InterfacciaAltoFlusso = 'adulto' | 'pediatrica' | 'junior'

/** Lo stato della disinfezione dell'apparecchio ad alto flusso. */
export type Disinfezione = 'pulito' | 'sporco' | 'non-sicuro'

/**
 * Quali modalità offre ogni ambiente.
 *
 * L'ordine è quello del selettore, e comincia dalla modalità con cui si parte
 * più spesso in quell'ambiente — non alfabetico e non «la più semplice».
 */
export const MODALITA_PER_AMBIENTE: Record<Ambiente, Modalita[]> = {
  anestesia: ['VC', 'PC', 'PS'],
  invasiva: ['VC', 'PC', 'PRVC', 'PS', 'SIMV', 'CPAP'],
  niv: ['PS', 'CPAP'],
  'alto-flusso': ['AF'],
}

/** Quello che una mano gira. */
export interface Impostazioni {
  /** Volume corrente in VC, ml. */
  volume: number
  /** Pressione sopra PEEP in PC, cmH₂O. */
  pressureTarget: number
  /** Frequenza impostata, atti/min. */
  frequency: number
  /** PEEP, cmH₂O. In manuale non si usa: c'è l'APL. */
  peep: number
  fio2: number
  /** Rapporto inspirazione/espirazione, scritto «1:2». */
  ratio: string
  /** Pressione di supporto sopra PEEP, cmH₂O. */
  psLevel: number
  /** Soglia del trigger a flusso, l/min. */
  triggerFlow: number
  /** Pausa inspiratoria come percentuale del tempo inspiratorio. */
  inspiratoryPausePercent: number
  /**
   * Il **sigh**: quanti atti al minuto, 0 se spento.
   *
   * Un singolo atto controllato portato a una pressione alta, una o due volte
   * al minuto, per riaprire quello che si è chiuso fra un atto e l'altro.
   * *(PROTECTION Trial, AJRCCM 2021.)* È una cosa diversa dal reclutamento
   * sostenuto, che è una manovra e si tiene premuta.
   */
  sighRate: number
  /** La pressione a cui il sigh porta le vie aeree, cmH₂O: 35-40. */
  sighPressure: number
  /** Tempo di salita, secondi. */
  inspiratoryRiseTimeSeconds: number
  /** Soglia di ciclaggio a flusso, percentuale del picco. */
  flowCycleOffPercent: number
  backupPressure: number
  backupFrequency: number
  backupIERatio: string
  /** Flusso di gas fresco, l/min. In alto flusso è **il** parametro. */
  fgf: number
  /**
   * La valvola APL, cmH₂O — solo in ventilazione manuale.
   *
   * Nell'originale stava fra le impostazioni del simulatore e non era un
   * parametro: la Paw manuale usava la PEEP al posto suo. Qui è un parametro
   * suo, perché in manuale è l'unica cosa che si regola davvero, ed è il tetto
   * su cui si appoggia l'onda quando il paziente smette di respirare.
   */
  apl: number
  /** MAC bersaglio, in multipli della MAC dell'agente. */
  targetMac: number
  targetEtPrimaryAgent: number
  targetEtSecondaryAgent: number
  /** Temperatura dell'umidificatore in terapia intensiva, °C. */
  humidifierTemperature: number
  /** Temperatura bersaglio in alto flusso, °C. */
  temperature: number
}

/** Quello che l'apparecchio scrive. `null` vuol dire «adesso non si misura». */
export interface Misure {
  pPeak: number | null
  pPlateau: number | null
  pMean: number | null
  /** Frequenza misurata: quella impostata più gli atti del paziente. */
  measuredFrequency: number | null
  /** Frequenza spontanea del paziente: il numero che tradisce l'asincronia. */
  spontaneousRate: number | null
  compliance: number | null
  resistance: number | null
  volumeMinute: number | null
  volumeInspired: number | null
  volumeExpired: number | null
  mlPerKg: number | null
  tiTtot: number | null
  leakPercentage: number | null
  etco2: number | null
  spo2: number | null
  /** CO₂ inspirata: sale quando la calce sodata è finita. */
  inspiratoryCo2: number | null
  etAgentConcentration: number | null
  etSecondaryAgentConcentration: number | null
  fiAgentConcentration: number | null
  fiSecondaryAgentConcentration: number | null
  /** MAC raggiunta, sommando gli agenti in circolo. */
  mac: number | null
  deliveredTemperature: number | null
  waterLevelPercent: number | null
}

export type ChiaveImpostazione = keyof Impostazioni
export type ChiaveMisura = keyof Misure
export type ChiaveParametro = ChiaveImpostazione | ChiaveMisura

/** Dove si guarda per sapere se un parametro si vede adesso. */
export interface ContestoVista {
  ambiente: Ambiente
  modalita: Modalita
  respiro: Respiro
  /**
   * Le impostazioni di adesso: servono ai parametri che compaiono **solo se
   * un altro parametro è acceso** — la pressione del sigh quando il sigh c'è.
   * Una manopola che regola una cosa spenta è un comando di troppo.
   */
  impostazioni: Impostazioni
}

export interface DefinizioneParametro {
  etichetta: TranslationKey
  unita: TranslationKey
  /** Vero se si regola: le impostazioni sì, le misure no. */
  regolabile: boolean
  /** Le tessere grandi della barra: volume, pressione, frequenza. */
  grande?: boolean
  min?: number
  max?: number
  passo?: number
  /**
   * Quante cifre dopo la virgola si scrivono. Zero se manca.
   *
   * Sta qui e non in chi disegna perché è una proprietà della grandezza, non
   * della schermata: una PEEP con un decimale è una PEEP scritta male su
   * qualunque schermo, e due schermate che scelgono da sole finirebbero per
   * scriverla in due modi.
   */
  decimali?: number
  /** In alto flusso il passo del FGF cambia sopra i 25 l/min. */
  passoVariabile?: (valore: number, interfaccia: InterfacciaAltoFlusso | null) => number
  /** Quando questo parametro esiste su questo apparecchio. */
  visibile: (ctx: ContestoVista) => boolean
}

const inIcu = (a: Ambiente) => a === 'invasiva' || a === 'niv'
const mecc = (ctx: ContestoVista) => ctx.ambiente !== 'anestesia' || ctx.respiro === 'meccanica'

/** Portate e temperature dell'alto flusso, che dipendono dall'interfaccia. */
export const ALTO_FLUSSO = {
  fgfMinAdulto: 10,
  fgfMaxAdulto: 60,
  fgfMinJunior: 2,
  fgfMaxJunior: 25,
  /** Sopra questa portata la manopola gira a cinque per volta, non a uno. */
  soglia: 25,
  passoBasso: 1,
  passoAlto: 5,
  temperatureAdulto: [31, 34, 37],
  temperatureJunior: [31, 34],
  /** Sotto questa percentuale d'acqua l'apparecchio chiede di riempire. */
  acquaBassa: 10,
  /** Quanta acqua se ne va per ogni litro di flusso, ogni secondo. */
  consumoAcquaPerLitro: 0.0022 / 30 / 2,
} as const

/** La temperatura dell'aria in stanza: da lì parte il riscaldatore. */
export const TEMPERATURA_AMBIENTE = 22

export const PARAMETRI: Record<ChiaveParametro, DefinizioneParametro> = {
  // ## Impostazioni
  volume: {
    etichetta: 'vent.param.volume',
    unita: 'vent.unit.ml',
    regolabile: true,
    grande: true,
    min: 50,
    max: 1500,
    passo: 10,
    visibile: (c) =>
      (c.ambiente === 'anestesia' && c.modalita === 'VC' && c.respiro === 'meccanica') ||
      (c.ambiente === 'invasiva' && (c.modalita === 'VC' || c.modalita === 'SIMV' || c.modalita === 'PRVC')),
  },
  pressureTarget: {
    etichetta: 'vent.param.pressureTarget',
    unita: 'vent.unit.cmH2O',
    regolabile: true,
    grande: true,
    min: 5,
    max: 40,
    passo: 1,
    visibile: (c) =>
      (c.ambiente === 'anestesia' && c.modalita === 'PC' && c.respiro === 'meccanica') ||
      (c.ambiente === 'invasiva' && (c.modalita === 'PC' || c.modalita === 'SIMV')),
  },
  frequency: {
    etichetta: 'vent.param.frequency',
    unita: 'vent.unit.perMin',
    regolabile: true,
    grande: true,
    min: 4,
    max: 60,
    passo: 1,
    visibile: (c) =>
      (c.ambiente === 'anestesia' && c.respiro === 'meccanica') ||
      (inIcu(c.ambiente) && c.modalita !== 'CPAP'),
  },
  peep: {
    etichetta: 'vent.param.peep',
    unita: 'vent.unit.cmH2O',
    regolabile: true,
    min: 0,
    max: 30,
    passo: 1,
    visibile: (c) => (c.ambiente === 'anestesia' && c.respiro === 'meccanica') || inIcu(c.ambiente),
  },
  fio2: {
    etichetta: 'vent.param.fio2',
    unita: 'vent.unit.percent',
    regolabile: true,
    min: 21,
    max: 100,
    passo: 5,
    visibile: () => true,
  },
  ratio: {
    etichetta: 'vent.param.ratio',
    unita: 'vent.unit.none',
    regolabile: true,
    visibile: (c) =>
      (c.ambiente === 'anestesia' &&
        (c.modalita === 'VC' || c.modalita === 'PC') &&
        c.respiro === 'meccanica') ||
      (c.ambiente === 'invasiva' &&
        (c.modalita === 'VC' || c.modalita === 'PC' || c.modalita === 'PRVC' || c.modalita === 'SIMV')),
  },
  psLevel: {
    etichetta: 'vent.param.psLevel',
    unita: 'vent.unit.cmH2O',
    regolabile: true,
    min: 0,
    max: 40,
    passo: 1,
    visibile: (c) =>
      (c.ambiente === 'anestesia' && c.modalita === 'PS' && c.respiro === 'meccanica') ||
      (inIcu(c.ambiente) && (c.modalita === 'PS' || c.modalita === 'SIMV')),
  },
  triggerFlow: {
    etichetta: 'vent.param.triggerFlow',
    decimali: 1,
    unita: 'vent.unit.lMin',
    regolabile: true,
    min: 0.5,
    max: 10,
    passo: 0.1,
    visibile: (c) =>
      (c.ambiente === 'anestesia' && c.modalita === 'PS' && c.respiro === 'meccanica') ||
      (c.ambiente === 'invasiva' && c.modalita !== 'CPAP') ||
      (c.ambiente === 'niv' && c.modalita === 'PS'),
  },
  inspiratoryPausePercent: {
    etichetta: 'vent.param.inspiratoryPausePercent',
    unita: 'vent.unit.percent',
    regolabile: true,
    min: 0,
    max: 30,
    passo: 1,
    visibile: (c) =>
      (c.modalita === 'VC' || c.modalita === 'SIMV') &&
      (c.ambiente === 'invasiva' || (c.ambiente === 'anestesia' && c.respiro === 'meccanica')),
  },
  sighRate: {
    etichetta: 'vent.param.sighRate',
    unita: 'vent.unit.perMin',
    regolabile: true,
    min: 0,
    max: 2,
    passo: 1,
    // Solo dove c'è un atto controllato su cui appoggiarlo: in pressione di
    // supporto e in CPAP il sigh non esiste, perché non c'è una macchina che
    // decide quando insufflare.
    visibile: (c) =>
      (c.modalita === 'VC' || c.modalita === 'PC' || c.modalita === 'PRVC' || c.modalita === 'SIMV') &&
      (c.ambiente === 'invasiva' || c.ambiente === 'niv'),
  },
  sighPressure: {
    etichetta: 'vent.param.sighPressure',
    unita: 'vent.unit.cmH2O',
    regolabile: true,
    min: 25,
    max: 45,
    passo: 1,
    // Si mostra solo quando il sigh è acceso: una pressione per una cosa
    // spenta è una manopola che non fa niente.
    visibile: (c) =>
      c.impostazioni.sighRate > 0 &&
      (c.modalita === 'VC' || c.modalita === 'PC' || c.modalita === 'PRVC' || c.modalita === 'SIMV') &&
      (c.ambiente === 'invasiva' || c.ambiente === 'niv'),
  },
  inspiratoryRiseTimeSeconds: {
    etichetta: 'vent.param.inspiratoryRiseTimeSeconds',
    decimali: 2,
    unita: 'vent.unit.seconds',
    regolabile: true,
    min: 0,
    max: 0.4,
    passo: 0.05,
    // **Anche in anestesia, quando si sta in pressione di supporto.** La
    // sorgente non la mostrava là, e noi l'abbiamo copiata: ma una macchina
    // d'anestesia che fa PSV ha la rampa come tutte le altre, e il trigger
    // accanto lo mostravamo già. A zero la pressione sale di colpo, ed è una
    // regolazione vera: serve a chi ha fame d'aria.
    visibile: (c) =>
      (c.ambiente === 'anestesia' && c.modalita === 'PS' && c.respiro === 'meccanica') ||
      (c.ambiente === 'invasiva' &&
        (c.modalita === 'PC' || c.modalita === 'PRVC' || c.modalita === 'PS' || c.modalita === 'SIMV')) ||
      (c.ambiente === 'niv' && c.modalita === 'PS'),
  },
  flowCycleOffPercent: {
    etichetta: 'vent.param.flowCycleOffPercent',
    unita: 'vent.unit.percent',
    regolabile: true,
    min: 5,
    max: 70,
    passo: 5,
    visibile: (c) =>
      (c.ambiente === 'invasiva' && (c.modalita === 'PS' || c.modalita === 'SIMV')) ||
      (c.ambiente === 'niv' && c.modalita === 'PS'),
  },
  backupPressure: {
    etichetta: 'vent.param.backupPressure',
    unita: 'vent.unit.cmH2O',
    regolabile: true,
    min: 5,
    max: 40,
    passo: 1,
    visibile: (c) => inIcu(c.ambiente) && (c.modalita === 'PS' || c.modalita === 'CPAP'),
  },
  backupFrequency: {
    etichetta: 'vent.param.backupFrequency',
    unita: 'vent.unit.perMin',
    regolabile: true,
    min: 5,
    max: 30,
    passo: 1,
    visibile: (c) => inIcu(c.ambiente) && (c.modalita === 'PS' || c.modalita === 'CPAP'),
  },
  backupIERatio: {
    etichetta: 'vent.param.backupIERatio',
    unita: 'vent.unit.none',
    regolabile: true,
    visibile: (c) => inIcu(c.ambiente) && (c.modalita === 'PS' || c.modalita === 'CPAP'),
  },
  fgf: {
    etichetta: 'vent.param.fgf',
    decimali: 1,
    unita: 'vent.unit.lMin',
    regolabile: true,
    min: 0,
    max: ALTO_FLUSSO.fgfMaxAdulto,
    passo: 0.5,
    passoVariabile: (valore, interfaccia) => {
      if (interfaccia === null) return 0.5 // anestesia: mezzo litro per volta
      if (interfaccia === 'adulto')
        return valore >= ALTO_FLUSSO.soglia ? ALTO_FLUSSO.passoAlto : ALTO_FLUSSO.passoBasso
      return ALTO_FLUSSO.passoBasso
    },
    visibile: (c) => c.ambiente === 'anestesia' || c.ambiente === 'alto-flusso',
  },
  apl: {
    etichetta: 'vent.param.apl',
    unita: 'vent.unit.cmH2O',
    regolabile: true,
    min: 0,
    max: 70,
    passo: 5,
    visibile: (c) => c.ambiente === 'anestesia' && c.respiro === 'manuale',
  },
  targetMac: {
    etichetta: 'vent.param.targetMac',
    decimali: 1,
    unita: 'vent.unit.mac',
    regolabile: true,
    min: 0.1,
    max: 3,
    passo: 0.1,
    visibile: (c) => c.ambiente === 'anestesia',
  },
  targetEtPrimaryAgent: {
    etichetta: 'vent.param.targetEtAgent',
    decimali: 1,
    unita: 'vent.unit.percent',
    regolabile: true,
    min: 0,
    max: 20,
    passo: 0.1,
    visibile: (c) => c.ambiente === 'anestesia',
  },
  targetEtSecondaryAgent: {
    etichetta: 'vent.param.targetEtSecondaryAgent',
    decimali: 1,
    unita: 'vent.unit.percent',
    regolabile: true,
    min: 0,
    max: 20,
    passo: 0.1,
    visibile: (c) => c.ambiente === 'anestesia',
  },
  humidifierTemperature: {
    etichetta: 'vent.param.humidifierTemperature',
    unita: 'vent.unit.celsius',
    regolabile: true,
    min: 31,
    max: 39,
    passo: 1,
    visibile: (c) => inIcu(c.ambiente),
  },
  temperature: {
    etichetta: 'vent.param.temperature',
    unita: 'vent.unit.celsius',
    regolabile: true,
    min: 31,
    max: 37,
    passo: 3,
    visibile: (c) => c.ambiente === 'alto-flusso',
  },

  // ## Misure
  pPeak: {
    etichetta: 'vent.param.pPeak',
    decimali: 1,
    unita: 'vent.unit.cmH2O',
    regolabile: false,
    grande: true,
    visibile: (c) => mecc(c) && c.ambiente !== 'alto-flusso' && c.modalita !== 'CPAP',
  },
  pPlateau: {
    etichetta: 'vent.param.pPlateau',
    decimali: 1,
    unita: 'vent.unit.cmH2O',
    regolabile: false,
    visibile: (c) =>
      mecc(c) &&
      (c.ambiente === 'anestesia' || c.ambiente === 'invasiva') &&
      (c.modalita === 'VC' || c.modalita === 'PC' || c.modalita === 'PRVC' || c.modalita === 'SIMV'),
  },
  pMean: {
    etichetta: 'vent.param.pMean',
    decimali: 1,
    unita: 'vent.unit.cmH2O',
    regolabile: false,
    visibile: (c) => mecc(c) && c.ambiente !== 'alto-flusso',
  },
  measuredFrequency: {
    etichetta: 'vent.param.measuredFrequency',
    unita: 'vent.unit.perMin',
    regolabile: false,
    visibile: (c) =>
      (c.ambiente === 'anestesia' && c.respiro === 'meccanica') ||
      c.ambiente === 'invasiva' ||
      (c.ambiente === 'niv' && c.modalita === 'PS'),
  },
  spontaneousRate: {
    etichetta: 'vent.param.spontaneousRate',
    unita: 'vent.unit.perMin',
    regolabile: false,
    visibile: (c) => c.ambiente !== 'alto-flusso',
  },
  compliance: {
    etichetta: 'vent.param.compliance',
    unita: 'vent.unit.mlCmH2O',
    regolabile: false,
    visibile: (c) => (c.ambiente === 'anestesia' && c.respiro === 'meccanica') || c.ambiente === 'invasiva',
  },
  resistance: {
    etichetta: 'vent.param.resistance',
    unita: 'vent.unit.cmH2OLs',
    regolabile: false,
    visibile: (c) => (c.ambiente === 'anestesia' && c.respiro === 'meccanica') || c.ambiente === 'invasiva',
  },
  volumeMinute: {
    etichetta: 'vent.param.volumeMinute',
    decimali: 1,
    unita: 'vent.unit.lMinLungo',
    regolabile: false,
    visibile: (c) => mecc(c) && c.ambiente !== 'alto-flusso' && c.modalita !== 'CPAP',
  },
  volumeInspired: {
    etichetta: 'vent.param.volumeInspired',
    unita: 'vent.unit.ml',
    regolabile: false,
    visibile: (c) => mecc(c) && c.ambiente !== 'alto-flusso' && c.modalita !== 'CPAP',
  },
  volumeExpired: {
    etichetta: 'vent.param.volumeExpired',
    unita: 'vent.unit.ml',
    regolabile: false,
    grande: true,
    visibile: (c) => mecc(c) && c.ambiente !== 'alto-flusso' && c.modalita !== 'CPAP',
  },
  mlPerKg: {
    etichetta: 'vent.param.mlPerKg',
    decimali: 1,
    unita: 'vent.unit.mlKg',
    regolabile: false,
    visibile: (c) => mecc(c) && c.ambiente !== 'alto-flusso' && c.modalita !== 'CPAP',
  },
  tiTtot: {
    etichetta: 'vent.param.tiTtot',
    decimali: 2,
    unita: 'vent.unit.none',
    regolabile: false,
    visibile: (c) => mecc(c) && c.ambiente !== 'alto-flusso' && c.modalita !== 'CPAP',
  },
  leakPercentage: {
    etichetta: 'vent.param.leakPercentage',
    decimali: 1,
    unita: 'vent.unit.percent',
    regolabile: false,
    visibile: (c) => c.ambiente === 'niv',
  },
  etco2: {
    etichetta: 'vent.param.etco2',
    unita: 'vent.unit.mmHg',
    regolabile: false,
    visibile: (c) => c.ambiente === 'anestesia',
  },
  spo2: {
    etichetta: 'vent.param.spo2',
    unita: 'vent.unit.percent',
    regolabile: false,
    visibile: (c) => c.ambiente === 'anestesia',
  },
  inspiratoryCo2: {
    etichetta: 'vent.param.inspiratoryCo2',
    unita: 'vent.unit.mmHg',
    regolabile: false,
    visibile: (c) => c.ambiente === 'anestesia' && c.respiro === 'meccanica',
  },
  etAgentConcentration: {
    etichetta: 'vent.param.etAgentConcentration',
    decimali: 1,
    unita: 'vent.unit.percent',
    regolabile: false,
    visibile: (c) => c.ambiente === 'anestesia',
  },
  etSecondaryAgentConcentration: {
    etichetta: 'vent.param.etSecondaryAgentConcentration',
    decimali: 1,
    unita: 'vent.unit.percent',
    regolabile: false,
    visibile: (c) => c.ambiente === 'anestesia',
  },
  fiAgentConcentration: {
    etichetta: 'vent.param.fiAgentConcentration',
    decimali: 1,
    unita: 'vent.unit.percent',
    regolabile: false,
    visibile: (c) => c.ambiente === 'anestesia',
  },
  fiSecondaryAgentConcentration: {
    etichetta: 'vent.param.fiSecondaryAgentConcentration',
    decimali: 1,
    unita: 'vent.unit.percent',
    regolabile: false,
    visibile: (c) => c.ambiente === 'anestesia',
  },
  mac: {
    etichetta: 'vent.param.mac',
    decimali: 1,
    unita: 'vent.unit.mac',
    regolabile: false,
    visibile: (c) => c.ambiente === 'anestesia',
  },
  deliveredTemperature: {
    etichetta: 'vent.param.deliveredTemperature',
    decimali: 1,
    unita: 'vent.unit.celsius',
    regolabile: false,
    visibile: (c) => c.ambiente === 'alto-flusso',
  },
  waterLevelPercent: {
    etichetta: 'vent.param.waterLevel',
    unita: 'vent.unit.percent',
    regolabile: false,
    visibile: (c) => c.ambiente === 'alto-flusso',
  },
}

/** Le impostazioni con cui si accende un ventilatore che nessuno ha ancora toccato. */
export const IMPOSTAZIONI_INIZIALI: Impostazioni = {
  volume: 500,
  pressureTarget: 18,
  frequency: 12,
  peep: 5,
  fio2: 40,
  ratio: '1:2',
  psLevel: 10,
  triggerFlow: 2,
  inspiratoryPausePercent: 10,
  // Spento: il sigh è una cosa che si accende, e la sceneggiatura parte da un
  // paziente ventilato in modo ordinario.
  sighRate: 0,
  sighPressure: 35,
  inspiratoryRiseTimeSeconds: 0.15,
  flowCycleOffPercent: 25,
  backupPressure: 15,
  backupFrequency: 12,
  backupIERatio: '1:2',
  fgf: 2,
  apl: 10,
  targetMac: 1,
  targetEtPrimaryAgent: 2,
  targetEtSecondaryAgent: 0,
  humidifierTemperature: 37,
  temperature: 37,
}

/** Le misure a macchina ferma: tutte assenti, nessuna a zero. */
export const MISURE_VUOTE: Misure = {
  pPeak: null,
  pPlateau: null,
  pMean: null,
  measuredFrequency: null,
  spontaneousRate: null,
  compliance: null,
  resistance: null,
  volumeMinute: null,
  volumeInspired: null,
  volumeExpired: null,
  mlPerKg: null,
  tiTtot: null,
  leakPercentage: null,
  etco2: null,
  spo2: null,
  inspiratoryCo2: null,
  etAgentConcentration: null,
  etSecondaryAgentConcentration: null,
  fiAgentConcentration: null,
  fiSecondaryAgentConcentration: null,
  mac: null,
  deliveredTemperature: null,
  waterLevelPercent: null,
}

/**
 * Le impostazioni che si vedono adesso, nell'ordine della tabella.
 *
 * L'ordine è quello in cui compaiono sulla barra, ed è quello in cui sono
 * scritte qui sopra: le tessere grandi prima, poi le regolazioni fini. Chi
 * cerca la FiO₂ la cerca **dove stava l'ultima volta**, non in una griglia
 * riordinata perché è cambiata la modalità.
 */
export function impostazioniVisibili(ctx: ContestoVista): ChiaveImpostazione[] {
  return (Object.keys(IMPOSTAZIONI_INIZIALI) as ChiaveImpostazione[]).filter((k) =>
    PARAMETRI[k].visibile(ctx),
  )
}

/** Le misure che si vedono adesso, nell'ordine della colonna di monitoraggio. */
export function misureVisibili(ctx: ContestoVista): ChiaveMisura[] {
  return (Object.keys(MISURE_VUOTE) as ChiaveMisura[]).filter((k) => PARAMETRI[k].visibile(ctx))
}

/**
 * Un'impostazione spostata di un passo, dentro i suoi estremi.
 *
 * Vale la stessa regola di `spostaLimite` sul monitor: il valore resta dentro
 * gli estremi e non si esce con l'arrotondamento. Il passo lo decide la
 * definizione, e in alto flusso dipende da dove sta già la manopola — sotto i
 * venticinque litri si gira a uno, sopra a cinque, come sull'apparecchio vero.
 */
export function sposta(
  chiave: ChiaveImpostazione,
  valore: number,
  verso: 1 | -1,
  interfaccia: InterfacciaAltoFlusso | null = null,
): number {
  const def = PARAMETRI[chiave]
  const passo = def.passoVariabile ? def.passoVariabile(valore, interfaccia) : (def.passo ?? 1)
  const min = def.min ?? 0
  const max = def.max ?? Number.POSITIVE_INFINITY
  const prossimo = valore + verso * passo
  // Si arrotonda al passo per non trascinare code binarie: 0.1 + 0.2 non deve
  // diventare un trigger a 0.30000000000000004 sul display.
  const arrotondato = Math.round(prossimo / passo) * passo
  return Math.min(max, Math.max(min, parseFloat(arrotondato.toFixed(4))))
}

/**
 * Gli estremi del FGF e le temperature ammesse, per interfaccia.
 *
 * Un apparecchio junior che offrisse sessanta litri al minuto o trentasette
 * gradi non è un'imprecisione grafica: sono impostazioni che sul paziente vero
 * non esistono, e vederle in aula insegna una macchina che non c'è.
 */
export function limitiAltoFlusso(interfaccia: InterfacciaAltoFlusso): {
  fgfMin: number
  fgfMax: number
  temperature: number[]
} {
  if (interfaccia === 'adulto') {
    return {
      fgfMin: ALTO_FLUSSO.fgfMinAdulto,
      fgfMax: ALTO_FLUSSO.fgfMaxAdulto,
      temperature: [...ALTO_FLUSSO.temperatureAdulto],
    }
  }
  return {
    fgfMin: ALTO_FLUSSO.fgfMinJunior,
    fgfMax: ALTO_FLUSSO.fgfMaxJunior,
    temperature: [...ALTO_FLUSSO.temperatureJunior],
  }
}

/**
 * La frazione inspiratoria del ciclo, da cui discendono Ti e Te.
 *
 * In VC e PC la dice il rapporto I:E impostato. In PS e CPAP il rapporto non
 * c'è — il paziente cicla da solo — e si usa il terzo del ciclo, che è quanto
 * dura l'inspirazione di chi respira tranquillo.
 */
/**
 * Se in questa modalità l'atto lo **cicla il paziente**, non l'orologio.
 *
 * Sono i tre casi in cui il rapporto I:E non ha senso e comanda la soglia di
 * ciclaggio a flusso: pressione di supporto, CPAP, e la SIMV quando il
 * supporto è acceso. La regola stava già scritta dentro
 * `frazioneInspiratoria`, in una condizione lunga; qui ha un nome perché
 * adesso la legge anche `tempiRespiro`, e due copie della stessa condizione
 * divergono al primo modo che si aggiunge.
 */
export function assistito(modalita: Modalita, psLevel: number): boolean {
  return modalita === 'PS' || modalita === 'CPAP' || (modalita === 'SIMV' && psLevel > 0)
}

export function frazioneInspiratoria(modalita: Modalita, ratio: string, psLevel: number): number {
  if (assistito(modalita, psLevel)) return 0.33
  const parti = String(ratio).split(':').map(Number)
  const i = parti[0] || 1
  const e = parti[1] || 2
  if (!isFinite(i) || !isFinite(e) || i + e <= 0) return 0.33
  return i / (i + e)
}

/**
 * Il valore come si scrive sulla tessera.
 *
 * `null` è **«––»** e non «0»: la differenza fra «non si misura» e «vale zero»
 * è tutta la differenza fra un plateau che non c'è perché manca la pausa
 * inspiratoria e un plateau caduto a zero, che sarebbe un tubo staccato.
 * L'originale ci scriveva la stringa `'--'` dentro il campo numerico, cioè
 * decideva qui una cosa che riguarda chi disegna.
 */
export function scriviValore(chiave: ChiaveParametro, valore: number | string | null): string {
  if (valore === null || valore === undefined) return '\u2013\u2013'
  if (typeof valore === 'string') return valore
  if (!isFinite(valore)) return '\u2013\u2013'
  return valore.toFixed(PARAMETRI[chiave].decimali ?? 0)
}
