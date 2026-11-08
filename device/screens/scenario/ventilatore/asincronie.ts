/**
 * Il paziente che respira contro la macchina.
 *
 * Riferimento: de Haro et al., *Patient-ventilator asynchronies during
 * mechanical ventilation*, ICMx 2019 — DOI `10.1186/s40635-019-0234-5`
 * (fig. 1 per le forme d'onda, fig. 2 per i quattro gradi della fame di
 * flusso).
 *
 * ## Il drive è un treno, e non sa niente del ventilatore
 *
 * L'idea che tiene insieme tutto questo file è una sola: lo **sforzo del
 * paziente** è un'onda con una frequenza sua, che va avanti per conto proprio.
 * Il ventilatore ha la sua, impostata da chi lo ha regolato. Le asincronie sono
 * quello che succede quando le due frequenze non coincidono — ed è per questo
 * che si vedono soltanto guardando le onde: nessun numero, da solo, dice che i
 * due treni sono sfasati.
 *
 * Nel simulatore d'origine il termine `Pmusc` esisteva già, ma solo dentro il
 * ramo PSV e legato al ciclo della macchina: era uno sforzo che per costruzione
 * arrivava sempre al momento giusto, cioè un paziente che non può essere
 * asincrono. Qui il treno è indipendente e il trigger è una **conseguenza**:
 * se lo sforzo supera la soglia, l'atto parte; se no, resta una tacca.
 *
 * ## Quello che non sta qui, e non ci deve stare
 *
 * L'etichetta. Il device dei discenti mostra onde deformate e numeri coerenti e
 * **mai** il nome dell'asincronia — è la regola del niente-diagnosi applicata al
 * ventilatore, la stessa per cui il titolo dello stato è stato tolto
 * dall'istantanea. Il nome vive nel pannello della regia e nel registro, cioè
 * dove sta chi la diagnosi ce l'ha già.
 */

import { estrazione } from './caso'

/**
 * I tipi che il motore sa produrre, e la deformazione che li firma.
 *
 * 1. `sforzo-inefficace` — una tacca su flusso e Paw che non arriva al
 *    trigger: la frequenza spontanea è più alta di quella erogata.
 * 2. `doppio-ciclo` — lo sforzo continua oltre il tempo inspiratorio: due atti
 *    attaccati senza espirazione in mezzo, e il volume del primo si somma al
 *    secondo.
 * 3. `reverse-trigger` — è l'insufflazione passiva a innescare il diaframma,
 *    non il contrario: succede da sedati profondi, e a fine inspirazione può
 *    degenerare in doppio ciclo.
 * 4. `fame-di-flusso` — in VC il flusso è fisso e lo sforzo ne chiede di più:
 *    la Paw si scava, e con i gradi cresce la concavità fino al doppio ciclo.
 * 5. `ciclaggio-precoce` e `ciclaggio-ritardato` — la macchina finisce l'atto
 *    prima o dopo il paziente.
 * 6. `auto-trigger` — la macchina parte da sola, per una perdita o per le
 *    oscillazioni del cuore: nessuno sforzo, e l'atto c'è lo stesso.
 */
export type TipoAsincronia =
  | 'sforzo-inefficace'
  | 'doppio-ciclo'
  | 'reverse-trigger'
  | 'fame-di-flusso'
  | 'ciclaggio-precoce'
  | 'ciclaggio-ritardato'
  | 'auto-trigger'

export const TIPI_ASINCRONIA: TipoAsincronia[] = [
  'sforzo-inefficace',
  'doppio-ciclo',
  'reverse-trigger',
  'fame-di-flusso',
  'ciclaggio-precoce',
  'ciclaggio-ritardato',
  'auto-trigger',
]

/** Lo sforzo respiratorio del paziente: quanto spesso, e quanto forte. */
export interface Drive {
  /** Atti spontanei al minuto. **Zero vuol dire passivo**: nessuno sforzo. */
  frequenza: number
  /** Intensità dello sforzo, da 0 a 1. Uno è uno sforzo massimale. */
  intensita: number
  /**
   * Quanto della sua forza il diaframma ha ancora, da 0 a 1; manca = intera.
   *
   * È la parte che il curaro non ha tolto (`respiroTolto` del motore, §399), e
   * sta accanto al drive invece di riscriverlo: il paziente **vuole** ancora
   * respirare a quella frequenza, e quando il blocco passa riprende da lì. Chi
   * legge il drive per farne fisica passa da `driveEfficace`.
   */
  forza?: number
}

