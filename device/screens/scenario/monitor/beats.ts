/**
 * La fisiologia di un battito, e il piano con cui si ripete.
 *
 * Qui non si disegna niente: si dice **che forma ha** un battito e **ogni
 * quanto torna**. Chi disegna un ECG lo chiede qui: in questo
 * apparecchio sono le quattro derivazioni esofagee del catetere dell'EAdi
 * (`ventilatore/ecgEsofageo.ts`).
 *
 * ## Come è fatto un battito
 *
 * Ogni battito è una sequenza di punti di controllo in **secondi** e in
 * **millivolt**, uniti da segmenti: l'occhio a questa dimensione non distingue
 * una curva da una spezzata, e i punti di controllo si leggono come si legge un
 * ECG (P, PR, QRS, ST, T). Sopra ci può stare un fondo continuo — le onde F del
 * flutter, il tremolio della fibrillazione — che è invece una funzione del
 * tempo.
 *
 * Il disordine (fibrillazione ventricolare, torsione di punta, l'irregolarità
 * della fibrillazione atriale) viene da un generatore pseudocasuale **seminato
 * con il nome del ritmo**: la stessa traccia si ridisegna identica ad ogni
 * fotogramma, che è l'unico modo perché il pannello non tremoli mentre lo si
 * guarda.
 */

/** Millivolt: la R di un QRS normale vale 1. */
export const R_MV = 1

/** Generatore pseudocasuale deterministico (LCG a 32 bit). */
export function seeded(seed: string): () => number {
  let state = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i)
    state = Math.imul(state, 16777619)
  }
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export interface BeatShape {
  /** Ampiezza dell'onda P; 0 quando l'atrio non conduce o non si vede. */
  p: number
  /** Intervallo PR in secondi, dall'inizio della P all'inizio del QRS. */
  pr: number
  /** Durata del QRS in secondi. Sopra 0.12 è «largo». */
  qrs: number
  /** Ampiezza della R. Negativa per un complesso prevalentemente negativo. */
  r: number
  /** Slivellamento del tratto ST in millivolt. */
  st: number
  /** Ampiezza dell'onda T; negativa se invertita. */
  t: number
  /** Onda delta: la salita lenta che precede il QRS nella pre-eccitazione. */
  delta?: boolean
  /** Spicco del pacemaker prima del complesso. */
  paced?: boolean
  /** Onda U, che si vede quando il potassio è basso. */
  u?: number
  /**
   * Onda T bifasica: sale e poi scende sotto la linea, invece di fare una
   * gobba sola. È la T di Wellens tipo A, e non è un dettaglio grafico — un
   * quadro di Wellens disegnato con la T dritta o con il tratto ST sollevato
   * diventa un altro quadro, e chi lo guarda impara la cosa sbagliata.
   */
  tBiphasic?: boolean
  /** Quando comincia la P, in secondi dall'inizio del battito: dopo lo spicco atriale. */
  pInizio?: number
  /**
   * Gli spicchi dello stimolatore epicardico dentro il battito (`pacemaker/`): l'atriale prima
   * della P, il ventricolare dopo l'A-V. Si sommano alla curva e non sono punti del battito:
   * chi cerca la R fra i punti trova il QRS, non lo spicco.
   */
  spicchi?: { t: number; mV: number }[]
}

export const SINUS: BeatShape = { p: 0.15, pr: 0.16, qrs: 0.09, r: R_MV, st: 0, t: 0.3 }

/**
 * L'extrasistole ventricolare: nessuna P, complesso largo e alto, e la T
 * dall'altra parte.
 *
 * La discordanza fra QRS e T non è un abbellimento: un complesso largo con la
 * T dalla stessa parte si legge come un battito condotto con aberranza, che è
 * un'altra cosa e si tratta in un altro modo.
 */
export const PVC: BeatShape = { p: 0, pr: 0.02, qrs: 0.16, r: R_MV * 1.35, st: -0.12, t: -0.5 }

/** L'extrasistole ventricolare dell'altro focolaio: guarda in giù. */
export const PVC_ALTRO: BeatShape = {
  p: 0,
  pr: 0.02,
  qrs: 0.17,
  r: -R_MV * 1.1,
  st: 0.12,
  t: 0.45,
}

/** L'extrasistole atriale: P di forma diversa, ma il ventricolo conduce normale. */
export const PAC: BeatShape = { ...SINUS, p: 0.1, pr: 0.13 }

