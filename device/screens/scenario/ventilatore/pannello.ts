/**
 * Le regole della schermata, tolte dalla schermata.
 *
 * ## Perché non stanno dentro il componente
 *
 * «Quali maniglie ha questo apparecchio», «che cosa succede se giro il rapporto
 * I:E oltre l'ultimo», «quali gruppi di numeri restano vuoti in alto flusso»:
 * sono decisioni, non disegno. Dentro `Ventilatore.tsx` sarebbero verificabili
 * solo aprendo un browser e guardando; qui sono funzioni pure, e
 * `npm run prove` le misura come misura le curve.
 *
 * È la stessa divisione del monitor — `vista.ts` e `apparecchio.ts` tengono le
 * regole, gli schermi le applicano — e serve alla stessa cosa: un'assunzione
 * sbagliata («in alto flusso c'è il cassetto delle manovre») diventa una riga
 * rossa invece di un difetto che si scopre in aula.
 */

import type { TranslationKey } from '../../../i18n/it'
import type { AzioneVentilatore } from './azioni'
import { costanteTempo, tempiRespiro, volumeCorrenteAtteso, type StatoVentilatore } from './fisica'
import { PMUSC_MASSIMA, driveEfficace } from './asincronie'
import type { Misure } from './parametri'
import {
  impostazioniVisibili,
  misureVisibili,
  sposta,
  type ChiaveImpostazione,
  type ChiaveMisura,
  type ContestoVista,
} from './parametri'

export type Cassetto = 'ventilazione' | 'modalita' | 'gas' | 'umidificatore' | 'manovre' | 'allarmi'

/** Come si chiama in testa a ogni cassetto. */
export const NOME_CASSETTO: Record<Cassetto, TranslationKey> = {
  ventilazione: 'vent.drawer.ventilazione',
  modalita: 'vent.drawer.modalita',
  gas: 'vent.drawer.gas',
  umidificatore: 'vent.drawer.umidificatore',
  manovre: 'vent.drawer.manovre',
  allarmi: 'vent.drawer.allarmi',
}

/**
 * I rapporti I:E che si girano sulla manopola, nell'ordine del selettore.
 *
 * Comincia da 2:1 perché la manopola sale: girando in avanti si allunga
 * l'espirazione, che è il verso in cui la si gira quasi sempre.
 */
export const RAPPORTI = ['2:1', '1:1', '1:1.5', '1:2', '1:2.5', '1:3', '1:4']

/**
 * Le maniglie sul fianco, e quali sono accese.
 *
 * Il cassetto dei gas esiste **solo in anestesia** — altrove non c'è nessun
 * vaporizzatore da aprire — e quello delle manovre non esiste in alto flusso,
 * dove non c'è niente da mettere in pausa. Una maniglia che si apre su un
 * cassetto vuoto insegna che l'apparecchio ha una funzione che non ha.
 *
 * «Accesa» non vuol dire «aperta»: vuol dire che quella cosa è in corso —
 * l'apparecchio è fermo, l'agente sta erogando, una pausa è tenuta — e si vede
 * dal fianco senza aprire niente.
 */
export function maniglie(stato: StatoVentilatore): {
  chiave: Cassetto
  etichetta: TranslationKey
  accesa: boolean
}[] {
  const voci: { chiave: Cassetto; etichetta: TranslationKey; accesa: boolean }[] = [
    // OVS 3.3: a macchina spenta il tasto si chiama ON/OFF (rilievo dell'aula):
    // «Standby» su un apparecchio fermo sembrava lo stato, non il comando.
    {
      chiave: 'ventilazione',
      etichetta: stato.ventilando ? 'vent.handle.ventilazione' : 'vent.handle.accensione',
      accesa: !stato.ventilando,
    },
    { chiave: 'modalita', etichetta: 'vent.handle.modalita', accesa: false },
  ]
  if (stato.ambiente === 'anestesia') {
    voci.push({
      chiave: 'gas',
      etichetta: 'vent.handle.gas',
      accesa: stato.gas?.erogazione === true,
    })
  }
  // L'umidificatore c'è dove c'è una camera d'acqua: i tre ventilatori. In
  // anestesia il circuito è chiuso e l'umidità la fa la calce.
  if (stato.ambiente !== 'anestesia') {
    voci.push({
      chiave: 'umidificatore',
      etichetta: 'vent.handle.umidificatore',
      // Accesa quando c'è qualcosa da guardare: acqua agli sgoccioli, o
      // secrezioni che si stanno accumulando per una potenza troppo alta.
      accesa:
        (stato.umidificatore?.acqua ?? 1) < 0.1 || (stato.umidificatore?.accumulo ?? 0) > 0.3,
    })
  }
  if (stato.ambiente !== 'alto-flusso') {
    voci.push({
      chiave: 'manovre',
      etichetta: 'vent.handle.manovre',
      accesa: stato.manovra !== null,
    })
  }
  voci.push({ chiave: 'allarmi', etichetta: 'vent.handle.allarmi', accesa: false })
  return voci
}

