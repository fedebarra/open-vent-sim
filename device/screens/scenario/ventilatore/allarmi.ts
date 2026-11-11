/**
 * Gli allarmi del ventilatore: quali esistono, quando suonano, chi li zittisce.
 *
 * ## Due minuti, e non i trenta secondi del monitor
 *
 * Sul monitor il silenzio dura mezzo minuto, ed è una scelta scritta: chi preme
 * SILENCE in aula non sta facendo una manovra, sta dicendo una frase, e un
 * silenzio che torna presto è un silenzio che nessuno si dimentica addosso
 * (`monitor/apparecchio.ts`). Qui sono **due minuti**, ed è una scelta
 * altrettanto voluta: i motivi per cui suona un ventilatore si risolvono con le
 * mani dentro il circuito — si aspira, si riconnette, si cambia una modalità —
 * e sono i due minuti che stanno stampati sul tasto delle macchine vere. Un
 * apparecchio che ricomincia a strillare mentre qualcuno ha ancora il tubo in
 * mano insegna a silenziarlo di nuovo, non a risolverlo.
 *
 * ## Quello che non suona
 *
 * Manca «controlla il tubo», che sulla macchina vera c'è: qui non avrebbe da
 * dove suonare, perché i guasti — occlusione, perdite, secrezioni — arrivano
 * col pannello della regia (§A3 del piano). Un allarme che sta nella tabella e
 * non può accendersi è una risposta valida che non dice niente: si aggiunge
 * quando ha una causa, non prima.
 *
 * A macchina in standby, in ventilazione manuale e durante una pausa tenuta gli
 * allarmi **non si valutano**: non c'è niente da sorvegliare, e un allarme che
 * suona perché il volume minuto è zero mentre l'apparecchio è fermo è
 * esattamente il rumore che insegna a non fidarsi degli allarmi.
 *
 * ## Il silenzio si vede
 *
 * Quanti secondi mancano si scrive in cima allo schermo. Un apparecchio che
 * tace deve dire fino a quando, o chi entra in stanza non sa se è una scelta o
 * un guasto — è la stessa regola del monitor, e vale per la stessa ragione.
 */

import type { TranslationKey } from '../../../i18n/it'
import { MAC40 } from '../anestesia/modelli'
import type { ContestoVista, Misure } from './parametri'
import type { StatoVentilatore } from './fisica'

export type ChiaveAllarme =
  | 'pPeak'
  | 'volumeMinute'
  | 'etco2'
  | 'fio2'
  | 'peep'
  | 'measuredFrequency'
  | 'leakPercentage'
  | 'inspiratoryCo2'
  | 'etAgentConcentration'
  | 'flussoErogato'
  | 'acqua'
  | 'apnea'

/** Un limite: due estremi che possono mancare, e un interruttore. */
export interface LimiteAllarme {
  basso: number | null
  alto: number | null
  acceso: boolean
}

export type LimitiAllarme = Record<ChiaveAllarme, LimiteAllarme>

export interface DefinizioneAllarme {
  etichetta: TranslationKey
  unita: TranslationKey
  passo: number
  minimo: number
  massimo: number
  /** Vero se l'allarme ha solo il limite alto: la perdita, la CO₂ inspirata. */
  soloAlto?: boolean
  /** Vero se non ha limiti ma solo un interruttore: «controlla l'acqua». */
  interruttore?: boolean
  visibile: (ctx: ContestoVista) => boolean
  /** Da quale misura si guarda. Manca per gli allarmi a interruttore. */
  misura?: keyof Misure
}

/** Le modalità in cui si aspetta il respiro del paziente: lì l'apnea si sorveglia. */
export const MODALITA_CON_APNEA: readonly string[] = ['PS', 'CPAP', 'PAV']

