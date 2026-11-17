/**
 * Lo scambio dei gas: PaCO₂, PaO₂, SpO₂ ed emogas come conseguenza di quello
 * che si fa sulla macchina e sul paziente.
 *
 * ## Com'è fatto
 *
 * Tre compartimenti di Riley — ideale, basso V/Q, shunt — alimentati dalle otto
 * fette del modello EIT (`eit.ts`): le fette chiuse sono shunt, quelle
 * sovradistese spazio morto. Per ogni compartimento ventilato la FAO₂ avanza
 * col bilancio di massa (quello che entra con la ventilazione meno quello che
 * il sangue si porta via), il sangue che esce dal capillare si calcola lungo il
 * capillare con la capacità di diffusione, e la vasocostrizione ipossica
 * sposta il flusso dalle zone ipossiche a quelle ossigenate. La CO₂ sta in due
 * depositi (sangue e tessuti), l'O₂ nella CFR e nel sangue venoso: è da qui che
 * escono i tempi dell'apnea e dell'ipoventilazione.
 *
 * ## La CO₂ e lo spazio morto (3.6)
 *
 * Fonte: Cipulli F, Sanna A, Garberi R, Lassola S, Forcione M, Bellani G,
 * Foti G, Rezoagli E. Dead space in critical care: a practical approach with
 * clinical scenarios. *J Anesth Analg Crit Care* 2026;6:20,
 * doi:10.1186/s44158-025-00320-4. Da lì:
 *
 * * la PACO₂ (alveolare, quella che il polmone elimina) e la PaCO₂ (arteriosa,
 *   quella dell'emogas) non sono lo stesso numero: il sangue che passa dallo
 *   shunt non scarica CO₂, la PaCO₂ sale e la PACO₂ scende, e lo spazio morto
 *   di Bohr-Enghoff, che usa la PaCO₂, esce sovrastimato — poco sotto il 40% di
 *   shunt, molto sopra;
 * * a riposo il gradiente PaCO₂ − EtCO₂ è di circa 5 mmHg;
 * * nell'ostruzione grave la CO₂ resta intrappolata negli alveoli che non si
 *   svuotano, esce per ultima e l'EtCO₂ può superare la PaCO₂ (spazio morto
 *   negativo); il capnogramma perde il plateau;
 * * la VCO₂ a riposo è di 3–4 ml/kg/min;
 * * gli indici: VD/VT alveolare (PaCO₂ − EtCO₂)/PaCO₂, fisiologico
 *   (PaCO₂ − PECO₂)/PaCO₂, anatomico per differenza; EtCO₂/PaCO₂; rapporto
 *   ventilatorio VE·PaCO₂/(100·kg·37,5); ventilazione minuto standardizzata
 *   VE·PaCO₂/40.
 *
 * ## La taratura
 *
 * Quello che lo scenario scrive (SpO₂, EtCO₂) è la verità alle condizioni del
 * momento in cui lo scrive: il modello cerca la «lesione» che dà quella SpO₂ e
 * la produzione di CO₂ che dà quell'EtCO₂, e da lì in poi aggiunge solo le
 * conseguenze delle azioni. Uno scenario che si apre parte identico a prima.
 *
 * Tutto è puro: stessi ingressi, stessi numeri, su ogni schermo.
 */

import { regioni } from './eit'
import { autoPeep, type Fisiologia, type StatoVentilatore } from './fisica'
import { driveEfficace } from './asincronie'
import type { Misure } from './parametri'

// ---------------------------------------------------------------- tipi --

/** Quello che la regia (o lo scenario) regola del paziente. */
export interface ParametriScambio {
  /** Emoglobina, g/dl. */
  hb: number
  /** Temperatura, °C: sposta VO₂, VCO₂ e la curva. */
  temperatura: number
  /** Moltiplicatore del metabolismo (sedazione profonda 0,8; sepsi, brivido fino a 3). */
  metabolismo: number
  /** Capacità di diffusione, frazione della normale (fibrosi, interstiziopatia 0,2–0,5). */
  diffusione: number
  /** Shunt non reclutabile (consolidamento, atelettasia lobare), 0–0,6. */
  shuntFisso: number
  /** Perfusione in più verso zone a basso V/Q, 0–0,6. */
  bassoVQ: number
  /**
   * Quota della ventilazione alveolare verso zone non perfuse (embolia), 0–0,7.
   * Il 10% di base dà a riposo il gradiente PaCO₂ − EtCO₂ di circa 4-5 mmHg
   * (Cipulli 2026: «circa 5 mmHg»).
   */
  spazioMortoAlv: number
  /** Portata cardiaca, l/min; null = da peso (70 ml/kg/min). */
  portata: number | null
  /** Bicarbonato metabolico di base, mmol/l. */
  hco3: number
  /** Carbossiemoglobina e metaemoglobina, frazioni 0–0,6. */
  cohb: number
  methb: number
  /** Inibizione esterna della vasocostrizione ipossica (vasodilatatori), 0–1. */
  inibizioneHpv: number
  /** NO inalatorio, ppm. */
  noPpm: number
  /** BMI: riduce la CFR. */
  bmi: number
  /** Pressione barometrica, mmHg. */
  pb: number
}

export const PARAMETRI_SCAMBIO: ParametriScambio = {
  hb: 14,
  temperatura: 37,
  metabolismo: 1,
  diffusione: 1,
  shuntFisso: 0.02,
  bassoVQ: 0,
  spazioMortoAlv: 0.1,
  portata: null,
  hco3: 24,
  cohb: 0.01,
  methb: 0.005,
  inibizioneHpv: 0,
  noPpm: 0,
  bmi: 24,
  pb: 760,
}

/** Quello che il ventilatore (o il monitor, senza ventilatore) sa del respiro. */
export interface IngressiScambio {
  pesoKg: number
  /** FiO₂ che arriva agli alveoli, 0–1. */
  fio2: number
  /** Volume minuto espirato, ml/min, e corrente medio, ml. */
  veMlMin: number
  vtMl: number
  frequenza: number
  /** Spazio morto anatomico + strumentale, ml. */
  vdMl: number
  /** Vie aeree aperte verso una sorgente di gas (per l'ossigenazione apneica). */
  vieAperte: boolean
  /** FiO₂ della sorgente a vie aperte quando non si respira. */
  fonteO2: number
  peepTotale: number
  /**
   * L'auto-PEEP, cmH₂O: l'aria che non esce. È il segno misurabile della CO₂
   * intrappolata negli alveoli ostruiti. Assente = 0.
   */
  autoPeep?: number
  /** Pressione di fine inspirazione e pressione media, cmH₂O. */
  pFine: number
  pMedia: number
  /** Reclutamento sostenuto in corso. */
  reclutamento: boolean
  /** Il paziente è staccato dalla macchina (standby): il polmone si richiude. */
  scollegato: boolean
  fisiologia: Fisiologia
  /** MAC degli alogenati raggiunta (inibisce la vasocostrizione ipossica). */
  mac: number
  /** Portata dal circolo, se chi chiama la sa; altrimenti quella dei parametri. */
  portata: number | null
  /** Bersagli scritti dallo scenario: si tarano quando cambiano. */
  spo2Bersaglio: number | null
  etco2Bersaglio: number | null
  /** frequenza·(VT − VD), ml/min: zero vuol dire apnea. */
  vaTotaleStimata: number
}

