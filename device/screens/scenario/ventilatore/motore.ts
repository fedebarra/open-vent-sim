/**
 * Il motore: l'equazione del moto, integrata davvero.
 *
 * ## Perché un motore e non un disegno
 *
 * Fino alla 3.1 le curve erano **disegnate**: un'esponenziale per l'espirazione,
 * un tracciato registrato riscalato per la pressione controllata, e le
 * asincronie come figure appoggiate sopra (`onde.ts`). Il confronto con il
 * simulatore di Piraino (sim.rtmaven.com, rivisto da Bellani) ha mostrato dove
 * il disegno non basta: lì le cose **succedono** — l'auto-PEEP si accumula da
 * un atto all'altro, lo sforzo inefficace è uno sforzo vero che non arriva al
 * trigger, il doppio trigger è uno sforzo più lungo del tempo inspiratorio
 * della macchina. Qui si fa lo stesso, con un modello a un compartimento:
 *
 * > **Paw − Palv = R · V̇**,  **Palv = PEEP + V/C − Pmus**
 *
 * con `V` il volume sopra la capacità funzionale alla PEEP impostata. Ogni
 * modalità dice soltanto **chi impone che cosa**: in volume la macchina impone
 * il flusso e la pressione ne discende; in pressione impone la Paw e il flusso
 * ne discende; in PAV la Paw è proporzionale allo sforzo.
 *
 * ## Una funzione pura del tempo, lo stesso
 *
 * La regia produce l'istantanea e ogni schermo disegna da lì: due
 * schermi con lo stesso stato e lo stesso istante devono disegnare lo stesso
 * punto. Un integratore ha una storia, e la storia dipende da dove si comincia.
 * Si comincia quindi sempre dallo stesso posto: il tempo è diviso in **blocchi**
 * di `BLOCCO_SEC`, e ogni blocco si calcola partendo `CALDO_SEC` prima, a
 * polmone vuoto. In quaranta secondi qualunque polmone di questo modello ha
 * dimenticato da dove è partito, e il blocco dopo — partito quaranta secondi
 * prima del suo inizio — arriva allo stesso punto. Il blocco si tiene in una
 * piccola memoria, per stato: lo stesso stato chiesto mille volte si calcola
 * una volta.
 *
 * ## Che cosa resta fuori
 *
 * Un compartimento: niente pendelluft, niente costanti di tempo regionali. La
 * pressione esofagea è quella della parete (`V/Ccw − Pmus`), senza l'artefatto
 * mediastinico — lo stesso limite dichiarato dal simulatore di riferimento.
 */

import { estrazione, rumore } from './caso'
import {
  PMUSC_MASSIMA,
  attoAsincrono,
  driveEfficace,
  durataSforzoSec,
  quotaEfficace,
  type TipoAsincronia,
} from './asincronie'
import type { StatoVentilatore } from './fisica'

/** Il passo d'integrazione, in secondi: 200 Hz. */
export const PASSO = 0.005
/** Quanto è lungo un blocco, in secondi. */
export const BLOCCO_SEC = 20
/** Quanto prima del blocco si comincia, perché il polmone dimentichi da dove. */
export const CALDO_SEC = 40

/**
 * La resistenza del circuito quando il paziente tira **dal flusso continuo**,
 * cmH₂O/(l/s): col trigger a flusso la macchina tiene la PEEP con il bias flow,
 * e uno sforzo la scava di poco.
 */
const R_FLUSSO_CONTINUO = 1
/** La resistenza della valvola espiratoria, cmH₂O/(l/s). */
const R_VALVOLA = 0.3
/**
 * Il tempo minimo d'espirazione prima che il trigger possa riaprire, in secondi.
 * È il periodo refrattario della macchina: più corto, e ogni coda di sforzo
 * diventerebbe un secondo atto.
 */
const REFRATTARIO = 0.25
/**
 * Il ritardo del trigger, in secondi: fra l'istante in cui il flusso passa la
 * soglia e quello in cui la valvola apre. In quei cinquanta millisecondi il
 * paziente tira contro un circuito che non gli dà ancora niente, ed è la
 * piccola **tacca negativa** della Paw all'inizio di ogni atto assistito.
 */
const RITARDO_TRIGGER = 0.05
/** La resistenza che il paziente sente mentre la valvola non ha ancora aperto. */
const R_IN_ATTESA = 8
/**
 * La resistenza del circuito **chiuso**: quando il trigger non può aprire — in
 * controllata, o per lo sforzo inefficace — al paziente arriva solo il bias
 * flow, e tirando scava la Paw invece di prendersi aria. È la firma dello
 * sforzo perso: una tacca piccola sul flusso, una più netta sulla pressione.
 */
const R_CHIUSO = 50
/**
 * Quanto ci mette la valvola espiratoria a portare la Paw alla PEEP, in
 * secondi. Una macchina vera non stacca in un istante: la pressione scende in
 * una rampa di qualche decina di millisecondi, e la curva resta continua.
 */
const RAMPA_VALVOLA = 0.025
/** E non più in fretta di così, in cmH₂O/s: da una pressione alta ci mette di più. */
const PENDENZA_VALVOLA = 350
/** In pressione di supporto un atto non dura più di così: il ciclaggio di sicurezza. */
const TI_MASSIMO_PS = 3
/** Sopra la pressione bersaglio di tanto, la macchina cicla: il paziente spinge. */
const CICLAGGIO_PRESSIONE = 3
/**
 * il colpo di tosse, in secondi: la spinta sale in tre centesimi, tiene, poi molla. E quanto spinge, cmH₂O.
 */
const COLPO_DI_TOSSE = { salita: 0.03, tenuta: 0.12, discesa: 0.14 }
const TOSSE_PMUS = 80
/**
 * oltre la soglia la tosse è in corso (Pmus negativa sotto questo valore, cmH₂O): la macchina che arriva al
 * limite della pressione di picco taglia l'atto, e il ramo espiratorio diventa turbolento.
 */
const TOSSE_IN_CORSO = -5
/**
 * la resistenza turbolenta del ramo espiratorio e della valvola ai flussi della tosse, cmH₂O/(l/s)² (Rohrer:
 * ΔP = K₁·V̇ + K₂·V̇²). Ai flussi del respiro non conta; a due litri e mezzo al secondo fa trenta centimetri: è per
 * questo che la tosse, anche in espirazione, fa suonare l'allarme di pressione.
 */
const K_TURBOLENTO = 8
/**
 * arrivata al limite la valvola di sicurezza apre, ma non in un istante: la Paw passa il limite di poco.
 */
const SFORO_LIMITE = 1.5
/** Il flusso massimo della turbina, l/s: oltre, con una perdita grande, la pressione non arriva. */
const FLUSSO_MASSIMO = 3
/**
 * Quanto della perdita la compensazione **non** toglie, in inspirazione: il
 * flusso che la macchina crede del paziente e che il paziente non ha preso.
 */
const RESIDUO_PERDITA_INSP = 0.2

/** Un istante del motore. Flusso in l/min (positivo in inspirazione), volumi in ml. */
export interface CampioneMotore {
  paw: number
  flusso: number
  /** Il volume come lo mostra il ventilatore: integrato dall'inizio dell'atto. */
  volume: number
  /** Il volume del polmone sopra la capacità funzionale alla PEEP impostata. */
  vPolmone: number
  palv: number
  pmus: number
  pes: number
  pl: number
  /** 0 inspirazione, 1 pausa, 2 espirazione. */
  fase: number
  /** Dentro lo sforzo che ha fatto partire l'atto: il tratto che si colora. */
  inTrigger: boolean
}

/** Un atto erogato: quello che il display misura. */
export interface AttoMotore {
  inizio: number
  fine: number
  innescato: boolean
  vti: number
  vte: number
  pip: number
  /** Pressione a fine pausa, se la pausa c'era. */
  pplat: number | null
  /** La pressione alveolare a fine espirazione: la PEEP totale vera. */
  peepTotale: number
  /** La pressione alveolare a fine inspirazione, senza lo sforzo: il plateau statico. */
  palvFineInsp: number
  /** Quando la macchina è passata a espirare. */
  fineInsp: number
  /** Il gas uscito dalla perdita della maschera durante l'atto, ml; e solo in inspirazione. */
  vPerso: number
  vPersoInsp: number
  /**
   * La P0.1 dello sforzo che ha aperto l'atto, cmH₂O: la Pmus cento
   * millisecondi dopo l'inizio. Null se l'atto l'ha fatto partire la macchina.
   */
  p01: number | null
  /**
   * Lo stress index dell'atto (Ranieri 2000): l'esponente `b` di
   * `Paw = a·tᵇ + c` sul tratto a flusso costante. Uno è il polmone lineare,
   * sotto 0,9 si recluta a ogni atto, sopra 1,1 si sovradistende. Solo in
   * volume a flusso quadro e senza sforzo; null altrimenti.
   */
  stressIndex: number | null
  /**
   * A fine espirazione le vie aeree erano **chiuse** (pressione di apertura
   * sopra la PEEP): la pausa espiratoria non vede gli alveoli e misura la PEEP.
   */
  vieChiuse: boolean
  /** la pressione più alta di tutto l'atto, espirazione compresa: la tosse. */
  pMax: number
  /** la macchina ha tagliato l'atto al limite della pressione di picco. */
  limitato: boolean
}

