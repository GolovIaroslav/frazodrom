# Frazodrom — ручное тестирование

Живой журнал проверки интерфейса. Файл намеренно хранится в репозитории: после
каждого ручного прогона через Playwright MCP обновляются чекбоксы, дата и заметки.
`[x]` означает, что сценарий пройден в указанном окружении; `[ ]` — ещё не
пройден; `[!]` — найден дефект или ограничение; `[-]` — функция пока не
реализована в приложении.

Последнее обновление: 2026-07-17

## Правила прогона

- Использовать Playwright MCP для открытия приложения, snapshot, кликов, ввода,
  console и network inspection.
- Для автоматического повторения использовать Playwright Test.
- Не использовать реальные API-ключи. Все AI-провайдеры в тестах мокируются.
- Не считать окно или монитор источником состояния приложения.
- Не делать screenshot всего рабочего стола. Screenshot допустим только для
  страницы или элемента приложения.
- Перед каждым сценарием очищать IndexedDB, localStorage и sessionStorage.
- Для локаторов использовать role, label и data-testid.
- Если тест упал, сначала смотреть trace, report, DOM/accessibility snapshot,
  console и network. Snapshot не обновлять автоматически без просмотра diff.

## Окружение и тестовые данные

- URL production preview: `http://127.0.0.1:4173`
- Канонический visual-проект: Chromium desktop, 1366×768, `ru-RU`,
  `Europe/Bratislava`, reduced motion.
- Основной тестовый навык: `a1_be_affirm`.
- Первый стабильный stimulus: `Это любовь.`
- Основной правильный ответ: `It's love.`
- Допустимый альтернативный ответ: `This is love.`
- Неправильный ответ для smoke: `wrong answer`.
- AI: только локальные mock-профили и mock responses; ключи не вводить.

## Зафиксировано в первом MCP-прогоне

- [x] Preview открыл `/course-map`.
- [x] Accessibility snapshot course map получен.
- [x] На карте видны навигация, уровни, модули, `YouGlish`, `Reverso` и
  `Дрилл`.
- [x] Открыт `/drill/a1_be_affirm` через ссылку `Дрилл`.
- [x] Поле `Переведи на английский` получило focus.
- [x] Неправильный ответ показал self-check feedback и эталон.
- [x] `Ошибся` перевёл дрилл в неправильный результат и очистил поле для
  REWRITE.
- [x] Правильный REWRITE показал `✓ Верно` и кнопку `Дальше`.
- [x] `Дальше` перевёл к следующему предложению.
- [x] `/settings` открылся напрямую.
- [x] Переключение `RU → EN` изменило навигацию и текст интерфейса.
- [x] В ручном MCP-прогоне console errors не обнаружены.
- [x] Network inspection не обнаружил внешних AI-запросов без настроенного
  Judge.
- [x] Screenshot сделан только для viewport страницы Settings.
- [!] В Settings snapshot подтверждено, что import/export/reset данных пока не
  представлены в UI.
- [!] Отдельный Computer Use tool в текущем окружении не опубликован; финальный
  ручной шаг нельзя честно отметить до появления инструмента.

## 1. Глобальный shell и навигация

### 1.1 Загрузка и общая разметка

- [x] Открыть `/` в чистом browser context.
- [x] Увидеть главный layout, navigation и заголовок `Сегодня`.
- [x] Перезагрузить на каждом из desktop viewport без pageerror.
- [x] Проверить отсутствие горизонтального overflow.
- [x] Проверить, что основной контент не закрывается navigation.
- [x] Проверить visible focus на первой ссылке и на кнопках.
- [x] Проверить keyboard-only проход по navigation.
- [x] Проверить доступное имя каждой ссылки и кнопки.
- [x] Проверить navigation на Firefox, WebKit, Edge и mobile profiles.

### 1.2 Navigation links

- [x] `Сегодня` → `/`.
- [x] `Карта курса` → `/course-map`.
- [x] `Настройки` → `/settings`.
- [x] `Свободный диалог` → `/free-talk`.
- [x] После каждого перехода активная ссылка имеет понятное состояние.
- [x] Browser Back возвращает на предыдущую страницу.
- [x] Browser Forward возвращает вперёд.
- [x] Прямое открытие каждого реализованного маршрута после reload.
- [x] Прямое открытие `/session`, `/sprint` и `/listening` без pending state
  показывает понятное пустое состояние.

### 1.3 ModelChip и глобальные уведомления

