import { tl, type Lang, type LandingStringKey } from '@bw/shared'
import { createContext, useCallback, useContext } from 'react'

export const LANG_KEY = 'bw.landing.lang'

export type LangValue = { lang: Lang; setLang: (lang: Lang) => void }
export const LangContext = createContext<LangValue>({ lang: 'bn', setLang: () => {} })

export function useLang() {
  return useContext(LangContext)
}

/** `t(key, vars)` in the current language (Bangla first, English toggle). */
export function useT() {
  const { lang } = useContext(LangContext)
  const t = useCallback((key: LandingStringKey, vars?: Record<string, string | number>) => tl(key, lang, vars), [lang])
  return { t, lang }
}