/**
 * Un parametro girato di un passo, come azione da mandare in regia.
 *
 * I due rapporti I:E non sono numeri e non hanno un passo: si scorre l'elenco.
 * Girando oltre l'ultimo **non si riavvolge**: su una manopola vera c'è un
 * fermo, e un elenco che gira porterebbe da 1:4 a 2:1 con un tocco — cioè
 * dall'espirazione più lunga a quella più corta, che è il salto peggiore
 * possibile su un paziente ostruito.
 */
export function giraParametro(
  chiave: ChiaveImpostazione,
  stato: StatoVentilatore,
  verso: 1 | -1,
): AzioneVentilatore {
  const attuale = stato.impostazioni[chiave]
  if (typeof attuale === 'string') {
    const i = RAPPORTI.indexOf(attuale)
    const da = i < 0 ? RAPPORTI.indexOf('1:2') : i
    const prossimo = RAPPORTI[Math.max(0, Math.min(RAPPORTI.length - 1, da + verso))]
    return { tipo: 'parametro', chiave, valore: prossimo }
  }
  const interfaccia = stato.altoFlusso?.interfaccia ?? null
  return { tipo: 'parametro', chiave, valore: sposta(chiave, attuale, verso, interfaccia) }
}

/**
 * I gruppi della colonna di monitoraggio, già svuotati di quello che non c'è.
 *
 * L'ordine dentro ogni gruppo è quello in cui si leggono al letto; i gruppi
 * senza nemmeno una voce visibile spariscono, perché un'intestazione
 * «PRESSIONI» sopra il niente è peggio che non averla.
 */
export const GRUPPI: { titolo: TranslationKey; chiavi: ChiaveMisura[] }[] = [
  { titolo: 'vent.group.pressioni', chiavi: ['pPeak', 'pMean', 'pPlateau', 'p01', 'stressIndex'] },
  {
    titolo: 'vent.group.ventilazione',
    chiavi: [
      'measuredFrequency',
      'spontaneousRate',
      'volumeExpired',
      'volumeMinute',
      'mlPerKg',
      'tiTtot',
      'leakPercentage',
      'leakFlow',
      'compliance',
      'resistance',
    ],
  },
  {
    titolo: 'vent.group.gas',
    chiavi: [
      'etco2',
      'inspiratoryCo2',
      'etAgentConcentration',
      'fiAgentConcentration',
      'etSecondaryAgentConcentration',
      'fiSecondaryAgentConcentration',
      'mac',
    ],
  },
  { titolo: 'vent.group.apparecchio', chiavi: ['deliveredTemperature', 'waterLevelPercent'] },
]

export function gruppiMonitoraggio(
  ctx: ContestoVista,
  agentiMontati = 1,
): { titolo: TranslationKey; chiavi: ChiaveMisura[] }[] {
  const visibili = misureVisibili(ctx)
  // Il secondo agente solo quando ce n'è uno (dall'utente): due tessere
  // a 0,0 occupano il posto delle misure che si guardano.
  const nascoste: ChiaveMisura[] =
    agentiMontati >= 2 ? [] : ['etSecondaryAgentConcentration', 'fiSecondaryAgentConcentration']
  return GRUPPI.map((g) => ({
    titolo: g.titolo,
    chiavi: g.chiavi.filter((k) => visibili.includes(k) && !nascoste.includes(k)),
  })).filter((g) => g.chiavi.length > 0)
}