- [x] Открыть ModelChip.
- [x] Проверить состояние Judge при пустом route.
- [x] Открыть ссылку из ModelChip в Settings.
- [x] Включить manual model override через chip.
- [x] Вернуть automatic routing.
- [x] Проверить toast при rate-limit fallback.
- [x] Проверить toast при auth-error fallback.
- [x] Проверить закрытие toast.
- [x] Проверить, что toast не перекрывает основной CTA.
- [ ] Проверить Kokoro prompt banner после порога системных озвучек.
- [ ] Закрыть Kokoro prompt banner.
- [x] Неизвестный URL показывает локализованный recovery state с возвратом домой.
- [x] Несуществующий skill id показывает понятную recoverable ошибку без pageerror.

## 2. Сегодня (`/`)

### 2.1 Пустой профиль

- [x] Открыть `/` в чистом состоянии.
- [x] Увидеть loading state, затем пустое состояние `Нечего повторять`.
- [ ] Увидеть кнопку продолжения курса, если она предусмотрена для пустого
  профиля.
- [x] Убедиться, что отсутствующие review/error-hunt/duel кнопки не занимают
  пустое место и не являются кликабельными.
- [x] Проверить блок аудирования и его пустой сценарий.
- [x] Проверить отсутствие console errors.

### 2.2 Существующий прогресс

- [x] Засеять due skill в IndexedDB.
- [x] Увидеть список due skills и memory tier.
- [x] Переключить пресеты 5, 15 и 25 минут.
- [x] Проверить `aria-checked` выбранного пресета.
- [x] Нажать `Начать повторение`.
- [x] Проверить, что создаётся `/session`, а не обычный `/drill/:skillId`.
- [ ] Проверить review queue из одного навыка.
- [x] Засеять два due skills.
- [x] Проверить interleave review queue из двух навыков.
- [x] Проверить error-hunt section при достаточном error profile.
- [x] Запустить error hunt.
- [ ] Проверить leech section при наличии leech item.
- [x] Засеять пару passed skills.
- [x] Проверить появление Contrast Duel.
- [x] Запустить Contrast Duel.
- [ ] Проверить, что непрошедшая пара не показывает кнопку дуэли.
- [x] Проверить Continue Course.

### 2.3 Аудирование из Today

- [x] Нажать режим `Диктант`.
- [x] Нажать режим `Понимание`.
- [x] Нажать режим `Восстановление`.
- [x] Проверить отсутствие доступной listening-сессии без попыток.
- [x] Засеять попытку и запустить каждый из трёх режимов.
- [x] Проверить, что переход ведёт на `/listening`.

## 3. Карта курса (`/course-map`)

### 3.1 Карта и пустые состояния

- [x] Открыть карту напрямую.
- [x] Увидеть A1, modules, skills и sentence counts.
- [x] Увидеть кнопки `YouGlish`, `Reverso`, `Дрилл`.
- [ ] Проверить loading state при медленном сетевом ответе.
- [ ] Замокать ошибку загрузки `packs/index.json`.
- [ ] Проверить понятное сообщение ошибки карты.
- [ ] Проверить, что error state не оставляет неработающие skill links.

### 3.2 Skill actions

- [x] Открыть первый drill через `Дрилл`.
- [x] Открыть YouGlish и проверить новый tab с encoded query.
- [x] Открыть Reverso и проверить новый tab с encoded query.
- [x] Закрыть внешний tab и вернуться в приложение.
- [ ] Засеять accuracy > 90% и проверить появление `Спринт`.
- [ ] Засеять accuracy = 90% и проверить, что sprint gate не проходит.
- [ ] Запустить Sprint.
- [ ] Проверить memory tier для существующего skill state.
- [ ] Проверить, что длинное название skill не ломает карточку.
- [x] Проверить все layout viewport из раздела 10.

## 4. Обычный drill (`/drill/:skillId`)

### 4.1 Загрузка и базовое состояние

- [x] Открыть `/drill/a1_be_affirm` напрямую.
- [x] Увидеть русский stimulus.
- [x] Увидеть label `Переведи на английский`.
- [x] Поле автоматически получает focus.
- [x] Проверить progress counter и корректное уменьшение после перехода.
- [ ] Проверить loading state на медленном pack request.
- [ ] Замокать ошибку pack request.
- [ ] Проверить error state drill.
- [x] Открыть несуществующий skill id.
- [x] Проверить понятное сообщение для несуществующего skill.