/** Uno sforzo del paziente: salita, tenuta, discesa. Ampiezza negativa = espirio attivo. */
interface Sforzo {
  t0: number
  salita: number
  tenuta: number
  discesa: number
  ampiezza: number
  /** Questo sforzo non deve far partire niente: lo sforzo inefficace chiesto dalla regia. */
  muto: boolean
  /**
   * Questo sforzo apre il trigger anche in controllata. Sono quelli che la regia
   * mette per un doppio trigger o per la fame di flusso: in assistita-controllata
   * vera il trigger è sempre aperto, qui lo è per loro (vedi `triggerControllata`).
   */
  apre?: boolean
}

/** Le scelte del motore, ricavate dallo stato una volta per blocco. */
interface Parametri {
  modalita: StatoVentilatore['modalita']
  C: number
  R: number
  Ccw: number
  peep: number
  /** Pressione critica di chiusura delle vie aeree (cmH₂O assoluti), 0 se non c'è. */
  pCrit: number
  Ttot: number
  Ti: number
  Tif: number
  Tip: number
  vt: number
  motrice: number
  ps: number
  salita: number
  ciclaggio: number
  trigger: number
  /** Il trigger è aperto anche negli atti controllati (assistita-controllata). */
  triggerControllata: boolean
  psSimv: number
  pavGuadagno: number
  pavMax: number
  pesBase: number
  /** Pressione di apertura delle vie aeree (cmH₂O assoluti), 0 se non c'è. */
  aop: number
  /** Il freno espiratorio della glottide, 0–1 (`sforzoEspiratorio`). */
  freno: number
  /** Il volume controllato a flusso decelerante. */
  decelerante: boolean
  /** La perdita della maschera: l/s per √cmH₂O, 0 se non c'è. */
  perdita: number
  /** Il ritorno elastico: `Palv − PEEP = E1·V + E2·V²` fino a `vTetto`, poi lineare. */
  E1: number
  E2: number
  vTetto: number
  cardio: { ampiezza: number; frequenza: number }
  /** Dopo quanto senza atti entra il backup, in PS, CPAP e PAV. */
  apnea: number
  sighOgni: number
  sighMotrice: number
  sighTi: number
  sforzi: Sforzo[]
  autoTrigger: number[]
  /** il limite alto della pressione di picco: lì la macchina, se il paziente tossisce, smette di spingere. */
  pMax: number
}

/**
 * Lo spostamento degli indici d'atto per la scelta delle asincronie. Il
 * riscaldamento del primo blocco cade a tempi negativi, dove `attoAsincrono`
 * non sceglie niente: senza spostamento la prima misura della sessione non
 * vedrebbe l'asincronia che la regia ha chiesto.
 */
const SPOSTA_INDICE = 100000

/** Il gradino liscio: zero pendenza ai due capi, come la Pmus delle registrazioni. */
function liscio(u: number): number {
  if (u <= 0) return 0
  if (u >= 1) return 1
  return u * u * (3 - 2 * u)
}

/**
 * Come sale lo sforzo: in fretta all'inizio e poi a rallentare, come la Pes
 * delle registrazioni. Non parte piatto — un gradino liscio darebbe una P0.1
 * di pochi decimi, e il drive non si leggerebbe — ma la pendenza a metà è
 * metà di quella iniziale, e la cima arriva senza spigolo.
 */
function salitaSforzo(u: number): number {
  if (u <= 0) return 0
  if (u >= 1) return 1
  return 1 - Math.pow(1 - u, 1.7)
}

/** La forma di uno sforzo a `u` secondi dall'inizio, da 0 a 1. */
function formaA(s: Sforzo, u: number): number {
  if (u <= 0 || u >= s.salita + s.tenuta + s.discesa) return 0
  if (u < s.salita) return salitaSforzo(u / Math.max(1e-3, s.salita))
  if (u < s.salita + s.tenuta) return 1
  return 1 - liscio((u - s.salita - s.tenuta) / Math.max(1e-3, s.discesa))
}

/** La perdita cambia: la maschera si sposta, il paziente gira la testa. ±25%, lenta. */
function fluttua(t: number): number {
  return 1 + 0.25 * rumore(4242, t, 0.3)
}

/**
 * La pressione che la macchina riesce a tenere con la perdita aperta: se il
 * flusso che serve — al paziente più alla perdita — supera quello della
 * turbina, la Paw scende finché i conti tornano. Bisezione fra la pressione
 * alveolare (flusso al paziente nullo) e quella chiesta.
 */
function pressioneConPerdita(chiesta: number, palv: number, R: number, k: number): number {
  const serve = (p: number) => Math.max(0, (p - palv) / R) + k * Math.sqrt(Math.max(0, p))
  if (serve(chiesta) <= FLUSSO_MASSIMO) return chiesta
  let a = Math.min(palv, chiesta)
  let b = chiesta
  for (let i = 0; i < 30; i++) {
    const m = (a + b) / 2
    if (serve(m) > FLUSSO_MASSIMO) b = m
    else a = m
  }
  return a
}

