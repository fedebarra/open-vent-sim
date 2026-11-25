/**
 * Steps of the guided familiarization tour, for the device UI under device/.
 *
 * Order: prepare it in standby, start it, set it, read it, gases, alarms,
 * manoeuvres, stop it. The targets are the `data-fam` hooks of the ventilator. In front of them, the Open Vent Sim start-up:
 * choose the device, the ICU interface, the patient.
 *
 * ## An open drawer covers everything else
 *
 * Commands live in drawers sliding from the left; an open drawer covers the
 * handles. So a target is a list: the command if visible, else the ✕ of the
 * open drawer, else the handle that opens the right one — the light always
 * falls on what has to be touched now.
 */
import type { VentIstantanea } from '../device/screens/scenario/ventilatore/istantanea';
import type { Ambiente } from '../device/screens/scenario/ventilatore/parametri';

export type TourScreen = 'startup' | 'setup' | 'running';

export interface TourContext {
  screen: TourScreen;
  /** On the ICU "invasive or non-invasive?" screen. */
  icuChoice: boolean;
  /** Chosen environment; null before the choice. */
  ambiente: Ambiente | null;
  /** The running ventilator state; null when no machine is on. */
  vent: VentIstantanea | null;
  /** Learner actions (`nomeAzione` kinds) with local time, most recent last. */
  actions: { kind: string; at: number }[];
}

export interface StepText { title: string; body: string; tryIt?: string }

export interface TourStep {
  id: string;
  it: StepText;
  en: StepText;
  /** CSS selectors, first visible wins. Absent: card centred, nothing lit. */
  target?: string[];
  /** Light the union of all visible matches instead of the first. */
  union?: boolean;
  /** Is this step relevant now? Default: always. */
  when?: (c: TourContext) => boolean;
  /** When "Try it" is done. */
  done?: {
    /** An action with this kind (or making the predicate true) since the step began. */
    action?: string | ((kind: string) => boolean);
    /** A click inside one of these selectors. */
    click?: string[];
    /** This selector appears on the page. */
    appears?: string;
    /** A condition on the app state; `start` is the context when the step began. */
    state?: (c: TourContext, start: TourContext) => boolean;
  };
  /** Move on by itself shortly after "done" (screen-by-screen start-up). */
  auto?: boolean;
  card?: 'center';
}

// ---------------------------------------------------------------- helpers --
const CLOSE = '.simvent__cassetto:not(.simvent__cassetto--via) > header > button';
const BAR = '.simvent__barra';
const handle = (name: string) => `[data-fam="maniglia-${name}"]`;
const drawer = (name: string) => `[data-fam="cassetto-${name}"]`;
/** The open tape of that setting (first in the page), or its tile. */
const knob = (key: string) => `[data-fam="nastro-${key}"], [data-fam="manopola-${key}"]`;
/** A command inside drawer `name`: it, or the ✕ of another drawer, or its handle. */
const inside = (name: string, ...commands: string[]) => [...commands, CLOSE, handle(name)];
/** A command outside the drawers: first close the open one. */
const outside = (...commands: string[]) => [CLOSE, ...commands];

const env = (c: TourContext): Ambiente | null => c.vent?.ambiente ?? c.ambiente;
/** Unknown environment (tour started on the start screen): keep the step. */
const envIs = (...list: Ambiente[]) => (c: TourContext) => { const a = env(c); return a === null || list.includes(a); };
const envNot = (...list: Ambiente[]) => (c: TourContext) => { const a = env(c); return a === null || !list.includes(a); };
const onVent = (f: (v: VentIstantanea) => boolean) => (c: TourContext) => (c.vent ? f(c.vent) : false);
const starts = (prefix: string) => (k: string) => k.startsWith(prefix);
const peakAlarm = (v: VentIstantanea) => v.allarmi.some((a) => a.chiave === 'pPeak');