export const ALLARMI: Record<ChiaveAllarme, DefinizioneAllarme> = {
  pPeak: {
    etichetta: 'vent.alarm.pPeak',
    unita: 'vent.unit.cmH2O',
    passo: 1,
    minimo: 0,
    massimo: 70,
    misura: 'pPeak',
    visibile: (c) => c.ambiente !== 'alto-flusso',
  },
  volumeMinute: {
    etichetta: 'vent.alarm.volumeMinute',
    unita: 'vent.unit.lMinLungo',
    passo: 0.1,
    minimo: 0.1,
    massimo: 30,
    misura: 'volumeMinute',
    visibile: (c) => c.ambiente !== 'alto-flusso',
  },
  etco2: {
    etichetta: 'vent.alarm.etco2',
    unita: 'vent.unit.mmHg',
    passo: 1,
    minimo: 10,
    massimo: 80,
    misura: 'etco2',
    visibile: (c) => c.ambiente === 'anestesia',
  },
  fio2: {
    etichetta: 'vent.alarm.fio2',
    unita: 'vent.unit.percent',
    passo: 1,
    minimo: 18,
    massimo: 100,
    visibile: () => true,
  },
  peep: {
    etichetta: 'vent.alarm.peep',
    unita: 'vent.unit.cmH2O',
    passo: 1,
    minimo: 0,
    massimo: 30,
    visibile: (c) => c.ambiente !== 'alto-flusso',
  },
  measuredFrequency: {
    etichetta: 'vent.alarm.measuredFrequency',
    unita: 'vent.unit.perMin',
    passo: 1,
    minimo: 2,
    massimo: 60,
    misura: 'measuredFrequency',
    visibile: (c) => c.ambiente !== 'alto-flusso',
  },
  leakPercentage: {
    etichetta: 'vent.alarm.leakPercentage',
    unita: 'vent.unit.percent',
    passo: 1,
    minimo: 0,
    massimo: 100,
    soloAlto: true,
    misura: 'leakPercentage',
    visibile: (c) => c.ambiente === 'niv',
  },
  inspiratoryCo2: {
    etichetta: 'vent.alarm.inspiratoryCo2',
    unita: 'vent.unit.mmHg',
    passo: 1,
    minimo: 0,
    massimo: 20,
    soloAlto: true,
    misura: 'inspiratoryCo2',
    visibile: (c) => c.ambiente === 'anestesia',
  },
  etAgentConcentration: {
    etichetta: 'vent.alarm.etAgentConcentration',
    unita: 'vent.unit.percent',
    passo: 0.1,
    minimo: 0,
    massimo: 15,
    misura: 'etAgentConcentration',
    visibile: (c) => c.ambiente === 'anestesia',
  },
  flussoErogato: {
    etichetta: 'vent.alarm.flussoErogato',
    unita: 'vent.unit.lMin',
    passo: 1,
    minimo: 1,
    massimo: 70,
    visibile: (c) => c.ambiente === 'alto-flusso',
  },
  acqua: {
    etichetta: 'vent.alarm.acqua',
    unita: 'vent.unit.none',
    passo: 0,
    minimo: 0,
    massimo: 0,
    interruttore: true,
    // **Ovunque ci sia un umidificatore**, non solo in alto flusso: la camera
    // si svuota anche in terapia intensiva, e un allarme che esiste solo su un
    // apparecchio dei tre è un allarme che non si impara.
    visibile: (c) => c.ambiente !== 'anestesia',
  },
  // ## L'apnea: il tempo senza un atto del paziente
  //
  // Nei modi in cui l'atto lo fa partire il paziente: se lui non tira, la macchina passa alla
  // ventilazione di apnea e **lo dice**. Senza la scritta un paziente passivo in PSV sembrava uno
  // che respira, e molto sovrassistito (867 mL a 12 atti in aula, 9/11). Dalla OVS 3.3 il limite è
  // un **tempo**, in secondi, come sulle macchine vere: un paziente addormentato dalla regia non faceva
  // suonare niente, perché il backup teneva frequenza e volume minuto dentro i limiti (rilievo
  // dell'aula, 10/11). Il conto lo tiene l'istantanea (`attesaRespiro`).
  apnea: {
    etichetta: 'vent.alarm.apnea',
    unita: 'vent.unit.seconds',
    passo: 5,
    minimo: 10,
    massimo: 60,
    soloAlto: true,
    visibile: (c) => MODALITA_CON_APNEA.includes(c.modalita),
  },
}

/** I limiti con cui la macchina si accende: larghi, ma non spenti. */
export const LIMITI_INIZIALI: LimitiAllarme = {
  pPeak: { basso: 10, alto: 40, acceso: true },
  volumeMinute: { basso: 2, alto: 15, acceso: true },
  etco2: { basso: 25, alto: 50, acceso: true },
  fio2: { basso: 21, alto: 99, acceso: true },
  peep: { basso: 0, alto: 20, acceso: true },
  measuredFrequency: { basso: 5, alto: 35, acceso: true },
  leakPercentage: { basso: null, alto: 30, acceso: true },
  inspiratoryCo2: { basso: null, alto: 5, acceso: true },
  etAgentConcentration: { basso: 0.1, alto: 5, acceso: true },
  flussoErogato: { basso: 5, alto: 70, acceso: true },
  acqua: { basso: null, alto: null, acceso: true },
  apnea: { basso: null, alto: 20, acceso: true },
}

