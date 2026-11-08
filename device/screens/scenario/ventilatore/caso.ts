/**
 * Il caso, ma riproducibile.
 *
 * ## Perché non `Math.random()`
 *
 * Il simulatore da cui viene questo motore chiama `Math.random()` dentro il
 * generatore d'onda: una volta per la pressione, una per il flusso, una per il
 * rumore delle secrezioni. Il risultato è che la stessa curva, chiesta due
 * volte allo stesso istante, torna diversa, e che il rumore sulla pressione e
 * quello sul flusso non hanno niente a che vedere l'uno con l'altro — mentre
 * sul paziente vero sono la stessa aria che passa nello stesso tubo.
 *
 * Il guaio pratico è un altro, ed è quello che ha deciso questo file: **una
 * curva che cambia a ogni chiamata non si misura**. Le prove del monitor
 * (`npm run prove`) interrogano le sorgenti come fa chi disegna, `a(t)` per
 * `t` che avanza, e contano i picchi: con `Math.random()` dentro non
 * conterebbero niente di stabile, e un difetto vero — una curva che scompare,
 * un'ampiezza che raddoppia — resterebbe indistinguibile dal rumore.
 *
 * Qui il caso è una funzione del tempo e di un seme: stesso istante, stesso
 * valore. A schermo si vede identico; a banco si conta.
 */

/**
 * Un numero fra -1 e 1 che dipende solo da `t` e dal seme.
 *
 * È rumore di valore: si interpola fra due estrazioni intere, così la curva
 * sale e scende invece di saltare. `scala` dice quante estrazioni al secondo —
 * quindici per le secrezioni, che gorgogliano, una o due per una deriva lenta.
 */
export function rumore(seme: number, t: number, scala = 1): number {
  const x = t * scala
  const i = Math.floor(x)
  const f = x - i
  const a = mescola(seme, i) * 2 - 1
  const b = mescola(seme, i + 1) * 2 - 1
  // Interpolazione con la curva del coseno: niente spigoli fra un'estrazione e
  // l'altra, che su una traccia si vedrebbero come scalini.
  const morbido = (1 - Math.cos(f * Math.PI)) / 2
  return a + (b - a) * morbido
}

/**
 * Un numero fra 0 e 1 fisso per quell'indice: serve a decidere, non a disegnare.
 *
 * La usa anche il monitor, per l'irregolarità del polso sotto sforzi spontanei
 * (`sources.ts`): è la stessa domanda — «questo atto, che numero ha?» — e due
 * hash diversi nella stessa applicazione sarebbero due modi di essere
 * riproducibili, cioè uno di troppo.
 */
export function estrazione(seme: number, indice: number): number {
  return mescola(seme, indice)
}

/**
 * Hash intero → numero fra 0 e 1. Nessuno stato, nessuna sorpresa.
 *
 * Il mescolamento è quello di murmur3, e non è pignoleria: una funzione più
 * semplice — moltiplica, sposta, mescola una volta — distribuisce bene sui
 * grandi numeri e **male sui primi indici**. Il primo tentativo dava 0,77, 0,66,
 * 0,98, 0,86 per gli indici da zero a tre: con una quota di asincronie al
 * sessanta per cento, i primi quattro atti dello scenario non ne mostravano
 * nessuna. Contati su duemila atti i conti tornavano, e sarebbe passato: ma i
 * primi quattro atti sono esattamente quelli che l'istruttore guarda dopo aver
 * premuto il pulsante, e una funzione che si comporta bene solo alla lunga qui
 * è una funzione rotta.
 */
function mescola(seme: number, i: number): number {
  let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(seme | 0, 0x165667b1)
  h ^= h >>> 15
  h = Math.imul(h, 0x2545f491)
  h ^= h >>> 13
  h = Math.imul(h, 0x27d4eb2f)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}
