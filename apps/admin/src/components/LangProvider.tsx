import type { Lang } from '@bw/shared'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { LANG_KEY, LangContext } from '../lib/i18n'

function savedLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'bn' ? 'bn' : 'en'
  } catch {
    return 'en'
  }
}

/** English first; the Bangla toggle is remembered in this browser. */
export function LangProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial ?? savedLang)
  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      // Private mode: the choice lasts for this tab only.
    }
  }, [])
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}