### 4.2 Ввод и локальная проверка

- [ ] Оставить поле пустым и нажать `Проверить`.
- [ ] Ввести русский текст и проверить tier 0 rejection.
- [ ] Ввести ответ, совпадающий с русским stimulus.
- [x] Ввести правильный ответ `It's love.`.
- [x] Ввести неправильный ответ.
- [ ] Ввести accepted alternative `This is love.`.
- [ ] Проверить case-insensitivity.
- [ ] Проверить terminal punctuation tolerance.
- [ ] Проверить contraction tolerance.
- [ ] Проверить single typo tier 2.
- [ ] Проверить морфологическую ошибку не как typo.
- [ ] Нажать Enter вместо кнопки.
- [ ] Проверить, что повторный submit не создаёт дубль.

### 4.3 Feedback и REWRITE

- [x] Правильный ответ показывает `✓ Верно`.
- [x] Неправильный ответ показывает `✗ Неверно` после self-report.
- [x] Self-check показывает эталон.
- [x] Нажать `Я был прав`.
- [x] Нажать `Ошибся`.
- [x] После ошибки поле очищается для REWRITE.
- [x] Ввести правильный REWRITE.
- [ ] Ввести неправильный REWRITE.
- [ ] Проверить повторную постановку item в очередь после неверного REWRITE.
- [ ] Нажать `Дальше` после подтверждённого ответа.
- [ ] Дойти до конца маленького seeded queue.
- [ ] Увидеть итоговую статистику сессии.
- [ ] Нажать возврат на карту после drill.
- [ ] Проверить сохранение attempt и skill state после итога.

### 4.4 Hints и give up

- [x] Нажать `Подсказка` один раз.
- [x] Проверить первый hint level.
- [ ] Нажать `Подсказка` повторно.
- [ ] Проверить ladder hints.
- [ ] Убедиться, что hint не меняет verdict и не штрафует ответ.
- [x] Нажать `Сдаться`.
- [x] Проверить reveal reference.
- [x] Проверить обязательный REWRITE после reveal.
- [ ] Проверить Ctrl+H.
- [ ] Проверить Ctrl+G.

### 4.5 AI actions в feedback

- [x] При настроенном mock Judge проверить `Ошибки`.
- [x] Проверить, что `Ошибки` раскрывает эталон и требует REWRITE.
- [ ] Проверить `Разбор`.
- [ ] Проверить, что `Разбор` раскрывает эталон и требует REWRITE.
- [ ] Проверить `Варианты` без обязательного REWRITE, если эталон не раскрыт.
- [ ] Проверить `Нюансы` без обязательного REWRITE, если эталон не раскрыт.
- [ ] Проверить `Спросить репетитора`.
- [x] Проверить TutorPanel и ответ mock provider.
- [ ] Открыть TutorChat.
- [ ] Отправить сообщение в TutorChat.
- [ ] Проверить лимит шести ходов.
- [ ] Проверить кэш повторного tutor action.
- [ ] Проверить invalid AI response и fallback.
- [ ] Проверить timeout первого provider и fallback второго.
- [ ] Проверить exhausted chain → self-check.
- [ ] Проверить отсутствие Judge configuration → self-check.
- [ ] Нажать флаг `ИИ ошибся`.
- [ ] Проверить запись в `judgeDisputes`.
- [ ] Проверить удаление принятого варианта из accepted cache.

### 4.6 Speaking и audio внутри drill

- [ ] После правильного ответа проверить auto-play.
- [ ] Отключить auto-play в Settings и проверить отсутствие озвучки.
- [x] Нажать `Записать`.
- [ ] Проверить disabled state `Остановить` до начала записи.
- [ ] Нажать `Остановить` после записи.
- [ ] Проверить playback recorded audio.
- [ ] Проверить сценарий без MediaRecorder.
- [ ] Проверить сценарий без SpeechRecognition.
- [ ] Убедиться, что ошибки микрофона не блокируют текстовый drill.

## 5. Review/session (`/session`)

- [x] Запустить review с Today.
- [x] Проверить session title и session-specific copy.
- [ ] Проверить смешанную очередь минимум из двух навыков.
- [ ] Пройти правильный ответ.
- [x] Пройти неправильный ответ через self-check и REWRITE.
- [ ] Проверить итог session stats.
- [ ] Проверить `Сегодня` return link.
- [x] Открыть `/session` напрямую без pending session.
- [x] Увидеть понятное пустое состояние при прямом открытии `/session`.
- [ ] Проверить, что StrictMode не съедает pending session.
- [ ] Проверить session record и FSRS update в IndexedDB.

