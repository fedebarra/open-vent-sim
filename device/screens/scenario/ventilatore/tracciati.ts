/**
 * Le tre registrazioni vere, e come si leggono.
 *
 * ## Che cosa sono
 *
 * Sono l'esportazione di un ventilatore da terapia intensiva — un Servo, con le
 * intestazioni in italiano e la virgola decimale — su tre modalità: volume
 * controllato, pressione controllata, pressione di supporto. Ogni riga è un
 * campione: tempo, fase del respiro, pressione delle vie aeree, flusso, volume.
 *
 * ## A che cosa servono, dato che le onde si calcolano
 *
 * In volume controllato e in pressione di supporto il motore usa il **modello**
 * (`onde.ts`): la fisica di quelle due modalità sta in quattro righe di
 * equazioni e reagisce ai parametri come deve. Ma la pressione controllata ha
 * una forma che il modello non rende — la spalla del flusso decelerante, il
 * modo in cui la pressione si appoggia al plateau — e lì si interpola il
 * tracciato registrato, riscalandolo sulla pressione e sulla compliance
 * impostate.
 *
 * Le tre restano tutte perché sono anche il **riscontro**: una curva calcolata
 * si può confrontare con una registrata sulla stessa modalità, ed è l'unico
 * modo onesto di dire che il modello somiglia a una macchina vera.
 *
 * ## Il tempo torna a zero all'inizio dell'inspirazione
 *
 * L'analisi trova il primo campione marcato `insp.` e ci porta l'origine, poi
 * riporta tutto dentro un ciclo. Senza quello i tracciati comincerebbero a metà
 * espirazione e l'interpolazione sfaserebbe le tre curve fra loro.
 */

import type { Modalita } from './parametri'

/** Un campione: tutto quello che il ventilatore scrive in una riga. */
export interface Campione {
  /** Millisecondi dall'inizio dell'inspirazione. */
  tempo: number
  paw: number
  flusso: number
  volume: number
}

export interface TracciatoRegistrato {
  modalita: Modalita
  /** Le impostazioni con cui è stato registrato: servono per riscalare. */
  impostazioni: Record<string, number>
  campioni: Campione[]
  durataCicloMs: number
  picchi: { paw: number; volume: number; flusso: number }
}

/** Le intestazioni del file, tradotte nei nomi dei nostri parametri. */
const INTESTAZIONI: Record<string, string> = {
  'PC sopra PEEP': 'pressureTarget',
  'PS sopra PEEP': 'psLevel',
  PEEP: 'peep',
  'Freq. resp.': 'frequency',
  'Freq. SIMV': 'frequency',
  'Volume corrente': 'volume',
  'T pausa (%)': 'inspiratoryPausePercent',
}

function analizza(grezzo: string, modalita: Modalita): TracciatoRegistrato {
  const righe = grezzo.split('\n')
  const inizioDati = righe.findIndex((r) => r.startsWith('[DATA]'))
  const testa = righe.slice(0, inizioDati)
  // Due righe si saltano: `[DATA]` e l'intestazione delle colonne.
  const corpo = righe.slice(inizioDati + 2)

  const impostazioni: Record<string, number> = {}
  for (const riga of testa) {
    const parti = riga.split('\t').map((p) => p.trim())
    const chiave = parti[0]
    if (INTESTAZIONI[chiave]) {
      const valore = parseFloat((parti[1] ?? '').replace(',', '.'))
      if (!isNaN(valore)) impostazioni[INTESTAZIONI[chiave]] = valore
    } else if (chiave === 'I:E') {
      const r = (parti[1] ?? '').split(':').map(Number)
      if (r.length === 2 && !isNaN(r[0]) && !isNaN(r[1])) {
        impostazioni.ratioI = r[0]
        impostazioni.ratioE = r[1]
      }
    }
  }

  const durataCicloMs = impostazioni.frequency > 0 ? (60 / impostazioni.frequency) * 1000 : 4000

  let origine = -1
  const crudi: (Campione & { fase: string })[] = []
  for (const riga of corpo) {
    const parti = riga.split('\t')
    if (parti.length < 5) continue
    const paw = parseFloat(parti[2].replace(',', '.'))
    const flusso = parseFloat(parti[3].replace(',', '.'))
    const volume = parseFloat(parti[4].replace(',', '.'))
    if (isNaN(paw) || isNaN(flusso) || isNaN(volume)) continue
    const p = parti[0].split(':').map(Number)
    const ms = (p[0] * 3600 + p[1] * 60 + p[2]) * 1000 + p[3]
    if (origine < 0 && parti[1].includes('insp')) origine = ms
    crudi.push({ tempo: ms, paw, flusso, volume, fase: parti[1] })
  }
  if (origine < 0 && crudi.length > 0) origine = crudi[0].tempo

  const campioni: Campione[] = crudi
    .map(({ tempo, paw, flusso, volume }) => ({
      tempo: (((tempo - origine) % durataCicloMs) + durataCicloMs) % durataCicloMs,
      paw,
      flusso,
      volume,
    }))
    .sort((a, b) => a.tempo - b.tempo)

  return {
    modalita,
    impostazioni,
    campioni,
    durataCicloMs,
    picchi: {
      paw: Math.max(...campioni.map((c) => c.paw)),
      volume: Math.max(...campioni.map((c) => c.volume)),
      flusso: Math.max(...campioni.map((c) => c.flusso)),
    },
  }
}

