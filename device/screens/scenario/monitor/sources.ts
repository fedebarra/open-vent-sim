/**
 * Trimmed from the Scenario Creator monitor/sources.ts: only the vital-sign
 * shape and the capnogram used by the ventilator screen.
 */

/** I numeri del paziente in questo istante, come li conosce il monitor. */
export interface Vitals {
  /** Nome canonico del ritmo (inglese, dall'archivio); vuoto = sinusale. */
  rhythm: string
  rhythmFamily: string
  heartRate: number | null
  systolic: number | null
  diastolic: number | null
  spo2: number | null
  respiratoryRate: number | null
  etco2: number | null
  temperature: number | null
  /** Pressione venosa centrale, se c'è un catetere che la misura. */
  cvp: number | null
  /** Pressione intracranica, se c'è un catetere che la misura. */
  icp: number | null
  /**
   * La media contro cui spinge la pompa, quando la linea arteriosa non la
   * legge: in A-NRP la radiale sta sopra il pallone e vede il torace fermo,
   * mentre la console lavora contro l'addome. Assente: è la media della linea.
   */
  mediaDellaPompa?: number | null
  /**
   * Polso alternante: un'onda forte e una debole, a battito regolare.
   *
   * Non è un'aritmia — la frequenza è la stessa — ed è per questo che si vede
   * **solo** sulla curva del polso e non sull'ECG. Segno di ventricolo sinistro
   * molto compromesso.
   */
  pulsusAlternans: boolean
  /**
   * Polso paradosso: l'onda cala durante l'inspirazione.
   *
   * Un po' lo fa ogni paziente; qui vuol dire il calo **marcato** del
   * tamponamento cardiaco e dell'asma grave. Sulla curva arteriosa si misura,
   * ed è la ragione per cui vale la pena disegnare il respiro anche lì.
   */
  pulsusParadoxus: boolean
  /**
   * Lo swing respiratorio del polso: quanto oscilla la pressione differenziale
   * col respiro, e a che periodo.
   *
   * È la **PPV** quando il periodo è quello del ventilatore: il segno di
   * fluidoresponsività che si legge sulle curve — sopra il 12-13% il paziente
   * risponde ai liquidi — e che nessun numero del monitor regala. Lo calcola la
   * regia (`interazioni.ts`) dalla volemia scelta e da come il paziente è
   * ventilato; qui si disegna e basta, su arteriosa **e** pletismografica
   * insieme, perché modula il polso alla sorgente e le due curve sono lo
   * stesso sangue.
   *
   * Il polso paradosso resta un'altra cosa: quello è il calo marcato e solo
   * inspiratorio del tamponamento, questo è un'oscillazione sinusoidale.
   */
  swing: {
    percento: number
    periodoSec: number
    /**
     * Quanto l'ampiezza salta da un atto all'altro, oltre alla modulazione
     * respiratoria: da 0 (oscillazione pulita, leggibile) a 1.
     *
     * Non è rumore grafico: è la ragione per cui la PPV **non si legge** in
     * ventilazione assistita con sforzi importanti. Un'onda che sale e scende
     * regolare col respiro si misura; una che cambia ampiezza a ogni atto no,
     * e chi la misurasse lo stesso otterrebbe un numero che non vuol dire
     * niente. Il monitor deve mostrare l'una o l'altra, non la prima al posto
     * della seconda.
     */
    irregolare: number
  } | null
  /** Pressione polmonare sistolica, se c'è un Swan-Ganz. */
  papSystolic: number | null
  /** Pressione polmonare diastolica: è lei a dire se si è superata la valvola. */
  papDiastolic: number | null
  /** Pressione di incuneamento: la media dell'onda a palloncino gonfiato. */
  pcwp: number | null
  /** Pressione intraddominale, se si misura in vescica. */
  iap: number | null
  /** Che cosa il team sta facendo al paziente in questo momento. */
  therapy?: unknown
}

export const VITALS_VUOTI: Vitals = {
  rhythm: '',
  rhythmFamily: '',
  heartRate: null,
  systolic: null,
  diastolic: null,
  spo2: null,
  respiratoryRate: null,
  etco2: null,
  temperature: null,
  cvp: null,
  icp: null,
  pulsusAlternans: false,
  pulsusParadoxus: false,
  swing: null,
  papSystolic: null,
  papDiastolic: null,
  pcwp: null,
  iap: null,
}

export interface Waveform {
  at: (t: number) => number
}

/**
 * Il capnogramma: rettangolare, e senza cuore dentro.
 *
 * È l'unica curva del monitor che non guarda i battiti — segue il respiro — ed
 * è la ragione per cui in arresto resta l'unica cosa che si muove insieme
 * all'ECG. Le quattro fasi sono quelle che si insegnano: spazio morto, salita
 * rapida, plateau che sale piano, discesa inspiratoria.
 */
export function createCapnoWaveform(vitals: () => Vitals, atti?: () => number | null): Waveform {
  /** Il tempo della curva a cui è caduto l'ultimo atto a mano, e il contatore che l'ha detto. */
  let attoA: number | null = null
  let contati: number | null = null
  return {
    at: (t: number) => {
      const v = vitals()
      const peak = v.etco2
      const rate = v.respiratoryRate
      const manuali = atti?.() ?? null
      if (manuali !== null) {
        if (contati !== null && manuali > contati) attoA = t
        contati = manuali
        return peak === null || peak <= 0 || attoA === null ? 0 : atteAMano(t - attoA, peak)
      }
      contati = null
      attoA = null
      if (peak === null || peak <= 0 || !rate || rate <= 0) return 0
      const cycle = 60 / rate
      const u = (t % cycle) / cycle
      if (u < 0.06) return 0
      if (u < 0.2) {
        // Salita rapida: l'aria alveolare che arriva dopo lo spazio morto.
        const k = (u - 0.06) / 0.14
        return peak * 0.93 * Math.sin((Math.PI / 2) * k) ** 0.8
      }
      if (u < 0.62) {
        // Plateau alveolare: sale ancora un poco, e la punta è l'EtCO₂.
        const k = (u - 0.2) / 0.42
        return peak * (0.93 + 0.07 * k)
      }
      if (u < 0.7) {
        const k = (u - 0.62) / 0.08
        return peak * (1 - k) ** 1.6
      }
      return 0
    },
  }
}

/**
 * Un'espirazione dopo un atto a mano, `dopo` secondi dal tocco.
 *
 * Il tocco è l'insufflazione, e lì la curva sta a zero: la CO₂ esce quando il pallone
 * si riapre. Non c'è un periodo perché non c'è una macchina: la gobba è una per tocco,
 * e un tocco arrivato a metà della gobba la tronca, come fa l'atto vero.
 */
function atteAMano(dopo: number, peak: number): number {
  if (dopo < 1 || dopo > 3.3) return 0
  if (dopo < 1.35) return peak * 0.93 * Math.sin((Math.PI / 2) * ((dopo - 1) / 0.35)) ** 0.8
  if (dopo < 3) return peak * (0.93 + 0.07 * ((dopo - 1.35) / 1.65))
  return peak * (1 - (dopo - 3) / 0.3) ** 1.6
}

