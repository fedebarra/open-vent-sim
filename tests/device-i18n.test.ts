import { describe, it, expect } from 'vitest'
import { it as itDict } from '../device/i18n/it'
import { en } from '../device/i18n/en'
import { translate } from '../device/i18n'

describe('device dictionaries', () => {
  it('Italian and English have identical keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(itDict).sort())
  })
  it('an English text is empty only where the Italian one is empty on purpose', () => {
    for (const [k, v] of Object.entries(en)) expect(v === '', k).toBe((itDict as Record<string, string>)[k] === '')
  })
  it('interpolates and falls back', () => {
    expect(translate('en', 'vent.param.peep')).toBe('PEEP')
    expect(translate('it', 'vent.param.frequency')).not.toBe('vent.param.frequency')
  })
})
