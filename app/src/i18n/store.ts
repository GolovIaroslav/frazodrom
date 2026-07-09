import { create } from 'zustand';
import { dictionaries, type DictKey, type Locale } from './dictionaries';

const STORAGE_KEY = 'frazodrom.locale';

function createTranslator(locale: Locale): (key: DictKey) => string {
  return (key) => dictionaries[locale][key];
}

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'ru';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'en' || stored === 'ru' ? stored : 'ru';
}

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: DictKey) => string;
}

const initialLocale = readStoredLocale();

export const useI18nStore = create<I18nState>((set) => ({
  locale: initialLocale,
  setLocale: (locale) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }
    set({
      locale,
      t: createTranslator(locale),
    });
  },
  t: createTranslator(initialLocale),
}));