/** Una gaussiana standard fissa per quell'atto: Box–Muller su due estrazioni. */
function gauss(seme: number, k: number): number {
  const u1 = Math.max(1e-9, estrazione(seme, k))
  const u2 = estrazione(seme + 101, k)
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function pmusDi(sforzi: Sforzo[], t: number, da: { i: number }): { valore: number; attivo: Sforzo | null } {
  // Gli sforzi sono in ordine: si avanza il primo indice utile e si guarda avanti poco.
  while (da.i < sforzi.length) {
    const s = sforzi[da.i]
    if (s.t0 + s.salita + s.tenuta + s.discesa < t - 2) da.i++
    else break
  }
  let valore = 0
  let attivo: Sforzo | null = null
  for (let k = da.i; k < sforzi.length; k++) {
    const s = sforzi[k]
    if (s.t0 > t) break
    const u = t - s.t0
    if (u >= s.salita + s.tenuta + s.discesa) continue
    valore += s.ampiezza * formaA(s, u)
    if (s.ampiezza > 0 && (!attivo || s.t0 > attivo.t0)) attivo = s
  }
  return { valore, attivo }
}

/** Le oscillazioni cardiache sul flusso: un colpo sistolico stretto per battito. */
function cardiaco(t: number, frequenza: number): number {
  if (frequenza <= 0) return 0
  const periodo = 60 / frequenza
  const u = (((t % periodo) + periodo) % periodo) / periodo
  if (u < 0.3) return Math.sin((Math.PI * u) / 0.3)
  if (u < 0.45) return -0.25 * Math.sin((Math.PI * (u - 0.3)) / 0.15)
  return 0
}

/**
 * Le scelte del motore per uno stato, nella finestra `[da, a)`.
 *
 * Gli sforzi si generano qui, una volta: il treno spontaneo del drive, e sopra
 * quelli che la regia chiede con un'asincronia. La regia sceglie **la causa**,
 * non la figura: «doppio trigger» vuol dire uno sforzo più lungo del tempo
 * inspiratorio della macchina, e il secondo atto lo fa partire il trigger.
 */
function parametri(stato: StatoVentilatore, da: number, a: number): Parametri {
  const { impostazioni: imp, fisiologia: fis, modalita } = stato
  const C = Math.max(3, fis.compliance)
  const R = Math.max(0.5, fis.resistenza)
  const Ccw = Math.max(C * 1.05, fis.complianceParete || 175)
  const Ttot = periodoMacchina(stato)
  const tempi = tempiControllati(stato, Ttot)
  const drive = driveEfficace(stato.drive)
  const forza = Math.min(1, Math.max(0, stato.drive.forza ?? 1))

  const sforzi: Sforzo[] = []
  const autoTrigger: number[] = []
  const asin = stato.asincronia
  const tipo: TipoAsincronia | null = asin && asin.quota > 0 ? asin.tipo : null
  const conTrigger = asin ? { ...asin, quota: quotaEfficace(asin, imp.triggerFlow) } : null
  const spontanea = modalita === 'PS' || modalita === 'CPAP' || modalita === 'PAV'

  // ## Il treno spontaneo
  if (drive.frequenza > 0 && drive.intensita > 0) {
    const periodo = 60 / drive.frequenza
    const neurale = durataSforzoSec(stato.drive)
    const sfas = stato.sfasamentoSpontaneo ?? 0
    const k0 = Math.floor((da - 3 - sfas) / periodo)
    const k1 = Math.ceil((a + 1 - sfas) / periodo)
    // La forma: quella chiesta dalla regia, o le proporzioni delle
    // registrazioni esofagee — una salita lunga, una tenuta breve, una discesa
    // che sconfina nell'espirazione. Non più lunga del ciclo: uno sforzo che
    // non finisce prima del successivo è un altro paziente.
    const f = stato.drive.forma
    const base = f
      ? { salita: Math.max(0.05, f.salita), tenuta: Math.max(0, f.tenuta), discesa: Math.max(0.05, f.discesa) }
      : { salita: neurale * 0.5, tenuta: neurale * 0.05, discesa: neurale * 0.4 }
    const lunga = base.salita + base.tenuta + base.discesa
    const stringi = lunga > periodo * 0.85 ? (periodo * 0.85) / lunga : 1
    const variabilita = Math.min(1, Math.max(0, stato.drive.variabilita ?? 0))
    const scarico = stato.drive.responsivo ? scaricoDalSupporto(stato, drive.intensita * PMUSC_MASSIMA) : 1
    for (let k = k0; k <= k1; k++) {
      // La variabilità, sempre la stessa per lo stesso atto: un paziente vero
      // non fa due sforzi identici, e la stessa sessione riguardata due volte
      // deve fare gli stessi. L'ombra del 4% c'è sempre; sopra, la regia può
      // chiedere un respiro irregolare vero — ampiezza, durata e istante.
      const v = 1 + (estrazione(stato.seme + 7, k) - 0.5) * 0.08 + variabilita * 0.18 * Math.max(-2, Math.min(2, gauss(stato.seme + 11, k)))
      const durata = 1 + variabilita * 0.12 * Math.max(-2, Math.min(2, gauss(stato.seme + 13, k)))
      const sposta = variabilita * 0.1 * periodo * Math.max(-2.5, Math.min(2.5, gauss(stato.seme + 17, k)))
      sforzi.push({
        t0: sfas + k * periodo + sposta,
        salita: base.salita * stringi * durata,
        tenuta: base.tenuta * stringi * durata,
        discesa: base.discesa * stringi * durata,
        ampiezza: drive.intensita * PMUSC_MASSIMA * Math.max(0.2, v) * scarico,
        muto: spontanea && tipo === 'sforzo-inefficace' && attoAsincrono(k + SPOSTA_INDICE, conTrigger, stato.seme),
      })
      // L'espirio attivo: dopo lo sforzo, gli addominali. Cade nella seconda
      // metà dell'espirazione e finisce prima che cominci lo sforzo dopo.
      const ea = Math.min(1, Math.max(0, stato.drive.espirioAttivo ?? 0))
      if (ea > 0) {
        const fine = (base.salita + base.tenuta + base.discesa) * stringi
        const resta = Math.max(0.3, periodo - fine)
        sforzi.push({
          t0: sfas + k * periodo + sposta + fine + resta * 0.2,
          salita: resta * 0.3,
          tenuta: resta * 0.15,
          discesa: resta * 0.25,
          ampiezza: -6 * ea * Math.max(0.5, drive.intensita),
          muto: false,
        })
      }
    }
    sforzi.sort((x, y) => x.t0 - y.t0)
  }

  // ## Le asincronie della regia, come cause
  if (tipo && conTrigger && conTrigger.quota > 0) {
    const intensita = Math.max(0.5, drive.intensita) * forza
    const ampiezza = intensita * PMUSC_MASSIMA
    const grado = Math.min(4, Math.max(1, asin?.grado ?? 1))
    const i0 = Math.floor((da - 3) / Ttot)
    const i1 = Math.ceil((a + 1) / Ttot)
    for (let i = i0; i <= i1; i++) {
      if (!attoAsincrono(i + SPOSTA_INDICE, conTrigger, stato.seme)) continue
      const t = i * Ttot
      const togli = (t0: number, t1: number) => {
        for (let k = sforzi.length - 1; k >= 0; k--) if (sforzi[k].t0 >= t0 && sforzi[k].t0 < t1 && sforzi[k].ampiezza > 0) sforzi.splice(k, 1)
      }
      switch (tipo) {
        case 'reverse-trigger': {
          // È la macchina che innesca il diaframma: lo sforzo parte a metà
          // dell'insufflazione, e il paziente sedato non ha un treno suo.
          if (forza <= 0) break
          sforzi.push({ t0: t + tempi.Ti * 0.45, salita: 0.35, tenuta: 0.1, discesa: 0.4, ampiezza: Math.max(4, ampiezza * 0.8), muto: false })
          break
        }
        case 'doppio-ciclo': {
          if (spontanea || forza <= 0) break
          // Lo sforzo dura più del doppio dell'inspirazione della macchina: a
          // valvola aperta il paziente tira ancora, e il trigger riapre.
          togli(t - Ttot * 0.4, t + Ttot * 0.6)
          // Perché il trigger riapra lo sforzo deve vincere il ritorno elastico
          // del volume appena entrato: è il paziente con una fame vera.
          const forte = Math.max(ampiezza, imp.volume / C + 4)
          sforzi.push({ t0: t - 0.08, salita: tempi.Ti * 0.8, tenuta: tempi.Ti * 0.9, discesa: 0.35, ampiezza: forte, muto: false, apre: true })
          break
        }
        case 'fame-di-flusso': {
          if (forza <= 0) break
          // Il paziente vuole più flusso di quello impostato: tira forte
          // proprio mentre la macchina eroga, e la Paw si scava.
          togli(t - Ttot * 0.4, t + Ttot * 0.6)
          const lungo = grado >= 4
          sforzi.push({
            t0: t - 0.06,
            salita: tempi.Ti * 0.4,
            tenuta: lungo ? tempi.Ti * 1.1 : tempi.Ti * 0.3,
            discesa: tempi.Ti * 0.4,
            ampiezza: ampiezza * (0.5 + grado * 0.3),
            muto: false,
            apre: lungo,
          })
          break
        }
        case 'ciclaggio-precoce': {
          if (forza <= 0) break
          // Il paziente è ancora in inspirazione quando la macchina stacca.
          togli(t - Ttot * 0.4, t + Ttot * 0.6)
          sforzi.push({ t0: t - 0.08, salita: tempi.Ti * 0.9, tenuta: tempi.Ti * 0.3, discesa: tempi.Ti * 0.6, ampiezza, muto: false })
          break
        }
        case 'ciclaggio-ritardato': {
          if (forza <= 0) break
          // Lo sforzo finisce presto e il paziente **spinge** per uscire mentre
          // la macchina tiene: l'espirio attivo è una Pmus negativa.
          togli(t - Ttot * 0.4, t + Ttot * 0.6)
          sforzi.push({ t0: t - 0.08, salita: tempi.Ti * 0.25, tenuta: 0, discesa: tempi.Ti * 0.25, ampiezza, muto: false })
          sforzi.push({ t0: t + tempi.Ti * 0.55, salita: tempi.Ti * 0.25, tenuta: tempi.Ti * 0.2, discesa: 0.3, ampiezza: -ampiezza * 0.6, muto: false })
          break
        }
        case 'auto-trigger': {
          // Un trigger che nessuno ha chiesto: la perdita, l'acqua nel
          // circuito, il battito sul flusso. A metà espirazione.
          autoTrigger.push(t + tempi.Ti + (Ttot - tempi.Ti) * 0.5)
          break
        }
        case 'sforzo-inefficace': {
          if (spontanea) break
          // In controllata lo sforzo cade in espirazione e non apre niente:
          // se il drive non ne ha uno, se ne mette uno, e si segna muto.
          if (drive.frequenza <= 0 && forza > 0) {
            sforzi.push({ t0: t + tempi.Ti + (Ttot - tempi.Ti) * 0.4, salita: 0.3, tenuta: 0.05, discesa: 0.35, ampiezza: Math.max(3, ampiezza * 0.6), muto: true })
          } else {
            for (const s of sforzi) if (s.t0 >= t && s.t0 < t + Ttot) s.muto = true
          }
          break
        }
      }
    }
    sforzi.sort((x, y) => x.t0 - y.t0)
  }

  // ## La limitazione al flusso: una pressione critica, e la PEEP che la tiene aperta
  //
  // Il segmento collassabile si comporta da resistore di Starling: in
  // espirazione, a valle comanda la più alta fra la Paw e la pressione critica.
  // Ne escono da sé le due cose che si insegnano: la «scodella» del flusso, e il
  // fatto che la PEEP esterna sotto la pressione critica **non** gonfia il
  // polmone — sostituisce l'auto-PEEP invece di sommarsi (la regola dell'80%).
  const pCrit = fis.limitazioneFlusso > 0 ? 3 + 9 * Math.min(1, fis.limitazioneFlusso) : 0

  const ogniSigh = imp.sighRate > 0 ? Math.max(1, Math.round(60 / (imp.sighRate * Math.max(0.5, Ttot)))) : 0
  // La Pes a fine espirazione: cinque cmH₂O sopra lo zero, più la quota della
  // PEEP che la parete si prende. La regia può scriverla lei: l'obeso e
  // l'addome teso stanno a quindici, venti (Talmor, *NEJM* 2008).
  const pesBase =
    typeof fis.pesBasale === 'number' && fis.pesBasale > 0
      ? fis.pesBasale + (imp.peep - 5) * (C / Ccw)
      : 5 + (imp.peep - 5) * (C / Ccw)

  // ## La curva pressione-volume non è una retta
  //
  // Il ritorno elastico è `E1·V + E2·V²` (il modello di Bates): con `E2`
  // negativo l'elastanza cala mentre il polmone si gonfia — alveoli che si
  // aprono a ogni atto, la **reclutamento tidalico** — e con `E2` positivo
  // cresce — il polmone che arriva in fondo, la **sovradistensione**. È da qui
  // che lo stress index esce da sé, senza scriverlo: la Paw a flusso costante
  // si curva verso il basso o verso l'alto.
  //
  // La corda resta quella: al corrente atteso `Palv − PEEP = V/C`, e plateau e
  // pressione motrice del display (calcolati con la `C` di `complianceA`)
  // tornano con la curva. Quello che cambia è la forma dentro l'atto.
  //   * Si sovradistende sopra un plateau di 25-26 cmH₂O, di più quanto più
  //     sopra (Terragni, *AJRCCM* 2007: lo stress index sopra 1,1 col plateau
  //     fra 28 e 30).
  //   * Si recluta a ogni atto quando c'è polmone da riaprire e la PEEP non lo
  //     tiene aperto: tanto più quanto più è bassa.
  const sforzoTipo = drive.intensita * PMUSC_MASSIMA
  const vRif = volumeRiferimento(stato, C, R, tempi.Ti, sforzoTipo)
  const pplatAtteso = imp.peep + vRif / C
  const sovra = Math.min(0.5, (0.35 * Math.max(0, pplatAtteso - 25)) / 10)
  const r = Math.min(1, Math.max(0, fis.reclutabilita ?? 0))
  const recluta = (0.6 * Math.max(0, r - 0.2)) / 0.8 * Math.exp(-Math.max(0, imp.peep - 5) / 5)
  const quotaE2 = Math.min(0.5, Math.max(-0.4, sovra - recluta))
  const E2 = quotaE2 / (C * vRif)
  const E1 = (1 - quotaE2) / C

  // ## La tosse
  //
  // Un colpo di tosse col tubo è un espirio esplosivo: i muscoli espiratori spingono il torace (una Pmus negativa
  // di 60-90 cmH₂O, McCool, *Chest* 2006) e l'aria esce dal tubo. Prima del primo colpo dell'accesso un'inspirazione
  // breve; gli altri vengono di fila, senza respiro in mezzo.
  for (const [i, c] of (stato.tossi ?? []).entries()) {
    if (c.t < da - 2 || c.t > a + 1) continue
    const primo = i === 0 || c.t - (stato.tossi![i - 1].t ?? -1e9) > 1
    if (primo) sforzi.push({ t0: c.t - 0.3, salita: 0.18, tenuta: 0.02, discesa: 0.08, ampiezza: 7 * c.forza, muto: false })
    sforzi.push({ t0: c.t - 0.02, ...COLPO_DI_TOSSE, ampiezza: -TOSSE_PMUS * c.forza, muto: true })
  }
  sforzi.sort((x, y) => x.t0 - y.t0)

  return {
    modalita,
    C,
    R,
    Ccw,
    peep: imp.peep,
    pCrit,
    Ttot,
    Ti: tempi.Ti,
    Tif: tempi.Tif,
    Tip: tempi.Tip,
    vt: imp.volume,
    motrice: imp.pressureTarget,
    ps: modalita === 'CPAP' ? 0 : imp.psLevel,
    salita: Math.max(0.02, imp.inspiratoryRiseTimeSeconds),
    ciclaggio: Math.min(0.9, Math.max(0.05, imp.flowCycleOffPercent / 100)),
    trigger: Math.max(0.3, imp.triggerFlow),
    triggerControllata: imp.triggerControllata === 1,
    psSimv: imp.psLevel,
    pavGuadagno: Math.min(0.95, Math.max(0.05, (imp.pavSupporto ?? 50) / 100)),
    pavMax: 35,
    pesBase,
    aop: Math.max(0, fis.aperturaVie ?? 0),
    freno: Math.min(1, Math.max(0, fis.sforzoEspiratorio ?? 0)),
    decelerante: (imp.formaFlusso ?? 0) === 1,
    perdita:
      stato.ambiente === 'niv' && typeof fis.perditaMaschera === 'number'
        ? Math.max(0, fis.perditaMaschera) / 60 / Math.sqrt(10)
        : 0,
    E1,
    E2,
    vTetto: vRif * 1.5,
    cardio: {
      ampiezza: Math.max(0, fis.oscillazioniCardiache ?? 0),
      frequenza: stato.paziente.heartRate ?? 80,
    },
    apnea: drive.frequenza > 0 ? Math.max(Ttot, (60 / drive.frequenza) * 1.5) : Ttot,
    sighOgni: ogniSigh,
    sighMotrice: Math.max(0, imp.sighPressure - imp.peep),
    sighTi: Math.min(Ttot * 0.7, 2.5),
    sforzi,
    autoTrigger,
    pMax: stato.pressioneMassima ?? Number.POSITIVE_INFINITY,
  }
}

/**
 * Quanto dello sforzo resta quando la macchina aiuta: il paziente che
 * **risponde** al supporto (`drive.responsivo`).
 *
 * Il paziente non vuole una Pmus: vuole un volume, e il lavoro che la macchina
 * fa non lo fa lui. Alzando la PS di un cmH₂O la sua Pmus cala di circa sei
 * decimi (Carteaux, *Chest* 2016: il supporto «giusto» è quello a cui la Pmus
 * sta fra 5 e 10), con un fondo — un drive non si spegne a forza di supporto —
 * e un tetto. Il riferimento è PS 5, il livello a cui lo sforzo è quello
 * scritto. In PAV il supporto è una frazione: lo sforzo scala con quello che
 * resta al paziente, `1 − k`, attenuato. In CPAP la macchina non aiuta, e il
 * paziente tira di più.
 */
function scaricoDalSupporto(stato: StatoVentilatore, ampiezza: number): number {
  const { modalita, impostazioni: imp } = stato
  if (ampiezza <= 0) return 1
  let f = 1
  if (modalita === 'PS' || modalita === 'CPAP' || modalita === 'SIMV') {
    const supporto = modalita === 'CPAP' ? 0 : imp.psLevel
    f = (ampiezza - 0.6 * (supporto - 5)) / ampiezza
  } else if (modalita === 'PAV') {
    const k = Math.min(0.95, Math.max(0.05, (imp.pavSupporto ?? 50) / 100))
    f = Math.pow((1 - k) / 0.5, 0.6)
  }
  return Math.min(1.5, Math.max(0.35, f))
}

/**
 * Il volume su cui si tara la curvatura della curva pressione-volume, in ml:
 * il corrente che quell'atto dovrebbe portare. Basta che sia dell'ordine giusto
 * — serve a dire «sopra questo volume il polmone è già disteso».
 */
function volumeRiferimento(stato: StatoVentilatore, C: number, R: number, Ti: number, sforzo: number): number {
  const { modalita, impostazioni: imp } = stato
  const tau = Math.max(0.05, (R * C) / 1000)
  if (modalita === 'VC' || modalita === 'PRVC' || (modalita === 'SIMV' && imp.psLevel === 0)) return Math.max(100, imp.volume)
  if (modalita === 'PC' || modalita === 'SIMV') {
    return Math.max(100, C * imp.pressureTarget * (1 - Math.exp(-Ti / tau)))
  }
  if (modalita === 'PS') return Math.max(100, C * (imp.psLevel + sforzo * 0.6))
  return Math.max(100, C * sforzo * 0.6)
}

/**
 * Il ritorno elastico del polmone sopra la capacità funzionale, cmH₂O: la curva
 * pressione-volume (vedi `parametri`). Sotto lo zero — l'espirio attivo —
 * resta lineare; oltre il tetto prosegue con la pendenza che ha lì.
 */
function ritornoDi(p: Parametri): (v: number) => number {
  const tettoP = p.E1 * p.vTetto + p.E2 * p.vTetto * p.vTetto
  const tettoE = p.E1 + 2 * p.E2 * p.vTetto
  return (v: number) =>
    v <= 0 ? v / p.C : v <= p.vTetto ? p.E1 * v + p.E2 * v * v : tettoP + tettoE * (v - p.vTetto)
}

/** Il ciclo della macchina: impostato, o di backup in apnea. */
function periodoMacchina(stato: StatoVentilatore): number {
  const { modalita, impostazioni } = stato
  if (modalita === 'PS' || modalita === 'CPAP' || modalita === 'PAV') {
    return 60 / Math.max(1, impostazioni.backupFrequency)
  }
  return 60 / Math.max(1, impostazioni.frequency)
}

function tempiControllati(stato: StatoVentilatore, Ttot: number) {
  const parti = String(stato.impostazioni.ratio).split(':').map(Number)
  const i = parti[0] || 1
  const e = parti[1] || 2
  const Ti = Ttot * (i / (i + e))
  const pausa =
    stato.modalita === 'VC' || stato.modalita === 'SIMV' ? Math.max(0, stato.impostazioni.inspiratoryPausePercent) / 100 : 0
  const Tip = Ti * pausa
  return { Ti, Tif: Ti - Tip, Tip }
}

/** Il blocco calcolato: campioni a passo fisso, e gli atti che ci cadono dentro. */
interface Blocco {
  inizio: number
  paw: Float32Array
  flusso: Float32Array
  volume: Float32Array
  vPolmone: Float32Array
  palv: Float32Array
  pmus: Float32Array
  pes: Float32Array
  fase: Uint8Array
  trigger: Uint8Array
  /** 1 dove fra il passo prima e questo c'è uno spigolo vero: non s'interpola. */
  spigolo: Uint8Array
  atti: AttoMotore[]
}

type Tipo = 'controllato' | 'volume' | 'pressione' | 'supporto' | 'pav' | 'cpap'

/**
 * Integra un blocco: da `inizio − CALDO_SEC` a `inizio + BLOCCO_SEC`.
 */
function integra(stato: StatoVentilatore, inizio: number): Blocco {
  const t0 = inizio - CALDO_SEC
  const t1 = inizio + BLOCCO_SEC
  const p = parametri(stato, t0, t1)
  const n = Math.round(BLOCCO_SEC / PASSO) + 1
  const out: Blocco = {
    inizio,
    paw: new Float32Array(n),
    flusso: new Float32Array(n),
    volume: new Float32Array(n),
    vPolmone: new Float32Array(n),
    palv: new Float32Array(n),
    pmus: new Float32Array(n),
    pes: new Float32Array(n),
    fase: new Uint8Array(n),
    trigger: new Uint8Array(n),
    spigolo: new Uint8Array(n),
    atti: [],
  }

  const { modalita, C, R, peep } = p
  const controllata = modalita === 'VC' || modalita === 'PC' || modalita === 'PRVC' || modalita === 'SIMV'
  const cursore = { i: 0 }
  const ritorno = ritornoDi(p)

  // Lo stato dell'integratore.
  let V = 0
  let fase = 2
  let inizioAtto = Number.NEGATIVE_INFINITY
  let fineInsp = Number.NEGATIVE_INFINITY
  let tipoAtto: Tipo = 'cpap'
  let innescato = false
  let flussoPicco = 0
  let volumeErogato = 0
  let vDisplay = 0
  let prossimoMandatorio = controllata ? Math.ceil(t0 / p.Ttot) * p.Ttot : t0 + p.Ttot
  let ultimoAtto = Number.NEGATIVE_INFINITY
  let attoCorrente: AttoMotore | null = null
  let atTi = p.Ti
  let atTif = p.Tif
  let atVt = p.vt
  let atMotrice = p.motrice
  let sforzoInnesco: Sforzo | null = null
  let autoIdx = 0
  // CPAP: l'«atto» è lo sforzo, e si conta da quando il flusso diventa inspiratorio.
  let flussoPrima = 0
  let inAttesa: number | null = null
  let pawPrima = peep
  let fasePrima = 2
  let pawCiclo = peep
  let ultimaTosse = Number.NEGATIVE_INFINITY
  // Lo stress index: la regressione di ln(Paw − Paw₀) su ln(t) nel tratto a
  // flusso costante, accumulata mentre passa.
  let si = { n: 0, x: 0, y: 0, xx: 0, xy: 0, paw0: 0, pulito: true }

  const passi = Math.round((t1 - t0) / PASSO)
  for (let s = 0; s <= passi; s++) {
    const t = t0 + s * PASSO
    const { valore: pmus, attivo } = pmusDi(p.sforzi, t, cursore)
    const palvSenza = peep + ritorno(V)
    const palv = palvSenza - pmus
    const osc = p.cardio.ampiezza > 0 ? cardiaco(t, p.cardio.frequenza) * p.cardio.ampiezza * 4 : 0

    // ## Si apre un atto?
    if (fase === 2 && modalita !== 'CPAP') {
      const aperta = t - fineInsp >= REFRATTARIO
      // La perdita della maschera in espirazione: la macchina la stima e la
      // toglie, ma una perdita che cambia lascia un residuo — e un residuo
      // sopra la soglia è un trigger che nessuno ha chiesto.
      const residuoEsp =
        p.perdita > 0
          ? p.perdita * Math.sqrt(Math.max(0, pawPrima)) * (0.03 + 0.12 * Math.max(0, rumore(stato.seme + 31, t, 1.5))) * 60
          : 0
      const flussoVisto = flussoPrima + osc + residuoEsp
      let parte: 'macchina' | 'paziente' | null = null
      if (controllata && t >= prossimoMandatorio - 1e-9) parte = 'macchina'
      else if (!controllata && !attivo && t - ultimoAtto >= p.apnea) parte = 'macchina'
      if (!parte && aperta) {
        // In controllata il trigger è chiuso, salvo che la macchina sia
        // regolata in assistita-controllata o che lo sforzo sia di quelli che
        // la regia ha messo apposta per aprirlo.
        const puo = !controllata || p.triggerControllata || modalita === 'SIMV' || attivo?.apre === true
        const sforzoValido = attivo ? !attivo.muto : true
        if (inAttesa !== null) {
          if (t >= inAttesa) parte = 'paziente'
        } else if (puo && sforzoValido && flussoVisto > p.trigger) inAttesa = t + RITARDO_TRIGGER
        if (!parte && autoIdx < p.autoTrigger.length && t >= p.autoTrigger[autoIdx]) {
          parte = 'paziente'
          autoIdx++
        }
      }
      while (autoIdx < p.autoTrigger.length && p.autoTrigger[autoIdx] < t - 1) autoIdx++
      if (parte) {
        inAttesa = null
        innescato = parte === 'paziente'
        sforzoInnesco = innescato ? attivo : null
        // Che atto è
        if (modalita === 'VC') tipoAtto = 'volume'
        else if (modalita === 'PC' || modalita === 'PRVC') tipoAtto = 'pressione'
        else if (modalita === 'SIMV') {
          // Lo sforzo che cade nella finestra prima dell'obbligato **è**
          // l'obbligato, sincronizzato: è la S di SIMV. Fuori, è uno spontaneo.
          const dovuto = parte === 'macchina' || t >= prossimoMandatorio - p.Ttot * 0.25
          tipoAtto = dovuto ? (p.psSimv > 0 ? 'pressione' : 'volume') : 'supporto'
        } else if (modalita === 'PAV') tipoAtto = innescato ? 'pav' : 'pressione'
        else tipoAtto = innescato ? 'supporto' : 'pressione'
        // In PS l'atto di backup è un atto in pressione col livello di backup.
        atTi = p.Ti
        atTif = p.Tif
        atVt = p.vt
        atMotrice = modalita === 'PS' || modalita === 'PAV' ? stato.impostazioni.backupPressure : p.motrice
        if (!controllata && tipoAtto === 'pressione') {
          const parti = String(stato.impostazioni.backupIERatio).split(':').map(Number)
          atTi = p.Ttot * ((parti[0] || 1) / ((parti[0] || 1) + (parti[1] || 2)))
          atTif = atTi
        }
        // Il sigh: un atto alto e lungo, sull'indice del ciclo.
        if (controllata && p.sighOgni > 0 && tipoAtto !== 'supporto') {
          const indice = Math.round(t / p.Ttot)
          if (indice % p.sighOgni === 0) {
            atVt = p.sighMotrice * C
            atMotrice = p.sighMotrice
            const quota = p.Ti > 0 ? p.Tif / p.Ti : 1
            atTi = p.sighTi
            atTif = p.sighTi * quota
          }
        }
        if (controllata && tipoAtto !== 'supporto') {
          // In assistita-controllata il ciclo riparte dall'atto innescato; in
          // SIMV l'obbligato sincronizzato resta sulla sua griglia.
          if (innescato && modalita !== 'SIMV') prossimoMandatorio = t + p.Ttot
          while (prossimoMandatorio <= t + p.Ttot * 0.25) prossimoMandatorio += p.Ttot
        }
        fase = 0
        inizioAtto = t
        ultimoAtto = t
        flussoPicco = 0
        volumeErogato = 0
        // Il volume mostrato riparte da zero a ogni atto — salvo che l'atto
        // prima non sia uscito nemmeno per metà: è il **breath stacking**, e la
        // curva deve salire sopra il corrente impostato, come sul monitor vero.
        if (!attoCorrente || attoCorrente.vte >= attoCorrente.vti * 0.5) vDisplay = 0
        if (attoCorrente) chiudiAtto(attoCorrente, palvSenza, p, out, inizio)
        attoCorrente = nuovoAtto(t, innescato, peep, palvSenza)
        // La P0.1: lo sforzo che ha aperto l'atto, cento millisecondi dopo
        // che è cominciato. È quella che la macchina misura occludendo.
        if (innescato && sforzoInnesco) attoCorrente.p01 = sforzoInnesco.ampiezza * formaA(sforzoInnesco, 0.1)
        si = { n: 0, x: 0, y: 0, xx: 0, xy: 0, paw0: 0, pulito: true }
        // Il tratto dello sforzo che ha aperto l'atto si colora, all'indietro.
        if (innescato && s * PASSO >= CALDO_SEC) {
          const da = Math.max(sforzoInnesco ? sforzoInnesco.t0 : t - 0.1, t - 0.4)
          // Almeno cento millisecondi: con uno sforzo che strappa il trigger
          // apre prima, e un tratto di trenta millisecondi non si vedrebbe.
          const a = Math.max(t, da + 0.1)
          for (let q = Math.max(0, Math.round((da - inizio) / PASSO)); q <= Math.round((a - inizio) / PASSO) && q < n; q++) out.trigger[q] = 1
        }
      }
    }
    // In controllata la macchina non aspetta: se il ciclo è scaduto e si sta
    // ancora espirando, il prossimo parte (è così che l'aria si accumula).
    const dentro = t - inizioAtto

    // ## La Paw e il flusso, secondo chi comanda
    let paw = peep
    let Q = 0 // l/s
    if (fase === 0 || fase === 1) {
      if (tipoAtto === 'volume') {
        if (dentro < atTif && volumeErogato < atVt) {
          // Quadro: lo stesso flusso dall'inizio alla fine. Decelerante: una
          // rampa che parte dal doppio e scende a zero nello stesso tempo, con
          // lo stesso volume — il picco di pressione arriva prima e più basso.
          const medio = atVt / 1000 / Math.max(0.05, atTif)
          Q = p.decelerante ? 2 * medio * Math.max(0, 1 - dentro / Math.max(0.05, atTif)) : medio
          paw = palv + R * Q
          fase = 0
          if (!p.decelerante) {
            if (dentro < PASSO * 0.5) si.paw0 = paw
            if (Math.abs(pmus) > 0.3) si.pulito = false
            if (dentro >= atTif * 0.2 && paw - si.paw0 > 0.05) {
              const x = Math.log(dentro)
              const y = Math.log(paw - si.paw0)
              si.n++
              si.x += x
              si.y += y
              si.xx += x * x
              si.xy += x * y
            }
          }
        } else if (dentro < atTi) {
          Q = 0
          paw = palv
          fase = 1
        } else {
          fase = 2
          fineInsp = t
        }
      } else if (tipoAtto === 'pav') {
        // PAV: la macchina amplifica lo sforzo. Paw − PEEP = k/(1−k) · Pmus.
        const k = p.pavGuadagno
        const sopra = Math.min(p.pavMax - peep, (k / (1 - k)) * Math.max(0, pmus))
        paw = peep + Math.max(0, sopra)
        if (p.perdita > 0) paw = pressioneConPerdita(paw, palv, R, p.perdita * fluttua(t))
        Q = (paw - palv) / R
        const visto = Q + RESIDUO_PERDITA_INSP * p.perdita * fluttua(t) * Math.sqrt(Math.max(0, paw))
        flussoPicco = Math.max(flussoPicco, visto)
        if (dentro > 0.15 && (visto <= flussoPicco * p.ciclaggio || dentro > TI_MASSIMO_PS)) {
          fase = 2
          fineInsp = t
        }
      } else {
        // Pressione: controllata, supporto, o backup.
        const livello = tipoAtto === 'supporto' ? (modalita === 'SIMV' ? p.psSimv : p.ps) : atMotrice
        const sale = liscio(Math.min(1, dentro / p.salita))
        paw = peep + livello * sale
        if (p.perdita > 0) paw = pressioneConPerdita(paw, palv, R, p.perdita * fluttua(t))
        Q = (paw - palv) / R
        // Con le vie aeree chiuse il gas intrappolato non torna indietro
        // mentre la pressione sale: aspetta che la Paw passi l'apertura.
        if (p.aop > 0 && paw < p.aop) Q = Math.max(0, Q)
        // Il flusso che la macchina vede: il paziente, più quello che la
        // compensazione della perdita non ha tolto. È lui che decide il ciclaggio.
        const visto = Q + RESIDUO_PERDITA_INSP * p.perdita * fluttua(t) * Math.sqrt(Math.max(0, paw))
        flussoPicco = Math.max(flussoPicco, visto)
        if (tipoAtto === 'supporto') {
          const ciclaFlusso = dentro > p.salita && visto <= flussoPicco * p.ciclaggio
          const ciclaPressione = palv > paw + CICLAGGIO_PRESSIONE
          if (ciclaFlusso || ciclaPressione || dentro > TI_MASSIMO_PS) {
            fase = 2
            fineInsp = t
          }
        } else if (dentro >= atTi) {
          fase = 2
          fineInsp = t
        }
      }
    }
    // il paziente tossisce mentre la macchina spinge: la Paw arriva al limite alto e la macchina smette di
    // insufflare, apre l'espirazione (e suona l'allarme di pressione)
    const tossisce = pmus < TOSSE_IN_CORSO
    if (tossisce) ultimaTosse = t
    if ((fase === 0 || fase === 1) && tossisce && paw >= p.pMax) {
      paw = p.pMax + SFORO_LIMITE
      fase = 2
      fineInsp = t
      if (attoCorrente) attoCorrente.limitato = true
    }
    if (fase === 2) {
      if (fineInsp === t) pawCiclo = pawPrima
      // L'espirazione: la valvola porta la Paw alla PEEP in poche decine di
      // millisecondi e poi la tiene; se il paziente tira, il flusso continuo
      // gli dà gas — o non gliene dà, se il trigger è chiuso.
      const te = t - fineInsp
      const rampa = Math.max(RAMPA_VALVOLA, Math.abs(pawCiclo - peep) / PENDENZA_VALVOLA)
      const valvola = peep + (pawCiclo - peep) * Math.max(0, 1 - te / rampa)
      const giu = valvola - palv
      if (giu >= 0) {
        const chiuso =
          attivo?.muto === true ||
          (controllata && !p.triggerControllata && modalita !== 'SIMV' && attivo?.apre !== true)
        // svuotato dalla tosse sotto la capacità funzionale, il polmone si riempie dalla macchina che tiene la
        // PEEP: col trigger chiuso la Paw restava sotto zero per secondi
        const svuotato = V < -50 && t - ultimaTosse < 4
        const rc = inAttesa !== null ? R_IN_ATTESA : chiuso && !svuotato ? R_CHIUSO : R_FLUSSO_CONTINUO
        Q = giu / (R + rc)
        paw = valvola - rc * Q
      } else {
        // Il freno della glottide: chi «trattiene» in espirazione — il
        // grugnito, la PEEP fatta da sé — mette una resistenza in più all'inizio
        // dell'espirio, che si scioglie in mezzo secondo.
        // con la tosse il ramo espiratorio è turbolento (dal flusso del passo prima)
        const turbolenta = tossisce ? K_TURBOLENTO * Math.abs(flussoPrima / 60) : 0
        const Re = R + R_VALVOLA + turbolenta + (p.freno > 0 ? R * 3 * p.freno * Math.exp(-te / 0.5) : 0)
        // Resistore di Starling: a valle comanda la più alta fra Paw e Pcrit.
        const valle = Math.max(valvola, p.pCrit)
        const libero = (valvola - palv) / Re
        let limitato = palv > valle ? (valle - palv) / Re : 0
        // Il primo decimo di secondo esce il gas delle vie centrali: è la punta
        // della scodella, prima che il segmento collassi.
        if (p.pCrit > peep) {
          const crollo = 1 - Math.exp(-te / 0.06)
          limitato = libero + (limitato - libero) * crollo
          Q = Math.max(libero, limitato)
        } else Q = libero
        // La chiusura delle vie aeree: sotto la pressione di apertura le
        // piccole vie si chiudono e il gas resta dentro, alla pressione di
        // apertura (Chen, *AJRCCM* 2018). Non è una scodella: è un muro.
        if (p.aop > valvola) Q = Math.max(Q, palv > p.aop ? (p.aop - palv) / Re : 0)
        paw = valvola - (R_VALVOLA + turbolenta) * Q
        // oltre il limite la valvola di sicurezza scarica
        if (paw > p.pMax + SFORO_LIMITE) paw = p.pMax + SFORO_LIMITE
      }
    }
    pawPrima = paw

    // La perdita: il gas che esce dal bordo della maschera, e il pezzo che la
    // compensazione lascia sulla curva del flusso.
    const qPerso = p.perdita > 0 ? p.perdita * fluttua(t) * Math.sqrt(Math.max(0, paw)) : 0
    const residuo = p.perdita > 0 ? (fase === 2 ? qPerso * 0.03 : qPerso * RESIDUO_PERDITA_INSP) : 0
    // Le oscillazioni cardiache arrivano al flusso e alla pressione.
    const flussoLmin = (Q + residuo) * 60 + osc
    // ## Avanza
    const dV = Q * 1000 * PASSO
    V += dV
    if (fase === 0 || fase === 1) volumeErogato += Math.max(0, dV)
    // il polmone svuotato dalla tosse che si riempie fino alla capacità funzionale non è un volume corrente:
    // contato, la curva del volume saliva in cima e ci restava fino all'atto dopo
    if (!(V - dV < 0 && t - ultimaTosse < 4)) vDisplay += dV
    if (modalita === 'CPAP') {
      if (flussoPrima <= 0 && Q > 0) {
        vDisplay = Math.max(0, dV)
        if (attoCorrente) chiudiAtto(attoCorrente, palvSenza, p, out, inizio)
        attoCorrente = nuovoAtto(t, true, peep, palvSenza)
        if (attivo) attoCorrente.p01 = attivo.ampiezza * formaA(attivo, 0.1)
      }
    }
    flussoPrima = Q * 60
    if (attoCorrente) {
      if (Q > 0) attoCorrente.vti += dV
      else attoCorrente.vte -= dV
      if (qPerso > 0) {
        attoCorrente.vPerso += qPerso * 1000 * PASSO
        if (fase !== 2) attoCorrente.vPersoInsp += qPerso * 1000 * PASSO
      }
      if (fase !== 2) attoCorrente.pip = Math.max(attoCorrente.pip, paw)
      attoCorrente.pMax = Math.max(attoCorrente.pMax, paw)
      if (fase === 1) attoCorrente.pplat = paw
      if (fase !== 2) attoCorrente.palvFineInsp = peep + ritorno(V)
      if (fase === 2 && fineInsp === t) attoCorrente.fineInsp = t
      if (fase !== 0 && fasePrima === 0 && tipoAtto === 'volume' && !p.decelerante && si.pulito && si.n >= 8) {
        const den = si.n * si.xx - si.x * si.x
        if (den > 1e-9) attoCorrente.stressIndex = (si.n * si.xy - si.x * si.y) / den
      }
      attoCorrente.fine = t
    }

    // ## Si scrive, se si è dentro il blocco
    const q = s - Math.round(CALDO_SEC / PASSO)
    if (q >= 0 && q < n) {
      out.paw[q] = paw + (p.cardio.ampiezza > 0 ? osc * 0.02 : 0)
      out.flusso[q] = flussoLmin
      out.volume[q] = Math.max(0, vDisplay)
      out.vPolmone[q] = V
      out.palv[q] = palv
      out.pmus[q] = pmus
      // L'artefatto cardiaco sulla Pes c'è sempre: il cuore sta sopra l'esofago.
      out.pes[q] = p.pesBase + V / p.Ccw - pmus + cardiaco(t - 0.08, p.cardio.frequenza) * 1
      out.fase[q] = fase
      // Gli spigoli del volume controllato: il flusso quadro che parte e che
      // si ferma. Sono veri, e chi campiona non li deve arrotondare.
      if (tipoAtto === 'volume' && fase !== fasePrima) out.spigolo[q] = 1
    }
    fasePrima = fase
  }
  return out
}

/**
 * Un atto si chiude quando parte il successivo, e appartiene al blocco in cui
 * **finisce**: così due blocchi vicini — che si sovrappongono nel riscaldamento
 * — non lo contano due volte.
 */
function chiudiAtto(a: AttoMotore, palvFine: number, p: Parametri, out: Blocco, inizio: number) {
  a.peepTotale = palvFine
  a.vieChiuse = p.aop > p.peep && palvFine < p.aop + 0.5
  if (a.fine >= inizio && a.fine < inizio + BLOCCO_SEC) out.atti.push({ ...a })
}

function nuovoAtto(t: number, innescato: boolean, peep: number, palv: number): AttoMotore {
  return {
    inizio: t,
    fine: t,
    innescato,
    vti: 0,
    vte: 0,
    pip: peep,
    pMax: peep,
    limitato: false,
    pplat: null,
    peepTotale: palv,
    palvFineInsp: palv,
    fineInsp: t,
    p01: null,
    stressIndex: null,
    vieChiuse: false,
    vPerso: 0,
    vPersoInsp: 0,
  }
}

// ## La memoria dei blocchi
//
// Poche voci bastano: chi disegna chiede sempre gli ultimi due blocchi, e chi
// misura l'ultimo. La chiave è lo stato serializzato nei campi che contano.

const MEMORIA = new Map<string, Blocco>()
const MEMORIA_MASSIMA = 24

// Chi disegna chiede un campione per pixel. `polmoneOra` rifà l'oggetto stato
// a ogni chiamata, ma le impostazioni restano lo stesso oggetto: la parte grossa
// dell'impronta si ricorda accanto a loro, il resto sono pochi numeri.
const IMPRONTE_IMPOSTAZIONI = new WeakMap<object, string>()

function chiave(stato: StatoVentilatore, inizio: number): string {
  let imp = IMPRONTE_IMPOSTAZIONI.get(stato.impostazioni)
  if (imp === undefined) {
    imp = JSON.stringify(stato.impostazioni)
    IMPRONTE_IMPOSTAZIONI.set(stato.impostazioni, imp)
  }
  const f = stato.fisiologia
  const d = stato.drive
  const a = stato.asincronia
  return [
    inizio,
    stato.modalita,
    imp,
    f.compliance,
    f.resistenza,
    f.complianceParete,
    f.limitazioneFlusso,
    f.oscillazioniCardiache ?? 0,
    f.reclutabilita,
    f.sforzoEspiratorio,
    f.aperturaVie ?? 0,
    f.pesBasale ?? 0,
    f.perditaMaschera ?? -1,
    stato.ambiente,
    d.frequenza,
    d.intensita,
    d.forza ?? 1,
    d.forma ? `${d.forma.salita}/${d.forma.tenuta}/${d.forma.discesa}` : '-',
    d.responsivo ? 1 : 0,
    d.variabilita ?? 0,
    d.espirioAttivo ?? 0,
    a ? `${a.tipo}:${a.quota}:${a.grado ?? 1}` : '-',
    stato.seme,
    stato.sfasamentoSpontaneo ?? 0,
    stato.paziente.heartRate ?? 80,
    stato.pressioneMassima ?? '-',
    // solo i colpi che cadono nel blocco o nel suo riscaldamento
    (stato.tossi ?? [])
      .filter((c) => c.t >= inizio - CALDO_SEC - 2 && c.t <= inizio + BLOCCO_SEC + 1)
      .map((c) => `${c.t.toFixed(3)}:${c.forza.toFixed(2)}`)
      .join(','),
  ].join('|')
}

function blocco(stato: StatoVentilatore, inizio: number): Blocco {
  const k = chiave(stato, inizio)
  let b = MEMORIA.get(k)
  if (b) {
    MEMORIA.delete(k)
    MEMORIA.set(k, b)
    return b
  }
  b = integra(stato, inizio)
  MEMORIA.set(k, b)
  if (MEMORIA.size > MEMORIA_MASSIMA) MEMORIA.delete(MEMORIA.keys().next().value as string)
  return b
}

/** Il motore si usa per queste modalità; le altre restano a `onde.ts`. */
export function motoreCopre(stato: StatoVentilatore): boolean {
  if (!stato.ventilando) return false
  if (stato.ambiente === 'alto-flusso') return false
  if (stato.ambiente === 'anestesia' && stato.respiro === 'manuale') return false
  return ['VC', 'PC', 'PRVC', 'PS', 'CPAP', 'SIMV', 'PAV'].includes(stato.modalita)
}

/** Il campione del motore a `tSec`, interpolato fra i due passi vicini. */
export function campioneMotore(tSec: number, stato: StatoVentilatore): CampioneMotore {
  const inizio = Math.floor(tSec / BLOCCO_SEC) * BLOCCO_SEC
  const b = blocco(stato, inizio)
  const x = (tSec - inizio) / PASSO
  const i = Math.min(b.paw.length - 2, Math.max(0, Math.floor(x)))
  const f = Math.min(1, Math.max(0, x - i))
  // Si interpola fra i due passi, salvo che fra i due ci sia uno spigolo vero
  // — il flusso quadro che parte, il gradino resistivo —: lì si tiene il passo
  // più vicino, o lo spigolo diventerebbe una rampa di cinque millisecondi.
  const spigolo = b.spigolo[i + 1] === 1
  const l = (a: Float32Array) => (spigolo ? (f < 0.5 ? a[i] : a[i + 1]) : a[i] + (a[i + 1] - a[i]) * f)
  const paw = l(b.paw)
  const pes = l(b.pes)
  return {
    paw,
    flusso: l(b.flusso),
    volume: l(b.volume),
    vPolmone: l(b.vPolmone),
    palv: l(b.palv),
    pmus: l(b.pmus),
    pes,
    pl: paw - pes,
    fase: b.fase[f < 0.5 ? i : i + 1],
    inTrigger: b.trigger[f < 0.5 ? i : i + 1] === 1,
  }
}

/**
 * Gli atti completati nella finestra `(tSec − finestra, tSec]`: quello che il
 * display misura, invece di calcolarlo a parte.
 */
export function attiRecenti(tSec: number, stato: StatoVentilatore, finestra = 20): AttoMotore[] {
  const inizio = Math.floor(tSec / BLOCCO_SEC) * BLOCCO_SEC
  const blocchi = tSec - finestra < inizio ? [blocco(stato, inizio - BLOCCO_SEC), blocco(stato, inizio)] : [blocco(stato, inizio)]
  const visti = new Set<number>()
  const out: AttoMotore[] = []
  for (const b of blocchi) {
    for (const a of b.atti) {
      const k = Math.round(a.inizio * 1000)
      if (visti.has(k)) continue
      if (a.fine <= tSec && a.inizio > tSec - finestra) {
        visti.add(k)
        out.push(a)
      }
    }
  }
  return out.sort((x, y) => x.inizio - y.inizio)
}

// ## Il polmone fermo, per le manovre
//
// Le manovre non sono atti: tengono la macchina ferma, o la fanno andare piano,
// e quello che si vede è la curva statica del polmone. La curva è la stessa
// che il motore integra (`ritornoDi`), così la manovra misura lo stesso
// polmone che le curve disegnano.

/** La compliance del circuito, ml/cmH₂O: dove va il gas a vie aeree chiuse. */
export const COMPLIANCE_CIRCUITO = 2
/** Il flusso della curva pressione-volume lenta, l/min (Chen, *AJRCCM* 2018). */
export const FLUSSO_LENTO = 5

export interface PolmoneStatico {
  peep: number
  C: number
  R: number
  /** Pressione di apertura delle vie aeree, 0 se non c'è. */
  aop: number
  /** Il ritorno elastico sopra la capacità funzionale alla PEEP, cmH₂O. */
  ritorno: (v: number) => number
}

export function polmoneStatico(stato: StatoVentilatore): PolmoneStatico {
  const p = parametri(stato, 0, 0)
  return { peep: p.peep, C: p.C, R: p.R, aop: p.aop, ritorno: ritornoDi(p) }
}

/** Il volume a cui il ritorno elastico vale `dp` cmH₂O: l'inversa, per bisezione. */
function volumeA(pl: PolmoneStatico, dp: number): number {
  if (dp <= 0) return dp * pl.C
  let a = 0
  let b = Math.max(10, dp * pl.C * 4)
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2
    if (pl.ritorno(m) < dp) a = m
    else b = m
  }
  return (a + b) / 2
}