/** L'extrasistole giunzionale: il ventricolo conduce, l'atrio non si vede. */
export const PJC: BeatShape = { ...SINUS, p: 0, pr: 0.06 }

/**
 * I punti di un battito, in (secondi dall'inizio della P, millivolt).
 *
 * Le onde tonde — P e T — sono campionate a otto punti, il QRS è una spezzata:
 * è la forma che ha davvero, e con meno punti resta più leggero.
 */
export function beatPoints(shape: BeatShape): [number, number][] {
  const points: [number, number][] = []
  const pDur = 0.09
  const p0 = shape.pInizio ?? 0
  if (p0 > 0) points.push([0, 0])
  if (shape.p !== 0) {
    for (let i = 0; i <= 8; i += 1) {
      const t = (pDur * i) / 8
      points.push([p0 + t, shape.p * Math.sin((Math.PI * i) / 8)])
    }
  } else if (!p0) {
    points.push([0, 0])
  }

  const qrsStart = shape.pr
  // Il tempo dei punti deve crescere sempre: `piecewise()` cerca fra due punti
  // consecutivi, e un punto fuori ordine (la delta che comincia prima della
  // fine della P, con un PR corto) restituirebbe un valore preso a caso.
  // Da qui l'ancora prima del QRS, calcolata invece che sottratta.
  const pEnd = shape.p !== 0 ? p0 + pDur : p0
  const lead = shape.delta ? 0.05 : shape.paced ? 0.02 : 0.005
  const preStart = Math.min(qrsStart - 0.002, Math.max(pEnd + 0.002, qrsStart - lead))
  points.push([preStart, 0])

  if (shape.paced) {
    // Lo spicco del pacemaker: stretto, ma non più stretto del passo di
    // campionamento, o non verrebbe mai colpito e sparirebbe.
    points.push([qrsStart - 0.012, 1.1 * R_MV], [qrsStart - 0.006, 0])
  }
  if (shape.delta) {
    // La delta sale piano dalla fine del PR fino alla R.
    points.push([qrsStart, 0.18 * shape.r])
  }

  const w = shape.qrs
  // Q, R, S in proporzione alla durata: un complesso largo non è un complesso
  // stretto ingrandito, ha le stesse tre inflessioni più distanziate.
  points.push([qrsStart + w * 0.15, -0.12 * Math.abs(shape.r)])
  points.push([qrsStart + w * 0.42, shape.r])
  if (Math.abs(shape.r) > 0 && w > 0.12) {
    // Complesso largo: la salita ha una spalla, che è quello che si vede in un
    // blocco di branca o in un ritmo ventricolare.
    points.push([qrsStart + w * 0.62, shape.r * 0.55])
  }
  points.push([qrsStart + w * 0.82, -0.28 * Math.abs(shape.r)])
  points.push([qrsStart + w, shape.st])

  const stEnd = qrsStart + w + 0.07
  points.push([stEnd, shape.st])

  const tDur = 0.17
  for (let i = 0; i <= 8; i += 1) {
    const t = (tDur * i) / 8
    // Una gobba sola, o due di segno opposto se la T è bifasica: mezzo periodo
    // di seno contro un periodo intero.
    const lobo = shape.tBiphasic
      ? Math.sin(2 * Math.PI * (i / 8))
      : Math.sin((Math.PI * i) / 8)
    points.push([stEnd + t, shape.st * (1 - i / 8) + shape.t * lobo])
  }
  if (shape.u) {
    const uStart = stEnd + tDur + 0.05
    for (let i = 0; i <= 5; i += 1) {
      points.push([uStart + (0.1 * i) / 5, shape.u * Math.sin((Math.PI * i) / 5)])
    }
  }
  return points
}

/**
 * I battiti prematuri, e la pausa che lasciano dietro.
 *
 * ## Perché non bastava una forma in più
 *
 * Un extrasistole non è un battito diverso: è un battito **fuori tempo**. Il
 * segno che si insegna a riconoscere non sta nel complesso largo — sta nel
 * fatto che arriva presto e che dopo c'è un buco. Metterlo nel piano come una
 * seconda forma, senza toccare la cadenza, darebbe un ritmo regolare con dentro
 * dei complessi strani, che non è quello che si vede su un monitor.
 *
 * ## La pausa dice da dove viene
 *
 * Un extrasistole **ventricolare** non arriva al nodo del seno, che continua a
 * scaricare per conto suo: il battito successivo cade all'ora in cui sarebbe
 * caduto comunque, e fra l'extrasistole e lui c'è una pausa piena
 * (`compensatory`). Un extrasistole **atriale** invece il nodo del seno lo
 * sente e riparte da lì: la pausa è più corta. Sono due misure diverse sullo
 * schermo, e sono il modo in cui si distingue un'origine dall'altra prima di
 * guardare la larghezza del QRS.
 */