/**
 * Il fondo scala delle tre curve.
 *
 * ## Perché non è fisso
 *
 * La prima versione usava estremi larghi e fissi — la pressione da -5 a 30, il
 * flusso da -70 a 70 — e su un paziente normale l'onda della Paw viveva fra 5 e
 * 16: un sesto dell'altezza della corsia. Guardandola in aula sembrava una
 * linea che ondeggia, e la differenza fra un plateau e un picco non si vedeva.
 * Su un apparecchio vero la scala si adatta a quello che sta succedendo, ed è
 * il motivo per cui le curve si leggono da lontano.
 *
 * Gli estremi sono **generosi ma non enormi**: c'è un minimo, perché una scala
 * che si stringe troppo trasformerebbe il rumore di fondo in montagne, e c'è un
 * margine sopra il picco, perché un'onda che tocca il bordo si legge come
 * un'onda tagliata.
 */
/**
 * Il primo fondo scala «bello» sopra un valore: 1, 2, 5 e i loro decimali.
 *
 * **Serve a far vedere che una manopola ha fatto qualcosa.** Finché il fondo
 * scala si ricavava dal valore corrente, alzare la pressione di supporto
 * alzava il volume **e** la corsia insieme: la curva restava identica, e in
 * aula si leggeva «se alzo la PS non cambia niente». Con i gradini la corsia
 * sta ferma finché può, e la curva cresce dentro; quando proprio non ci sta
 * più, il fondo scala fa un salto solo e onesto — come su un apparecchio vero,
 * dove la scala è scritta di lato e non balla a ogni respiro.
 */
export function fondoScala(valore: number): number {
  const v = Math.max(1e-6, valore)
  const decade = Math.pow(10, Math.floor(Math.log10(v)))
  for (const passo of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (v <= passo * decade + 1e-9) return passo * decade
  }
  return 10 * decade
}

/**
 * Il fondo scala che si tiene, guardando quello che c'era prima.
 *
 * **Un fondo scala che insegue il valore nasconde il valore.** Era il difetto
 * visto in aula: alzando la pressione di supporto il volume saliva e la corsia
 * saliva con lui, quindi la curva restava identica e la manopola sembrava non
 * fare niente. Su un ventilatore vero la scala **sta ferma** finché la curva ci
 * sta dentro, e cambia con un salto quando non ci sta più: è quello che rende
 * visibile un cambiamento.
 *
 * Quindi: si cresce solo se serve — la curva uscirebbe — e si scende solo
 * quando è rimpicciolita **parecchio**, sotto il quaranta per cento, o la
 * scala ballerebbe a ogni respiro un po' più corto.
 */
export function assestaScala(corrente: number, voluta: number): number {
  if (!isFinite(corrente) || corrente <= 0) return voluta
  if (voluta > corrente) return voluta
  if (voluta < corrente * 0.4) return voluta
  return corrente
}

/**
 * Il peso su cui si tara la corsia del volume, in chili.
 *
 * Quello del paziente se c'è; settanta se il ventilatore non lo sa ancora —
 * una corsia che cambia scala quando arriva l'anagrafica sarebbe peggio di una
 * tarata su un adulto medio.
 */
function pesoRiferimento(stato: StatoVentilatore): number {
  const peso = stato.paziente.pesoKg
  return typeof peso === 'number' && peso > 0 ? peso : 70
}

