/**
 * `useT()`, backed by Open Vent Sim's language
 * (LanguageContext). Same signature, so the ported files stay untouched.
 */
import { useCallback } from 'react'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { it, type TranslationKey } from './it'
import { en } from './en'

export type { TranslationKey }
export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

const DICTS: Record<'it' | 'en', Record<string, string>> = { it, en }

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

export function translate(language: string, key: TranslationKey, vars?: Record<string, string | number>): string {
  const d = DICTS[language === 'it' ? 'it' : 'en']
  return interpolate(d[key] ?? it[key] ?? key, vars)
}

export function useT(): Translate {
  const { language } = useLanguage()
  return useCallback<Translate>((key, vars) => translate(language, key, vars), [language])
}