export interface Ectopy {
  /**
   * Ogni quanti battiti ne arriva uno prematuro: 2 è il bigeminismo, 3 il
   * trigeminismo. Nullo quando arrivano sparsi, e allora decide `chance`.
   */
  every: number | null
  /** Con `every` nullo, la probabilità che un battito qualsiasi sia prematuro. */
  chance: number
  /** Le forme possibili. Più di una vuol dire multifocale. */
  shapes: BeatShape[]
  /** Quanto arriva in anticipo, come frazione dell'intervallo atteso. */
  prematurity: number
  /** Pausa piena dopo: il nodo del seno non si è accorto di niente. */
  compensatory: boolean
  /** Ventricolare: il ventricolo si riempie poco, e il polso lo dice. */
  ventricular: boolean
}

export interface Plan {
  /** Forma del battito, se ci sono battiti riconoscibili. */
  shape: BeatShape | null
  /** Intervallo fra un battito e il successivo, in secondi. */
  interval: number
  /** Quanto l'intervallo può variare, da 0 (regolare) a 1. */
  irregularity: number
  /** Battiti saltati secondo Wenckebach: il PR si allunga finché uno cade. */
  wenckebach?: boolean
  /** Battiti prematuri in mezzo ai normali, se ce ne sono. */
  ectopy?: Ectopy
  /** Atri e ventricoli indipendenti: le P camminano per conto loro. */
  dissociated?: boolean
  /** Fondo continuo: onde F, tremolio fibrillatorio, torsione. */
  background?: (t: number, rnd: () => number) => number
  /** Nessun battito: solo il fondo (fibrillazione ventricolare). */
  chaos?: (t: number) => number
  /**
   * Le P dissociate, quando non sono quelle a settantadue del blocco completo: le proprie sotto lo
   * stimolo ventricolare, o le stimolate che il nodo non passa (`pacemaker/`).
   */
  atri?: { intervallo: number; spike: boolean }
  /** Gli spicchi che non catturano, sopra tutto il resto: periodici, e indipendenti dai battiti. */
  spicchi?: { intervallo: number; a: boolean; v: boolean; av: number }
}

/** Quanto è alto lo spicco atriale e quello ventricolare dell'epicardico, in mV. */
export const SPICCO_A = 0.7
export const SPICCO_V = 1.1

/** Lo spicco: piatto, sei millisecondi, così il campionamento non lo salta. */
export function spicco(t: number, quando: number, mV: number): number {
  const dt = t - quando
  return dt >= 0 && dt <= 0.006 ? mV : 0
}

/** Il battito con i suoi spicchi sommati alla curva. */
function conSpicchi(curva: (t: number) => number, spicchi: BeatShape['spicchi']): (t: number) => number {
  if (!spicchi?.length) return curva
  return (t) => spicchi.reduce((v, s) => v + spicco(t, s.t, s.mV), curva(t))
}

/** Gli spicchi sovrapposti del piano a `t` secondi: la competizione e la perdita di cattura. */
export function spicchiSovrapposti(plan: Plan, t: number): number {
  const s = plan.spicchi
  if (!s || !(s.intervallo > 0)) return 0
  const dt = t - Math.floor(t / s.intervallo) * s.intervallo
  return (s.a ? spicco(dt, 0, SPICCO_A) : 0) + (s.v ? spicco(dt, s.av, SPICCO_V) : 0)
}

/** Quante onde F per ogni QRS, se il nome lo dice: «2 to 1» dà 2. Gemello di Python. */
export function conduzioneDelFlutter(rhythm: string): number | null {
  const trovato = /(\d)\s*(?:to|:)\s*1\b/.exec(rhythm.toLowerCase())
  return trovato ? Number(trovato[1]) : null
}

/** Le onde F al minuto: i ventricoli per il blocco, o 300 se il blocco non è fisso. */
export function ondeFAlMinuto(rhythm: string, bpm: number): number {
  const rapporto = conduzioneDelFlutter(rhythm)
  return rapporto ? bpm * rapporto : 300
}