/**
 * Il limite alto dell'Et agente con cui la macchina si accende, **per agente**.
 * Il 5% di fabbrica era tarato sul sevoflurano — quasi tre MAC — e sul
 * desflurano è meno di una: un mantenimento normale al 5,5% suonava dal primo
 * secondo. Qui è lo stesso multiplo della MAC per tutti, dentro la scala del
 * limite (15%).
 */
export function etAgenteAltoDiFabbrica(agente: string | undefined): number {
  const alto = LIMITI_INIZIALI.etAgentConcentration.alto ?? 5
  if (agente !== 'desflurano' && agente !== 'isoflurano') return alto
  const scala = ALLARMI.etAgentConcentration.massimo
  return Math.min(scala, Number(((alto * MAC40[agente]) / MAC40.sevoflurano).toFixed(1)))
}

const ALTI_DI_FABBRICA = new Set(
  ['sevoflurano', 'desflurano', 'isoflurano'].map((a) => etAgenteAltoDiFabbrica(a)),
)

/**
 * I limiti con quello dell'Et agente portato sull'agente montato, **se nessuno
 * l'ha toccato**: un limite che vale ancora uno di quelli di fabbrica segue
 * l'agente, uno spostato a mano resta dov'è.
 */
export function conLimiteDellAgente(
  limiti: LimitiAllarme,
  agente: string | undefined,
): LimitiAllarme {
  const attuale = limiti.etAgentConcentration
  if (!attuale || attuale.alto === null || !ALTI_DI_FABBRICA.has(attuale.alto)) return limiti
  const alto = etAgenteAltoDiFabbrica(agente)
  if (alto === attuale.alto) return limiti
  return { ...limiti, etAgentConcentration: { ...attuale, alto } }
}

/** Per quanti secondi il tasto del silenzio tiene zitto l'apparecchio. */
export const SILENZIO_SECONDI = 120

/** Sotto questa percentuale d'acqua l'alto flusso chiede di riempire. */
const ACQUA_BASSA = 10

/** Un allarme che sta suonando adesso. */
export interface AllarmeAttivo {
  chiave: ChiaveAllarme
  /** Da che parte è stato sfondato il limite. Nullo per gli interruttori. */
  verso: 'alto' | 'basso' | null
  valore: number | null
}

/**
 * Quali allarmi stanno suonando, dato quello che l'apparecchio misura.
 *
 * Funzione pura, come il resto: gli stessi numeri danno gli stessi allarmi, e
 * il registro lo scrive chi confronta due chiamate di fila — non questa.
 */
export function valuta(
  stato: StatoVentilatore,
  misure: Misure,
  limiti: LimitiAllarme,
  /** Da quanti secondi il paziente non fa un atto; nullo dove non si sorveglia. */
  apneaSec: number | null = null,
): AllarmeAttivo[] {
  if (!stato.ventilando) return []
  if (stato.manovra) return []
  if (stato.ambiente === 'anestesia' && stato.respiro === 'manuale') return []

  const ctx: ContestoVista = {
    ambiente: stato.ambiente,
    modalita: stato.modalita,
    respiro: stato.respiro,
    impostazioni: stato.impostazioni,
  }
  const attivi: AllarmeAttivo[] = []

  for (const chiave of Object.keys(ALLARMI) as ChiaveAllarme[]) {
    const def = ALLARMI[chiave]
    // Un'istantanea salvata prima che l'allarme esistesse non ha il suo limite: vale quello di fabbrica.
    const limite = limiti[chiave] ?? LIMITI_INIZIALI[chiave]
    if (!limite?.acceso || !def.visibile(ctx)) continue

    if (chiave === 'acqua') {
      const acqua = misure.waterLevelPercent
      if (acqua !== null && acqua < ACQUA_BASSA) attivi.push({ chiave, verso: null, valore: acqua })
      continue
    }
    if (def.interruttore) continue

    if (chiave === 'apnea') {
      if (apneaSec !== null && limite.alto !== null && apneaSec >= limite.alto) {
        attivi.push({ chiave, verso: 'alto', valore: Math.floor(apneaSec) })
      }
      continue
    }

    const valore = valoreDa(chiave, stato, misure)
    if (valore === null) continue

    // In CPAP la pressione di picco bassa non vuol dire niente: la macchina non
    // insuffla, e l'allarme suonerebbe per tutto lo scenario.
    //
    // Et agente basso con il vaporizzatore chiuso, idem: la macchina d'anestesia nasce coi gas
    // chiusi, e il limite basso suonava dall'accensione — anche in familiarizzazione — per un
    // agente che nessuno ha ancora aperto (rilievo dell'aula, 10/11). Suona se l'erogazione è
    // aperta e l'Et non arriva: il vaporizzatore vuoto, quello che va ricordato.
    const saltaBasso =
      (stato.modalita === 'CPAP' && chiave === 'pPeak') ||
      (chiave === 'etAgentConcentration' && !stato.gas?.erogazione)
    if (limite.basso !== null && valore < limite.basso && !saltaBasso) {
      attivi.push({ chiave, verso: 'basso', valore })
      continue
    }
    // Cento per cento di ossigeno è una scelta, non un guasto: durante il
    // flush e in preossigenazione l'allarme alto non serve a nessuno.
    const saltaAlto = chiave === 'fio2' && valore >= 100
    if (limite.alto !== null && valore > limite.alto && !saltaAlto) {
      attivi.push({ chiave, verso: 'alto', valore })
    }
  }

  return attivi
}