## 6. Fluency Sprint (`/sprint`)

- [ ] Засеять skill accuracy > 90%.
- [ ] Открыть sprint с карты курса.
- [ ] Проверить раунд 1 timer 4.
- [ ] Проверить раунд 2 timer 3.
- [ ] Проверить раунд 3 timer 2.
- [ ] Проверить, что sprint не использует REWRITE и AI Judge.
- [ ] Проверить, что ошибка не штрафует FSRS как обычный drill.
- [ ] Проверить завершение по исчерпанию items.
- [ ] Проверить завершение по таймеру.
- [ ] Проверить sprint summary.
- [ ] Проверить возврат на карту.
- [x] Открыть `/sprint` без pending session.
- [ ] Проверить отсутствие StrictMode race.

## 7. Listening (`/listening`)

### 7.1 Общие действия

- [x] Запустить listening с Today после seed attempt.
- [x] Увидеть текущий режим и stimulus.
- [x] Нажать play/replay.
- [x] Изменить скорость 0.7×, 0.85×, 1×.
- [x] Проверить radiogroup и pressed state.
- [x] Проверить `Дальше`.
- [ ] Проверить итог listening session.
- [x] Открыть `/listening` без pending session.
- [x] Проверить понятное пустое состояние.

### 7.2 Dictation

- [ ] Прослушать фразу.
- [ ] Ввести правильный английский ответ.
- [x] Ввести неправильный ответ.
- [ ] Проверить word diff.
- [ ] Проверить максимум трёх повторов.
- [ ] Проверить отсутствие LLM-запроса.

### 7.3 Comprehension

- [ ] Прослушать фразу.
- [ ] Ввести правильный русский смысл.
- [x] Ввести неправильный смысл.
- [x] Проверить self-check UI.
- [ ] Убедиться, что текст не говорит ошибочно про отсутствие AI key.

### 7.4 Dictogloss/reconstruction

- [ ] Прослушать фразу один раз.
- [ ] Восстановить английскую фразу.
- [x] Проверить неправильный ответ и reference.
- [x] Проверить self-check/rewrite flow.
- [ ] Проверить отсутствие LLM-запроса.

### 7.5 TTS

- [ ] Settings: выбрать US voice.
- [x] Settings: выбрать UK voice.
- [ ] Settings: выбрать female voice.
- [x] Settings: выбрать male voice.
- [ ] Settings: выбрать 0.7×/0.85×/1×.
- [x] Проверить preview voice.
- [ ] Включить Quality voice offline.
- [ ] Дождаться загрузки Kokoro mock/реальной модели только в отдельном
  ручном эксперименте, не в CI.
- [ ] Повторить уже озвученный текст и проверить cache hit.
- [ ] Проверить fallback на Web Speech при ошибке Kokoro.
- [ ] Проверить offline после предварительного cache.
- [ ] Человеческим слухом проверить wh-question intonation.

## 8. Settings (`/settings`)

### 8.1 Theme и язык

- [x] Переключить светлую тему в тёмную.
- [x] Переключить тёмную тему обратно в светлую.
- [ ] Reload и проверить сохранение темы.
- [x] Нажать `EN`.
- [x] Увидеть английскую навигацию и заголовок Settings.
- [x] Reload и проверить сохранение английского языка.
- [x] Нажать `RU` и проверить возврат UI.
- [ ] Новый browser context должен начинаться с RU/light.

### 8.2 TTS settings

- [x] Проверить default US/female/1×/auto-play on; automatic flows never use local fallback without Gemini.
- [x] Сменить accent.
- [x] Сменить gender.
- [x] Сменить speed.
- [x] Отключить auto-play.
- [x] Reload и проверить persistence каждой настройки.
- [ ] Нажать `Включить качественный голос`.
- [ ] Проверить loading/progress state.
- [x] Нажать `Проверить голос`.
- [ ] Проверить graceful error при недоступном speech API.

### 8.3 LanguageTool

- [x] Включить self-hosted LanguageTool.
- [x] Изменить server URL.
- [x] Reload и проверить persistence.
- [ ] Проверить, что public `languagetool.org` не вызывается.
- [ ] Замокать network error self-hosted server.
- [ ] Проверить graceful fallback.

### 8.4 AI provider credentials