export function planFor(rhythm: string, family: string, rate: number): Plan {
  const bpm = rate > 20 && rate < 320 ? rate : 75
  const interval = 60 / bpm
  const name = rhythm.toLowerCase()

  // **L'asistolia è una linea piatta**, e finché non stava qui il monitor
  // cadeva sul disegno predefinito: due complessi QRS sotto la scritta
  // «asystole», che è la cosa peggiore che questo pannello possa mostrare —
  // chi lo guarda dal corridoio legge un ritmo dove non c'è.
  //
  // Piatta non vuol dire dritta: la linea di base ondeggia col respiro e col
  // rumore dell'elettrodo, e un tratto perfettamente orizzontale si legge come
  // «elettrodi staccati» invece che come asistolia.
  //
  // L'attività elettrica senza polso **non** sta qui: sul monitor mostra un
  // ritmo organizzato, ed è tutto il punto — il tracciato non la distingue.
  if (name.includes('asisto') || name.includes('asysto')) {
    return {
      shape: null,
      interval,
      irregularity: 0,
      chaos: (t) =>
        0.035 * Math.sin(2 * Math.PI * 0.25 * t) +
        0.015 * Math.sin(2 * Math.PI * 1.1 * t + 0.7),
    }
  }
  if (name.includes('pulseless electrical') || name.includes('attivita elettrica senza polso')) {
    // **La PEA si disegna come quello che è**: complessi organizzati alla
    // frequenza scritta. Non c'è una morfologia della PEA — è uno stato del
    // paziente, non del tracciato — e il monitor di chi è in PEA mostra un
    // ritmo che sembra a posto. È esattamente la cosa da non fidarsene: il
    // polso lo dicono le dita, non lo schermo, ed è il motivo per cui questo
    // ritmo non accende nessun allarme di crisi.
    //
    // Senza una frequenza scritta non si inventano complessi: cade sul ramo
    // dello zero più sotto, che lascia la linea di base.
    if (rate > 0) return { shape: SINUS, interval, irregularity: 0.02 }
  }
  if (name.includes('ventricular fibrillation')) {
    // Nessuna sistole: ampiezza e frequenza cambiano di continuo.
    return {
      shape: null,
      interval,
      irregularity: 0,
      chaos: (t) =>
        0.45 * Math.sin(2 * Math.PI * 5.5 * t + 1.7 * Math.sin(2 * Math.PI * 1.3 * t)) +
        0.22 * Math.sin(2 * Math.PI * 9.1 * t + 0.8) +
        0.12 * Math.sin(2 * Math.PI * 14.3 * t + 2.2),
    }
  }
  if (name.includes('ventricular flutter')) {
    return {
      shape: null,
      interval,
      irregularity: 0,
      chaos: (t) => 0.85 * Math.sin(2 * Math.PI * 4.5 * t),
    }
  }
  if (name.includes('torsades')) {
    // La torsione: la stessa oscillazione veloce, con l'ampiezza che gira.
    return {
      shape: null,
      interval,
      irregularity: 0,
      chaos: (t) => 0.9 * Math.sin(2 * Math.PI * 4.2 * t) * Math.sin(2 * Math.PI * 0.55 * t),
    }
  }
  // «supraventricular tachycardia» contiene «ventricular tachycardia»: senza
  // l'esclusione la TPSV prendeva questo ramo e usciva a QRS largo, cioè il
  // ritmo opposto. Lo stesso controllo c'è già in `ritmo.ts` e `alarms.ts`.
  if (name.includes('ventricular tachycardia') && !name.includes('supraventricular')) {
    // La frequenza è quella scritta: un minimo imposto qui disegnava a 140 una
    // TV che il monitor contava a 120.
    return {
      shape: { p: 0, pr: 0.02, qrs: 0.16, r: R_MV * 0.95, st: -0.08, t: -0.35 },
      interval,
      irregularity: 0.02,
    }
  }
  if (name.includes('atrial fibrillation')) {
    return {
      shape: { ...SINUS, p: 0 },
      interval,
      // L'irregolarità è il segno: senza, una FA sembra un ritmo sinusale
      // a cui è stata cancellata la P.
      irregularity: 0.28,
      // Le onde f: irregolari per definizione, e visibili — se restano sotto la
      // grossezza del tratto la traccia sembra un ritmo regolare senza P, che
      // è un altro ritmo.
      background: (t, rnd) =>
        0.055 * Math.sin(2 * Math.PI * 6.5 * t) +
        0.035 * Math.sin(2 * Math.PI * 11.3 * t + 1.1) +
        0.05 * (rnd() - 0.5),
    }
  }
  if (name.includes('atrial flutter')) {
    // Le onde a dente di sega sono la frequenza dei ventricoli per il grado del
    // blocco: un 2:1 a 140 ha le F a 280. Fisse a 300, il 2:1 a 75 era un 4:1.
    // Un blocco fisso conduce regolare; solo il variabile è irregolare.
    const hz = ondeFAlMinuto(name, bpm) / 60
    return {
      shape: { ...SINUS, p: 0 },
      interval,
      irregularity: conduzioneDelFlutter(name) === null ? 0.2 : 0,
      background: (t) => 0.16 * (2 * ((t * hz) % 1) - 1),
    }
  }
  if (name.includes('3rd degree') || name.includes('complete heart block')) {
    // La frequenza è quella dello scappamento, e si disegna quella: il tetto a
    // 45 faceva 45 complessi sotto un monitor che segnava 60.
    return {
      shape: { p: 0, pr: 0.02, qrs: 0.15, r: R_MV * 0.8, st: 0, t: -0.25 },
      interval,
      irregularity: 0.02,
      dissociated: true,
    }
  }
  if (name.includes('mobitz i') || name.includes('wenckebach')) {
    // Quattro P e tre QRS per ciclo: la frequenza del monitor è dei
    // ventricoli, quindi l'atrio va a 4/3.
    return { shape: SINUS, interval: (interval * 3) / 4, irregularity: 0, wenckebach: true }
  }
  if (name.includes('1st degree')) {
    return { shape: { ...SINUS, pr: 0.28 }, interval, irregularity: 0 }
  }
  if (family === 'junctional') {
    return { shape: { ...SINUS, p: 0, pr: 0.06 }, interval, irregularity: 0.02 }
  }
  if (family === 'svt') {
    return { shape: { ...SINUS, p: 0, pr: 0.06, t: 0.2 }, interval, irregularity: 0 }
  }
  if (family === 'bundle_branch') {
    return { shape: { ...SINUS, qrs: 0.15, t: -0.28 }, interval, irregularity: 0.02 }
  }
  if (name.includes('wellens')) {
    // **Wellens non è un infarto in atto**, ed è tutto il suo interesse: la
    // discendente anteriore è critica ma ancora aperta, il paziente spesso in
    // quel momento non ha nemmeno dolore, e il tratto ST è **piatto**. Il segno
    // sta solo nell'onda T.
    //
    // Finendo nella famiglia `ischemia` questi due quadri venivano disegnati
    // col sopraslivellamento di uno STEMI: chi guardava il monitor imparava a
    // riconoscere un infarto conclamato esattamente dove la lezione è che non
    // c'è, e che il tracciato quasi normale non autorizza a mandare a casa.
    return {
      shape: name.includes('type a')
        ? // Tipo A: T bifasica, positiva e poi negativa.
          { ...SINUS, st: 0.03, t: 0.3, tBiphasic: true }
        : // Tipo B: T profondamente invertita e simmetrica.
          { ...SINUS, st: 0.02, t: -0.55 },
      interval,
      irregularity: 0.02,
    }
  }
  if (family === 'ischemia') {
    // Sopraslivellamento del tratto ST: il segno che si cerca guardando.
    return { shape: { ...SINUS, st: 0.35, t: 0.45 }, interval, irregularity: 0.02 }
  }
  const iperkaliemia = name.includes('hyperkalemia') || name.includes('hyperkalaemia')
  if (iperkaliemia && (name.includes('pvc') || name.includes('premature ventricular'))) {
    // Prima del ramo dell'iperkaliemia, come in `ecg_trace.plan_for`: T appuntite
    // con il QRS ancora quasi stretto, e le extrasistoli ventricolari sopra.
    return {
      shape: { ...SINUS, p: 0.06, qrs: 0.11, t: 0.75 },
      interval,
      irregularity: 0.02,
      ectopy: {
        every: null,
        chance: 0.14,
        shapes: [PVC],
        prematurity: 0.36,
        compensatory: true,
        ventricular: true,
      },
    }
  }
  if (iperkaliemia) {
    return { shape: { ...SINUS, p: 0.04, qrs: 0.14, t: 0.75 }, interval, irregularity: 0.02 }
  }
  if (name.includes('hypokal')) {
    return { shape: { ...SINUS, t: 0.08, u: 0.22 }, interval, irregularity: 0.02 }
  }
  if (family === 'preexcitation') {
    return { shape: { ...SINUS, pr: 0.1, qrs: 0.13, delta: true }, interval, irregularity: 0.02 }
  }
  if (family === 'toxicology') {
    return { shape: { ...SINUS, p: 0.06, qrs: 0.16, r: R_MV * 0.8 }, interval, irregularity: 0.03 }
  }
  if (name.includes('low qrs voltage')) {
    return { shape: { ...SINUS, p: 0.06, r: R_MV * 0.28, t: 0.1 }, interval, irregularity: 0.02 }
  }
  if (name.includes('paced') || name.includes('pacing')) {
    return {
      shape: { ...SINUS, p: 0, pr: 0.05, qrs: 0.16, r: R_MV * 0.85, t: -0.3, paced: true },
      interval,
      irregularity: 0,
    }
  }
  // I battiti prematuri. **L'ordine dei due controlli non è indifferente**:
  // «supraventricular premature» contiene «ventricular premature», e cercando
  // prima il secondo ogni extrasistole sopraventricolare diventerebbe
  // ventricolare — complesso largo al posto di uno stretto, cioè il contrario
  // di quello che il tracciato deve far riconoscere.
  if (name.includes('supraventricular premature') || name.includes('atrial premature')) {
    return {
      shape: SINUS,
      interval,
      irregularity: 0.02,
      ectopy: {
        every: null,
        chance: 0.14,
        shapes: [PAC],
        prematurity: 0.32,
        // L'atrio arriva al nodo del seno e lo fa ripartire: pausa corta.
        compensatory: false,
        ventricular: false,
      },
    }
  }
  if (name.includes('junctional premature')) {
    return {
      shape: SINUS,
      interval,
      irregularity: 0.02,
      ectopy: {
        every: null,
        chance: 0.14,
        shapes: [PJC],
        prematurity: 0.3,
        compensatory: false,
        ventricular: false,
      },
    }
  }
  const bigemino = name.includes('bigemin')
  const trigemino = name.includes('trigemin')
  if (
    bigemino ||
    trigemino ||
    name.includes('ventricular premature') ||
    name.includes('premature ventricular')
  ) {
    // Multifocale: due focolai, quindi due forme che si alternano a caso. È il
    // segno che distingue un cuore irritabile da uno con un solo punto che
    // scarica, e sullo schermo è l'unica differenza visibile.
    const multifocale = name.includes('multifocal')
    return {
      shape: SINUS,
      interval,
      irregularity: 0.02,
      ectopy: {
        every: bigemino ? 2 : trigemino ? 3 : null,
        chance: 0.14,
        shapes: multifocale ? [PVC, PVC_ALTRO] : [PVC],
        prematurity: 0.36,
        // Il ventricolo non risale al nodo del seno: pausa piena.
        compensatory: true,
        ventricular: true,
      },
    }
  }
  if (name.includes('wide qrs')) {
    // Una tachicardia sinusale a QRS largo: la frequenza è quella scritta, ma
    // il complesso è quello di un blocco di branca. Senza questo ramo cadeva
    // nel sinusale qui sotto e usciva a QRS stretto — cioè come il ritmo da cui
    // deve essere distinta.
    return { shape: { ...SINUS, qrs: 0.14, t: -0.22 }, interval, irregularity: 0.015 }
  }
  // ## Zero battiti al minuto, e un nome che non si riconosce
  //
  // Arrivare qui vuol dire che nessun ramo ha riconosciuto il ritmo: il
  // ripiego è il sinusale, e la frequenza mancante diventa 75 — che va bene
  // per un ritmo scritto male su un paziente vivo, e non va bene per niente
  // quando la frequenza scritta è **zero**. Il 28 agosto 2026 uno stato di
  // arresto è uscito con `non ritmico` (il modello, a parole sue) e FC 0: il
  // monitor della sala avrebbe disegnato complessi a 75 sotto un HR che
  // segnava 0. È lo stesso disastro dell'asistolia coi QRS qui sopra, per una
  // via diversa — e le parole con cui un modello chiama l'assenza di ritmo
  // cambieranno ancora, mentre lo zero no.
  //
  // Zero è un reperto, non un dato mancante: se non c'è un ritmo riconosciuto
  // che spieghi quello zero, non ci sono complessi da disegnare.
  if (rate === 0) {
    return {
      shape: null,
      interval,
      irregularity: 0,
      chaos: (t) =>
        0.035 * Math.sin(2 * Math.PI * 0.25 * t) +
        0.015 * Math.sin(2 * Math.PI * 1.1 * t + 0.7),
    }
  }
  // Sinusale, pediatrico compreso: cambia solo la frequenza, che arriva da fuori.
  // L'aritmia sinusale respira, e si vede.
  return {
    shape: SINUS,
    interval,
    irregularity: name.includes('arrhythmia') ? 0.12 : 0.015,
  }
}

