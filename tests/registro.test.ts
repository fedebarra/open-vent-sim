import { describe, it, expect } from 'vitest';
import { raggruppa, mmss, nuovoRegistro, esportaJson, leggiJson, vociAllarmi, esportaCsv } from '../remote/registro';

describe('session log', () => {
  it('formats time from T0', () => {
    expect(mmss(0)).toBe('0:00');
    expect(mmss(75_400)).toBe('1:15');
    expect(mmss(-599_996)).toBe('−10:00');
  });
  it('groups repeated adjustments of the same knob within a minute', () => {
    const v = (at: number, key?: string, text = 'x') => ({ at, vent: 'v1', cat: 'ventilatore' as const, who: 'learner' as const, text, key });
    const g = raggruppa([v(0, 'peep', 'PEEP 6'), v(10_000, 'peep', 'PEEP 7'), v(20_000, 'peep', 'PEEP 8'), v(30_000, 'fio2'), v(200_000, 'peep')]);
    expect(g.length).toBe(3);
    expect(g[0].riassunte.length).toBe(3);
    expect(g[0].voce.text).toBe('PEEP 8');
    expect(g[0].voce.at).toBe(0);
  });
  it('round-trips through JSON and rejects foreign files', () => {
    const r = nuovoRegistro(1000);
    r.voci.push({ at: 2000, vent: 'v1', cat: 'paziente', who: 'director', text: 'ARDS' });
    r.scheda.titolo = 'Giro 1';
    const back = leggiJson(esportaJson(r));
    expect(back.voci[0].text).toBe('ARDS');
    expect(back.scheda.titolo).toBe('Giro 1');
    expect(() => leggiJson('{"a":1}')).toThrow();
  });
  it('derives alarm on/off lines', () => {
    const out = vociAllarmi(['pPeak'], ['volumeMinute'], 5, 'v1', (k) => k, 'Allarme', 'Rientrato');
    expect(out.map((x) => x.text).sort()).toEqual(['Allarme: volumeMinute', 'Rientrato: pPeak']);
  });
  it('exports CSV with quoted fields', () => {
    const r = nuovoRegistro(0);
    r.vents.v1 = 'Letto "A"';
    r.voci.push({ at: 1000, vent: 'v1', cat: 'ventilatore', who: 'learner', text: 'PEEP, 8' });
    const csv = esportaCsv(r, { learner: 'studente', director: 'regia', system: 'sistema', cat: { ventilatore: 'Ventilatore', paziente: 'Paziente', allarmi: 'Allarmi', regia: 'Regia' } });
    expect(csv).toContain('"Letto ""A"""');
    expect(csv).toContain('"PEEP, 8"');
  });
});