/** Lo stato che avanza: tutto quello che ha un tempo. */
export interface StatoScambio {
  parametri: ParametriScambio
  /** Il tempo interno, secondi. */
  t: number
  /**
   * CO₂: polmone e sangue di fine capillare (= PACO₂, l'alveolare) e tessuti
   * (= venosa mista), mmHg. La PaCO₂ arteriosa ci aggiunge lo shunt
   * (`paco2Arteriosa`).
   */
  pco2Sangue: number
  pco2Tessuti: number
  /** FAO₂ dei compartimenti ventilati: ideale, basso V/Q. */
  fa: [number, number]
  /** Contenuto venoso misto, ml O₂/l. */
  cv: number
  /**
   * Tono della vasocostrizione, fase rapida e lenta, per compartimento
   * [ideale, basso V/Q, shunt da collasso, shunt da consolidamento].
   */
  tonoRapido: Quattro
  tonoLento: Quattro
  /**
   * La distribuzione della perfusione com'è adesso: segue quella del polmone
   * in una quindicina di secondi, il tempo perché l'O₂ rimasto negli alveoli appena chiusi
   * (o esclusi) passi nel sangue. Assente = quella del polmone.
   */
  q0?: Quattro
  /** Compenso renale, mmol/l, e lattato, mmol/l. */
  compenso: number
  lattato: number
  /** La SpO₂ che il sensore mostra (ritardata), %. */
  spo2Sensore: number
  /** La lesione che la taratura ha trovato, e quella verso cui va. */
  lesione: number
  lesioneVerso: number
  /** Il fattore della VCO₂ che la taratura ha trovato. */
  vco2Fattore: number
  /** Fino a quando i depositi di CO₂ vengono tirati verso il nuovo equilibrio, s. */
  co2TiraFino: number
  /**
   * Fino a quando i serbatoi dell'O₂ vengono tirati verso il nuovo equilibrio
   * dopo una taratura: la SpO₂ scritta dallo scenario arriva in mezzo minuto,
   * non nei minuti che il sangue venoso ci metterebbe da solo.
   */
  o2TiraFino?: number
  /** I bersagli già tarati. */
  bersagli: { spo2: number | null; etco2: number | null }
  /** La SpO₂ scritta non è raggiungibile: vince lo scritto, la regia lo sa. */
  taraturaAlLimite: boolean
}

/** La memoria del reclutamento: è meccanica, la tiene il ventilatore. */
export interface StatoIsteresi {
  peepMemoria: number
  atelettasia: number
}

/** Quello che si legge: emogas, monitor, regia. */
export interface LetturaScambio {
  pao2: number
  paco2: number
  ph: number
  hco3: number
  be: number
  sao2: number
  spo2: number
  svo2: number
  pvo2: number
  pvco2: number
  /** PACO₂ alveolare media, mmHg: non si misura, la sa il modello. */
  pAco2: number
  /** PECO₂ mista espirata, mmHg (capnografia volumetrica). */
  peco2: number
  etco2: number
  /** PaCO₂ − EtCO₂, mmHg (normale circa 5; negativo nell'ostruzione grave). */
  gradienteCo2: number | null
  /** EtCO₂/PaCO₂ (sotto 0,8 compromissione ventilatoria grave). */
  rapportoEtPa: number | null
  /** VD/VT alveolare di Bohr-Enghoff, (PaCO₂ − EtCO₂)/PaCO₂: può essere negativo. */
  vdAlveolare: number | null
  /** VD/VT fisiologico di Bohr-Enghoff, (PaCO₂ − PECO₂)/PaCO₂. */
  vdFisiologico: number | null
  /** VD/VT anatomico, fisiologico − alveolare. */
  vdAnatomico: number | null
  /** VD/VT alveolare vero, con la PACO₂ (quello che l'Enghoff stima). */
  vdAlveolareVero: number | null
  lattato: number
  pf: number
  aa: number
  oi: number | null
  qsqt: number
  /** VD/VT fisiologico (= `vdFisiologico`, il nome di prima). */
  vdvt: number | null
  rapportoVentilatorio: number | null
  /** Ventilazione minuto standardizzata VE·PaCO₂/40, l/min. */
  ventilazioneStandardizzata: number | null
  do2: number
  vo2: number
  hb: number
  cohb: number
  methb: number
  fio2: number
  /** Minuti stimati al 90% se smettesse di respirare adesso. */
  apneaSicuraMin: number
  /** Tono medio della vasocostrizione (0–1), per la regia. */
  tono: number
  taraturaAlLimite: boolean
}

type Quattro = [number, number, number, number]

// --------------------------------------------------------- costanti --

const PH2O = 47
/** VO₂ di base, ml/kg/min. */
const VO2_ML_KG = 3.5
/**
 * VCO₂ di base, ml/kg/min: 3–4 a riposo (Cipulli 2026), si prende il bordo basso
 * (210 ml/min a 70 kg). Il quoziente respiratorio è quello che ne esce, 0,86.
 */
const VCO2_ML_KG = 3
export const QUOZIENTE_RESPIRATORIO = VCO2_ML_KG / VO2_ML_KG
/**
 * Le capacità dei depositi rapidi della CO₂, ml/mmHg per kg. I depositi del corpo
 * sono circa 120 l, l'89% nell'osso (il lento, che si muove in giorni e qui non
 * c'è) e l'11% rapido: interstizio 8,5%, sangue 2,5% (Cipulli 2026). Il totale
 * rapido (0,9 ml/mmHg/kg) dà i tempi dell'apnea; la ripartizione è quella.
 */
const CAP_CO2_RAPIDO = 0.9
const CAP_CO2_SANGUE = CAP_CO2_RAPIDO * (2.5 / 11)
const CAP_CO2_TESSUTI = CAP_CO2_RAPIDO * (8.5 / 11)
/** Scambio tessuti-sangue della CO₂ a portata normale, ml/min/mmHg a 70 kg. */
const G_CO2 = 33
/** Pendenza e mezzo effetto della vasocostrizione ipossica (PO₂ di stimolo, mmHg). */
const HPV_P50 = 35
const HPV_K = 4
/** Nel consolidamento (polmonite, ARDS) la vasocostrizione funziona poco: l'infiammazione la spegne. */
const HPV_CONSOLIDAMENTO = 0.3
const TAU_HPV_RAPIDO = 300
const TAU_HPV_LENTO = 2400
/** V/Q del compartimento basso. */
const VQ_BASSO = 0.1
/** Isteresi: quanto sotto la memoria si può scendere prima che il polmone si richiuda. */
export const ISTERESI_CMH2O = 8
const TAU_CHIUSURA = 120
/** Il reclutamento sostenuto tiene aperto come una PEEP di... */
const MEMORIA_RECLUTAMENTO = 24
const PASSO_INTERNO = 0.5
/** In quanto la perfusione segue un polmone che cambia (l'O₂ negli alveoli appena chiusi si esaurisce). */
const TAU_PERFUSIONE = 15

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const segue = (x: number, verso: number, dt: number, tau: number) => x + (verso - x) * (1 - Math.exp(-dt / Math.max(1e-6, tau)))