/**
 * Il drive che arriva ai polmoni: lo sforzo scalato dalla forza che resta, e
 * senza forza nessun atto — in pressione di supporto il trigger non parte più
 * ed entra la frequenza di backup, in controllata spariscono le asincronie.
 */
export function driveEfficace(drive: Drive): Drive {
  const forza = Math.min(1, Math.max(0, drive.forza ?? 1))
  if (forza >= 1) return { frequenza: drive.frequenza, intensita: drive.intensita }
  if (forza <= 0) return { frequenza: 0, intensita: 0 }
  return { frequenza: drive.frequenza, intensita: drive.intensita * forza }
}

/** Il paziente curarizzato: niente treno, niente asincronie possibili. */
export const DRIVE_ASSENTE: Drive = { frequenza: 0, intensita: 0 }

/**
 * La depressione muscolare a sforzo pieno, in cmH₂O.
 *
 * Dieci: è l'ordine di grandezza di una Pmusc misurata con il palloncino
 * esofageo in un paziente che tira. L'originale usava sette, ma lì lo sforzo
 * serviva solo ad aiutare il ventilatore in PSV; qui deve anche **non** riuscire
 * a far partire un atto, e per farlo deve poter arrivare abbastanza in alto da
 * rendere visibile la tacca quando non ce la fa.
 */
export const PMUSC_MASSIMA = 10

/**
 * Come si regola l'asincronia dalla regia.
 *
 * La quota è la frazione degli atti coinvolti, non un numero di eventi al
 * minuto: legata agli atti resta vera anche se poi si cambia la frequenza,
 * mentre «sei al minuto» su un paziente portato da 12 a 30 atti diventa
 * un'altra cosa senza che nessuno l'abbia deciso. Chi in regia vuole pensare in
 * eventi al minuto usa `quotaDaEventi()`.
 */
export interface ImpostazioniAsincronia {
  tipo: TipoAsincronia
  /** Frazione degli atti coinvolti, da 0 a 1. */
  quota: number
  /** Gravità della fame di flusso, 1–4 (fig. 2 di de Haro). Uno altrove. */
  grado?: number
}

/** Da «sei eventi al minuto» alla quota, che è quello che il motore usa. */
export function quotaDaEventi(eventiAlMinuto: number, attiAlMinuto: number): number {
  if (attiAlMinuto <= 0) return 0
  return Math.min(1, Math.max(0, eventiAlMinuto / attiAlMinuto))
}

/**
 * Una rampa: un valore che si sposta in un tempo invece di saltare.
 *
 * Serve all'addormentamento — «frequenza spontanea da 15 a 0 in trenta
 * secondi» è l'induzione, e va guardata mentre succede — e al risveglio, che è
 * la stessa cosa al contrario. È anche il comando che governa la Paw della
 * ventilazione manuale: gli atti si diradano e l'onda si appiattisce sull'APL.
 *
 * Uno scatto secco non è la stessa cosa raccontata più in fretta: in aula
 * insegna che il paziente si ferma di colpo, che non succede mai.
 */
export interface Rampa {
  da: number
  a: number
  /** Quando comincia, nel tempo del ventilatore (secondi). */
  inizioSec: number
  durataSec: number
}

/** Dove sta la rampa a quell'istante. Senza rampa, il valore fermo. */
export function valoreRampa(rampa: Rampa | null, tSec: number, fermo: number): number {
  if (!rampa) return fermo
  if (rampa.durataSec <= 0) return rampa.a
  const avanzamento = (tSec - rampa.inizioSec) / rampa.durataSec
  if (avanzamento <= 0) return rampa.da
  if (avanzamento >= 1) return rampa.a
  return rampa.da + (rampa.a - rampa.da) * avanzamento
}

/** Il periodo del treno spontaneo, in secondi. Senza drive, infinito. */
export function periodoSpontaneoSec(drive: Drive): number {
  const { frequenza } = driveEfficace(drive)
  if (frequenza <= 0) return Number.POSITIVE_INFINITY
  return 60 / frequenza
}