export const TOUR_STEPS: TourStep[] = [
  // ------------------------------------------------------------ start-up --
  {
    id: 'welcome',
    card: 'center',
    it: {
      title: 'Benvenuto in Open Vent Sim',
      body: 'Qualche minuto per conoscere la macchina. Il paziente è finto e sta bene: tocca pure tutto, niente di quello che fai conta. Segui i passi con «Avanti»: il pezzo di cui si parla si illumina; quando c’è scritto «Prova tu», fallo: comparirà un segno verde.',
    },
    en: {
      title: 'Welcome to Open Vent Sim',
      body: 'A few minutes to get to know the machine. The patient is fake and healthy: touch anything, nothing you do counts. Follow the steps with “Next”: the part being explained lights up; when it says “Try it”, do it: a green tick will appear.',
    },
  },
  {
    id: 'choose',
    when: (c) => c.screen === 'startup',
    target: ['[data-testid="mode-anesthesia"]', '[data-testid="mode-icu"]', '[data-testid="mode-highflow"]'],
    union: true,
    auto: true,
    done: { state: (c) => c.screen !== 'startup' },
    it: {
      title: 'Scegli l’apparecchio',
      body: 'Tre macchine: la macchina da anestesia, il ventilatore di terapia intensiva e l’ossigenatore ad alti flussi. Per la prima volta va bene Terapia intensiva.',
      tryIt: 'tocca un apparecchio.',
    },
    en: {
      title: 'Choose the device',
      body: 'Three machines: the anaesthesia workstation, the intensive care ventilator and the high-flow oxygenator. For a first time, Intensive care is a good choice.',
      tryIt: 'tap a device.',
    },
  },
  {
    id: 'icu-choice',
    when: (c) => c.screen === 'startup' || (c.screen === 'setup' && (c.icuChoice || c.ambiente === 'invasiva' || c.ambiente === 'niv')),
    target: ['[data-testid="icu-invasive"]', '[data-testid="icu-niv"]'],
    union: true,
    auto: true,
    done: { state: (c) => c.ambiente !== null || c.screen === 'running' },
    it: {
      title: 'Invasiva o non invasiva',
      body: 'In terapia intensiva il paziente può essere intubato (invasiva) o con maschera o casco (non invasiva, NIV). Cambiano le modalità disponibili e le perdite.',
      tryIt: 'scegli Invasiva.',
    },
    en: {
      title: 'Invasive or non-invasive',
      body: 'In intensive care the patient can be intubated (invasive) or on a mask or helmet (non-invasive, NIV). The available modes and the leaks change.',
      tryIt: 'choose Invasive.',
    },
  },
  {
    id: 'patient',
    when: (c) => c.screen !== 'running',
    target: ['[data-testid="patient-setup"]'],
    auto: true,
    done: { state: (c) => c.screen === 'running' },
    it: {
      title: 'Il paziente',
      body: 'Peso, età e il tipo di polmone. Il peso serve a leggere il volume per chilo: con un peso sbagliato anche quel numero è sbagliato.',
      tryIt: 'scegli il polmone e premi Accendi la macchina.',
    },
    en: {
      title: 'The patient',
      body: 'Weight, age and the kind of lung. Weight is used to read the volume per kilo: with a wrong weight that number is wrong too.',
      tryIt: 'choose the lung and press Switch the machine on.',
    },
  },

  // ---------------------------------------------------- from standby --
  {
    id: 'status',
    target: ['.simvent__pillola--ferma', '.simvent__pillola--attiva'],
    it: { title: 'In funzione o in standby', body: 'Qui in alto leggi se la macchina sta ventilando. Adesso è in Standby: non dà aria al paziente.' },
    en: { title: 'Running or in standby', body: 'Up here you see whether the machine is ventilating. Right now it is in Standby: no air goes to the patient.' },
  },
  {
    id: 'panel',
    target: inside('ventilazione', drawer('ventilazione')),
    done: { appears: drawer('ventilazione') },
    it: { title: 'Apri il pannello ON/OFF', body: 'A sinistra ci sono i pannelli della macchina. Il primo, ON/OFF, serve a prepararla e ad avviarla; mentre ventila si chiama Standby.', tryIt: 'tocca ON/OFF, a sinistra.' },
    en: { title: 'Open the ON/OFF panel', body: 'The machine’s panels are on the left. The first one, ON/OFF, is where you prepare and start it; while ventilating it is called Standby.', tryIt: 'tap ON/OFF, on the left.' },
  },
  {
    id: 'source',
    when: (c) => env(c) === 'anestesia',
    target: inside('ventilazione', '[data-fam="sorgente"]'),
    done: { state: onVent((v) => v.respiro === 'meccanica') },
    it: { title: 'Pallone o ventilatore', body: 'In Manuale ventili tu, col pallone: le curve sono Paw, flusso e CO₂. In Meccanica ventila la macchina.', tryIt: 'scegli Meccanica.' },
    en: { title: 'Bag or ventilator', body: 'In Manual you ventilate with the bag: the curves are Paw, flow and CO₂. In Mechanical the machine ventilates.', tryIt: 'choose Mechanical.' },
  },
  {
    id: 'circuit',
    when: envIs('invasiva', 'niv'),
    target: inside('ventilazione', '[data-fam="circuito"]'),
    done: { action: starts('vent-circuito:') },
    it: { title: 'Il circuito montato', body: 'Indica il circuito che c’è davvero sul paziente. Si cambia solo in standby, e poi va rifatto l’autotest.', tryIt: 'tocca un circuito.' },
    en: { title: 'The fitted circuit', body: 'Select the circuit actually on the patient. You can change it only in standby, then redo the self-test.', tryIt: 'tap a circuit.' },
  },
  {
    id: 'selftest',
    target: inside('ventilazione', '[data-fam="autotest"]'),
    done: { action: 'vent-autotest' },
    it: { title: 'Fai l’autotest', body: 'Prima di collegare il paziente la macchina prova tenuta, valvole e sensori. Dura pochi secondi.', tryIt: 'premi Esegui autotest e aspetta la fine.' },
    en: { title: 'Run the self-test', body: 'Before connecting the patient the machine checks leaks, valves and sensors. It takes a few seconds.', tryIt: 'press Run self-test and wait for it to finish.' },
  },
  {
    id: 'start',
    target: inside('ventilazione', '[data-fam="avvia"]'),
    done: { state: onVent((v) => v.ventilando) },
    it: { title: 'Avvia la ventilazione', body: 'Premi Avvia la ventilazione: il pannello si chiude e compaiono le curve (in alto flusso parte il flusso).', tryIt: 'avvia la ventilazione.' },
    en: { title: 'Start ventilation', body: 'Press Start ventilation: the panel closes and the waveforms appear (in high flow, the flow starts).', tryIt: 'start ventilation.' },
  },

  // ------------------------------------------------------------- set it --
  {
    id: 'mode',
    when: envNot('alto-flusso'),
    target: inside('modalita', drawer('modalita')),
    done: { action: (k) => (k === 'vent-modalita:PC' || k === 'vent-modalita:PS' || k === 'vent-modalita:CPAP') },
    it: { title: 'Scegli la modalità', body: 'Tocca Modalità, a sinistra, e scegline una. Quella in uso è scritta sopra le curve. In NIV ci sono PS, CPAP, PC e NEURO: la PC è a tempo e sempre assistita, e con la maschera che perde il suo Ti non si allunga.', tryIt: 'scegli PC (in NIV: CPAP, poi torna a PS).' },
    en: { title: 'Choose the mode', body: 'Tap Mode, on the left, and pick one. The mode in use is written above the waveforms. In NIV there are PS, CPAP, PC and NEURO: PC is time-cycled and always assisted, and with a leaking mask its Ti does not drag on.', tryIt: 'choose PC (in NIV: CPAP, then back to PS).' },
  },
  // ------------------------------------- neural assist (OVS 3.8: NEURO) --
  {
    id: 'neuro',
    when: envIs('invasiva', 'niv'),
    target: inside('modalita', '[data-fam="modalita-NEURO"]', drawer('modalita')),
    done: { action: 'vent-modalita:NEURO' },
    it: { title: 'L’assistenza neurale (NEURO)', body: 'NEURO dà a ogni istante una pressione proporzionale all’attività elettrica del diaframma (EAdi), letta da un catetere nell’esofago: Paw = PEEP + livello × EAdi. L’atto lo apre il diaframma e si chiude quando l’EAdi scende; la perdita della maschera non li tocca. Senza catetere NEURO è grigio: lo monta la regia.', tryIt: 'se NEURO non è grigio, sceglilo.' },
    en: { title: 'Neural assist (NEURO)', body: 'NEURO gives at every instant a pressure proportional to the electrical activity of the diaphragm (EAdi), read by a catheter in the oesophagus: Paw = PEEP + level × EAdi. The diaphragm opens the breath and it ends when EAdi falls; the mask leak touches neither. Without a catheter NEURO is greyed out: the instructor mounts it.', tryIt: 'if NEURO is not greyed out, choose it.' },
  },
  {
    id: 'neuro-catheter',
    when: onVent((v) => v.modalita === 'NEURO' && !!v.fisiologia.catetereEAdi),
    target: outside('[data-testid="vista-catetere"]'),
    done: { appears: '[data-testid="vista-catetere-schermo"]' },
    it: { title: 'Il catetere EAdi', body: 'Prima di fidarsi di NEURO il catetere va messo alla profondità giusta: gli elettrodi devono stare a cavallo del diaframma. Il tasto Catetere EAdi, accanto al nome della modalità, apre la sua schermata.', tryIt: 'tocca Catetere EAdi.' },
    en: { title: 'The EAdi catheter', body: 'Before trusting NEURO the catheter must sit at the right depth: the electrodes must straddle the diaphragm. The EAdi catheter key, next to the mode name, opens its screen.', tryIt: 'tap EAdi catheter.' },
  },
  {
    id: 'neuro-depth',
    when: onVent((v) => v.modalita === 'NEURO' && !!v.fisiologia.catetereEAdi),
    target: ['[data-testid="cat-inserisci"]', '[data-testid="vista-catetere"]'],
    done: { action: starts('vent-catetere') },
    it: { title: 'La profondità di partenza', body: 'Si misura la distanza naso–lobo dell’orecchio–xifoide (NEX). Dal naso: NEX × 0,9 più la costante del calibro; dalla bocca: NEX × 0,8 più la costante. È un punto di partenza: in molti pazienti il diaframma sta un po’ più in basso.', tryIt: 'scegli la via e premi Inserisci.' },
    en: { title: 'The starting depth', body: 'Measure the nose–earlobe–xiphoid distance (NEX). Through the nose: NEX × 0.9 plus the caliber constant; through the mouth: NEX × 0.8 plus the constant. It is a starting point: in many patients the diaphragm sits a little lower.', tryIt: 'choose the route and press Insert.' },
  },
  {
    id: 'neuro-leads',
    when: onVent((v) => v.modalita === 'NEURO' && !!v.fisiologia.catetereEAdi),
    target: ['.simvent__catetere-tracce', '[data-testid="vista-catetere"]'],
    done: { state: onVent((v) => v.fisiologia.catetereEAdi === 'giusto') },
    it: { title: 'Leggere le quattro derivazioni', body: 'Sono l’ECG visto dall’esofago, dalla derivazione più alta (1) alla più bassa (4): in alto onde P grandi, in basso le P spariscono e il QRS cala. Il diaframma, quando si contrae, accende la traccia dove è più forte. Nelle derivazioni 2 e 3 il catetere è a posto; in 1 e 2 è troppo dentro: tira; in 3 e 4 è troppo fuori: spingi. Un passo alla volta, mai più di quattro.', tryIt: 'porta l’attività del diaframma nelle derivazioni 2 e 3.' },
    en: { title: 'Reading the four leads', body: 'They are the ECG seen from the oesophagus, from the highest lead (1) to the lowest (4): large P waves at the top, P waves vanishing and QRS shrinking at the bottom. The diaphragm, when it contracts, lights the trace where it is strongest. In leads 2 and 3 the catheter is in place; in 1 and 2 it is too deep: pull; in 3 and 4 it is too shallow: push. One step at a time, never more than four.', tryIt: 'bring the diaphragm activity to leads 2 and 3.' },
  },
  {
    id: 'neuro-occlusion',
    when: onVent((v) => v.modalita === 'NEURO' && !!v.fisiologia.catetereEAdi),
    target: ['[data-testid="cat-occlusione"]', '[data-testid="vista-catetere"]'],
    done: { action: 'vent-manovra:pausa-espiratoria' },
    it: { title: 'La verifica con l’occlusione', body: 'Con la macchina che ventila, una pausa espiratoria chiude le vie aeree: lo sforzo fa salire l’EAdi e scendere la Paw. Se le due deflessioni coincidono, il segnale è del diaframma di questo paziente.', tryIt: 'avvia la ventilazione e premi Pausa espiratoria.' },
    en: { title: 'The occlusion check', body: 'With the machine ventilating, an expiratory hold closes the airway: the effort makes EAdi rise and Paw fall. If the two deflections coincide, the signal is this patient’s diaphragm.', tryIt: 'start ventilation and press Expiratory hold.' },
  },
  {
    id: 'neuro-level',
    when: onVent((v) => v.modalita === 'NEURO'),
    target: outside(knob('livelloNeuro'), BAR),
    done: { action: 'vent-parametro:livelloNeuro' },
    it: { title: 'Il livello NEURO', body: 'Quanti cmH₂O per ogni µV di EAdi. Si parte da 0,5–1 e si sale a passi di 0,1–0,3: Paw e volume crescono, l’EAdi scende perché il paziente lavora meno. Il livello giusto è dove la salita rallenta. Il trigger EAdi è di quanti µV l’EAdi deve salire per aprire l’atto.', tryIt: 'alza il livello e guarda EAdi picco.' },
    en: { title: 'The NEURO level', body: 'How many cmH₂O per µV of EAdi. Start at 0.5–1 and go up by 0.1–0.3: Paw and volume grow, EAdi falls because the patient works less. The right level is where the rise slows down. The EAdi trigger is how many µV EAdi must rise to open the breath.', tryIt: 'raise the level and watch EAdi peak.' },
  },
  {
    id: 'neuro-state',
    when: onVent((v) => v.modalita === 'NEURO'),
    target: outside('.simvent__modo'),
    it: { title: 'Quando il segnale non basta', body: 'Se il segnale del diaframma non è credibile — il catetere si è spostato, gli atti non coincidono con gli sforzi — la macchina passa da sola al supporto di pressione e accanto alla modalità compare «NEURO ⇄ PS»; torna quando il segnale torna buono. «Backup» vuol dire che il paziente non respira e la macchina dà gli atti di sicurezza. Se dura, suona l’allarme del segnale: si controlla il catetere.' },
    en: { title: 'When the signal is not enough', body: 'If the diaphragm signal is not credible — the catheter has moved, breaths do not match efforts — the machine switches by itself to pressure support and “NEURO ⇄ PS” appears next to the mode; it returns when the signal is good again. “Backup” means the patient is not breathing and the machine gives the safety breaths. If it lasts, the signal alarm sounds: check the catheter.' },
  },

  {
    id: 'settings',
    target: outside(BAR),
    done: { appears: '.simvent__manopola--aperta' },
    it: { title: 'I parametri impostati', body: 'In basso c’è quello che hai impostato. Tocca una casella per regolarla.', tryIt: 'tocca una casella in basso.' },
    en: { title: 'The set parameters', body: 'Along the bottom is what you have set. Tap a box to adjust it.', tryIt: 'tap a box at the bottom.' },
  },
  {
    id: 'peep',
    when: envNot('alto-flusso'),
    target: outside(knob('peep'), BAR),
    done: { state: onVent((v) => v.impostazioni.peep === 8) },
    it: { title: 'Cambia la PEEP', body: 'Tocca PEEP e trascina il nastro, o usa − e +. In giallo il valore non è ancora attivo: si conferma con ✓. Dopo 6 secondi senza conferma resta quello di prima.', tryIt: 'porta la PEEP a 8 e conferma con ✓.' },
    en: { title: 'Change the PEEP', body: 'Tap PEEP and drag the tape, or use − and +. While yellow the value is not active yet: confirm it with ✓. After 6 seconds without confirming, the old one stays.', tryIt: 'set the PEEP to 8 and confirm with ✓.' },
  },
  {
    id: 'flow-pattern',
    when: (c) => envIs('invasiva', 'anestesia')(c) && (!c.vent || c.vent.modalita === 'VC'),
    target: outside(knob('formaFlusso'), BAR),
    done: { state: onVent((v) => v.impostazioni.formaFlusso === 1) },
    it: { title: 'La forma del flusso', body: 'In volume controllato il flusso può essere quadro (■) o decelerante (◣): stesso volume, stesso tempo, ma il decelerante parte dal doppio e scende a zero. Il picco di pressione si abbassa, il plateau no.', tryIt: 'metti il flusso decelerante e guarda la curva del flusso.' },
    en: { title: 'The flow pattern', body: 'In volume control the flow can be square (■) or decelerating (◣): same volume, same time, but the decelerating one starts at twice the flow and falls to zero. Peak pressure drops, plateau does not.', tryIt: 'set decelerating flow and watch the flow waveform.' },
  },
  {
    id: 'flow',
    when: (c) => env(c) === 'alto-flusso',
    target: outside(knob('fgf'), BAR),
    done: { action: 'vent-parametro:fgf' },
    it: { title: 'Regola il flusso', body: 'È il flusso di aria e ossigeno, in litri al minuto. Sopra i 25 si sposta di 5 alla volta.', tryIt: 'cambia il flusso.' },
    en: { title: 'Set the flow', body: 'It is the flow of air and oxygen, in litres per minute. Above 25 it moves by 5 at a time.', tryIt: 'change the flow.' },
  },
  {
    id: 'fio2',
    target: outside(knob('fio2'), BAR),
    done: { state: onVent((v) => v.impostazioni.fio2 === 50) },
    it: { title: 'Cambia la FiO₂', body: 'È la quota di ossigeno, dal 21 al 100%. Ogni tocco la sposta di 5.', tryIt: 'porta la FiO₂ al 50% e conferma.' },
    en: { title: 'Change the FiO₂', body: 'It is the oxygen fraction, from 21 to 100%. Each tap moves it by 5.', tryIt: 'set the FiO₂ to 50% and confirm.' },
  },
  {
    id: 'volume',
    when: envNot('alto-flusso'),
    target: outside(knob('volume'), knob('pressureTarget'), knob('psLevel'), BAR),
    done: { action: (k) => ['vent-parametro:volume', 'vent-parametro:pressureTarget', 'vent-parametro:psLevel'].includes(k) },
    it: { title: 'Volume o pressione', body: 'In VC regoli il volume corrente, in PC e PS la pressione. Cambiala e guarda la curva.', tryIt: 'cambia il volume o la pressione.' },
    en: { title: 'Volume or pressure', body: 'In VC you set the tidal volume, in PC and PS the pressure. Change it and watch the waveform.', tryIt: 'change the volume or the pressure.' },
  },
  {
    id: 'rate',
    when: envNot('alto-flusso'),
    target: outside(knob('frequency'), BAR),
    done: { action: 'vent-parametro:frequency' },
    it: { title: 'Cambia la frequenza', body: 'Sono gli atti al minuto che la macchina garantisce. Quelli misurati li leggi in Monitoraggio.', tryIt: 'cambia la frequenza.' },
    en: { title: 'Change the rate', body: 'These are the breaths per minute the machine guarantees. The measured ones are under Monitoring.', tryIt: 'change the rate.' },
  },
  {
    id: 'temperature',
    when: (c) => env(c) === 'alto-flusso',
    target: outside(knob('temperature'), BAR),
    done: { action: 'vent-parametro:temperature' },
    it: { title: 'Regola la temperatura', body: 'È la temperatura del gas che arriva al naso. Di solito 37 °C, meno se il paziente non la tollera.', tryIt: 'cambia la temperatura.' },
    en: { title: 'Set the temperature', body: 'It is the temperature of the gas at the nose. Usually 37 °C, lower if the patient cannot tolerate it.', tryIt: 'change the temperature.' },
  },

  // ------------------------------------------------------------ read it --
  {
    id: 'hf-numbers',
    when: (c) => env(c) === 'alto-flusso',
    target: outside('.simvent__grandi', '.simvent__altoflusso'),
    it: { title: 'Flusso, FiO₂ e temperatura', body: 'Qui leggi in grande quello che arriva al paziente. Il flusso è quello misurato: se non raggiunge l’impostato, sotto compare «impostato». Dopo l’avvio la temperatura sale piano. La fascia sotto scorre mentre l’apparecchio eroga, più veloce con più flusso; ambra mentre scalda.' },
    en: { title: 'Flow, FiO₂ and temperature', body: 'Here you read in large type what reaches the patient. The flow is the measured one: if it does not reach the set value, “set” appears below. After starting, the temperature rises slowly. The band below moves while the device delivers, faster with more flow; amber while warming.' },
  },
  {
    id: 'hf-cannula',
    when: (c) => env(c) === 'alto-flusso',
    target: outside('[data-fam="silenzia"]'),
    it: { title: 'Quello che l’apparecchio vede, e quello che no', body: 'Con la cannula schiacciata o ostruita il flusso non arriva e suona «Flusso ostacolato»; con il tubo staccato il gas esce libero e suona «Circuito aperto». Con la cannula fuori dal naso invece per l’apparecchio è tutto in ordine: non suona niente, e la SpO₂ scende. Si scopre guardando il paziente.' },
    en: { title: 'What the device sees, and what it does not', body: 'With the cannula kinked or blocked the flow does not get through and “Flow obstructed” sounds; with the tube detached the gas flows out freely and “Circuit open” sounds. With the cannula out of the nose, though, for the device all is well: nothing sounds, and SpO₂ falls. You find it by looking at the patient.' },
  },
  {
    id: 'waves',
    when: envNot('alto-flusso'),
    target: outside('.simvent__onde'),
    it: { title: 'Le tre curve', body: 'Dall’alto: pressione delle vie aeree (Paw), flusso (sopra lo zero entra, sotto esce) e volume. Scorrono atto per atto: la forma dice più dei numeri.' },
    en: { title: 'The three waveforms', body: 'From the top: airway pressure (Paw), flow (above zero goes in, below comes out) and volume. They scroll breath by breath: the shape tells more than the numbers.' },
  },
  {
    id: 'sweep',
    when: envNot('alto-flusso'),
    target: outside('.simvent__velocita', '.simvent__onde'),
    done: { appears: '.simvent__velocita > button:first-child.scelto' },
    it: { title: 'La velocità dello schermo', body: 'I tasti 10s, 30s e 60s cambiano quanto tempo vedi da un bordo all’altro: con 10s guardi bene un atto, con 60s vedi l’andamento.', tryIt: 'tocca 10s.' },
    en: { title: 'Screen speed', body: 'The 10s, 30s and 60s keys change how much time you see edge to edge: 10s shows one breath in detail, 60s shows the trend.', tryIt: 'tap 10s.' },
  },
  {
    id: 'freeze',
    when: envNot('alto-flusso'),
    target: outside('.simvent__congela', '.simvent__onde'),
    done: { appears: '.simvent__congela--attivo' },
    it: { title: 'Ferma le curve', body: 'Premi Congela, poi tocca una curva: leggi i valori di quel punto. Premi di nuovo per ripartire.', tryIt: 'premi Congela.' },
    en: { title: 'Freeze the waveforms', body: 'Press Freeze, then tap a waveform to read the values at that point. Press again to resume.', tryIt: 'press Freeze.' },
  },
  {
    id: 'monitoring',
    when: envNot('alto-flusso'),
    target: outside('.simvent__monitoraggio'),
    it: { title: 'I valori misurati', body: 'In Monitoraggio c’è quello che la macchina misura. Confrontalo con quello che hai impostato in basso.' },
    en: { title: 'The measured values', body: 'Monitoring shows what the machine measures. Compare it with what you set at the bottom.' },
  },

  {
    id: 'drive-measures',
    when: envIs('invasiva'),
    target: outside('.simvent__monitoraggio'),
    it: { title: 'P0.1 e stress index', body: 'Due numeri che leggono la forma, non il volume. La P0.1 compare quando il paziente apre gli atti: è quanto scende la pressione nei primi 100 ms dello sforzo, sopra 3,5 il drive è alto. Lo stress index compare in volume a flusso quadro: fra 0,9 e 1,1 il polmone è lineare, sotto si recluta a ogni atto, sopra si sovradistende.' },
    en: { title: 'P0.1 and stress index', body: 'Two numbers that read the shape, not the volume. P0.1 appears when the patient opens the breaths: how much pressure falls in the first 100 ms of the effort; above 3.5 the drive is high. The stress index appears in volume control with square flow: 0.9 to 1.1 the lung is linear, below it recruits every breath, above it overdistends.' },
  },
  {
    id: 'niv-leak',
    when: (c) => env(c) === 'niv',
    target: outside('.simvent__monitoraggio'),
    it: { title: 'La perdita della maschera', body: 'In NIV la maschera perde: Perdita in l/min e in percentuale, e un VTi più alto del VTe. Con una perdita grande il flusso non scende alla soglia di ciclaggio e l’inspirazione si allunga; con una perdita che cambia il trigger parte da solo; con la maschera staccata la pressione non arriva. Si corregge sistemando la maschera, non alzando la pressione.' },
    en: { title: 'The mask leak', body: 'In NIV the mask leaks: Leak in l/min and as a percentage, and a VTi higher than VTe. With a large leak the flow never falls to the cycling threshold and inspiration drags on; with a changing leak the trigger fires by itself; with the mask off the face the pressure is not reached. Fix the mask, not the pressure.' },
  },
  {
    id: 'niv-mask-off',
    when: (c) => env(c) === 'niv',
    target: outside(knob('perditaEccessiva'), BAR),
    done: { action: 'vent-parametro:perditaEccessiva' },
    it: { title: 'La maschera staccata', body: 'Quando la perdita passa il 95% la maschera non è più sul viso. La casella «Perdita >95%» decide che cosa fa la macchina: ▶ continua a ventilare; ‖ ▲ o ‖ ▼ si mette in pausa con un flusso alto o basso, non cicla e riparte da sola quando la maschera torna a tenere. In ogni caso suona «Perdita eccessiva».', tryIt: 'cambia la scelta della casella Perdita >95%.' },
    en: { title: 'The mask off the face', body: 'When the leak passes 95% the mask is no longer on the face. The “Leak >95%” box decides what the machine does: ▶ keeps ventilating; ‖ ▲ or ‖ ▼ pauses with a high or low flow, does not cycle and resumes by itself when the mask seals again. Either way “Excessive leak” sounds.', tryIt: 'change the Leak >95% choice.' },
  },
  {
    id: 'eit',
    when: envIs('invasiva'),
    target: outside('[data-testid="vista-eit"]', '.simvent__onde'),
    done: { appears: '[data-testid="eit"]' },
    it: { title: 'L’EIT', body: 'Il tasto EIT mostra una fetta del torace: in alto il ventrale, in basso il dorsale, il chiaro è dove arriva l’aria. A destra le curve di impedenza: globale, ventrale, dorsale. Se il dorsale sale mentre il ventrale scende all’inizio di uno sforzo, è pendelluft.', tryIt: 'tocca EIT.' },
    en: { title: 'EIT', body: 'The EIT key shows a slice of the chest: ventral at the top, dorsal at the bottom; bright is where the air goes. On the right, the impedance curves: global, ventral, dorsal. If the dorsal rises while the ventral falls at the start of an effort, that is pendelluft.', tryIt: 'tap EIT.' },
  },
  {
    id: 'peep-trial',
    when: envIs('invasiva'),
    target: outside('[data-testid="eit-prova"]', '[data-testid="vista-eit"]'),
    done: { appears: '[data-testid="eit-incrocio"]' },
    it: { title: 'Il PEEP trial', body: 'Una discesa di PEEP da 24 a 4 a pressione motrice costante: in arancione il polmone che collassa scendendo, in azzurro quello che si sovradistende salendo, in bianco la compliance. Dove le due curve si incrociano c’è la PEEP che le bilancia.', tryIt: 'apri l’EIT e premi PEEP trial.' },
    en: { title: 'The PEEP trial', body: 'A PEEP descent from 24 to 4 at constant driving pressure: orange is lung that collapses going down, cyan is lung that overdistends going up, white is compliance. Where the two curves cross is the PEEP that balances them.', tryIt: 'open EIT and press PEEP trial.' },
  },

  // ------------------------------------------- gases (anaesthesia only) --
  {
    id: 'dose',
    when: (c) => env(c) === 'anestesia',
    target: outside(knob('targetMac'), knob('targetEtPrimaryAgent'), BAR),
    done: { action: starts('vent-parametro:target') },
    it: { title: 'Regola la dose', body: 'In basso imposti la MAC o l’Et da raggiungere: la macchina ci arriva in qualche minuto. Se la casella non si vede, scorri la barra.', tryIt: 'cambia la MAC obiettivo.' },
    en: { title: 'Set the dose', body: 'At the bottom you set the target MAC or end-tidal agent: the machine gets there in a few minutes. If the box is not visible, scroll the bar.', tryIt: 'change the target MAC.' },
  },
  {
    id: 'fresh-gas',
    when: (c) => env(c) === 'anestesia',
    target: outside(knob('fgf'), BAR),
    done: { action: 'vent-parametro:fgf' },
    it: { title: 'Il gas fresco', body: 'Più gas fresco cambia la concentrazione più in fretta, ma consuma più agente. Se la casella non si vede, scorri la barra.', tryIt: 'cambia il gas fresco.' },
    en: { title: 'Fresh gas flow', body: 'More fresh gas changes the concentration faster, but uses more agent. If the box is not visible, scroll the bar.', tryIt: 'change the fresh gas flow.' },
  },
  {
    id: 'gas',
    when: (c) => env(c) === 'anestesia',
    target: inside('gas', drawer('gas')),
    done: { appears: drawer('gas') },
    it: { title: 'Apri il pannello Gas', body: 'Qui ci sono i vaporizzatori, la calce sodata e il flush d’ossigeno.', tryIt: 'tocca Gas, a sinistra.' },
    en: { title: 'Open the Gas panel', body: 'Here are the vaporisers, the soda lime and the oxygen flush.', tryIt: 'tap Gas, on the left.' },
  },
  {
    id: 'delivery',
    when: (c) => env(c) === 'anestesia',
    target: inside('gas', '[data-fam="gas-erogazione"]'),
    done: { state: onVent((v) => v.gas?.erogazione === true) },
    it: { title: 'Accendi l’erogazione', body: 'Con l’interruttore l’agente entra nel circuito. Sotto puoi montare o togliere i vaporizzatori.', tryIt: 'accendi l’erogazione.' },
    en: { title: 'Turn on agent delivery', body: 'With the switch the agent enters the circuit. Below you can fit or remove the vaporisers.', tryIt: 'turn on delivery.' },
  },
  {
    id: 'flush',
    when: (c) => env(c) === 'anestesia',
    target: inside('gas', '[data-fam="gas-flush"]'),
    done: { action: 'vent-gas-flush' },
    it: { title: 'Il flush d’ossigeno', body: 'Dà ossigeno al 100% per 30 secondi. Poi la FiO₂ torna da sola a quella impostata.', tryIt: 'premi Flush O₂.' },
    en: { title: 'The oxygen flush', body: 'It gives 100% oxygen for 30 seconds. Then the FiO₂ returns to the set value by itself.', tryIt: 'press O₂ flush.' },
  },
  {
    id: 'consumables',
    when: (c) => env(c) === 'anestesia',
    target: inside('gas', '[data-fam="gas-calce"]'),
    done: { action: 'vent-riempi:calce' },
    it: { title: 'Calce e vaporizzatore', body: 'Il disegno mostra quanto ne resta. Si cambiano solo a gas chiusi: con l’erogazione accesa il cambio non parte.', tryIt: 'premi Sostituisci, sotto la calce, e guarda che succede.' },
    en: { title: 'Soda lime and vaporiser', body: 'The drawing shows how much is left. They can be changed only with the gases closed: with delivery on the change does not start.', tryIt: 'press Replace, under the soda lime, and see what happens.' },
  },

  // -------------------------------------------------------------- alarms --
  {
    id: 'limits',
    target: inside('allarmi', drawer('allarmi')),
    done: { action: (k) => k.startsWith('vent-limite:') || k.startsWith('vent-allarme:') },
    it: { title: 'I limiti d’allarme', body: 'Tocca Allarmi, a sinistra. Per ogni misura ci sono le soglie rosse, sopra la barra, e le gialle, sotto: il giallo avvisa prima. Il trattino bianco è la misura di adesso. In PS, CPAP e PAV c’è anche l’apnea: quanti secondi senza un respiro del paziente prima che suoni.', tryIt: 'chiudi il pannello aperto con ✕, poi tocca Allarmi e trascina una linguetta, o toccala e usa − e +.' },
    en: { title: 'The alarm limits', body: 'Tap Alarms, on the left. Each measurement has red limits, above the bar, and yellow ones, below: yellow warns first. The white mark is the value now. In PS, CPAP and PAV there is also apnoea: how many seconds without a breath from the patient before it sounds.', tryIt: 'close the open panel with ✕, then tap Alarms and drag a tab, or tap it and use − and +.' },
  },
  {
    id: 'alarm',
    when: envNot('alto-flusso'),
    target: inside('allarmi', '[data-fam="limite-pPeak"]'),
    done: { state: onVent(peakAlarm) },
    it: { title: 'Fai suonare un allarme', body: 'Alza la soglia rossa bassa della pressione di picco sopra il picco misurato. In alto compare l’allarme.', tryIt: 'trascina a destra la linguetta rossa di sinistra finché l’allarme suona.' },
    en: { title: 'Make an alarm sound', body: 'Raise the low red peak pressure limit above the measured peak. The alarm appears at the top.', tryIt: 'drag the left red tab to the right until the alarm sounds.' },
  },
  {
    id: 'silence',
    target: outside('[data-fam="silenzia"]'),
    done: { action: 'vent-silenzia' },
    it: { title: 'Silenzia l’allarme', body: 'La campana barrata, in alto, zittisce gli allarmi per due minuti. Il messaggio resta finché il problema c’è.', tryIt: 'chiudi il pannello con ✕, poi premi la campana barrata.' },
    en: { title: 'Silence the alarm', body: 'The crossed-out bell, at the top, silences the alarms for two minutes. The message stays as long as the problem does.', tryIt: 'close the panel with ✕, then press the crossed-out bell.' },
  },
  {
    id: 'fix-cause',
    when: envNot('alto-flusso'),
    target: inside('allarmi', '[data-fam="limite-pPeak"]'),
    done: { state: onVent((v) => (v.limiti.pPeak.basso ?? 0) <= 10 && !peakAlarm(v)) },
    it: { title: 'Togli la causa', body: 'Riapri Allarmi e riporta il picco ai valori d’avvio: così tornano anche le gialle, che la rossa aveva spinto. L’allarme si spegne da solo quando il problema non c’è più.', tryIt: 'tocca la freccia circolare in fondo alla riga.' },
    en: { title: 'Remove the cause', body: 'Open Alarms again and take the peak back to its start-up values: the yellow limits, pushed by the red one, return too. The alarm clears by itself once the problem is gone.', tryIt: 'tap the circular arrow at the end of the row.' },
  },

  // -------------------------------------------- manoeuvres, humidifier --
  {
    id: 'holds',
    when: envNot('alto-flusso'),
    target: inside('manovre', '[data-fam="manovra-pausa-inspiratoria"]'),
    done: { state: onVent((v) => v.manovraEsito?.manovra === 'pausa-inspiratoria') },
    it: { title: 'Pausa inspiratoria', body: 'Le pause misurano plateau, compliance e auto-PEEP. I numeri arrivano dopo 5 secondi.', tryIt: 'chiudi il pannello, apri Manovre e fai una pausa inspiratoria.' },
    en: { title: 'Inspiratory hold', body: 'The holds measure plateau, compliance and auto-PEEP. The numbers arrive after 5 seconds.', tryIt: 'close the panel, open Manoeuvres and do an inspiratory hold.' },
  },
  {
    id: 'recruitment',
    when: envNot('alto-flusso'),
    target: inside('manovre', '[data-fam="manovra-reclutamento"]'),
    it: { title: 'Manovra di reclutamento', body: 'Tiene le vie aeree a pressione alta per alcune decine di secondi. In un polmone reclutabile la compliance sale; se poi la PEEP è troppo bassa, il guadagno si perde. Si interrompe se il paziente non la tollera.' },
    en: { title: 'Recruitment manoeuvre', body: 'Holds the airway at high pressure for some tens of seconds. In a recruitable lung compliance rises; if PEEP is then too low the gain is lost. It stops if the patient does not tolerate it.' },
  },
  {
    id: 'occlusion',
    when: envNot('alto-flusso'),
    target: inside('manovre', '[data-fam="manovra-pausa-espiratoria"]'),
    it: { title: 'Pausa espiratoria e test di occlusione', body: 'La pausa espiratoria misura la PEEP totale. Se il paziente tira mentre la valvola è chiusa, la Paw scende quanto la pressione esofagea: l’esito riporta ΔPocc, la Pmus stimata (0,75 × |ΔPocc|) e la transpolmonare dinamica stimata.' },
    en: { title: 'Expiratory hold and occlusion test', body: 'The expiratory hold measures total PEEP. If the patient pulls while the valve is closed, Paw falls as much as oesophageal pressure: the result reports ΔPocc, the estimated Pmus (0.75 × |ΔPocc|) and the estimated dynamic transpulmonary pressure.' },
  },
  {
    id: 'slow-curve',
    when: envIs('invasiva'),
    target: inside('manovre', '[data-fam="manovra-curva-lenta"]'),
    done: { state: onVent((v) => v.manovraEsito?.manovra === 'curva-lenta') },
    it: { title: 'La curva P/V lenta', body: 'Cinque litri al minuto dalla PEEP: la curva che esce è quella statica del polmone. Se le vie aeree sono chiuse, la pressione sale ripida senza volume fino alla pressione di apertura (AOP), poi la pendenza cambia. Sotto l’AOP la PEEP non arriva agli alveoli.', tryIt: 'apri Manovre e fai la curva P/V lenta.' },
    en: { title: 'The low-flow P/V curve', body: 'Five litres a minute from PEEP: what comes out is the static curve of the lung. If the airways are closed, pressure rises steeply with no volume up to the airway opening pressure (AOP), then the slope changes. Below the AOP, PEEP does not reach the alveoli.', tryIt: 'open Manoeuvres and run the low-flow P/V curve.' },
  },
  {
    id: 'ri-ratio',
    when: envIs('invasiva'),
    target: inside('manovre', '[data-fam="manovra-rapporto-ri"]'),
    it: { title: 'Il rapporto R/I', body: 'Da una PEEP di almeno 10 la macchina scende a 5 per un respiro e misura quanto volume esce in più di quello che la compliance spiega: è il polmone che la PEEP alta teneva aperto. Un rapporto da 0,5 in su dice che alzare la PEEP recluta; sotto, che gonfia soltanto.' },
    en: { title: 'The R/I ratio', body: 'From a PEEP of at least 10 the machine drops to 5 for one breath and measures how much more volume comes out than compliance explains: the lung the high PEEP kept open. A ratio of 0.5 or more says raising PEEP recruits; below that, it only inflates.' },
  },
  {
    id: 'humidifier',
    when: envNot('anestesia'),
    target: inside('umidificatore', drawer('umidificatore')),
    done: { appears: drawer('umidificatore') },
    it: { title: 'L’umidificatore', body: 'Qui lo accendi, scegli la potenza e controlli l’acqua. Con il filtro HME va lasciato spento; in alto flusso fra un paziente e l’altro si disinfetta.', tryIt: 'chiudi il pannello aperto, poi tocca Umidificatore.' },
    en: { title: 'The humidifier', body: 'Here you turn it on, choose the power and check the water. With an HME filter leave it off; in high flow it is disinfected between patients.', tryIt: 'close the open panel, then tap Humidifier.' },
  },

  // ------------------------------------------------------------- stop it --
  {
    id: 'standby',
    target: inside('ventilazione', '[data-fam="avvia"]'),
    done: { action: 'vent-standby' },
    it: { title: 'Metti in standby', body: 'Si ferma dal pannello Standby, come si è avviata. La macchina smette di dare aria e gli allarmi tacciono.', tryIt: 'chiudi il pannello, apri Standby e premi Metti in standby.' },
    en: { title: 'Go to standby', body: 'You stop it from the Standby panel, just as you started it. The machine stops giving air and the alarms go quiet.', tryIt: 'close the panel, open Standby and press Go to standby.' },
  },
  {
    id: 'exit',
    target: outside('[data-tour="esci"]'),
    it: { title: 'Spegni e torna all’inizio', body: 'La freccia in alto a sinistra spegne la macchina e torna alla scelta dell’apparecchio. Le impostazioni non vengono salvate.' },
    en: { title: 'Switch off and go back', body: 'The arrow at the top left switches the machine off and goes back to the device choice. Settings are not saved.' },
  },
  {
    id: 'goodbye',
    card: 'center',
    it: { title: 'Finito!', body: 'Continua pure a provare quello che vuoi. Puoi rivedere la guida quando vuoi dalla schermata iniziale.' },
    en: { title: 'Finished!', body: 'Keep trying whatever you like. You can replay the guide any time from the start screen.' },
  },
];

/** Steps that apply now, in order. */
export function stepsFor(c: TourContext): TourStep[] {
  return TOUR_STEPS.filter((s) => !s.when || s.when(c));
}