export function scaleOnde(
  stato: StatoVentilatore,
  misure: Misure,
): { paw: [number, number]; flusso: [number, number]; volume: [number, number] } {
  const imp = stato.impostazioni
  const inManuale = stato.ambiente === 'anestesia' && stato.respiro === 'manuale'

  if (inManuale) {
    // A pallone l'onda oscilla **sotto** il livello dell'APL: la scala si apre
    // in basso, dove sta l'atto del paziente, e poco in alto.
    const sforzo = driveEfficace(stato.drive).intensita * PMUSC_MASSIMA
    return {
      paw: [Math.min(-2, imp.apl - sforzo * 1.5 - 3), imp.apl + 8],
      flusso: [-40, 40],
      volume: [0, Math.max(300, stato.fisiologia.compliance * sforzo * 1.3)],
    }
  }

  const vt = volumeCorrenteAtteso(stato)
  const { Tif } = tempiRespiro(stato)
  const picco = Tif > 0 ? (vt / 1000 / Tif) * 60 : 30
  // ## Il picco espiratorio non si deduce da quello inspiratorio
  //
  // Il primo tentativo lo stimava a una volta e otto l'inspiratorio, e la curva
  // usciva dalla corsia: l'espirazione è passiva e parte da `V/RC`, che con una
  // costante di tempo corta è **tre volte** il flusso quadro dell'insufflazione.
  // Con l'ostruito è il contrario — la coda è lunga e bassa — ed è la stessa
  // formula a dirlo, perché RC cresce.
  const RC = Math.max(0.05, costanteTempo(stato.fisiologia) * (1 + 2 * stato.fisiologia.limitazioneFlusso))
  const piccoEsp = ((vt / 1000 / RC) * 60) * (1 + stato.fisiologia.limitazioneFlusso * 2)
  const pPeak = typeof misure.pPeak === 'number' ? misure.pPeak : imp.peep + 15
  // I fondi scala si arrotondano al gradino sopra: la corsia sta ferma mentre
  // la curva cresce, ed è così che si vede che la manopola ha fatto qualcosa.
  return {
    paw: [Math.min(0, imp.peep - 3), fondoScala(Math.max(imp.peep + 12, pPeak * 1.15))],
    flusso: [-fondoScala(Math.max(20, piccoEsp * 1.1)), fondoScala(Math.max(20, picco * 1.1))],
    // ## La corsia del volume ha un fondo legato **al paziente**, non al respiro
    //
    // Se il fondo scala insegue il volume corrente, alzare la pressione di
    // supporto alza tutt'e due e la curva resta identica: era il rilievo
    // «se alzo la PS non varia il volume». Con un pavimento a dieci ml per
    // chilo la corsia sta ferma per tutta la fascia clinica — su settanta chili
    // sono settecento ml — e dentro quella fascia il volume che cresce **si
    // vede crescere**. Sopra, la scala fa il suo gradino.
    volume: [
      0,
      fondoScala(Math.max(300, pesoRiferimento(stato) * 10, vt * 1.1)),
    ],
  }
}

/**
 * Le impostazioni da mostrare davvero sulla barra.
 *
 * `impostazioniVisibili` sa che cosa esiste in quell'ambiente, e non può sapere
 * di più: riceve modalità e respiro, non lo stato dei gas. Ma il bersaglio del
 * **secondo** agente su un carrello con un vaporizzatore solo è una manopola
 * che non regola niente, ed è la specie di comando che insegna una macchina che
 * non c'è.
 */
export function impostazioniDaMostrare(stato: StatoVentilatore): ChiaveImpostazione[] {
  const ctx: ContestoVista = {
    ambiente: stato.ambiente,
    modalita: stato.modalita,
    respiro: stato.respiro,
    impostazioni: stato.impostazioni,
  }
  const due = (stato.gas?.agenti.length ?? 0) >= 2
  return impostazioniVisibili(ctx).filter((k) => due || k !== 'targetEtSecondaryAgent')
}

/**
 * Le velocità dello schermo: quanti secondi di curva da un bordo all'altro.
 *
 * Trenta è il predefinito perché a dodici atti al minuto fa **sei atti per
 * schermata**, che è come si guarda un ventilatore: il singolo atto dice poco,
 * il pattern dice tutto — ed è nel pattern che si riconoscono le asincronie.
 * Dieci è lo zoom sull'atto singolo, sessanta è la finestra lunga del trend.
 */
export const VELOCITA_SCHERMO = [10, 30, 60]
export const VELOCITA_PREDEFINITA = 30

/**
 * Da dove si è toccato lo schermo congelato all'istante della curva.
 *
 * Il pennello scrive il tempo `t` al pixel `(t mod finestra) / finestra`: sullo
 * schermo fermo convivono la coda del giro in corso (a sinistra della punta) e
 * quella del giro prima (a destra). Questa è l'inversa: dato dove si è toccato,
 * qual è il `t` che sta lì — mai nel futuro della punta, mai più vecchio di una
 * finestra intera.
 */
export function tempoDalTocco(frazione: number, tFermo: number, finestraSec: number): number {
  const f = Math.min(1, Math.max(0, frazione))
  const base = Math.floor(tFermo / finestraSec) * finestraSec
  let t = base + f * finestraSec
  if (t > tFermo) t -= finestraSec
  return Math.max(0, t)
}
