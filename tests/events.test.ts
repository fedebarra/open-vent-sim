import { describe, it, expect } from 'vitest';
import { parseSequence, EVENT_LIBRARY } from '../remote/events';
import { rt } from '../remote/strings';

describe('sequence files', () => {
  it('round-trips and drops unknown events', () => {
    const s = parseSequence(JSON.stringify({ app: 'open-vent-sim', kind: 'sequence', version: 1, name: 'x', steps: [{ eventId: 'ptx', afterSec: 10 }, { eventId: 'hack', afterSec: 1 }, { eventId: 'desat', afterSec: -5 }] }));
    expect(s.steps).toEqual([{ eventId: 'ptx', afterSec: 10 }, { eventId: 'desat', afterSec: 0 }]);
  });
  it('rejects random JSON', () => {
    expect(() => parseSequence('{"a":1}')).toThrow();
    expect(() => parseSequence('nope')).toThrow();
  });
});

describe('strings', () => {
  it('every event has a label in both languages', () => {
    for (const l of ['it', 'en']) for (const e of EVENT_LIBRARY) expect(typeof rt(l)[e.labelKey]).toBe('string');
  });
  it('Italian and English have the same keys', () => {
    expect(Object.keys(rt('it')).sort()).toEqual(Object.keys(rt('en')).sort());
  });
});