/** La P stimolata da sola, dopo lo spicco: comincia `dopo` secondi più in là. */
function pOnlyDopo(amplitude: number, dopo: number): [number, number][] {
  return [[0, 0], ...pOnly(amplitude).map(([t, v]): [number, number] => [t + dopo, v])]
}

/** I soli punti dell'onda P: è quello che resta di un battito non condotto. */
export function pOnly(amplitude: number): [number, number][] {
  const points: [number, number][] = []
  for (let i = 0; i <= 8; i += 1) {
    points.push([(0.09 * i) / 8, amplitude * Math.sin((Math.PI * i) / 8)])
  }
  return points
}

/**
 * Da punti di controllo a funzione del tempo, per interpolazione lineare.
 * Fuori dall'intervallo dei punti vale zero, così i battiti si possono sommare
 * senza che ognuno tiri la linea isoelettrica verso di sé.
 */
export function piecewise(points: [number, number][]): (t: number) => number {
  const first = points[0][0]
  const last = points[points.length - 1][0]
  return (t: number) => {
    if (t <= first || t >= last) return 0
    // Ricerca binaria: a 190 al minuto i treni sono venti e i campioni mille.
    let low = 0
    let high = points.length - 1
    while (high - low > 1) {
      const mid = (low + high) >> 1
      if (points[mid][0] <= t) low = mid
      else high = mid
    }
    const [t0, v0] = points[low]
    const [t1, v1] = points[high]
    if (t1 === t0) return v1
    return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0)
  }
}