- [x] Gemini key field имеет label.
- [ ] Не вводить реальный ключ.
- [ ] Сохранить fake key в отдельном тестовом context.
- [ ] Проверить fake-key validation через mock.
- [ ] Проверить auth error через mock 401/403.
- [x] Проверить Groq key field.
- [x] Проверить OpenRouter key field.
- [x] Проверить GigaChat Authorization key field.
- [x] Проверить Yandex API key и folder ID fields.
- [x] Проверить local OpenAI-compatible base URL и model.
- [x] Проверить proxy URL.
- [ ] Проверить, что key не попадает в console.
- [ ] Проверить, что key не попадает в screenshot/trace/error message.

### 8.5 Routing по ролям

- [x] При чистом профиле Judge route пуст.
- [x] Добавить mock provider в Judge chain.
- [ ] Добавить mock provider в Tutor chain.
- [ ] Добавить mock provider в Generator chain.
- [x] Переставить provider кнопками `Выше` и `Ниже`.
- [x] Удалить provider кнопкой `Убрать`.
- [x] Нажать `Вернуть плановые дефолты`.
- [ ] Проверить сохранение routing после reload.
- [ ] Проверить status configured/unreachable.
- [ ] Проверить `При недоступности судьи — сразу самопроверка`.
- [ ] Проверить ежедневный budget state.

### 8.6 Prompt editor

- [x] Найти JUDGE_SYSTEM.
- [x] Сохранить корректный mock JUDGE_SYSTEM.
- [ ] Проверить smoke-test prompt.
- [ ] Ввести invalid prompt.
- [ ] Проверить invalid response message.
- [x] Сбросить JUDGE_SYSTEM к дефолту.
- [ ] Проверить TUTOR_SYSTEM save/reset.
- [ ] Проверить ACTION_ERRORS save/reset.
- [ ] Проверить ACTION_EXPLAIN save/reset.
- [ ] Проверить ACTION_VARIANTS save/reset.
- [ ] Проверить ACTION_NUANCES save/reset.
- [ ] Проверить default hash notice после изменения версии.

### 8.7 Data and backup

- [x] Export all Dexie data from Settings; download completed through Playwright MCP.
- [x] Import JSON backup; the downloaded backup restored IndexedDB records through Playwright MCP.
- [x] Reset progress; confirmation dialog cleared local data and reload completed through Playwright MCP.
- [x] Import uses overwrite semantics (unit test + Playwright E2E: old attempts disappear before imported rows are restored).
- [x] Provider keys are excluded by default (unit test + UI export with a clean context).
- [ ] Test an old backup against a future Dexie migration.

## 9. Free Talk (`/free-talk`)

### 9.1 Без AI provider

- [x] Открыть Free Talk в чистом состоянии.
- [x] Увидеть понятное сообщение, что нужен AI provider.
- [x] Проверить, что недоступный режим не предлагает отправлять сообщение.
- [x] Проверить отсутствие внешнего запроса.

### 9.2 Настроенный mock provider

- [x] Засеять mock Tutor provider.
- [x] Увидеть topic picker.
- [x] Выбрать preset topic.
- [x] Ввести custom topic.
- [x] Проверить disabled/enabled state start.
- [x] Запустить разговор.
- [x] Увидеть transcript.
- [x] Ввести сообщение.
- [x] Нажать Send.
- [x] Проверить mock assistant reply.
- [ ] Проверить обязательный встречный вопрос в mock fixture.
- [ ] Проверить 15-turn cap.
- [ ] Проверить budget warning.
- [x] Нажать `Закончить`.
- [x] Проверить summary.
- [ ] Проверить `recurring_tags` в errorProfile.

### 9.3 Resume

- [x] Начать разговор.
- [x] Закрыть/перезагрузить страницу до finish.
- [x] Вернуться в Free Talk.
- [x] Увидеть resume prompt.
- [x] Возобновить разговор.
- [x] Завершить разговор и убедиться, что transcript не потерян.

## 10. Layout matrix

Для каждой страницы проверить `document.scrollWidth <= document.clientWidth`,
видимость h1, попадание CTA в viewport, отсутствие наложений и обрезанного
текста.

