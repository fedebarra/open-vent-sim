/** Chrome of the guided tour (card buttons, banner). Step texts live in steps.ts. */
const it = {
  badge: 'GUIDA',
  banner: 'Prova libera: niente di quello che fai conta',
  step: (n: number, tot: number) => `Passo ${n} di ${tot}`,
  next: 'Avanti',
  back: 'Indietro',
  exit: 'Esci',
  done: 'Ho finito',
  hide: 'Nascondi la guida',
  restart: 'Rivedi dall’inizio',
  tab: 'Guida',
  tryIt: 'Prova tu:',
  doneTick: 'Fatto!',
  missing: 'Questo pezzo adesso non è sullo schermo: leggi la descrizione e vai avanti.',
  keys: 'Tasti: ← → per muoverti, Esc per uscire.',
};

export type TourStrings = typeof it;

const en: TourStrings = {
  badge: 'GUIDE',
  banner: 'Free practice: nothing you do counts',
  step: (n: number, tot: number) => `Step ${n} of ${tot}`,
  next: 'Next',
  back: 'Back',
  exit: 'Exit',
  done: 'Done',
  hide: 'Hide the guide',
  restart: 'Restart the guide',
  tab: 'Guide',
  tryIt: 'Try it:',
  doneTick: 'Done!',
  missing: 'This part is not on screen right now: read the description and go on.',
  keys: 'Keys: ← → to move, Esc to exit.',
};

export function tourStrings(language: string): TourStrings {
  return language === 'it' ? it : en;
}