// ------------------------------------------------- la curva dell'O₂ --

interface Sangue {
  hb: number
  ph: number
  temperatura: number
  be: number
  pco2: number
  cohb: number
  methb: number
}

/** La saturazione funzionale (Severinghaus 1979, PO₂ virtuale per pH, temperatura, BE e CO₂). */
export function saturazione(po2: number, s: Sangue): number {
  if (po2 <= 0) return 0
  const virtuale =
    po2 *
    Math.pow(10, 0.48 * (s.ph - 7.4) - 0.024 * (s.temperatura - 37) - 0.0013 * s.be) *
    (1 + 1.1 * (s.cohb + s.methb))
  return 1 / (23400 / (virtuale ** 3 + 150 * virtuale) + 1)
}

/** Il contenuto di O₂, ml per litro di sangue. */
export function contenuto(po2: number, s: Sangue): number {
  const disponibile = Math.max(0, 1 - s.cohb - s.methb)
  return 10 * (1.34 * s.hb * disponibile * saturazione(po2, s) + 0.0031 * Math.max(0, po2))
}

/** La PO₂ che dà quel contenuto (bisezione: la curva è monotona). */
export function po2DaContenuto(c: number, s: Sangue): number {
  let lo = 0
  let hi = 800
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2
    if (contenuto(m, s) < c) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

/**
 * La PO₂ del sangue a fine capillare: parte da quella venosa e sale verso la
 * PAO₂ con la velocità che la diffusione consente (Bohr). A riposo e con la
 * diffusione normale arriva in un terzo del tempo di transito; con la
 * diffusione ridotta e la portata alta (transito breve) non ci arriva.
 */
export function fineCapillare(pa: number, pv: number, kd: number, transito: number, s: Sangue): number {
  const N = 16
  const dt = transito / N
  let p = pv
  if (pa <= pv) return pa
  for (let i = 0; i < N; i++) {
    const pendenza = Math.max(1e-6, (contenuto(p + 0.5, s) - contenuto(p - 0.5, s)) / 1000)
    p = pa - (pa - p) * Math.exp((-kd * dt) / pendenza)
  }
  return p
}

// --------------------------------------------------- la struttura --

interface Struttura {
  /** Perfusione di base [ideale, basso V/Q, shunt da collasso, shunt da consolidamento], somma 1. */
  q0: Quattro
  /** Ventilazione alveolare verso i compartimenti perfusi [ideale, basso], ml/min. */
  va: [number, number]
  /** Quota della ventilazione alveolare che va a zone non perfuse. */
  fDalv: number
  /** Ventilazione alveolare totale (oltre lo spazio morto anatomico), ml/min. */
  vaTotale: number
  /** Volume dei compartimenti ventilati, ml. */
  volume: [number, number]
  portata: number
  kd: number
  transito: number
}

function portataDi(s: StatoScambio, ing: IngressiScambio): number {
  const q = ing.portata ?? s.parametri.portata ?? 0.07 * ing.pesoKg
  return Math.max(0, q)
}

/**
 * Come è fatto il polmone adesso: quanta perfusione va dove, quanta
 * ventilazione arriva a chi.
 */
function struttura(s: StatoScambio, ing: IngressiScambio): Struttura {
  const par = s.parametri
  const f = ing.fisiologia
  const kg = Math.max(3, ing.pesoKg)
  const Q = portataDi(s, ing)
  const r = clamp(f.reclutabilita ?? 0, 0, 1)

  // ## Lo shunt dalle fette chiuse
  //
  // La perfusione segue la gravità (il dorso ne prende il doppio del davanti);
  // una fetta chiusa a fine espirazione è shunt. Quanto pesa dipende da quanto
  // polmone c'è da chiudere: poco nel sano (le atelettasie dell'anestesia),
  // molto nell'ARDS edematoso.
  const reg = regioni(f, ing.peepTotale, Math.max(ing.peepTotale, ing.pFine))
  let pesi = 0
  let chiuso = 0
  let sovra = 0
  reg.aperte.forEach((a, i) => {
    const w = 1 + (i + 0.5) / reg.aperte.length
    pesi += w
    chiuso += w * (1 - a)
    sovra += reg.quote[i] * (1 - reg.rese[i])
  })
  const shuntFette = (chiuso / pesi) * Math.min(1, 0.05 + 0.9 * r + 1.2 * r * r)
  const lesione = s.lesione
  const allarga = lesione < 0 ? 1 + lesione : 1
  // Due shunt: il polmone **chiuso** (fette collassate, atelettasie, il polmone
  // escluso nella monopolmonare), dove la vasocostrizione lavora; e quello
  // **consolidato** (shunt fisso, lesione tarata), dove lavora poco.
  let consolidato = clamp((par.shuntFisso + Math.max(0, lesione) * 0.5) * allarga, 0, 0.9)
  let collassato = clamp((shuntFette + 0.08 * (f.atelettasia ?? 0)) * allarga, 0, 0.9) * (1 - consolidato)
  if (f.monopolmonare) {
    const esclusa = f.monopolmonare === 'sinistro' ? 0.55 : 0.45
    collassato = esclusa + (1 - esclusa) * collassato
    consolidato = (1 - esclusa) * consolidato
  }
  const tot = consolidato + collassato
  if (tot > 0.92) {
    consolidato *= 0.92 / tot
    collassato *= 0.92 / tot
  }
  const shunt = consolidato + collassato
  const basso =
    clamp(
      (par.bassoVQ + Math.max(0, lesione) * 0.8 + 0.25 * (f.limitazioneFlusso ?? 0) + 0.3 * (f.secrezioni ?? 0)) * allarga,
      0,
      0.85,
    ) * (1 - shunt)
  const ideale = Math.max(0, 1 - shunt - basso)

  // ## Lo spazio morto alveolare
  //
  // L'embolia (quello che scrive la regia), le fette sovradistese che
  // schiacciano i capillari, e la portata bassa che lascia in alto alveoli
  // ventilati e non perfusi (la zona 1 di West, peggio con la pressione media alta).
  const qNorm = 0.07 * kg
  const bassaPortata = clamp(1 - Q / qNorm, 0, 1) * (0.25 + 0.01 * Math.max(0, ing.pMedia - 10))
  const fDalv = clamp(par.spazioMortoAlv + 0.6 * sovra + bassaPortata, 0, 0.9)

  const vaTotale = Math.max(0, ing.frequenza * Math.max(0, ing.vtMl - ing.vdMl))
  const perfusa = vaTotale * (1 - fDalv)
  const vaBasso = Math.min(perfusa * 0.5, VQ_BASSO * basso * Q * 1000)
  const vaIdeale = Math.max(0, perfusa - vaBasso)

  // ## La CFR: il serbatoio dell'apnea
  //
  // Trenta ml/kg in piedi, meno da supino; l'obeso ne perde un tre per cento
  // per punto di BMI sopra 25; la PEEP la gonfia (C·PEEP) e le fette chiuse
  // la svuotano.
  const obesita = clamp(1 - 0.03 * Math.max(0, par.bmi - 25), 0.35, 1)
  const cfr = Math.max(300, 25 * kg * obesita * (1 - 0.6 * (chiuso / pesi) * r) + (f.compliance || 50) * Math.max(0, ing.peepTotale))
  const quotaBasso = basso / Math.max(0.05, ideale + basso)

  // La diffusione: il tempo di transito si accorcia con la portata, finché i
  // capillari di riserva (fino al doppio) non si aprono.
  const vc = 75 * clamp(1 + 0.25 * (Q / qNorm - 1), 1, 1.6) * (kg / 70)
  const dl = 25 * par.diffusione * (kg / 70)
  const kd = dl / 60 / Math.max(1, vc)
  const transito = Q > 0.05 ? vc / ((Q * 1000) / 60) : 5

  return {
    q0: [ideale, basso, collassato, consolidato],
    va: [vaIdeale, vaBasso],
    fDalv,
    vaTotale,
    volume: [cfr * (1 - quotaBasso * 0.5), Math.max(50, cfr * quotaBasso * 0.5)],
    portata: Q,
    kd,
    transito,
  }
}

// ------------------------------------------- acido-base e sangue --

function acidoBase(s: StatoScambio, paco2: number): { hco3: number; ph: number; be: number } {
  const d = paco2 - 40
  const acuto = d > 0 ? 0.1 * d : 0.2 * d
  const hco3 = Math.max(2, s.parametri.hco3 + acuto + s.compenso - Math.max(0, s.lattato - 1))
  const ph = 6.1 + Math.log10(hco3 / (0.0307 * Math.max(5, paco2)))
  const be = 0.93 * (hco3 - 24.4 + 14.83 * (ph - 7.4))
  return { hco3, ph, be }
}

function sangueDi(s: StatoScambio, pco2: number): Sangue {
  const ab = acidoBase(s, pco2)
  return {
    hb: s.parametri.hb,
    ph: ab.ph,
    temperatura: s.parametri.temperatura,
    be: ab.be,
    pco2,
    cohb: s.parametri.cohb,
    methb: s.parametri.methb,
  }
}

function vo2Domanda(s: StatoScambio, kg: number): number {
  return VO2_ML_KG * kg * s.parametri.metabolismo * (1 + 0.1 * (s.parametri.temperatura - 37))
}

/** Lo stimolo della vasocostrizione: la PO₂ alveolare pesata con quella venosa (Marshall). */
function tonoVerso(pAlv: number, pv: number): number {
  const stimolo = Math.pow(Math.max(1, pAlv), 0.6) * Math.pow(Math.max(1, pv), 0.4)
  return 1 / (1 + Math.pow(stimolo / HPV_P50, 3))
}

function inibizioneHpv(s: StatoScambio, ing: IngressiScambio, ph: number): number {
  const alogenati = 0.5 * clamp(ing.mac - 1, 0, 1)
  const alcalosi = 0.3 * clamp((ph - 7.45) / 0.15, 0, 1)
  return 1 - (1 - alogenati) * (1 - clamp(s.parametri.inibizioneHpv, 0, 1)) * (1 - alcalosi)
}

/** Le perfusioni di adesso, dopo la vasocostrizione e l'NO (che dilata solo dove arriva gas). */
function perfusioni(s: StatoScambio, ing: IngressiScambio, st: Struttura, tono: number[], ph: number, q0: Quattro = s.q0 ?? st.q0): Quattro {
  const inib = inibizioneHpv(s, ing, ph)
  const no = 0.3 * clamp(s.parametri.noPpm / 10, 0, 1)
  const efficacia = [1, 1, 1, HPV_CONSOLIDAMENTO]
  const dilata = [1 - no, 1 - no / 2, 1, 1]
  const w = q0.map((q, i) => q / ((1 + HPV_K * tono[i] * efficacia[i] * (1 - inib)) * dilata[i]))
  const somma = w.reduce((a, b) => a + b, 0) || 1
  return w.map((x) => x / somma) as Quattro
}

function tonoAttuale(s: StatoScambio): number[] {
  return s.tonoRapido.map((t, i) => 0.7 * t + 0.3 * s.tonoLento[i])
}

// ------------------------------------------------------------ la CO₂ --

/**
 * Lo scambio di CO₂ fra tessuti e polmone, ml/min/mmHg: va con la portata, e
 * solo il sangue che passa dagli alveoli scarica (quello dello shunt torna
 * indietro com'era).
 */
function gCo2(Q: number, kg: number, shunt: number): number {
  return G_CO2 * (Q / (0.07 * kg)) * (kg / 70) * Math.max(0.05, 1 - shunt)
}

/**
 * La PaCO₂ arteriosa: il sangue di fine capillare (alla PACO₂) mescolato con
 * quello dello shunt (alla venosa mista). È la ragione per cui l'Enghoff,
 * che mette la PaCO₂ al posto della PACO₂, sovrastima lo spazio morto: poco
 * con lo shunt basso, molto sopra il 40% (Cipulli 2026). Mescolare le pressioni
 * invece dei contenuti va bene nel tratto quasi lineare della curva della CO₂.
 */
export function paco2Arteriosa(pAlv: number, pVen: number, shunt: number): number {
  return pAlv + clamp(shunt, 0, 1) * (pVen - pAlv)
}

/**
 * Quanta parte del gas di fine espirazione viene dagli alveoli che si
 * svuotano per ultimi, 0–0,85. Nell'ostruzione grave quegli alveoli restano
 * pieni (l'auto-PEEP è l'aria che non esce), la loro CO₂ va verso la venosa
 * mista e alla fine dell'espirazione esce quella: l'EtCO₂ supera la PaCO₂
 * (Cipulli 2026, caso 3: PEEPi 14, EtCO₂ 63 su PaCO₂ 57). Sotto i 2 cmH₂O
 * non c'è.
 */
export function quotaIntrappolata(autoPeep: number): number {
  return clamp((autoPeep - 2) / 14, 0, 0.85)
}

/**
 * Quanto il capnogramma perde il plateau, 0–1: nell'ostruzione la salita
 * della fase 2 si allunga e la fase 3 sale fino alla fine (la pinna di squalo).
 */
export function pendenzaCapnogramma(f: Pick<Fisiologia, 'resistenza' | 'limitazioneFlusso'>, autoPeep = 0): number {
  const r = clamp(((f.resistenza ?? 8) - 10) / 25, 0, 1)
  return clamp(Math.max(r, f.limitazioneFlusso ?? 0, quotaIntrappolata(autoPeep) / 0.85), 0, 1)
}

/** L'EtCO₂: il gas alveolare misto (con le zone non perfuse a zero) e la coda intrappolata. */
function etco2Di(pAlv: number, pVen: number, fDalv: number, intrappolata: number): number {
  return (1 - intrappolata) * pAlv * (1 - fDalv) + intrappolata * pVen
}

// ------------------------------------------------------- il passo --

interface Istante {
  pa: [number, number]
  pv: number
  ca: number
  cc: [number, number]
  q: Quattro
  vo2: number
  do2: number
  sangue: Sangue
}

function istante(s: StatoScambio, ing: IngressiScambio, st: Struttura): Istante {
  const sangue = sangueDi(s, s.pco2Sangue)
  const pi = s.parametri.pb - PH2O
  const pa: [number, number] = [s.fa[0] * pi, s.fa[1] * pi]
  const pv = po2DaContenuto(s.cv, sangue)
  const q = perfusioni(s, ing, st, tonoAttuale(s), sangue.ph)
  const cc: [number, number] = [0, 1].map((i) =>
    contenuto(fineCapillare(pa[i], pv, st.kd, st.transito, sangue), sangue),
  ) as [number, number]
  const ca = q[0] * cc[0] + q[1] * cc[1] + (q[2] + q[3]) * s.cv
  const kg = Math.max(3, ing.pesoKg)
  const do2 = st.portata * ca
  const domanda = vo2Domanda(s, kg)
  // Sotto il trasporto critico l'estrazione non tiene più (circa 70%).
  const vo2 = Math.min(domanda, do2 * 0.7)
  return { pa, pv, ca, cc, q, vo2, do2, sangue }
}

function passo(s: StatoScambio, ing: IngressiScambio, st: Struttura, dt: number): StatoScambio {
  const kg = Math.max(3, ing.pesoKg)
  const ist = istante(s, ing, st)
  const Q = st.portata
  const fi = ing.fio2
  const minuti = dt / 60

  // ## L'O₂ degli alveoli
  const respira = st.vaTotale > 1
  const fa: [number, number] = [s.fa[0], s.fa[1]]
  for (const i of [0, 1] as const) {
    const presa = Q * ist.q[i] * Math.max(0, ist.cc[i] - s.cv)
    // In apnea a vie aperte il gas entra per flusso di massa, quanto il sangue
    // se ne prende (meno la CO₂ che arriva): è l'ossigenazione apneica.
    const entra = respira ? st.va[i] * (fi - s.fa[i]) : ing.vieAperte ? 0.9 * presa * ing.fonteO2 : 0
    const netto = entra - presa
    fa[i] = clamp(s.fa[i] + (netto * minuti) / Math.max(50, st.volume[i]), 0, 1)
  }

  // ## Il sangue venoso: il serbatoio dell'O₂ del corpo
  const vv = 3.5 * (kg / 70)
  const cv = Math.max(0, s.cv + ((Q * (ist.ca - s.cv) - ist.vo2) * minuti) / vv)

  // ## La CO₂: tessuti → sangue → polmone
  const vco2 = QUOZIENTE_RESPIRATORIO * ist.vo2 * s.vco2Fattore
  const kT = CAP_CO2_TESSUTI * kg
  const kS = CAP_CO2_SANGUE * kg
  const G = gCo2(Q, kg, ist.q[2] + ist.q[3])
  const elimina = (st.vaTotale * (1 - st.fDalv) * s.pco2Sangue) / 863
  let pt = s.pco2Tessuti + ((vco2 - G * (s.pco2Tessuti - s.pco2Sangue)) * minuti) / kT
  let pb = s.pco2Sangue + ((G * (s.pco2Tessuti - s.pco2Sangue) - elimina) * minuti) / kS
  if (s.t < s.co2TiraFino && st.vaTotale > 1) {
    const eq = equilibrioCo2(s, st, ist.vo2, kg, ist.q[2] + ist.q[3])
    pb = segue(pb, eq.pa, dt, 20)
    pt = segue(pt, eq.pt, dt, 20)
  }
  pb = clamp(pb, 8, 150)
  pt = clamp(pt, 8, 160)

  // ## La vasocostrizione: due fasi
  const verso = [tonoVerso(ist.pa[0], ist.pv), tonoVerso(ist.pa[1], ist.pv), tonoVerso(ist.pv, ist.pv), tonoVerso(ist.pv, ist.pv)]
  const tonoRapido = s.tonoRapido.map((t, i) => segue(t, verso[i], dt, TAU_HPV_RAPIDO)) as Quattro
  const tonoLento = s.tonoLento.map((t, i) => segue(t, verso[i], dt, TAU_HPV_LENTO)) as Quattro

  // ## Acido-base: il rene (ore) e il lattato
  const compenso = segue(s.compenso, 0.25 * (paco2Arteriosa(pb, pt, ist.q[2] + ist.q[3]) - 40), dt, 8 * 3600)
  const domanda = vo2Domanda(s, kg)
  const debito = clamp((domanda - ist.vo2) / Math.max(1, domanda), 0, 1)
  const lattato = clamp(s.lattato + (3 * debito - (s.lattato - 1) / 60) * minuti, 0.5, 25)

  // ## Il saturimetro: insegue con il ritardo del circolo
  const sat = saturazione(po2DaContenuto(ist.ca, ist.sangue), ist.sangue) * 100
  const tauSensore = 10 * (1 + clamp(1 - Q / (0.07 * kg), 0, 1))
  const spo2Sensore = segue(s.spo2Sensore, letturaSaturimetro(sat, s.parametri), dt, tauSensore)

  return {
    ...s,
    t: s.t + dt,
    fa,
    cv,
    pco2Sangue: pb,
    pco2Tessuti: pt,
    tonoRapido,
    tonoLento,
    compenso,
    lattato,
    spo2Sensore,
    lesione: s.lesioneVerso,
    q0: (s.q0 ?? st.q0).map((q, i) => segue(q, st.q0[i], dt, TAU_PERFUSIONE)) as Quattro,
  }
}

/** Quello che il saturimetro legge: la CO conta come O₂, la metaemoglobina tira verso 85. */
function letturaSaturimetro(satFunzionale: number, p: ParametriScambio): number {
  const conCo = satFunzionale + (100 - satFunzionale) * clamp(p.cohb, 0, 0.6) * 0.9
  const m = clamp(p.methb / 0.35, 0, 1)
  return conCo * (1 - m) + 85 * m
}

function equilibrioCo2(s: StatoScambio, st: Struttura, vo2: number, kg: number, shunt: number): { pa: number; pt: number } {
  const vco2 = QUOZIENTE_RESPIRATORIO * vo2 * s.vco2Fattore
  const vaPerf = st.vaTotale * (1 - st.fDalv)
  const pa = vaPerf > 1 ? clamp((863 * vco2) / vaPerf, 8, 150) : s.pco2Sangue
  return { pa, pt: pa + vco2 / Math.max(1, gCo2(st.portata, kg, shunt)) }
}

/** Lo shunt della struttura, prima della vasocostrizione (per i conti di regime). */
const shuntDi = (st: Struttura) => st.q0[2] + st.q0[3]

// ------------------------------------------------- il regime e la taratura --

/**
 * Lo stato di equilibrio con questi ingressi: FAO₂ e contenuto venoso che non
 * cambiano più, tono della vasocostrizione al suo valore di regime, CO₂ dei
 * depositi in pari. Serve alla taratura e all'apertura.
 */
export function regime(s: StatoScambio, ing: IngressiScambio): StatoScambio {
  const kg = Math.max(3, ing.pesoKg)
  const st = struttura(s, ing)
  const Q = Math.max(0.3, st.portata)
  const pi = s.parametri.pb - PH2O
  let x: StatoScambio = { ...s }
  // la CO₂ prima: la curva dell'O₂ dipende dal pH
  const eqC = equilibrioCo2(x, st, vo2Domanda(x, kg), kg, shuntDi(st))
  if (st.vaTotale > 1) x = { ...x, pco2Sangue: eqC.pa, pco2Tessuti: eqC.pt }
  let cv = x.cv > 0 ? x.cv : contenuto(40, sangueDi(x, x.pco2Sangue))
  let tono = [...tonoAttuale(x)] as Quattro
  let fa: [number, number] = [x.fa[0], x.fa[1]]
  for (let giro = 0; giro < 14; giro++) {
    const sangue = sangueDi(x, x.pco2Sangue)
    const pv = po2DaContenuto(cv, sangue)
    const q = perfusioni(x, ing, st, tono, sangue.ph, st.q0)
    const cc: number[] = []
    for (const i of [0, 1] as const) {
      const va = st.va[i]
      const qi = Q * q[i]
      if (va < 1 || qi < 1e-4) {
        fa[i] = st.vaTotale > 1 ? ing.fio2 : fa[i]
        cc[i] = contenuto(fineCapillare(fa[i] * pi, pv, st.kd, st.transito, sangue), sangue)
        continue
      }
      let lo = 0
      let hi = ing.fio2
      for (let k = 0; k < 30; k++) {
        const m = (lo + hi) / 2
        const c = contenuto(fineCapillare(m * pi, pv, st.kd, st.transito, sangue), sangue)
        const bilancio = va * (ing.fio2 - m) - qi * (c - cv)
        if (bilancio > 0) lo = m
        else hi = m
      }
      fa[i] = (lo + hi) / 2
      cc[i] = contenuto(fineCapillare(fa[i] * pi, pv, st.kd, st.transito, sangue), sangue)
    }
    const ca = q[0] * cc[0] + q[1] * cc[1] + (q[2] + q[3]) * cv
    const vo2 = Math.min(vo2Domanda(x, kg), Q * ca * 0.7)
    cv = 0.5 * cv + 0.5 * Math.max(1, ca - vo2 / Q)
    const pvNuovo = po2DaContenuto(cv, sangue)
    tono = [tonoVerso(fa[0] * pi, pvNuovo), tonoVerso(fa[1] * pi, pvNuovo), tonoVerso(pvNuovo, pvNuovo), tonoVerso(pvNuovo, pvNuovo)]
  }
  const sangue = sangueDi(x, x.pco2Sangue)
  const q = perfusioni(x, ing, st, tono, sangue.ph, st.q0)
  const pv = po2DaContenuto(cv, sangue)
  const cc = [0, 1].map((i) => contenuto(fineCapillare(fa[i] * pi, pv, st.kd, st.transito, sangue), sangue))
  const ca = q[0] * cc[0] + q[1] * cc[1] + (q[2] + q[3]) * cv
  const sat = saturazione(po2DaContenuto(ca, sangue), sangue) * 100
  return {
    ...x,
    fa,
    cv,
    tonoRapido: tono,
    tonoLento: [...tono] as Quattro,
    q0: [...st.q0] as Quattro,
    spo2Sensore: letturaSaturimetro(sat, x.parametri),
  }
}

/** La lesione che dà quella SpO₂ a regime, fra −1 (meno di quello che il polmone ha) e 4. */
function lesionePer(s: StatoScambio, ing: IngressiScambio, spo2: number): { lesione: number; limite: boolean } {
  const prova = (l: number) => regime({ ...s, lesione: l, lesioneVerso: l }, ing).spo2Sensore
  let lo = -1
  let hi = 4
  if (prova(lo) < spo2) return { lesione: lo, limite: true }
  if (prova(hi) > spo2) return { lesione: hi, limite: true }
  for (let i = 0; i < 22; i++) {
    const m = (lo + hi) / 2
    if (prova(m) > spo2) lo = m
    else hi = m
  }
  return { lesione: (lo + hi) / 2, limite: false }
}

/** Il fattore della VCO₂ che dà quell'EtCO₂ a regime. */
function vco2Per(s: StatoScambio, ing: IngressiScambio, etco2: number): number | null {
  const st = struttura(s, ing)
  const vaPerf = st.vaTotale * (1 - st.fDalv)
  if (vaPerf < 50) return null
  const kg = Math.max(3, ing.pesoKg)
  // L'EtCO₂ è lineare nella VCO₂: PACO₂ = 863·VCO₂/VA, venosa = PACO₂ + VCO₂/G.
  const w = quotaIntrappolata(ing.autoPeep ?? 0)
  const perUnita = (1 - w) * (1 - st.fDalv) * (863 / vaPerf) + w * (863 / vaPerf + 1 / Math.max(1, gCo2(st.portata, kg, shuntDi(st))))
  const vco2 = etco2 / perUnita
  return clamp(vco2 / Math.max(1, QUOZIENTE_RESPIRATORIO * vo2Domanda(s, kg)), 0.2, 5)
}

/** Lo stato nuovo, a regime con questi ingressi e tarato sui bersagli. */
export function scambioIniziale(ing: IngressiScambio, parametri: ParametriScambio = PARAMETRI_SCAMBIO): StatoScambio {
  const base: StatoScambio = {
    parametri,
    t: 0,
    pco2Sangue: 40,
    pco2Tessuti: 46,
    fa: [0.15, 0.08],
    cv: 0,
    tonoRapido: [0.15, 0.3, 0.4, 0.4],
    tonoLento: [0.15, 0.3, 0.4, 0.4],
    compenso: 0,
    lattato: 1,
    spo2Sensore: 97,
    lesione: 0,
    lesioneVerso: 0,
    vco2Fattore: 1,
    co2TiraFino: 0,
    bersagli: { spo2: null, etco2: null },
    taraturaAlLimite: false,
  }
  let s = base
  if (ing.etco2Bersaglio !== null) {
    const f = vco2Per(s, ing, ing.etco2Bersaglio)
    if (f !== null) s = { ...s, vco2Fattore: f }
  }
  if (ing.spo2Bersaglio !== null) {
    const l = lesionePer(s, ing, ing.spo2Bersaglio)
    s = { ...s, lesione: l.lesione, lesioneVerso: l.lesione, taraturaAlLimite: l.limite }
  }
  s = regime(s, ing)
  return { ...s, bersagli: { spo2: ing.spo2Bersaglio, etco2: ing.etco2Bersaglio } }
}

/**
 * Un passo avanti di `dtSec`. Se un bersaglio scritto è cambiato si ritara:
 * la lesione nuova passa al polmone in una quindicina di secondi, i depositi di
 * CO₂ vengono tirati verso il nuovo equilibrio per un minuto.
 */
export function avanzaScambio(s: StatoScambio, ing: IngressiScambio, dtSec: number): StatoScambio {
  let x = s
  if (ing.spo2Bersaglio !== x.bersagli.spo2 && ing.spo2Bersaglio !== null) {
    const l = lesionePer(x, ing, ing.spo2Bersaglio)
    x = { ...x, lesioneVerso: l.lesione, taraturaAlLimite: l.limite, o2TiraFino: x.t + 45 }
  }
  if (ing.etco2Bersaglio !== x.bersagli.etco2 && ing.etco2Bersaglio !== null) {
    const f = vco2Per(x, ing, ing.etco2Bersaglio)
    if (f !== null) x = { ...x, vco2Fattore: f, co2TiraFino: x.t + 60 }
  }
  x = { ...x, bersagli: { spo2: ing.spo2Bersaglio, etco2: ing.etco2Bersaglio } }
  if (!(dtSec > 0)) return x
  const st = struttura(x, ing)
  const n = Math.max(1, Math.ceil(dtSec / PASSO_INTERNO))
  for (let i = 0; i < n; i++) x = passo(x, ing, st, dtSec / n)
  if ((x.o2TiraFino ?? 0) > x.t) {
    const eq = regime({ ...x, lesione: x.lesioneVerso }, ing)
    const tira = (a: number, b: number) => segue(a, b, dtSec, 8)
    x = {
      ...x,
      cv: tira(x.cv, eq.cv),
      fa: [tira(x.fa[0], eq.fa[0]), tira(x.fa[1], eq.fa[1])],
      q0: eq.q0 && x.q0 ? (x.q0.map((q, i) => tira(q, eq.q0![i])) as Quattro) : x.q0,
      tonoRapido: x.tonoRapido.map((t, i) => tira(t, eq.tonoRapido[i])) as Quattro,
      tonoLento: x.tonoLento.map((t, i) => tira(t, eq.tonoLento[i])) as Quattro,
    }
  }
  return x
}

// ------------------------------------------------------- la lettura --

export function letturaScambio(s: StatoScambio, ing: IngressiScambio): LetturaScambio {
  const st = struttura(s, ing)
  const ist = istante(s, ing, st)
  const kg = Math.max(3, ing.pesoKg)
  const pao2 = po2DaContenuto(ist.ca, ist.sangue)
  const shunt = ist.q[2] + ist.q[3]
  const pAco2 = s.pco2Sangue
  const paco2 = paco2Arteriosa(pAco2, s.pco2Tessuti, shunt)
  const ab = acidoBase(s, paco2)
  const pi = s.parametri.pb - PH2O
  // L'equazione dei gas alveolari completa: PAO₂ = PiO₂ − PaCO₂·[FiO₂ + (1 − FiO₂)/R].
  const pAlvEquazione = ing.fio2 * pi - paco2 * (ing.fio2 + (1 - ing.fio2) / QUOZIENTE_RESPIRATORIO)
  const respira = st.vaTotale > 1
  const etco2 = respira ? etco2Di(pAco2, s.pco2Tessuti, st.fDalv, quotaIntrappolata(ing.autoPeep ?? 0)) : 0
  const ve = ing.veMlMin
  // La PECO₂: tutta la CO₂ eliminata, diluita nel volume minuto espirato.
  const peco2 = ve > 1 ? (st.vaTotale * (1 - st.fDalv) * pAco2) / ve : 0
  const conCo2 = respira && ve > 1 && paco2 > 1
  const vdAlveolare = conCo2 ? (paco2 - etco2) / paco2 : null
  const vdFisiologico = conCo2 ? (paco2 - peco2) / paco2 : null
  const vdvt = vdFisiologico
  const tono = tonoAttuale(s)
  // ## L'apnea sicura: quanto O₂ c'è nei due serbatoi sopra il 90%
  const sangue = ist.sangue
  const p90 = 60
  const cfr = st.volume[0] + st.volume[1]
  const o2Alv = Math.max(0, ((s.fa[0] * st.volume[0] + s.fa[1] * st.volume[1]) - (p90 / pi) * cfr) * 0.85)
  const vv = 3.5 * (kg / 70)
  const o2Ven = Math.max(0, (s.cv - contenuto(30, sangue)) * vv)
  const apneaSicuraMin = clamp((o2Alv + o2Ven * 0.5) / Math.max(1, ist.vo2), 0, 60)
  return {
    pao2,
    paco2,
    ph: ab.ph,
    hco3: ab.hco3,
    be: ab.be,
    sao2: saturazione(pao2, sangue) * 100,
    spo2: s.spo2Sensore,
    svo2: saturazione(ist.pv, sangue) * 100,
    pvo2: ist.pv,
    pvco2: s.pco2Tessuti,
    pAco2,
    peco2,
    etco2,
    gradienteCo2: conCo2 ? paco2 - etco2 : null,
    rapportoEtPa: conCo2 ? etco2 / paco2 : null,
    vdAlveolare,
    vdFisiologico,
    vdAnatomico: vdFisiologico !== null && vdAlveolare !== null ? vdFisiologico - vdAlveolare : null,
    vdAlveolareVero: conCo2 && pAco2 > 1 ? (pAco2 - etco2) / pAco2 : null,
    lattato: s.lattato,
    pf: pao2 / Math.max(0.21, ing.fio2),
    aa: Math.max(0, pAlvEquazione - pao2),
    oi: ing.pMedia > 0 ? (ing.pMedia * ing.fio2 * 100) / Math.max(1, pao2) : null,
    qsqt: ist.q[2] + ist.q[3],
    vdvt,
    // Rapporto ventilatorio, VE·PaCO₂/(100·kg·37,5): sopra 1 inefficienza, sopra 2
    // mortalità più alta nell'ARDS (Cipulli 2026). Il peso è quello del paziente.
    rapportoVentilatorio: ve > 1 ? (ve * paco2) / (kg * 100 * 37.5) : null,
    ventilazioneStandardizzata: ve > 1 ? (ve / 1000) * (paco2 / 40) : null,
    do2: ist.do2,
    vo2: ist.vo2,
    hb: s.parametri.hb,
    cohb: s.parametri.cohb,
    methb: s.parametri.methb,
    fio2: ing.fio2,
    apneaSicuraMin,
    tono: (tono[0] + tono[1] + tono[2] + tono[3]) / 4,
    taraturaAlLimite: s.taraturaAlLimite,
  }
}

// ------------------------------------------------- l'isteresi --

/**
 * La memoria del reclutamento, un passo avanti.
 *
 * Sale subito a quello che apre il polmone (la PEEP, il reclutamento
 * sostenuto); scende solo se la PEEP va sotto la memoria di più
 * dell'isteresi, e allora in un paio di minuti verso la pressione di chiusura.
 * Staccato dalla macchina il polmone si richiude. Con la FiO₂ sopra 0,8 e la
 * PEEP bassa le zone poco ventilate si svuotano d'azoto e collassano
 * (atelettasie da assorbimento): le riapre il reclutamento.
 */
export function avanzaIsteresi(
  s: StatoIsteresi | null | undefined,
  peep: number,
  fio2: number,
  reclutamento: boolean,
  scollegato: boolean,
  dtSec: number,
): StatoIsteresi {
  let m = s?.peepMemoria ?? peep
  let a = s?.atelettasia ?? 0
  if (scollegato) return { peepMemoria: 0, atelettasia: a }
  if (reclutamento) {
    m = Math.max(m, MEMORIA_RECLUTAMENTO)
    a = 0
  }
  if (peep >= m) m = peep
  else if (peep < m - ISTERESI_CMH2O) m = segue(m, peep + ISTERESI_CMH2O, dtSec, TAU_CHIUSURA)
  if (fio2 > 0.8 && !reclutamento) {
    const spinta = ((fio2 - 0.8) / 0.2) * clamp(1 - peep / 10, 0, 1)
    a = clamp(a + (spinta * dtSec) / 600, 0, 1)
  } else if (fio2 < 0.6) {
    a = segue(a, 0, dtSec, 1800)
  }
  return { peepMemoria: Math.round(m * 100) / 100, atelettasia: Math.round(a * 1000) / 1000 }
}

// ------------------------------------------ gli ingressi dal ventilatore --

/**
 * Quello che il ventilatore sa del respiro, per lo scambio.
 *
 * Il volume e la frequenza sono quelli che il display ha appena scritto (gli
 * atti erogati); senza macchina — staccato, alto flusso — quelli del respiro
 * spontaneo del paziente.
 */
export function ingressiDaVentilatore(
  stato: StatoVentilatore,
  misure: Misure,
  bersagli: { spo2: number | null; etco2: number | null },
  portata: number | null = null,
): IngressiScambio {
  const i = ingressiGrezzi(stato, misure, bersagli, portata)
  return { ...i, vaTotaleStimata: Math.max(0, i.frequenza * Math.max(0, i.vtMl - i.vdMl)) }
}

function ingressiGrezzi(
  stato: StatoVentilatore,
  misure: Misure,
  bersagli: { spo2: number | null; etco2: number | null },
  portata: number | null = null,
): Omit<IngressiScambio, 'vaTotaleStimata'> {
  const kg = stato.paziente.pesoKg && stato.paziente.pesoKg > 0 ? stato.paziente.pesoKg : 70
  const imp = stato.impostazioni
  const drive = driveEfficace(stato.drive)
  // Il respiro libero, senza una macchina che spinge: sette ml/kg allo sforzo
  // ordinario, di più o di meno con lo sforzo (fra 4,5 e 10 ml/kg). Non dalla
  // compliance: chi respira da solo regola il corrente col drive, e la
  // compliance del ventilato (quella del preset) lo farebbe crollare.
  // (`volumeSpontaneo` è l'atto supportato, e da staccato faceva iperventilare.)
  const spontaneo = drive.frequenza > 0 ? kg * 7 * clamp(drive.intensita / 0.7, 0.65, 1.4) : 0
  const comune = {
    pesoKg: kg,
    fisiologia: stato.fisiologia,
    mac: misure.mac ?? 0,
    portata,
    spo2Bersaglio: bersagli.spo2,
    etco2Bersaglio: bersagli.etco2,
    reclutamento: stato.manovra === 'reclutamento',
  }
  // ## Staccato dalla macchina: aria, vie aperte, polmone che si richiude
  // (anche col circuito aperto verso la stanza, dove l'host lo sa: `staccato`)
  if (!stato.ventilando || (stato as { staccato?: boolean }).staccato === true) {
    return {
      ...comune,
      fio2: 0.21,
      veMlMin: drive.frequenza * spontaneo,
      vtMl: spontaneo,
      frequenza: drive.frequenza,
      vdMl: 2.2 * kg,
      vieAperte: true,
      fonteO2: 0.21,
      peepTotale: 0,
      pFine: 0,
      pMedia: 0,
      reclutamento: false,
      scollegato: true,
    }
  }
  if (stato.ambiente === 'alto-flusso') {
    const fgf = imp.fgf
    const ve = drive.frequenza * spontaneo
    // Il picco inspiratorio del paziente: circa cinque volte il volume minuto.
    const picco = Math.max(1, (ve / 1000) * 5)
    const set = imp.fio2 / 100
    const fio2 = fgf >= picco ? set : (fgf * set + (picco - fgf) * 0.21) / picco
    const lavaggio = 0.7 * kg * clamp((fgf - 30) / 30, 0, 1)
    const peep = 0.07 * fgf
    return {
      ...comune,
      fio2,
      veMlMin: ve,
      vtMl: spontaneo,
      frequenza: drive.frequenza,
      vdMl: Math.max(0.8 * kg, 2.2 * kg - lavaggio),
      vieAperte: true,
      fonteO2: set,
      peepTotale: peep,
      pFine: peep + 2,
      pMedia: peep,
      scollegato: false,
    }
  }
  const manuale = stato.ambiente === 'anestesia' && stato.respiro === 'manuale'
  const f = manuale ? drive.frequenza : (misure.measuredFrequency ?? 0)
  const vt = manuale ? spontaneo : (misure.volumeExpired ?? 0)
  const intubato = stato.ambiente === 'invasiva' || stato.ambiente === 'anestesia'
  const strumentale =
    stato.ambiente === 'anestesia' ? 40 : stato.ambiente === 'niv' ? 60 : stato.circuito === 'hme' ? 50 : 10
  const intrinseca = manuale ? 0 : autoPeep(stato)
  const peepTot = imp.peep + intrinseca
  return {
    ...comune,
    autoPeep: intrinseca,
    fio2: imp.fio2 / 100,
    veMlMin: f * vt,
    vtMl: vt,
    frequenza: f,
    vdMl: (intubato ? 1.1 : 2.2) * kg + strumentale,
    vieAperte: true,
    fonteO2: imp.fio2 / 100,
    peepTotale: manuale ? Math.max(0, (imp.apl ?? 0) * 0.3) : peepTot,
    pFine: misure.pPlateau ?? misure.pPeak ?? peepTot,
    pMedia: misure.pMean ?? peepTot,
    scollegato: false,
  }
}