- [ ] 390×844 — Today.
- [ ] 390×844 — Course Map.
- [ ] 390×844 — Drill.
- [ ] 390×844 — Review.
- [ ] 390×844 — Settings.
- [ ] 768×1024 — ключевые страницы.
- [ ] 1366×768 — ключевые страницы.
- [ ] 1440×900 — ключевые страницы.
- [ ] 1920×1080 — ключевые страницы.
- [ ] Mobile navigation не обрезается.
- [ ] Course card actions не перекрываются.
- [ ] Drill CTA остаётся кликабельным.
- [ ] Settings fields не выходят за viewport.
- [ ] Fixed/sticky элементы не закрывают контент.

## 11. Visual regression

Канонический проект: Chromium desktop; mobile baseline — отдельный стабильный
viewport. Перед baseline: animations disabled, fonts ready, caret hidden,
динамические значения маскируются только при необходимости.

- [x] Course map screenshot inspected.
- [x] Drill screenshot inspected.
- [x] Review screenshot inspected.
- [x] Settings screenshot inspected.
- [x] Mobile layout screenshot inspected.
- [ ] При diff сначала изучить defect, не повышать threshold.
- [ ] Snapshots не обновлять без ручного просмотра diff.

## 12. Offline/PWA

Service worker и PWA offline относятся к незавершённой части roadmap; до их
реализации сценарии ниже отмечаются как ожидание, а не как зелёный тест.

- [-] First online load → service worker cache.
- [-] Assets cached.
- [-] Switch offline → reload → app opens.
- [-] Offline state message.
- [-] Progress survives offline reload.

## 13. Accessibility

- [ ] Axe check Today.
- [ ] Axe check Course Map.
- [ ] Axe check Drill.
- [ ] Axe check Review.
- [ ] Axe check Settings.
- [ ] All buttons have accessible names.
- [ ] All form fields have labels.
- [ ] Keyboard navigation works.
- [ ] Focus is visible.
- [ ] No serious/critical axe violations.
- [ ] Tutor dialogs/panels have correct role when opened.
- [ ] Dialog/panel focus management works when opened and closed.

## 14. Persistence and isolation

- [ ] Each Playwright test starts with clean IndexedDB.
- [ ] Each Playwright test starts with clean localStorage.
- [ ] Each Playwright test starts with clean sessionStorage.
- [ ] New browser context starts clean.
- [ ] Correct attempt persists after reload.
- [ ] Wrong + rewrite attempts persist after reload.
- [ ] Settings persist after reload.
- [ ] Review FSRS fields persist after session finish.
- [ ] Different tests do not see each other's progress.
- [ ] Fixed-time tests use deterministic clock only where required.
- [ ] No arbitrary sleeps used to stabilize tests.

## 15. AI routing matrix (mock-only)

- [x] Successful first provider.
- [x] First provider timeout → second provider.
- [x] First provider 429 → second provider.
- [x] First provider 401/403 → second provider with auth notice.
- [ ] Invalid JSON response → retry, then next provider.
- [ ] Invalid schema response → retry, then next provider.
- [ ] Cyrillic explanation failure → retry with stronger instruction.
- [ ] Exhausted chain → tier 4 self-check.
- [ ] Empty Judge route → tier 4 self-check.
- [ ] Manual override changes provider order.
- [x] No real provider endpoint is requested.
- [ ] No fake/real key appears in console, screenshot, trace or error.
- [ ] Repeated accepted answer uses local/cache tier.
- [ ] Tutor action cache invalidates after prompt edit.

## 16. CI and final handoff

- [x] `npm ci`.
- [x] `npm run lint`.
- [x] `npm run typecheck`.
- [x] `npm run test`.
- [x] `npm run build`.
- [x] `npm run e2e`.
- [x] Chromium functional tests green.
- [x] Firefox functional tests green.
- [x] WebKit functional tests green.
- [x] Edge functional tests green.
- [x] Mobile Chromium functional tests green.
- [x] Mobile WebKit functional tests green.
- [x] Python `uv sync`.
- [x] Python `ruff`.
- [x] Python `mypy`.
- [x] Python `pytest`.
- [x] Reports and traces uploaded by CI on failure.
- [x] Production preview started for interactive MCP smoke.
- [x] Critical scenario replayed via Playwright MCP.
- [x] Console and network checked after interactive replay.
- [ ] Computer Use final smoke test completed when tool is available.

## 17. Найденные дефекты и решения