/**
 * La curva pressione-volume a basso flusso: cinque litri al minuto dalla PEEP,
 * per tutta la manovra. A flusso così basso la resistenza quasi non conta e la
 * curva è quella statica del polmone. Con le vie aeree chiuse il primo tratto è
 * **ripido** — il gas comprime solo il circuito — finché la pressione arriva a
 * quella di apertura; lì la pendenza cambia di colpo, ed è il ginocchio che si
 * legge (Chen, *AJRCCM* 2018).
 */
export function curvaLenta(tRel: number, stato: StatoVentilatore): { paw: number; flusso: number; volume: number } {
  const pl = polmoneStatico(stato)
  const q = FLUSSO_LENTO / 60 // l/s
  const erogato = Math.max(0, tRel) * q * 1000
  const chiuse = pl.aop > pl.peep
  const primo = chiuse ? (pl.aop - pl.peep) * COMPLIANCE_CIRCUITO : 0
  if (erogato < primo) return { paw: pl.peep + erogato / COMPLIANCE_CIRCUITO, flusso: FLUSSO_LENTO, volume: erogato }
  const v0 = chiuse ? volumeA(pl, pl.aop - pl.peep) : 0
  return { paw: pl.peep + pl.ritorno(v0 + erogato - primo) + pl.R * q, flusso: FLUSSO_LENTO, volume: erogato }
}