const memoria = new Map<Modalita, TracciatoRegistrato>()

/**
 * Il tracciato da usare per quella modalità.
 *
 * SIMV prende quello della pressione controllata: gli atti mandatori sono
 * quelli, e quelli spontanei in mezzo li mette il modello. CPAP e PS prendono
 * il tracciato in pressione di supporto. L'analisi si fa una volta sola e
 * resta in memoria — sono tre file di testo, non vale la pena rileggerli a ogni
 * fotogramma.
 */
export function tracciatoPer(modalita: Modalita): TracciatoRegistrato {
  const scelta: Modalita =
    modalita === 'VC' ? 'VC' : modalita === 'PS' || modalita === 'CPAP' ? 'PS' : 'PC'
  const gia = memoria.get(scelta)
  if (gia) return gia
  const grezzo = scelta === 'VC' ? REGISTRAZIONE_VC : scelta === 'PS' ? REGISTRAZIONE_PS : REGISTRAZIONE_PC
  const nuovo = analizza(grezzo, scelta)
  memoria.set(scelta, nuovo)
  return nuovo
}

/**
 * Il campione interpolato a quell'istante del ciclo.
 *
 * Fra due campioni si interpola diritto: la registrazione è a dieci
 * millisecondi nei tratti che contano, e una curva più liscia di così sarebbe
 * inventata.
 */
export function campioneA(tracciato: TracciatoRegistrato, tempoMs: number): Campione {
  const { campioni, durataCicloMs } = tracciato
  if (campioni.length === 0) return { tempo: 0, paw: 0, flusso: 0, volume: 0 }
  if (campioni.length === 1) return campioni[0]
  const dentro = ((tempoMs % durataCicloMs) + durataCicloMs) % durataCicloMs
  let i = 0
  for (let k = 0; k < campioni.length; k++) {
    if (campioni[k].tempo <= dentro) i = k
    else break
  }
  const a = campioni[i]
  const b = campioni[(i + 1) % campioni.length]
  const tempoB = b.tempo < a.tempo ? b.tempo + durataCicloMs : b.tempo
  const salto = tempoB - a.tempo
  const f = salto > 0 ? Math.min(1, Math.max(0, (dentro - a.tempo) / salto)) : 0
  return {
    tempo: dentro,
    paw: a.paw + f * (b.paw - a.paw),
    flusso: a.flusso + f * (b.flusso - a.flusso),
    volume: a.volume + f * (b.volume - a.volume),
  }
}

/**
 * Le registrazioni grezze, copiate come stanno.
 *
 * Vengono da `data/ventilatorData.ts` di open-vent-sim e sono l'unico pezzo di
 * quel progetto che entra qui **senza essere riscritto**: sono dati, non
 * codice, e riformattarli vorrebbe dire perdere il diritto di dire che sono
 * l'esportazione di una macchina vera. Per questo stanno qui dentro e non là
 * fuori — ed è la ragione per cui la cartella ha potuto uscire dal repository
 * senza portarsele via (sta in `~/Developer/open-vent-sim`, dove quel
 * file è identico a quello da cui queste stringhe sono state copiate).
 */