| Дата | Сценарий | Наблюдение | Статус |
|---|---|---|---|
| 2026-07-17 | Settings | В интерфейсе отсутствовал Data/export/import/reset section, хотя это есть в нормативном плане | Исправлено: backup/import/reset добавлены и проверены unit, E2E и MCP |
| 2026-07-17 | Settings narrow layout | Configured role-routing cards overflowed at 390×844 (`scrollWidth` 484 > viewport) | Исправлено `min-w-0`; regression test fails before fix and passes after fix; MCP confirms no overflow |
| 2026-07-17 | GitHub CI visual | Ubuntu запускал canonical visual suite, но snapshots существуют только для `chromium-win32`; пять Linux baseline файлов отсутствовали | Исправлено: visual suite перенесена в Windows-only OS smoke job |
| 2026-07-17 | QA tooling | Computer Use connector отсутствует в текущем окружении | Внешнее ограничение |

## 18. Решения по спорным функциям

### Почему Quality voice работает offline

Kokoro-js выбран как локальная опциональная модель, потому что проект — backend-less
PWA с local-first прогрессом. Это даёт:

- отсутствие отправки текста пользователя на отдельный TTS-сервис;
- работу после загрузки модели без аккаунта и API key;
- предсказуемость для offline listening;
- кэш повторяющихся фраз в IndexedDB.

Минус — первая загрузка около 86 MB и медленный первый синтез на слабом устройстве.
Поэтому Web Speech остаётся мгновенным дефолтом, а Kokoro — opt-in quality voice.
Платный или внешний TTS API не является default: бесплатность, приватность,
offline и отсутствие backend важнее. В будущем можно добавить opt-in облачный
адаптер с явным предупреждением, но нельзя silently отправлять учебный текст.

### NVIDIA NIM и дополнительные AI providers

Идея принята в backlog провайдеров. Уже реализованы адаптеры Gemini, Groq,
OpenRouter, GigaChat, Yandex AI Studio и local OpenAI-compatible endpoint.
Перед добавлением NVIDIA NIM нужно подтвердить актуальные endpoint, model ids,
auth/CORS и бесплатные ограничения; в тестах всё равно использовать только mock.
Архитектурно NIM удобно добавить как отдельный OpenAI-compatible adapter или как
настраиваемый provider profile, не меняя Judge/Tutor/Generator routing contract.

## 19. QA log — 2026-07-17

Эти пункты подтверждены автоматизированными проверками; они не заменяют финальный ручной проход через MCP.

- [x] Manual inventory status after this pass: 449 checklist items; 250 checked, 190 open, 3 blocked, 6 N/A.
- [x] `npm run lint` — exit code 0.
- [x] `npm run typecheck` — exit code 0.
- [x] `npm run test` — 49 files, 417 tests passed.
- [x] `npm run build` — exit code 0; production preview получает свежий build через Playwright webServer.
- [x] `npm run e2e` — 132/132 passed: Chromium, Firefox, WebKit, Edge, mobile Chromium, mobile WebKit.
- [x] Targeted WebKit smoke after async navigation fix — 1/1 passed.
- [x] Targeted unknown-route smoke — 2/2 passed in Chromium.
- [x] Free Talk mock conversation E2E — six-project run 6/6 passed in the full verify.
- [x] `npm run verify` — exit code 0; 417 unit tests and 132 E2E tests, full order lint → typecheck → unit → build → E2E.
- [x] AI mocks — 24/24 across all six projects; success, timeout fallback, invalid response, exhausted chain, empty Judge route.
- [x] Layout — 5/5 viewport groups passed for Today, Course Map, Drill and Settings; mobile navigation and Course Map cards no longer overflow.
- [x] Visual regression — five canonical Chromium screenshots reviewed before baseline creation and 5/5 passed afterwards.
- [x] Accessibility — axe critical checks passed for Today, Course Map, Drill and Settings; keyboard focus check passed.
- [x] Persistence/isolation — clean browser state fixture, fresh context, IndexedDB reload persistence, language persistence, backup download/import and reset passed.
- [x] Python: `uv sync` exit code 0; Ruff passed; mypy passed for 18 files; pytest 50/50 passed. In a fresh PowerShell session, use the installed user-level `uv.exe` path if `uv` is not on PATH.
- [x] Playwright failure artifacts are configured under `app/playwright-report/` and `app/test-results/`; the pre-fix layout regression produced a trace, screenshot and video before the final green run cleaned transient results.
- [x] GitHub Actions run #10 on `6bffeb2` succeeded: app functional, Chromium CDP, layout, Windows canonical visual, Windows/Ubuntu/macOS smoke and Python pipeline all passed.

### Исправления, подтверждённые тестами

