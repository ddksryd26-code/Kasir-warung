import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setActiveLanguage, translateText, type LanguageCode, type TranslationValues } from '@/localization/translate';

const LANGUAGE_STORAGE_KEY = 'kasir-language';

interface LanguageValue {
  language: LanguageCode;
  locale: string;
  setLanguage: (language: LanguageCode) => void;
  t: (source: string, values?: TranslationValues) => string;
  languageSaveError: boolean;
}

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('id');
  const [hydrated, setHydrated] = useState(false);
  const [languageSaveError, setLanguageSaveError] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((savedLanguage) => {
        if (!mounted) return;
        const nextLanguage: LanguageCode = savedLanguage === 'en' ? 'en' : 'id';
        setActiveLanguage(nextLanguage);
        setLanguageState(nextLanguage);
      })
      .catch(() => {
        if (mounted) setLanguageSaveError(true);
      })
      .finally(() => {
        if (mounted) setHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setActiveLanguage(language);
    void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language)
      .then(() => setLanguageSaveError(false))
      .catch(() => setLanguageSaveError(true));
  }, [hydrated, language]);

  const setLanguage = useCallback((nextLanguage: LanguageCode) => {
    setActiveLanguage(nextLanguage);
    setLanguageState(nextLanguage);
  }, []);

  const value = useMemo<LanguageValue>(() => ({
    language,
    locale: language === 'en' ? 'en-US' : 'id-ID',
    setLanguage,
    t: (source, values) => translateText(language, source, values),
    languageSaveError,
  }), [language, languageSaveError, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage harus dipakai di dalam LanguageProvider');
  return value;
}

export type { LanguageCode };