/**
 * Quanto dura una contrazione, in secondi.
 *
 * Il tempo neurale inspiratorio non segue la frequenza in modo proporzionale:
 * chi respira a trenta non fa inspirazioni da un secondo. Si tiene il più corto
 * fra un secondo e il quaranta per cento del ciclo.
 */
export function durataSforzoSec(drive: Drive): number {
  const periodo = periodoSpontaneoSec(drive)
  if (!isFinite(periodo)) return 0
  return Math.min(1, periodo * 0.4)
}

/** A quale atto spontaneo appartiene questo istante. Senza drive, -1. */
export function indiceAtto(tSec: number, drive: Drive, sfasamentoSec = 0): number {
  const periodo = periodoSpontaneoSec(drive)
  if (!isFinite(periodo)) return -1
  return Math.floor((tSec - sfasamentoSec) / periodo)
}

/**
 * La pressione muscolare a quell'istante, in cmH₂O — positiva mentre tira.
 *
 * Mezza sinusoide sulla durata dello sforzo, zero per il resto del ciclo: è la
 * forma con cui la Pmusc compare nelle figure, e basta a generare tutte le
 * deformazioni che servono. Chi la usa la sottrae alla pressione delle vie
 * aeree o la divide per la resistenza, secondo che gli serva una pressione o
 * un flusso.
 */
export function pmusc(tSec: number, drive: Drive, sfasamentoSec = 0): number {
  const periodo = periodoSpontaneoSec(drive)
  const { intensita } = driveEfficace(drive)
  if (!isFinite(periodo) || intensita <= 0) return 0
  const dentro = (((tSec - sfasamentoSec) % periodo) + periodo) % periodo
  const durata = durataSforzoSec(drive)
  if (dentro >= durata || durata <= 0) return 0
  return intensita * PMUSC_MASSIMA * Math.sin((Math.PI * dentro) / durata)
}

/**
 * Se **questo** atto è asincrono.
 *
 * Deterministico sull'indice dell'atto: la stessa sessione riguardata due volte
 * mostra le stesse tacche negli stessi punti, e una prova può contarle. Con una
 * quota a 0,3 gli atti asincroni non sono uno ogni tre in fila — sono sparsi,
 * come succede davvero — ma sono sempre gli stessi.
 */
export function attoAsincrono(
  indice: number,
  impostazioni: ImpostazioniAsincronia | null,
  seme = 1,
): boolean {
  if (!impostazioni || impostazioni.quota <= 0 || indice < 0) return false
  if (impostazioni.quota >= 1) return true
  return estrazione(seme, indice) < impostazioni.quota
}

/**
 * Il trigger a cui la quota chiesta dalla regia vale **così com'è**.
 *
 * Due litri al minuto è la regolazione con cui una macchina si accende, ed è
 * il punto in cui «sforzi inefficaci al 50%» vuol dire davvero la metà.
 */
export const TRIGGER_RIFERIMENTO = 2

/**
 * Quanti atti sono asincroni davvero, contando **come è regolato il trigger**.
 *
 * La regia dice il quadro clinico — «questo paziente perde metà degli sforzi» —
 * ma perderli o no dipende anche dalla macchina, ed è la cosa che al letto si
 * fa per prima: si tocca la sensibilità. Finché la quota era un numero fisso,
 * rendere il trigger sensibilissimo non cambiava niente e l'apparecchio
 * insegnava che quella manopola non serve.
 *
 * I due versi sono **opposti**, e sono la coppia che si insegna insieme:
 *
 * * **sforzi inefficaci** — un trigger duro li fa perdere, uno sensibile li
 *   fa passare. A 0,5 l/min ne resta un quarto di quelli chiesti, e la
 *   frequenza erogata risale verso quella nativa del paziente;
 * * **auto-trigger** — il rovescio esatto: un trigger troppo sensibile fa
 *   partire atti che nessuno ha chiesto, e indurirlo li spegne.
 *
 * Le altre asincronie non passano dal trigger — un doppio ciclo o un ciclaggio
 * ritardato nascono altrove — e tornano com'erano.
 */
