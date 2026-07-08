import { create } from 'zustand';
import { dictionaries, type DictKey, type Locale } from './dictionaries';

const STORAGE_KEY = 'frazodrom.locale';

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

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: readStoredLocale(),
  setLocale: (locale) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }
    set({ locale });
  },
  t: (key) => dictionaries[get().locale][key],
}));
