import { describe, expect, it, beforeEach } from 'vitest';
import { useI18nStore } from './store';

describe('useI18nStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useI18nStore.getState().setLocale('ru');
  });

  it('translates a key in the default locale (ru)', () => {
    expect(useI18nStore.getState().t('nav.home')).toBe('Сегодня');
  });

  it('switches locale and translates in the new locale', () => {
    useI18nStore.getState().setLocale('en');
    expect(useI18nStore.getState().locale).toBe('en');
    expect(useI18nStore.getState().t('nav.home')).toBe('Today');
  });
});