/**
 * Il treno dei battiti: quando torna il prossimo, e che forma ha.
 *
 * Sta qui e non nei due disegnatori perché la cadenza è **clinica** — il
 * Wenckebach che allunga il PR finché un battito cade, le P del blocco completo
 * che camminano per conto loro — e una regola clinica scritta in due posti è
 * una regola che prima o poi diverge in due posti.
 *
 * Il treno è **incrementale**: `upTo(t)` restituisce i battiti che cominciano
 * prima di `t` e ricorda dove è arrivato, così la striscia ferma lo chiama una
 * volta sola per cinque secondi e il monitor che scorre lo chiama ad ogni
 * fotogramma per i millisecondi appena passati.
 *
 * `setPlan` cambia il piano **senza toccare l'istante del prossimo battito**:
 * è quello che fa un cuore vero quando la frequenza cambia, e sullo schermo è
 * l'unico modo perché un ritocco della frequenza non tagli a metà il QRS che si
 * sta disegnando.
 */
export interface Beat {
  /** Istante in cui comincia il battito, in secondi. */
  start: number
  /** Il valore del battito a `t` secondi dal suo inizio. */
  at: (t: number) => number
  /** I punti di controllo, per chi campiona sulle punte invece che a griglia. */
  points: [number, number][]
  /**
   * Vero se questo battito è un QRS: è il battito che fa il bip, e quello che
   * il polso segue. Falso per le P sole — quella di un battito non condotto e
   * quelle dissociate del blocco completo.
   */
  qrs: boolean
  /**
   * Vero se questo battito è prematuro. Chi disegna il polso lo guarda: un
   * ventricolo che ha avuto meno tempo per riempirsi eietta meno, e
   * sull'ossimetro l'onda che segue un extrasistole è più bassa delle altre o
   * non c'è. È il deficit di polso, e si vede solo mettendo le due curve una
   * sopra l'altra.
   */
  ectopic: boolean
  /** Gli istanti degli spicchi dello stimolatore, dall'inizio del battito: chi campiona li prende. */
  spicchi?: number[]
}