/**
 * Che cosa si legge sulla curva lenta: dove cambia la pendenza (la pressione di
 * apertura, se c'è), la compliance del tratto dopo, e dove arriva.
 *
 * Il ginocchio si **cerca** sulla curva, come lo cerca chi la guarda: il primo
 * tratto dove la compliance passa da quella del circuito a quella di un
 * polmone. Se la pendenza è da polmone fin dall'inizio, le vie aeree erano
 * aperte e la pressione di apertura non c'è.
 */
export function letturaCurvaLenta(stato: StatoVentilatore, durataSec: number): {
  aperturaVie: number | null
  compliance: number | null
  pFinale: number
  volume: number
} {
  const passo = 0.02
  const punti: { paw: number; volume: number }[] = []
  for (let t = 0; t <= durataSec + 1e-9; t += passo) punti.push(curvaLenta(t, stato))
  let ginocchio = -1
  for (let i = 1; i < punti.length; i++) {
    const dp = punti[i].paw - punti[i - 1].paw
    const dv = punti[i].volume - punti[i - 1].volume
    const cLocale = dp > 1e-6 ? dv / dp : Infinity
    if (cLocale > COMPLIANCE_CIRCUITO * 3) {
      ginocchio = i - 1
      break
    }
  }
  const ultimo = punti[punti.length - 1]
  const aperta = ginocchio <= 1
  const da = Math.max(0, ginocchio) + 1
  const tratto = punti.length - 1 - da
  const compliance =
    tratto > 5 && ultimo.paw > punti[da].paw ? (ultimo.volume - punti[da].volume) / (ultimo.paw - punti[da].paw) : null
  return {
    aperturaVie: aperta ? null : punti[ginocchio].paw,
    compliance,
    pFinale: ultimo.paw,
    volume: ultimo.volume,
  }
}

/** Solo per le prove: svuota la memoria. */
export function svuotaMemoriaMotore(): void {
  MEMORIA.clear()
}

