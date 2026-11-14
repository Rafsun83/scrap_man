import { t as translate, type Lang, type StringKey } from '@bw/shared';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const LANG_KEY = 'bw.lang';

type LangValue = { lang: Lang; setLang: (lang: Lang) => void };

const LangContext = createContext<LangValue>({ lang: 'bn', setLang: () => {} });

/** Bangla first; the choice is remembered on the device and, once signed in, on the account. */
export function LangProvider({ children, initial = 'bn' }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial);

  useEffect(() => {
    SecureStore.getItemAsync(LANG_KEY)
      .then((saved) => {
        if (saved === 'bn' || saved === 'en') setLangState(saved);
      })
      .catch(() => {});
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    SecureStore.setItemAsync(LANG_KEY, next).catch(() => {});
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

/** `t('key', { vars })` in the current language. */
export function useT() {
  const { lang } = useContext(LangContext);
  const t = useCallback((key: StringKey, vars?: Record<string, string | number>) => translate(key, lang, vars), [lang]);
  return { t, lang };
}

export const apiLanguage = (lang: Lang) => (lang === 'bn' ? 'BN' : 'EN') as 'BN' | 'EN';
export const fromApiLanguage = (language: string | undefined): Lang => (language === 'EN' ? 'en' : 'bn');