const REGISTRAZIONE_VC = `[REC]
Data	18/06/25 00:10:39
File	1750205438696.txt
Ventilatore	42204 
Sistema	4.4 
Versione	4.4.0.78be7bed 
Stato PUC	Superato
Ultima esecuzione PUC	15/06/25 17:50:46
Date format	dd/MM/yy
Language setting	it_IT
Decimal separator	COMMA
==========
Data registrazione	18/06/25 00:10:23
Modalità di ventilazione	Volume controllato
Categ. paziente	Adulti
Automode	no
Backup	no
NIV	no
Sensore Y	no
Compensazione perdite	no
Compensazione circuito	sì
Volume corrente	490	ml
PEEP	5,0	cmH2O
Freq. resp.	16	resp/min
Conc. O2	30	%
I:E	1:2	
Tsalita insp. (%)	5	%
T pausa (%)	10	%
Trigger flusso	1,6	l/min
[DATA]
Tempo	Fase del respiro	Paw (cmH2O)	FLUSSO (l/min)	V (ml)	Trigger
00:10:11:403	insp.	5,22	35,7	-0,10	
00:10:11:413	insp.	5,43	35,7	-0,20	
00:10:11:423	insp.	5,94	35,8	1,20	
00:10:11:523	insp.	10,32	36,2	104,60	
00:10:11:623	insp.	16,10	36,9	236,20	
00:10:11:723	insp.	21,67	36,8	363,50	
00:10:11:823	insp.	24,80	36,7	490,00	
00:10:11:900	insp. pausa	24,50	0,00	490,00	
00:10:12:000	insp. pausa	24,45	0,00	490,00	
00:10:12:100	insp. pausa	24,40	0,00	490,00	
00:10:12:200	insp. pausa	24,35	0,00	490,00	
00:10:12:300	esp.	24,00	-0,50	488,00	
00:10:12:400	esp.	18,50	-28,5	450,30	
00:10:12:500	esp.	14,21	-25,1	360,80	
00:10:12:600	esp.	11,15	-20,2	275,20	
00:10:12:700	esp.	8,98	-16,3	198,10	
00:10:12:800	esp.	7,34	-12,5	130,50	
00:10:12:900	esp.	6,21	-8,7	75,40	
00:10:13:000	esp.	5,55	-5,1	35,20	
00:10:13:100	esp.	5,12	-2,3	10,10	
00:10:13:200	esp.	5,01	-0,5	1,50	
00:10:13:300	esp.	5,00	0,00	0,00	
00:10:13:400	esp.	5,00	0,00	0,00	
00:10:13:500	esp.	5,00	0,00	0,00	
00:10:13:600	esp.	5,00	0,00	0,00	
00:10:13:700	esp.	5,00	0,00	0,00	
00:10:13:800	esp.	5,00	0,00	0,00	
00:10:13:900	esp.	5,00	0,00	0,00	
00:10:14:000	esp.	5,00	0,00	0,00	
00:10:14:100	esp.	5,00	0,00	0,00	
00:10:14:200	esp.	5,00	0,00	0,00	
00:10:14:300	esp.	5,00	0,00	0,00	
00:10:14:400	esp.	5,00	0,00	0,00	
00:10:14:500	esp.	5,00	0,00	0,00	
00:10:14:600	esp.	5,00	0,00	0,00	
00:10:14:700	esp.	5,00	0,00	0,00	
00:10:14:800	esp.	5,00	0,00	0,00	
00:10:14:900	esp.	5,00	0,00	0,00	
00:10:15:000	esp.	5,00	0,00	0,00	
00:10:15:100	esp.	5,00	0,00	0,00	
`;

const REGISTRAZIONE_PC = `[REC]
Data	18/06/25 00:15:00
File	1750205700000.txt
Ventilatore	42204
Sistema	4.4
Versione	4.4.0.78be7bed
Stato PUC	Superato
Ultima esecuzione PUC	15/06/25 17:50:46
Date format	dd/MM/yy
Language setting	it_IT
Decimal separator	COMMA
==========
Data registrazione	18/06/25 00:14:50
Modalità di ventilazione	Pressione controllata
Categ. paziente	Adulti
Automode	no
Backup	no
NIV	no
Sensore Y	no
Compensazione perdite	no
Compensazione circuito	sì
PC sopra PEEP	15,0	cmH2O
PEEP	5,0	cmH2O
Freq. resp.	15	resp/min
Conc. O2	30	%
I:E	1:2	
Tsalita insp. (%)	5	%
Trigger flusso	1,6	l/min
[DATA]
Tempo	Fase del respiro	Paw (cmH2O)	FLUSSO (l/min)	V (ml)	Trigger
00:14:50:000	insp.	5,2	1,5	0	
00:14:50:050	insp.	10,5	58,0	12	
00:14:50:100	insp.	19,8	52,1	38	
00:14:50:200	insp.	20,0	42,2	85	
00:14:50:300	insp.	20,0	36,5	130	
00:14:50:400	insp.	20,0	31,1	175	
00:14:50:500	insp.	20,0	26,3	215	
00:14:50:600	insp.	20,0	22,8	250	
00:14:50:700	insp.	20,0	19,2	280	
00:14:50:800	insp.	20,0	16,1	305	
00:14:50:900	insp.	20,0	13,4	325	
00:14:51:000	insp.	20,0	11,1	340	
00:14:51:100	insp.	20,0	9,2	353	
00:14:51:200	insp.	20,0	7,5	363	
00:14:51:300	insp.	20,0	6,1	370	
00:14:51:333	esp.	19,8	-1,0	369	
00:14:51:400	esp.	15,1	-38,2	320	
00:14:51:500	esp.	11,5	-30,1	250	
00:14:51:600	esp.	9,2	-24,3	180	
00:14:51:700	esp.	7,5	-19,1	120	
00:14:51:800	esp.	6,5	-13,4	70	
00:14:51:900	esp.	5,8	-9,2	35	
00:14:52:000	esp.	5,2	-5,1	10	
00:14:52:100	esp.	5,0	-2,0	2	
00:14:52:200	esp.	5,0	0,0	0	
00:14:52:300	esp.	5,0	0,0	0	
00:14:52:400	esp.	5,0	0,0	0	
00:14:52:500	esp.	5,0	0,0	0	
00:14:52:600	esp.	5,0	0,0	0	
00:14:52:700	esp.	5,0	0,0	0	
00:14:52:800	esp.	5,0	0,0	0	
00:14:52:900	esp.	5,0	0,0	0	
00:14:53:000	esp.	5,0	0,0	0	
00:14:53:100	esp.	5,0	0,0	0	
00:14:53:200	esp.	5,0	0,0	0	
00:14:53:300	esp.	5,0	0,0	0	
00:14:53:400	esp.	5,0	0,0	0	
00:14:53:500	esp.	5,0	0,0	0	
00:14:53:600	esp.	5,0	0,0	0	
00:14:53:700	esp.	5,0	0,0	0	
00:14:53:800	esp.	5,0	0,0	0	
00:14:53:900	esp.	5,0	0,0	0	
`;

