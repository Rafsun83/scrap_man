import { ta, type AdminStringKey, type Lang } from '@bw/shared'
import { createContext, useCallback, useContext } from 'react'

export const LANG_KEY = 'bw.admin.lang'

export type LangValue = { lang: Lang; setLang: (lang: Lang) => void }
export const LangContext = createContext<LangValue>({ lang: 'en', setLang: () => {} })

export function useLang() {
  return useContext(LangContext)
}

/** `t(key, vars)` in the current language (English first, Bangla toggle). */
export function useT() {
  const { lang } = useContext(LangContext)
  const t = useCallback((key: AdminStringKey, vars?: Record<string, string | number>) => ta(key, lang, vars), [lang])
  return { t, lang }
}