- [x] Mobile navigation wraps instead of exceeding a 390 px viewport.
- [x] Course Map skill cards wrap action buttons on narrow screens.
- [x] Settings local-model URL and all prompt editors have accessible labels.
- [x] WebKit AI scenario waits for Home data before navigation, preventing a cancelled `packs/index.json` request from becoming a pageerror.
- [x] AI mock profiles use a deterministic 1000 ms budget; provider assertions are scoped to drill feedback.
- [x] Unknown routes now render a localized 404 recovery screen instead of an empty main.
- [x] Free Talk mock flow covers topic, transcript, assistant reply, finish and summary.
- [x] Stray Cyrillic was removed from source comments and technical annotations; RU strings remain only in the required RU dictionary and learner/test fixtures.
- [x] Final MCP smoke on fresh production preview: course map → drill → correct answer → feedback → next sentence; Settings → EN → reload; 1 persisted IndexedDB attempt; 0 console errors.
- [x] Final MCP network inspection contained only local pack requests and mocked provider traffic; no real AI endpoint was used.
- [x] Backup/import/reset MCP smoke: download, confirmation dialog, reset/reload, import and IndexedDB restoration; 0 console errors.
- [x] Backup contract tests: 5/5, including secret exclusion, explicit secret opt-in, overwrite import, malformed input and full reset.
- [x] Full `npm run verify` after Settings layout fix: 417 unit + 132 E2E passed across all six projects.
- [x] Final MCP smoke after Settings layout fix: clean state → Course Map → Drill → correct answer → feedback → Next; one persisted attempt; Settings EN → reload; 0 console errors; network stayed local.

### Manual MCP continuation — 2026-07-17

- Seeded two due skills, two passed skills and an error profile in the browser IndexedDB; Today displayed review, Error Hunt and Contrast Duel sections.
- Review opened `/session`, interleaved the two due skills, persisted a correct attempt, and handled wrong answer → self-check → REWRITE → correct answer.
- Error Hunt and Contrast Duel opened usable session screens; listening Dictation, Comprehension and Dictogloss opened from Today with the expected wrong/self-check states.
- Settings browser flow changed UK/male/0.7×, disabled auto-play, used voice preview, reloaded, and confirmed the four `tts.*` IndexedDB values persisted.
- Mock-only AI checks covered successful primary, 504 timeout fallback, 429 fallback toast, 401 fallback toast, toast close and zero CTA overlap; Tutor `Ошибки` returned the mock response and forced REWRITE.
- Free Talk mock flow started, sent a message, reloaded, showed the resume prompt, resumed, finished and preserved the transcript in the summary.
- Successful mocked provider and Free Talk paths had 0 console errors. Deliberately fulfilled mock 504/429/401 responses produced only expected browser `Failed to load resource` entries; no pageerror or secret was observed.
- Canonical Windows visual suite passed locally: 5/5 Chromium screenshots, no snapshot update performed.

### Оставшиеся ограничения

- [-] Service worker/PWA offline mode is not implemented in the current PLAN phase.
- [ ] Old backup import against a future Dexie migration is not yet covered; current schema is v6.
- [!] Computer Use connector is unavailable in the current environment, so the final physical-user smoke cannot be honestly marked complete.
- [ ] External provider live calls and real TTS audio quality remain intentionally untested; all QA uses mocks or local browser speech.

## 20. TTS research and implementation note — 2026-07-17

- [x] Official Gemini TTS documentation checked: Interactions API, exact-text audio output, voice selection, accent and pace prompting.
- [x] Official Gemini pricing checked: `gemini-3.1-flash-tts-preview` currently lists free input/output on the free tier; Preview limits and policy may change.
- [x] Google Cloud TTS, Azure Speech, and ElevenLabs checked as alternatives. They require account credentials and have different quotas or billing constraints; none is silently enabled.
- [x] Implemented Gemini TTS as explicit BYOK opt-in in Settings. The key is read from existing local settings, never committed, and never included in error text.
- [x] Added local audio caching and fallback chain: Gemini -> Kokoro when enabled -> browser Web Speech when cloud speech is not selected.
- [x] Deterministic unit coverage added with mocked fetch and a fake API key; no live provider call is allowed in automated QA.
- [x] Automatic flows never use local speech fallback. When Gemini is selected, provider errors do not silently switch to system speech.
- [ ] Human listening check of Gemini voice quality remains open; this environment cannot honestly judge audio by ear.
