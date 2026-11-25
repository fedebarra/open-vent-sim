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
  | 'perditaEccessiva'
  | 'ostruzioneAF'
  | 'segnaleEAdi'
  | 'perditaAF'
  | 'inspiratoryCo2'
  | 'etAgentConcentration'
  | 'flussoErogato'
  | 'acqua'
  | 'apnea'

/**
 * Un limite: due estremi che possono mancare, e un interruttore.
 *
 * `basso` e `alto` sono le soglie **rosse** (`pPeak.alto` è anche il tetto di
 * pressione del motore). `preBasso` e `preAlto` sono le **gialle**, sempre dentro
 * le rosse; uguali alla rossa vuol dire nessuna fascia gialla da quel lato.
 * Mancano nelle istantanee salvate prima: vedi `completo()`.
 */
export interface LimiteAllarme {
  basso: number | null
  alto: number | null
  preBasso?: number | null
  preAlto?: number | null
  acceso: boolean
}

export type EstremoLimite = 'basso' | 'preBasso' | 'preAlto' | 'alto'

export type GravitaAllarme = 'giallo' | 'rosso'

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
  /** La gravità di un allarme a interruttore, che fasce non ne ha. Di serie rosso. */
  gravita?: GravitaAllarme
  /** Vero se la fascia gialla non esiste: l'apnea è rossa e basta. */
  soloRosso?: boolean
  visibile: (ctx: ContestoVista) => boolean
  /** Da quale misura si guarda. Manca per gli allarmi a interruttore. */
  misura?: keyof Misure
}

/** Le modalità in cui si aspetta il respiro del paziente: lì l'apnea si sorveglia. */
export const MODALITA_CON_APNEA: readonly string[] = ['PS', 'CPAP', 'PAV', 'NEURO']

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
  // ## La maschera staccata
  //
  // Oltre il 95% di perdita non c'è un limite da spostare: è la maschera che
  // non sta sul viso. Un interruttore, come l'acqua; in pausa è l'unico che
  // suona, perché volume, frequenza e apnea dicono la stessa cosa peggio.
  perditaEccessiva: {
    etichetta: 'vent.alarm.perditaEccessiva',
    unita: 'vent.unit.none',
    passo: 0,
    minimo: 0,
    massimo: 0,
    interruttore: true,
    visibile: (c) => c.ambiente === 'niv',
  },
  // ## L'alto flusso: i due guasti che l'apparecchio vede
  //
  // La cannula ostruita (non riesce a spingere il flusso) e il tubo staccato
  // (il gas esce senza resistenza). La cannula fuori dal naso non suona: per
  // l'apparecchio è tutto in ordine, ed è proprio quello che va insegnato.
  // ## NEURO: il segnale del diaframma non è credibile da 80 secondi
  segnaleEAdi: {
    etichetta: 'vent.alarm.segnaleEAdi',
    unita: 'vent.unit.none',
    passo: 0,
    minimo: 0,
    massimo: 0,
    interruttore: true,
    gravita: 'giallo',
    visibile: (c) => c.modalita === 'NEURO',
  },
  ostruzioneAF: {
    etichetta: 'vent.alarm.ostruzioneAF',
    unita: 'vent.unit.none',
    passo: 0,
    minimo: 0,
    massimo: 0,
    interruttore: true,
    visibile: (c) => c.ambiente === 'alto-flusso',
  },
  perditaAF: {
    etichetta: 'vent.alarm.perditaAF',
    unita: 'vent.unit.none',
    passo: 0,
    minimo: 0,
    massimo: 0,
    interruttore: true,
    visibile: (c) => c.ambiente === 'alto-flusso',
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
    gravita: 'giallo',
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
    soloRosso: true,
    visibile: (c) => MODALITA_CON_APNEA.includes(c.modalita),
  },
}

/**
 * I limiti con cui la macchina si accende: larghi, ma non spenti. Il giallo è
 * una fascia stretta sotto al rosso; dove un valore normale ci cadrebbe dentro
 * (picco basso in PS, FiO₂, flusso) parte chiusa, e si apre trascinandola.
 */
