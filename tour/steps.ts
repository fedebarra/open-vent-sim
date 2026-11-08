/**
 * Steps of the guided familiarization tour, for the device UI under device/
 * (the ventilator ported from the Scenario Creator).
 *
 * Ported from the Scenario Creator "familiarizzazione/passi/ventilatore.ts":
 * same order (prepare it in standby, start it, set it, read it, gases, alarms,
 * manoeuvres, stop it), same targets (the `data-fam` hooks that came with the
 * ventilator), same texts. In front of them, the Open Vent Sim start-up:
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
const knob = (key: string) => `[data-fam="manopola-${key}"]`;
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
    it: { title: 'Apri il pannello Standby', body: 'A sinistra ci sono i pannelli della macchina. Il primo, Standby, serve a prepararla e ad avviarla.', tryIt: 'tocca Standby, a sinistra.' },
    en: { title: 'Open the Standby panel', body: 'The machine’s panels are on the left. The first one, Standby, is where you prepare and start it.', tryIt: 'tap Standby, on the left.' },
  },
  {
    id: 'source',
    when: (c) => env(c) === 'anestesia',
    target: inside('ventilazione', '[data-fam="sorgente"]'),
    done: { state: onVent((v) => v.respiro === 'meccanica') },
    it: { title: 'Pallone o ventilatore', body: 'In Manuale ventili tu, col pallone. In Meccanica ventila la macchina.', tryIt: 'scegli Meccanica.' },
    en: { title: 'Bag or ventilator', body: 'In Manual you ventilate with the bag. In Mechanical the machine ventilates.', tryIt: 'choose Mechanical.' },
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
    it: { title: 'Scegli la modalità', body: 'Tocca Modalità, a sinistra, e scegline una. Quella in uso è scritta sopra le curve. In NIV le modalità sono PS e CPAP.', tryIt: 'scegli PC (in NIV: CPAP, poi torna a PS).' },
    en: { title: 'Choose the mode', body: 'Tap Mode, on the left, and pick one. The mode in use is written above the waveforms. In NIV the modes are PS and CPAP.', tryIt: 'choose PC (in NIV: CPAP, then back to PS).' },
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
    it: { title: 'Cambia la PEEP', body: 'Tocca PEEP e usa − e +: il valore cambia subito. Il segno ✓ chiude la casella.', tryIt: 'porta la PEEP a 8.' },
    en: { title: 'Change the PEEP', body: 'Tap PEEP and use − and +: the value changes at once. The ✓ closes the box.', tryIt: 'set the PEEP to 8.' },
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
    it: { title: 'Cambia la FiO₂', body: 'È la quota di ossigeno, dal 21 al 100%. Ogni tocco la sposta di 5.', tryIt: 'porta la FiO₂ al 50%.' },
    en: { title: 'Change the FiO₂', body: 'It is the oxygen fraction, from 21 to 100%. Each tap moves it by 5.', tryIt: 'set the FiO₂ to 50%.' },
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
    it: { title: 'Flusso, FiO₂ e temperatura', body: 'Qui leggi in grande quello che arriva al paziente. Dopo l’avvio la temperatura sale piano.' },
    en: { title: 'Flow, FiO₂ and temperature', body: 'Here you read in large type what reaches the patient. After starting, the temperature rises slowly.' },
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
    it: { title: 'I limiti d’allarme', body: 'Tocca Allarmi, a sinistra. Per ogni misura ci sono un limite basso e uno alto.', tryIt: 'chiudi il pannello aperto con ✕, poi tocca Allarmi e sposta un limite con − o +.' },
    en: { title: 'The alarm limits', body: 'Tap Alarms, on the left. Each measurement has a low and a high limit.', tryIt: 'close the open panel with ✕, then tap Alarms and move a limit with − or +.' },
  },
  {
    id: 'alarm',
    when: envNot('alto-flusso'),
    target: inside('allarmi', '[data-fam="limite-pPeak"]'),
    done: { state: onVent(peakAlarm) },
    it: { title: 'Fai suonare un allarme', body: 'Alza il limite basso della pressione di picco sopra il picco misurato. In alto compare l’allarme.', tryIt: 'premi + finché l’allarme suona.' },
    en: { title: 'Make an alarm sound', body: 'Raise the low peak pressure limit above the measured peak. The alarm appears at the top.', tryIt: 'press + until the alarm sounds.' },
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
    it: { title: 'Togli la causa', body: 'Riapri Allarmi e riporta il limite basso del picco a 10. L’allarme si spegne da solo quando il problema non c’è più.', tryIt: 'riporta il limite a 10.' },
    en: { title: 'Remove the cause', body: 'Open Alarms again and set the low peak limit back to 10. The alarm clears by itself once the problem is gone.', tryIt: 'set the limit back to 10.' },
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
