import { describe, it, expect } from 'vitest';
import { TOUR_STEPS, stepsFor, TourContext } from '../tour/steps';
import { tourStrings } from '../tour/strings';

const ctx = (over: Partial<TourContext> = {}): TourContext => ({
  screen: 'startup', icuChoice: false, ambiente: null, vent: null, actions: [], ...over,
});
const ids = (c: TourContext) => stepsFor(c).map((s) => s.id);

describe('tour steps', () => {
  it('have unique ids', () => {
    const all = TOUR_STEPS.map((s) => s.id);
    expect(new Set(all).size).toBe(all.length);
  });
  it('every step has Italian and English title and body, and tryIt in both or neither', () => {
    for (const s of TOUR_STEPS) {
      for (const l of ['it', 'en'] as const) {
        expect(s[l].title.trim().length, `${s.id}.${l}.title`).toBeGreaterThan(0);
        expect(s[l].body.trim().length, `${s.id}.${l}.body`).toBeGreaterThan(0);
      }
      expect(!!s.it.tryIt, `${s.id} tryIt`).toBe(!!s.en.tryIt);
      expect(s.it.body, `${s.id} not translated`).not.toBe(s.en.body);
    }
  });
  it('selectors are non-empty strings', () => {
    for (const s of TOUR_STEPS) for (const q of [...(s.target ?? []), ...(s.done?.click ?? []), ...(s.done?.appears ? [s.done.appears] : [])]) {
      expect(typeof q).toBe('string');
      expect(q.trim().length, s.id).toBeGreaterThan(2);
    }
  });
  it('the environment decides the steps', () => {
    const inv = ids(ctx({ screen: 'running', ambiente: 'invasiva' }));
    const niv = ids(ctx({ screen: 'running', ambiente: 'niv' }));
    const anes = ids(ctx({ screen: 'running', ambiente: 'anestesia' }));
    const hf = ids(ctx({ screen: 'running', ambiente: 'alto-flusso' }));
    expect(inv).toEqual(expect.arrayContaining(['circuit', 'mode', 'peep', 'waves', 'holds', 'recruitment', 'humidifier']));
    expect(inv).not.toContain('gas');
    expect(niv).toContain('circuit');
    expect(anes).toEqual(expect.arrayContaining(['source', 'gas', 'delivery', 'flush', 'dose']));
    expect(anes).not.toContain('humidifier');
    expect(anes).not.toContain('circuit');
    expect(hf).toEqual(expect.arrayContaining(['flow', 'temperature', 'hf-numbers', 'humidifier']));
    expect(hf).not.toContain('waves');
    expect(hf).not.toContain('mode');
    for (const l of [inv, niv, anes, hf]) {
      expect(l[0]).toBe('welcome');
      expect(l[l.length - 1]).toBe('goodbye');
      expect(l).not.toContain('choose');
      expect(l).not.toContain('patient');
    }
  });
  it('start-up steps appear only before the machine runs', () => {
    expect(ids(ctx())).toEqual(expect.arrayContaining(['choose', 'icu-choice', 'patient']));
    expect(ids(ctx({ screen: 'setup', ambiente: 'anestesia' }))).not.toContain('icu-choice');
    expect(ids(ctx({ screen: 'setup', icuChoice: true }))).toContain('icu-choice');
  });
  it('action-based "Try it" matches the action names', () => {
    const silence = TOUR_STEPS.find((s) => s.id === 'silence')!;
    expect(silence.done?.action).toBe('vent-silenzia');
    const mode = TOUR_STEPS.find((s) => s.id === 'mode')!.done!.action as (k: string) => boolean;
    expect(mode('vent-modalita:PC')).toBe(true);
    expect(mode('vent-modalita:VC')).toBe(false);
  });
  it('chrome strings exist in both languages', () => {
    expect(Object.keys(tourStrings('it')).sort()).toEqual(Object.keys(tourStrings('en')).sort());
    expect(tourStrings('it').step(3, 14)).toBe('Passo 3 di 14');
  });
});

import { REGIA_STEPS } from '../tour/regia';
describe('console tour steps', () => {
  it('have unique ids, both languages, and differ from the ventilator ids', () => {
    const ids = REGIA_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const vent = new Set(TOUR_STEPS.map((s) => s.id));
    for (const s of REGIA_STEPS) {
      expect(vent.has(s.id), s.id).toBe(false);
      for (const l of ['it', 'en'] as const) {
        expect(s[l].title.trim().length, `${s.id}.${l}.title`).toBeGreaterThan(0);
        expect(s[l].body.trim().length, `${s.id}.${l}.body`).toBeGreaterThan(0);
      }
      expect(!!s.it.tryIt, `${s.id} tryIt`).toBe(!!s.en.tryIt);
      expect(s.it.body).not.toBe(s.en.body);
    }
  });
  it('covers every tab of the console', () => {
    for (const k of ['patient', 'async', 'mechanics', 'lung', 'machine', 'events']) {
      expect(REGIA_STEPS.some((s) => s.target?.includes(`[data-testid="tab-${k}"]`)), k).toBe(true);
    }
  });
});
