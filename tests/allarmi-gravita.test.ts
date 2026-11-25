import { describe, it, expect } from 'vitest';
import { istantaneaIniziale, applica, statoDa } from '../device/screens/scenario/ventilatore/istantanea';
import { misura } from '../device/screens/scenario/ventilatore/fisica';
import { ALLARMI, LIMITI_INIZIALI, cambiamenti, completo, conLimiteDellAgente, gravitaDi, gravitaMassima, limiteDiFabbrica, portaLimite, spostaLimite, valuta, type ChiaveAllarme, type EstremoLimite, type LimiteAllarme } from '../device/screens/scenario/ventilatore/allarmi';

const base = () => applica(istantaneaIniziale('invasiva', 0, { pesoKg: 70, etco2: null, spo2: null, heartRate: 80, map: null }), { tipo: 'standby', ventilando: true }, 0).istantanea;
const suona = (picco: number, limiti = LIMITI_INIZIALI) => {
  const s = statoDa(base());
  return valuta(s, { ...misura(s, 10, 2, null), pPeak: picco }, limiti).find((a) => a.chiave === 'pPeak');
};
const chiavi = (Object.keys(ALLARMI) as ChiaveAllarme[]).filter((k) => !ALLARMI[k].interruttore);

describe('fasce gialle e rosse', () => {
  it('la stessa misura passa da niente a giallo a rosso', () => {
    expect(suona(35)).toBeUndefined();
    expect(suona(38)).toMatchObject({ verso: 'alto', gravita: 'giallo' });
    expect(suona(40)).toMatchObject({ gravita: 'giallo' });
    expect(suona(41)).toMatchObject({ verso: 'alto', gravita: 'rosso' });
    expect(suona(9)).toMatchObject({ verso: 'basso', gravita: 'rosso' });
  });
  it('all’avvio un paziente normale non suona', () => {
    const s = statoDa(base());
    expect(valuta(s, misura(s, 60, 2, null), LIMITI_INIZIALI)).toEqual([]);
  });
  it('un salvataggio senza gialle prende quelle di fabbrica, dentro le sue rosse', () => {
    const vecchio: LimiteAllarme = { basso: 10, alto: 30, acceso: true };
    expect(completo('pPeak', vecchio)).toMatchObject({ preBasso: 10, preAlto: 30 });
    expect(completo('pPeak', { basso: 36, alto: 60, acceso: true })).toMatchObject({ basso: 36, alto: 60 });
    expect(suona(41, { ...LIMITI_INIZIALI, pPeak: { basso: 10, alto: 60, acceso: true } })).toMatchObject({ gravita: 'giallo' });
  });
  it('acqua gialla, apnea rossa senza fascia, ostruzione rossa', () => {
    expect(gravitaDi({ chiave: 'acqua', verso: null, valore: 5 })).toBe('giallo');
    expect(gravitaDi({ chiave: 'ostruzioneAF', verso: null, valore: 5 })).toBe('rosso');
    expect(completo('apnea', LIMITI_INIZIALI.apnea)).toMatchObject({ preBasso: null, preAlto: null });
    expect(gravitaMassima([])).toBeNull();
    expect(gravitaMassima([{ chiave: 'acqua', verso: null, valore: 5 }])).toBe('giallo');
  });
  it('da giallo a rosso è una riga nuova, il ritorno no', () => {
    const g = { chiave: 'pPeak', verso: 'alto', valore: 38, gravita: 'giallo' } as const;
    const r = { ...g, valore: 45, gravita: 'rosso' } as const;
    expect(cambiamenti([g], [r])).toEqual({ accesi: [r], spenti: [] });
    expect(cambiamenti([r], [g])).toEqual({ accesi: [], spenti: [] });
  });
});

describe('spostare le soglie', () => {
  it('l’ordine regge qualunque cosa si trascini', () => {
    let seme = 7;
    const caso = () => (seme = (seme * 16807) % 2147483647) / 2147483647;
    for (const k of chiavi) {
      let l: LimiteAllarme = LIMITI_INIZIALI[k];
      for (let i = 0; i < 400; i++) {
        const e = (['basso', 'preBasso', 'preAlto', 'alto'] as EstremoLimite[])[Math.floor(caso() * 4)];
        const d = ALLARMI[k];
        l = portaLimite(k, l, e, d.minimo - 5 + caso() * (d.massimo - d.minimo + 10));
        const v = [l.basso, l.preBasso, l.preAlto, l.alto];
        const n = v.filter((x): x is number => x != null);
        expect(n, `${k} ${JSON.stringify(l)}`).toEqual([...n].sort((a, b) => a - b));
        if (l.basso !== null && l.alto !== null) expect(l.basso).toBeLessThan(l.alto);
        if (l.preBasso != null && l.preAlto != null) expect(l.preBasso).toBeLessThan(l.preAlto);
        for (const x of n) { expect(x).toBeGreaterThanOrEqual(d.minimo); expect(x).toBeLessThanOrEqual(d.massimo); }
      }
    }
  });
  it('la rossa spinge la gialla, la gialla si ferma alla rossa', () => {
    expect(portaLimite('pPeak', LIMITI_INIZIALI.pPeak, 'alto', 30)).toMatchObject({ alto: 30, preAlto: 30 });
    expect(portaLimite('pPeak', LIMITI_INIZIALI.pPeak, 'preAlto', 60)).toMatchObject({ alto: 40, preAlto: 40 });
    expect(spostaLimite('pPeak', LIMITI_INIZIALI.pPeak, 'preAlto', -1)).toMatchObject({ preAlto: 34 });
  });
  it('un valore non numerico non tocca niente', () => {
    expect(portaLimite('pPeak', LIMITI_INIZIALI.pPeak, 'alto', NaN)).toEqual(LIMITI_INIZIALI.pPeak);
  });
  it('le azioni arrivano all’istantanea, e il ripristino di uno lascia stare gli altri', () => {
    let i = applica(base(), { tipo: 'limite-valore', chiave: 'pPeak', estremo: 'preAlto', valore: 28 }, 0).istantanea;
    i = applica(i, { tipo: 'limite-valore', chiave: 'peep', estremo: 'alto', valore: 12 }, 0).istantanea;
    i = applica(i, { tipo: 'limite-iniziale', chiave: 'pPeak' }, 0).istantanea;
    expect(i.limiti.pPeak).toEqual(LIMITI_INIZIALI.pPeak);
    expect(i.limiti.peep.alto).toBe(12);
  });
  it('il giallo dell’agente segue l’agente montato', () => {
    const d = limiteDiFabbrica('etAgentConcentration', 'desflurano');
    expect(d.preAlto!).toBeLessThan(d.alto!);
    expect(d.preAlto!).toBeGreaterThan(5.5);
    expect(conLimiteDellAgente({ ...LIMITI_INIZIALI, etAgentConcentration: d }, 'sevoflurano').etAgentConcentration).toEqual(LIMITI_INIZIALI.etAgentConcentration);
  });
});
