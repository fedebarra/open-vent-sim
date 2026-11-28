// Le righe di riferimento e la scala che si ricalcola al giro della spazzata.
import { describe, it, expect } from 'vitest';
import { tacche, scalaDaVisto } from '../device/screens/scenario/ventilatore/pannello';

describe('tacche', () => {
  it('estremi, zero e valori tondi in mezzo', () => {
    expect(tacche([0, 25])).toEqual([0, 10, 20, 25]);
    expect(tacche([-80, 25])).toEqual([-80, -50, 0, 25]);
    expect(tacche([0, 800])).toEqual([0, 200, 400, 600, 800]);
  });
  it('una scala vuota non ha tacche', () => {
    expect(tacche([0, 0])).toEqual([]);
  });
});

describe('scalaDaVisto', () => {
  it('la curva che esce allarga la scala', () => {
    expect(scalaDaVisto([0, 25], [5, 30], [0, 25])).toEqual([0, 40]);
  });
  it('un flusso espiratorio più forte del previsto allarga il fondo negativo', () => {
    expect(scalaDaVisto([-40, 40], [-60, 30], [-40, 40])[0]).toBe(-80);
  });
  it('una curva un po\' più piccola non stringe la scala (isteresi)', () => {
    expect(scalaDaVisto([0, 25], [5, 18], [0, 40])).toEqual([0, 40]);
  });
  it('una curva molto più piccola sì', () => {
    expect(scalaDaVisto([0, 10], [0, 8], [0, 50])).toEqual([0, 10]);
  });
  it('senza niente di visto vale la scala suggerita', () => {
    expect(scalaDaVisto([0, 25], null, [0, 25])).toEqual([0, 25]);
  });
});
