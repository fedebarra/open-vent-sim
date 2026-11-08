/**
 * Steps of the guided tour for the director console ("Regia").
 *
 * Same engine as the ventilator's tour (`Tour.tsx`), another list: the
 * console in the order an instructor meets it before a lesson — let the
 * learners in, put a ventilator on the projector, choose who to talk to, then
 * the tabs from the patient to the events, and the session log. The targets are
 * the console's `data-testid` hooks; a tab step ticks when the tab is opened.
 *
 * The console has no environment to filter on: every step always applies.
 * Steps about a selected ventilator light the card if there is one, and stay
 * centred if no learner has connected yet.
 */
import type { TourStep } from './steps';

const tab = (k: string): Pick<TourStep, 'target' | 'done'> => ({
  target: [`[data-testid="tab-${k}"]`],
  done: { click: [`[data-testid="tab-${k}"]`] },
});

export const REGIA_STEPS: TourStep[] = [
  {
    id: 'regia-welcome',
    card: 'center',
    it: { title: 'La regia', body: 'Da qui vedi tutti i ventilatori collegati e decidi il paziente: polmone, sforzo, asincronie, eventi. I discenti vedono solo le curve e i numeri: i nomi di quello che succede restano qui. Segui i passi con «Avanti»; dove c’è «Prova tu», fallo.' },
    en: { title: 'The director console', body: 'From here you see every connected ventilator and decide the patient: lung, effort, asynchronies, events. Learners only see waveforms and numbers: the names of what is happening stay here. Follow the steps with “Next”; where it says “Try it”, do it.' },
  },
  {
    id: 'regia-connect',
    target: ['[data-testid="connect-card"]', '[data-testid="regia-pin"]'],
    it: { title: 'Far entrare i discenti', body: 'Niente da installare: sulla stessa rete Wi-Fi, iPad, tablet o portatile inquadrano il QR (o scrivono l’indirizzo) nel browser e mettono il PIN. Ogni dispositivo che entra è un ventilatore nella lista a sinistra.' },
    en: { title: 'Letting learners in', body: 'Nothing to install: on the same Wi-Fi, an iPad, tablet or laptop scans the QR code (or types the address) in the browser and enters the PIN. Each device that joins is a ventilator in the list on the left.' },
  },
  {
    id: 'regia-second-screen',
    target: ['[data-testid="second-screen"]'],
    done: { click: ['[data-testid="second-screen"]'] },
    it: { title: 'Il ventilatore sul proiettore', body: 'Con un proiettore o una LIM collegati a questo computer, questo pulsante apre un ventilatore già collegato sull’altro schermo, a tutto schermo: la classe lo usa col tocco, tu lo comandi da qui. Esc esce dal tutto schermo.', tryIt: 'premi Ventilatore sul secondo schermo.' },
    en: { title: 'The ventilator on the projector', body: 'With a projector or an interactive whiteboard connected to this computer, this button opens a ventilator, already joined, full screen on the other display: the class uses it by touch, you drive it from here. Esc leaves full screen.', tryIt: 'press Ventilator on the second screen.' },
  },
  {
    id: 'regia-list',
    target: ['[data-testid="vent-list"]'],
    it: { title: 'Chi stai guardando', body: 'Tocca un ventilatore per vederlo e comandarlo. Il pallino dice se è collegato, la riga sotto dice che macchina è, in che modalità e se ventila. Lo puoi rinominare col nome del gruppo.' },
    en: { title: 'Who you are looking at', body: 'Tap a ventilator to see and drive it. The dot says whether it is connected; the line below says which machine, which mode and whether it is ventilating. You can rename it after the group.' },
  },
  {
    id: 'regia-overview',
    target: ['[data-tour="regia-ventilatore"]'],
    it: { title: 'Il ventilatore, da qui', body: 'Le curve in piccolo, i numeri che vedono i discenti e gli allarmi accesi sul loro schermo. È quello che guardi mentre loro decidono.' },
    en: { title: 'The ventilator, from here', body: 'The waveforms in small, the numbers the learners see and the alarms active on their screen. It is what you watch while they decide.' },
  },
  {
    id: 'regia-send-to',
    target: ['[data-testid="send-to"]'],
    it: { title: 'A uno o a tutti', body: '«Solo questo» manda i comandi al ventilatore scelto; «Tutti» a ogni ventilatore collegato, per far partire tutta l’aula dallo stesso paziente.' },
    en: { title: 'To one or to all', body: '“This one” sends commands to the chosen ventilator; “All” to every connected ventilator, to start the whole class from the same patient.' },
  },
  {
    id: 'regia-patient',
    ...tab('patient'),
    it: { title: 'Il paziente', body: 'I quadri clinici (normale, BPCO, ARDS…), poi compliance, resistenza, frequenza e forza dello sforzo, limitazione al flusso, secrezioni, e i parametri vitali. Muovi i cursori e premi Applica.', tryIt: 'apri la scheda Paziente.' },
    en: { title: 'The patient', body: 'Clinical pictures (normal, COPD, ARDS…), then compliance, resistance, effort rate and strength, flow limitation, secretions, and the vital signs. Move the sliders and press Apply.', tryIt: 'open the Patient tab.' },
  },
  {
    id: 'regia-ramp',
    target: ['[data-testid="ramp-select"]', '[data-testid="tab-patient"]'],
    it: { title: 'Subito o piano piano', body: '«Cambia in» decide quanto ci mette un cambio: subito, o in 30 secondi, 1, 2 o 5 minuti. Una desaturazione che scende in un minuto si riconosce; uno scalino no.' },
    en: { title: 'At once or gradually', body: '“Change over” decides how long a change takes: at once, or over 30 seconds, 1, 2 or 5 minutes. A desaturation that falls over a minute is recognisable; a step is not.' },
  },
  {
    id: 'regia-async',
    ...tab('async'),
    it: { title: 'Le asincronie', body: 'Scegli l’asincronia e quanti atti coinvolge. Non sono disegni: sono cause — uno sforzo che non arriva al trigger, uno sforzo più lungo dell’inspirazione — e le curve le mostrano da sole. Il nome non compare sul ventilatore: riconoscerle è il compito dei discenti.', tryIt: 'apri la scheda Asincronie.' },
    en: { title: 'Asynchronies', body: 'Choose the asynchrony and how many breaths it involves. They are not drawings but causes — an effort that misses the trigger, an effort longer than inspiration — and the waveforms show them by themselves. The name never appears on the ventilator: recognising it is the learners’ job.', tryIt: 'open the Asynchronies tab.' },
  },
  {
    id: 'regia-mechanics',
    ...tab('mechanics'),
    it: { title: 'Sforzo e parete', body: 'I quadri che si sommano al polmone: obesità, addome teso, chiusura delle vie aeree, sforzo vigoroso, respiro irregolare, oscillazioni cardiache, grugnito, espirio attivo. Sotto, la forma dello sforzo e lo sforzo che risponde al supporto. In NIV c’è la perdita della maschera: grande, e la PS cicla in ritardo e il trigger parte da solo.', tryIt: 'apri la scheda Sforzo e parete.' },
    en: { title: 'Effort & chest wall', body: 'Pictures that add to the lung: obesity, tense abdomen, airway closure, vigorous effort, irregular breathing, cardiac oscillations, grunting, active expiration. Below, the shape of the effort and an effort that responds to support. In NIV there is the mask leak: make it large, and PS cycles late and the trigger fires by itself.', tryIt: 'open the Effort & chest wall tab.' },
  },
  {
    id: 'regia-lung',
    ...tab('lung'),
    it: { title: 'Il polmone e la PEEP', body: 'La reclutabilità decide se alzando la PEEP la compliance sale (si riapre) o scende (si sovradistende); la parete toracica decide quanto della pressione arriva al circolo. Da qui si avvia anche il reclutamento sostenuto.', tryIt: 'apri la scheda Polmone.' },
    en: { title: 'The lung and PEEP', body: 'Recruitability decides whether raising PEEP makes compliance rise (it reopens) or fall (it overdistends); the chest wall decides how much pressure reaches the circulation. The sustained recruitment is started from here too.', tryIt: 'open the Lung tab.' },
  },
  {
    id: 'regia-machine',
    ...tab('machine'),
    it: { title: 'La macchina', body: 'Le manopole del ventilatore, se in sala c’è una macchina vera da ricopiare; le pause, la curva P/V lenta e il rapporto R/I; «Mostra le tracce didattiche» accende Palv·Pmus e Pes·PL sui ventilatori. Qui salvi e carichi uno scenario: paziente e macchina in un file.', tryIt: 'apri la scheda Macchina.' },
    en: { title: 'The machine', body: 'The ventilator knobs, if a real machine in the room has to be mirrored; the holds, the low-flow P/V curve and the R/I ratio; “Show the teaching traces” turns on Palv·Pmus and Pes·PL on the ventilators. Here you save and load a scenario: patient and machine in a file.', tryIt: 'open the Machine tab.' },
  },
  {
    id: 'regia-events',
    ...tab('events'),
    it: { title: 'Gli eventi', body: 'Broncospasmo, tappo di muco, pneumotorace, maschera spostata… «Ora» lo fa partire subito; «+ Aggiungi» lo mette in una sequenza con i tempi, che si avvia, si mette in pausa e si salva per la lezione dopo.', tryIt: 'apri la scheda Eventi.' },
    en: { title: 'Events', body: 'Bronchospasm, mucus plug, pneumothorax, displaced mask… “Now” fires it at once; “+ Add” puts it in a timed sequence that you start, pause and save for the next lesson.', tryIt: 'open the Events tab.' },
  },
  {
    id: 'regia-record',
    target: ['[data-testid="rec-start"]', '[data-testid="rec-stop"]'],
    it: { title: 'Registrare la sessione', body: 'Registra tiene i trend e ogni gesto — dei discenti e tuoi — con l’ora. Fermata la registrazione si apre il registro: è il materiale del debriefing.' },
    en: { title: 'Recording the session', body: 'Record keeps the trends and every action — the learners’ and yours — with the time. When you stop, the session log opens: it is your debriefing material.' },
  },
  {
    id: 'regia-log',
    target: ['[data-testid="regia-log"]'],
    it: { title: 'Il diario', body: 'Qui scorre quello che succede: chi ha toccato che cosa, i tuoi comandi, gli allarmi. Lo leggi senza alzare gli occhi dalla regia.' },
    en: { title: 'The diary', body: 'What happens scrolls here: who touched what, your commands, the alarms. You read it without looking up from the console.' },
  },
  {
    id: 'regia-goodbye',
    card: 'center',
    it: { title: 'Pronto', body: 'Questo è tutto. La guida si riapre dal pulsante Guida in alto. Buona lezione.' },
    en: { title: 'Ready', body: 'That is all. The guide reopens from the Guide button at the top. Have a good lesson.' },
  },
];
