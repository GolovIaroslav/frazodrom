export type Locale = 'ru' | 'en';

export const dictionaries = {
  ru: {
    'nav.home': 'Сегодня',
    'nav.courseMap': 'Карта курса',
    'nav.settings': 'Настройки',
    'home.title': 'Сегодня',
    'home.body': 'Здесь будет план тренировок на сегодня.',
    'courseMap.title': 'Карта курса',
    'courseMap.body': 'Здесь будет карта грамматических паттернов A1–C1.',
    'settings.title': 'Настройки',
    'settings.theme': 'Тема',
    'settings.theme.light': 'Светлая',
    'settings.theme.dark': 'Тёмная',
    'settings.language': 'Язык',
  },
  en: {
    'nav.home': 'Today',
    'nav.courseMap': 'Course Map',
    'nav.settings': 'Settings',
    'home.title': 'Today',
    'home.body': "Today's training plan will live here.",
    'courseMap.title': 'Course Map',
    'courseMap.body': 'The A1–C1 grammar pattern map will live here.',
    'settings.title': 'Settings',
    'settings.theme': 'Theme',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.language': 'Language',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type DictKey = keyof (typeof dictionaries)['ru'];