/**
 * Da dove si legge il valore di quell'allarme.
 *
 * Tre sorveglia **impostazioni** e non misure — FiO₂, PEEP e il flusso
 * dell'alto flusso — perché su questa macchina sono quello che esce dal
 * miscelatore, e il limite serve a impedire di regolare male, non a scoprire un
 * guasto. Gli altri guardano quello che l'apparecchio misura.
 */
function valoreDa(chiave: ChiaveAllarme, stato: StatoVentilatore, misure: Misure): number | null {
  if (chiave === 'fio2') return stato.impostazioni.fio2
  if (chiave === 'peep') return stato.impostazioni.peep
  if (chiave === 'flussoErogato') return stato.impostazioni.fgf
  const def = ALLARMI[chiave]
  if (!def.misura) return null
  const valore = misure[def.misura]
  return typeof valore === 'number' ? valore : null
}

/**
 * Che cosa è cambiato fra due valutazioni: quello che va nel registro.
 *
 * Un allarme che continua a suonare non produce righe — una riga al minuto per
 * dieci minuti seppellisce il debriefing. Si scrive quando comincia e quando
 * finisce, che è quello che in debriefing si racconta: «da qui a qui il picco
 * era sopra il limite, e nessuno lo ha guardato».
 */
export function cambiamenti(
  prima: AllarmeAttivo[],
  dopo: AllarmeAttivo[],
): { accesi: AllarmeAttivo[]; spenti: AllarmeAttivo[] } {
  const eranoAccesi = new Set(prima.map((a) => a.chiave))
  const sonoAccesi = new Set(dopo.map((a) => a.chiave))
  return {
    accesi: dopo.filter((a) => !eranoAccesi.has(a.chiave)),
    spenti: prima.filter((a) => !sonoAccesi.has(a.chiave)),
  }
}

/** Vero se in questo istante l'apparecchio sta tacendo per scelta di qualcuno. */
export function inSilenzio(silenziatoFinoA: number, adessoSec: number): boolean {
  return adessoSec < silenziatoFinoA
}

/** Quanti secondi mancano alla fine del silenzio: zero se non c'è. */
export function silenzioRimasto(silenziatoFinoA: number, adessoSec: number): number {
  return Math.max(0, Math.ceil(silenziatoFinoA - adessoSec))
}

/**
 * Un limite spostato di un passo, dentro i suoi estremi.
 *
 * I due estremi non si scavalcano, come sul monitor: un limite basso sopra
 * quello alto farebbe suonare l'allarme per qualunque valore, che è il modo più
 * veloce di rendere inutile un apparecchio senza spegnere niente.
 */
export function spostaLimite(
  chiave: ChiaveAllarme,
  limite: LimiteAllarme,
  estremo: 'basso' | 'alto',
  verso: 1 | -1,
): LimiteAllarme {
  const def = ALLARMI[chiave]
  if (def.interruttore || def.passo <= 0) return limite
  const attuale = limite[estremo]
  if (attuale === null) return limite
  const prossimo = Math.min(
    def.massimo,
    Math.max(def.minimo, parseFloat((attuale + verso * def.passo).toFixed(4))),
  )
  const candidato = { ...limite, [estremo]: prossimo }
  if (candidato.basso !== null && candidato.alto !== null && candidato.basso >= candidato.alto) {
    return limite
  }
  return candidato
}