export function quotaEfficace(
  impostazione: ImpostazioniAsincronia | null,
  triggerFlow: number,
): number {
  if (!impostazione || impostazione.quota <= 0) return 0
  const trigger = Math.max(0.1, triggerFlow)
  if (impostazione.tipo === 'sforzo-inefficace') {
    // **Non arriva mai a uno**, e il fermo non è prudenza numerica: una quota
    // piena vorrebbe dire zero atti erogati, cioè un paziente che tira e una
    // macchina che non risponde **mai**. Su un apparecchio vero a quel punto
    // parte la ventilazione di apnea; qui resta un filo di atti, l'allarme
    // della frequenza scatta, e chi guarda ha qualcosa da vedere invece di una
    // linea piatta che sembra un guasto del simulatore.
    return Math.min(0.95, impostazione.quota * (trigger / TRIGGER_RIFERIMENTO))
  }
  if (impostazione.tipo === 'auto-trigger') {
    return Math.min(1, impostazione.quota * (TRIGGER_RIFERIMENTO / trigger))
  }
  return impostazione.quota
}

/** La soglia clinica dell'indice di asincronia: sopra il 10% conta. */
export const SOGLIA_INDICE = 0.1

/**
 * L'indice di asincronia: atti asincroni su atti totali.
 *
 * Sopra il dieci per cento è il valore che in letteratura si associa a una
 * prognosi peggiore, ed è il numero che il report di sessione mette accanto a
 * quello che i discenti hanno fatto per correggerlo. Zero atti totali non fa
 * un indice: fa `null`, perché «zero per cento di niente» è una risposta valida
 * che non dice niente.
 */
export function indiceAsincronia(asincroni: number, totali: number): number | null {
  if (totali <= 0) return null
  return asincroni / totali
}

/**
 * I grappoli: dove le asincronie si sono addensate.
 *
 * Un grappolo è una serie di almeno `minimo` eventi che stanno dentro
 * `finestraSec` l'uno dall'altro. Il senso è clinico, non statistico: trenta
 * asincronie sparse in un'ora sono rumore di fondo, trenta in due minuti sono
 * un paziente che sta lottando, e in debriefing la differenza è tutta lì.
 */
export function grappoli(
  istantiSec: number[],
  finestraSec = 60,
  minimo = 3,
): { inizio: number; fine: number; eventi: number }[] {
  const ordinati = [...istantiSec].sort((a, b) => a - b)
  const fuori: { inizio: number; fine: number; eventi: number }[] = []
  let corrente: number[] = []
  for (const t of ordinati) {
    if (corrente.length === 0 || t - corrente[corrente.length - 1] <= finestraSec) {
      corrente.push(t)
    } else {
      if (corrente.length >= minimo)
        fuori.push({ inizio: corrente[0], fine: corrente[corrente.length - 1], eventi: corrente.length })
      corrente = [t]
    }
  }
  if (corrente.length >= minimo)
    fuori.push({ inizio: corrente[0], fine: corrente[corrente.length - 1], eventi: corrente.length })
  return fuori
}

/**
 * I casi d'uso, pronti da premere in regia.
 *
 * Non sono «esempi»: sono i tre momenti in cui un istruttore vuole davvero
 * un'asincronia, e averli su un pulsante è la differenza fra usarla e
 * dimenticarsene mentre si conduce.
 */
export const PRESET_ASINCRONIA: Record<
  string,
  { drive: Drive; asincronia: ImpostazioniAsincronia }
> = {
  // Il curaro se ne va sotto un volume controllato: il drive riappare, non
  // arriva al trigger, e gli atti si accavallano.
  decurarizzazione: {
    drive: { frequenza: 12, intensita: 0.45 },
    asincronia: { tipo: 'sforzo-inefficace', quota: 0.5 },
  },
  // Sedazione profonda: il paziente non ha un drive suo, è la macchina che gli
  // innesca il diaframma.
  'sedazione-profonda': {
    drive: { frequenza: 0, intensita: 0.5 },
    asincronia: { tipo: 'reverse-trigger', quota: 0.6 },
  },
  // Fame d'aria in volume controllato: il flusso è fisso e non basta.
  'fame-d-aria': {
    drive: { frequenza: 22, intensita: 0.9 },
    asincronia: { tipo: 'fame-di-flusso', quota: 1, grado: 3 },
  },
}