export interface BeatTrain {
  /** I battiti che cominciano prima di `until`. Chiamate successive continuano. */
  upTo: (until: number) => Beat[]
  /** Cambia il piano da qui in avanti. Il battito già cominciato finisce. */
  setPlan: (plan: Plan) => void
}

export function createBeatTrain(plan: Plan, rnd: () => number, from = 0): BeatTrain {
  let current = plan
  let next = from
  let atrialNext = from
  let step = 0
  /** Se il prossimo battito è prematuro: deciso quando si è fissata la sua ora. */
  let nextEctopic = false

  const upTo = (until: number): Beat[] => {
    const beats: Beat[] = []
    if (current.chaos || !current.shape) {
      // Fibrillazione ventricolare, asistolia: nessun battito, solo il fondo.
      // Gli istanti avanzano lo stesso, o all'uscita dal caos il treno
      // recupererebbe di colpo tutti i battiti che non ha emesso.
      next = Math.max(next, until)
      atrialNext = Math.max(atrialNext, until)
      return beats
    }
    while (next < until) {
      const jitter = current.irregularity ? 1 + current.irregularity * (rnd() - 0.5) * 2 : 1
      const ecto = current.ectopy
      const ectopic = nextEctopic && ecto !== undefined

      if (ectopic && ecto) {
        const shape = ecto.shapes[Math.floor(rnd() * ecto.shapes.length)] ?? ecto.shapes[0]
        const points = beatPoints(shape)
        beats.push({ start: next, at: conSpicchi(piecewise(points), shape.spicchi), points, qrs: true, ectopic: true, spicchi: shape.spicchi?.map((x) => x.t) })
      } else {
        const shape: BeatShape = { ...current.shape }
        let dropped = false
        if (current.wenckebach) {
          // Ciclo di quattro: PR che si allunga, poi un battito che cade e
          // resta la sola P.
          const inCycle = step % 4
          shape.pr = 0.16 + inCycle * 0.07
          dropped = inCycle === 3
        }
        const points = dropped ? pOnly(shape.p) : beatPoints(shape)
        beats.push({
          start: next,
          at: conSpicchi(piecewise(points), dropped ? undefined : shape.spicchi),
          points,
          qrs: !dropped,
          ectopic: false,
          spicchi: dropped ? undefined : shape.spicchi?.map((x) => x.t),
        })
      }
      step += 1

      // ## L'anticipo si programma, non si applica dopo
      //
      // Un battito prematuro arriva **prima** dell'ora prevista, e la
      // tentazione è di emetterlo indietro nel tempo quando si arriva alla sua
      // ora. Non si può: `upTo(t)` promette i battiti che cominciano prima di
      // `t`, e chi disegna ha già passato il pennello su quel tratto. Un
      // battito consegnato con la data di ieri non viene disegnato — il tratto
      // è passato — e non viene nemmeno contato, perché `qrsBetween` cerca in
      // una finestra che è già oltre. L'extrasistole spariva così: le pause
      // c'erano, il complesso no.
      //
      // Quindi l'anticipo si sconta **qui**, decidendo adesso l'ora del
      // prossimo battito. `next` è sempre l'istante vero del battito che
      // seguirà, e la promessa di `upTo` resta vera.
      let advance = current.interval * jitter
      if (ectopic && ecto) {
        // La pausa dopo l'extrasistole. Piena: il nodo del seno non se n'è
        // accorto e il battito dopo cade all'ora che aveva già — cioè un
        // intervallo intero più l'anticipo appena scontato. Corta: il nodo è
        // ripartito da qui.
        advance = ecto.compensatory
          ? current.interval * (1 + ecto.prematurity)
          : current.interval
      }
      const seguente =
        ecto !== undefined &&
        (ecto.every !== null ? step % ecto.every === ecto.every - 1 : rnd() < ecto.chance)
      if (seguente && ecto) advance -= current.interval * ecto.prematurity
      next += advance
      nextEctopic = seguente
    }

    if (current.dissociated) {
      // Le P dell'atrio, che nel blocco completo camminano a settantadue al
      // minuto senza guardare i ventricoli — o alla frequenza dello stimolatore,
      // quando sono le sue e il nodo non le passa.
      const atri = current.atri
      const atrial = atri && atri.intervallo > 0 ? atri.intervallo : 60 / 72
      const points = atri?.spike ? pOnlyDopo(0.12, 0.012) : pOnly(0.15)
      const wave = atri?.spike ? conSpicchi(piecewise(points), [{ t: 0, mV: SPICCO_A }]) : piecewise(points)
      while (atrialNext < until) {
        beats.push({ start: atrialNext, at: wave, points, qrs: false, ectopic: false, spicchi: atri?.spike ? [0] : undefined })
        atrialNext += atrial
      }
    } else {
      atrialNext = next
    }
    return beats
  }

  return { upTo, setPlan: (p: Plan) => (current = p) }
}