export const LIMITI_INIZIALI: LimitiAllarme = {
  pPeak: { basso: 10, alto: 40, preBasso: 10, preAlto: 35, acceso: true },
  volumeMinute: { basso: 2, alto: 15, preBasso: 3, preAlto: 13, acceso: true },
  etco2: { basso: 25, alto: 50, preBasso: 30, preAlto: 47, acceso: true },
  fio2: { basso: 21, alto: 99, preBasso: 21, preAlto: 99, acceso: true },
  peep: { basso: 0, alto: 20, preBasso: 0, preAlto: 18, acceso: true },
  measuredFrequency: { basso: 5, alto: 35, preBasso: 7, preAlto: 30, acceso: true },
  leakPercentage: { basso: null, alto: 30, preBasso: null, preAlto: 25, acceso: true },
  perditaEccessiva: { basso: null, alto: null, acceso: true },
  ostruzioneAF: { basso: null, alto: null, acceso: true },
  segnaleEAdi: { basso: null, alto: null, acceso: true },
  perditaAF: { basso: null, alto: null, acceso: true },
  inspiratoryCo2: { basso: null, alto: 5, preBasso: null, preAlto: 4, acceso: true },
  etAgentConcentration: { basso: 0.1, alto: 5, preBasso: 0.1, preAlto: 4, acceso: true },
  flussoErogato: { basso: 5, alto: 70, preBasso: 5, preAlto: 70, acceso: true },
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

/** La soglia gialla dell'Et agente: quattro quinti della rossa, come di fabbrica. */
function preAltoAgente(alto: number): number {
  return Number((alto * 0.8).toFixed(1))
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
  // Il giallo segue solo se sta ancora alla distanza di fabbrica.
  const diFabbrica = attuale.preAlto === undefined || attuale.preAlto === preAltoAgente(attuale.alto)
  const preAlto = diFabbrica ? preAltoAgente(alto) : Math.min(attuale.preAlto ?? alto, alto)
  return { ...limiti, etAgentConcentration: { ...attuale, alto, preAlto } }
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
  /** Assente nelle istantanee salvate prima delle fasce gialle: vale rosso. */
  gravita?: GravitaAllarme
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
  const inPausa = misure.pausaPerdita === 1

  for (const chiave of Object.keys(ALLARMI) as ChiaveAllarme[]) {
    const def = ALLARMI[chiave]
    // Un'istantanea salvata prima che l'allarme esistesse non ha il suo limite: vale quello di fabbrica.
    const limite = completo(chiave, limiti[chiave])
    if (!limite?.acceso || !def.visibile(ctx)) continue

    if (chiave === 'segnaleEAdi') {
      if (misure.neuroRipiego === 1) attivi.push({ chiave, verso: null, valore: null })
      continue
    }
    if (chiave === 'ostruzioneAF' || chiave === 'perditaAF') {
      const guasto = stato.fisiologia.cannulaAF
      if ((chiave === 'ostruzioneAF' && guasto === 'occlusa') || (chiave === 'perditaAF' && guasto === 'staccata')) {
        attivi.push({ chiave, verso: null, valore: misure.flussoMisurato })
      }
      continue
    }
    if (chiave === 'perditaEccessiva') {
      const perdita = misure.leakPercentage
      if (inPausa || (perdita !== null && perdita > 95)) attivi.push({ chiave, verso: null, valore: perdita })
      continue
    }
    // In pausa la macchina non ventila apposta: si sorveglia solo il gas.
    if (inPausa && chiave !== 'fio2' && chiave !== 'acqua') continue

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
    // Cento per cento di ossigeno è una scelta, non un guasto: durante il
    // flush e in preossigenazione l'allarme alto non serve a nessuno.
    const saltaAlto = chiave === 'fio2' && valore >= 100
    const sotto = (soglia: number | null) => soglia !== null && valore < soglia && !saltaBasso
    const sopra = (soglia: number | null) => soglia !== null && valore > soglia && !saltaAlto
    // Prima i due rossi, poi i gialli: il giallo non può nascondere un rosso.
    if (sotto(limite.basso)) attivi.push({ chiave, verso: 'basso', valore, gravita: 'rosso' })
    else if (sopra(limite.alto)) attivi.push({ chiave, verso: 'alto', valore, gravita: 'rosso' })
    else if (sotto(limite.preBasso)) attivi.push({ chiave, verso: 'basso', valore, gravita: 'giallo' })
    else if (sopra(limite.preAlto)) attivi.push({ chiave, verso: 'alto', valore, gravita: 'giallo' })
  }

  // Interruttori e apnea non hanno fasce: la gravità sta nella tabella.
  return attivi.map((a) => ({ ...a, gravita: a.gravita ?? ALLARMI[a.chiave].gravita ?? 'rosso' }))
}

/** La gravità di un allarme acceso, anche se viene da un'istantanea vecchia. */
export function gravitaDi(a: AllarmeAttivo): GravitaAllarme {
  return a.gravita ?? ALLARMI[a.chiave]?.gravita ?? 'rosso'
}

/** La gravità più alta fra quelle accese: decide il suono e il colore in testata. */
export function gravitaMassima(attivi: AllarmeAttivo[]): GravitaAllarme | null {
  if (attivi.length === 0) return null
  return attivi.some((a) => gravitaDi(a) === 'rosso') ? 'rosso' : 'giallo'
}

/**
 * Da dove si legge il valore di quell'allarme.
 *
 * Tre sorveglia **impostazioni** e non misure — FiO₂, PEEP e il flusso
 * dell'alto flusso — perché su questa macchina sono quello che esce dal
 * miscelatore, e il limite serve a impedire di regolare male, non a scoprire un
 * guasto. Gli altri guardano quello che l'apparecchio misura.
 */
export function valoreDa(chiave: ChiaveAllarme, stato: StatoVentilatore, misure: Misure): number | null {
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
  const eranoAccesi = new Map(prima.map((a) => [a.chiave, gravitaDi(a)]))
  const sonoAccesi = new Set(dopo.map((a) => a.chiave))
  return {
    accesi: dopo.filter(
      (a) =>
        !eranoAccesi.has(a.chiave) ||
        // da giallo a rosso è un fatto nuovo; il ritorno al giallo no
        (gravitaDi(a) === 'rosso' && eranoAccesi.get(a.chiave) === 'giallo'),
    ),
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
 * Il limite con le quattro soglie, per chi lo legge.
 *
 * Un'istantanea vecchia non ha le gialle: valgono quelle di fabbrica, strette
 * dentro le rosse che quella istantanea ha davvero.
 */
export function completo(chiave: ChiaveAllarme, salvato: LimiteAllarme | undefined): Required<LimiteAllarme> {
  const fabbrica = LIMITI_INIZIALI[chiave]
  const { basso, alto, acceso, preBasso = fabbrica.preBasso, preAlto = fabbrica.preAlto } = salvato ?? fabbrica
  const dentro = (v: number) => Math.min(alto ?? Infinity, Math.max(basso ?? -Infinity, v))
  const soloRosso = ALLARMI[chiave].soloRosso
  let pb = soloRosso || basso === null ? null : dentro(preBasso ?? basso)
  const pa = soloRosso || alto === null ? null : dentro(preAlto ?? alto)
  if (pb !== null && pa !== null && pb >= pa) pb = basso
  return { basso, alto, preBasso: pb, preAlto: pa, acceso }
}

/**
 * Un limite portato a un valore: il trascinamento, e anche il passo.
 *
 * Il valore si arrotonda al passo e resta dentro la scala. Le rosse **spingono**
 * le gialle davanti a sé; le gialle si fermano contro le rosse. Le due rosse non
 * si scavalcano, e nemmeno le due gialle: un limite basso sopra quello alto
 * farebbe suonare l'allarme per qualunque valore.
 */
export function portaLimite(
  chiave: ChiaveAllarme,
  salvato: LimiteAllarme | undefined,
  estremo: EstremoLimite,
  valore: number,
): LimiteAllarme {
  const def = ALLARMI[chiave]
  const l = completo(chiave, salvato)
  if (def.interruttore || def.passo <= 0 || l[estremo] === null || !Number.isFinite(valore)) return salvato ?? l
  const tondo = parseFloat((Math.round(valore / def.passo) * def.passo).toFixed(4))
  let v = Math.min(def.massimo, Math.max(def.minimo, tondo))
  const passo = (x: number, verso: 1 | -1) => parseFloat((x + verso * def.passo).toFixed(4))

  if (estremo === 'basso') {
    if (l.alto !== null) v = Math.min(v, passo(l.alto, -1))
    const pb = l.preBasso === null ? null : Math.max(l.preBasso, v)
    const pa = l.preAlto === null || pb === null ? l.preAlto : Math.max(l.preAlto, passo(pb, 1))
    return { ...l, basso: v, preBasso: pb, preAlto: pa }
  }
  if (estremo === 'alto') {
    if (l.basso !== null) v = Math.max(v, passo(l.basso, 1))
    const pa = l.preAlto === null ? null : Math.min(l.preAlto, v)
    const pb = l.preBasso === null || pa === null ? l.preBasso : Math.min(l.preBasso, passo(pa, -1))
    return { ...l, alto: v, preBasso: pb, preAlto: pa }
  }
  if (estremo === 'preBasso') {
    if (l.preAlto !== null) v = Math.min(v, passo(l.preAlto, -1))
    return { ...l, preBasso: Math.max(v, l.basso ?? v) }
  }
  if (l.preBasso !== null) v = Math.max(v, passo(l.preBasso, 1))
  return { ...l, preAlto: Math.min(v, l.alto ?? v) }
}

/** Un limite spostato di un passo, dentro i suoi estremi. */
export function spostaLimite(
  chiave: ChiaveAllarme,
  salvato: LimiteAllarme | undefined,
  estremo: EstremoLimite,
  verso: 1 | -1,
): LimiteAllarme {
  const attuale = completo(chiave, salvato)[estremo]
  return portaLimite(chiave, salvato, estremo, attuale === null ? NaN : attuale + verso * ALLARMI[chiave].passo)
}

/**
 * Un allarme solo riportato a com'era all'accensione, acceso compreso. L'Et
 * agente torna al limite dell'agente montato, non a quello del sevoflurano.
 */
export function limiteDiFabbrica(chiave: ChiaveAllarme, agente: string | undefined): LimiteAllarme {
  return { ...conLimiteDellAgente(LIMITI_INIZIALI, agente)[chiave] }
}