const REGISTRAZIONE_PS = `[REC]
Data	18/06/25 00:20:00
File	1750206000000.txt
Ventilatore	42204
Sistema	4.4
Versione	4.4.0.78be7bed
Stato PUC	Superato
Ultima esecuzione PUC	15/06/25 17:50:46
Date format	dd/MM/yy
Language setting	it_IT
Decimal separator	COMMA
==========
Data registrazione	18/06/25 00:19:50
Modalità di ventilazione	Supporto di pressione
Categ. paziente	Adulti
Automode	no
Backup	no
NIV	no
Sensore Y	no
Compensazione perdite	no
Compensazione circuito	sì
PS sopra PEEP	10,0	cmH2O
PEEP	5,0	cmH2O
Freq. resp.	20	resp/min
Conc. O2	30	%
Tsalita insp. (%)	20	%
Trigger flusso	2,0	l/min
Terminazione esp. (%)	25
[DATA]
Tempo	Fase del respiro	Paw (cmH2O)	FLUSSO (l/min)	V (ml)	Trigger
00:19:50:000	esp.	5,0	-1,8	-2	Paziente
00:19:50:050	insp.	6,2	25,0	5	
00:19:50:100	insp.	14,8	45,1	20	
00:19:50:200	insp.	15,0	40,2	45	
00:19:50:300	insp.	15,0	33,5	85	
00:19:50:400	insp.	15,0	28,1	120	
00:19:50:500	insp.	15,0	22,3	155	
00:19:50:600	insp.	15,0	18,8	185	
00:19:50:700	insp.	15,0	15,2	210	
00:19:50:800	insp.	15,0	11,3	230	
00:19:50:850	esp.	14,9	11,2	235	
00:19:50:900	esp.	12,1	-25,2	200	
00:19:51:000	esp.	9,5	-20,1	150	
00:19:51:100	esp.	7,2	-15,3	90	
00:19:51:200	esp.	6,1	-10,1	45	
00:19:51:300	esp.	5,4	-5,2	15	
00:19:51:400	esp.	5,0	-1,0	2	
00:19:51:500	esp.	5,0	0,0	0	
00:19:51:600	esp.	5,0	0,0	0	
00:19:51:700	esp.	5,0	0,0	0	
00:19:51:800	esp.	5,0	0,0	0	
00:19:51:900	esp.	5,0	0,0	0	
00:19:52:000	esp.	5,0	0,0	0	
00:19:52:100	esp.	5,0	0,0	0	
00:19:52:200	esp.	5,0	0,0	0	
00:19:52:300	esp.	5,0	0,0	0	
00:19:52:400	esp.	5,0	0,0	0	
00:19:52:500	esp.	5,0	0,0	0	
00:19:52:600	esp.	5,0	0,0	0	
00:19:52:700	esp.	5,0	0,0	0	
00:19:52:800	esp.	5,0	0,0	0	
00:19:52:900	esp.	5,0	0,0	0	
`;