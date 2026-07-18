# Frazodrom — ручное тестирование

Живой журнал проверки интерфейса. Файл намеренно хранится в репозитории: после
каждого ручного прогона через Playwright MCP обновляются чекбоксы, дата и заметки.
`[x]` означает, что сценарий пройден в указанном окружении; `[ ]` — ещё не
пройден; `[!]` — найден дефект или ограничение; `[-]` — функция пока не
реализована в приложении.

Последнее обновление: 2026-07-18

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
- [x] В Settings snapshot подтверждено наличие import/export/reset данных в UI.
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
- [x] Проверить Kokoro prompt banner после порога системных озвучек.
- [x] Закрыть Kokoro prompt banner.
- [x] Неизвестный URL показывает локализованный recovery state с возвратом домой.
- [x] Несуществующий skill id показывает понятную recoverable ошибку без pageerror.

## 2. Сегодня (`/`)

### 2.1 Пустой профиль

- [x] Открыть `/` в чистом состоянии.
- [x] Увидеть loading state, затем пустое состояние `Нечего повторять`.
- [x] Увидеть кнопку продолжения курса, если она предусмотрена для пустого
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
- [x] Проверить review queue из одного навыка.
- [x] Засеять два due skills.
- [x] Проверить interleave review queue из двух навыков.
- [x] Проверить error-hunt section при достаточном error profile.
- [x] Запустить error hunt.
- [x] Проверить leech section при наличии leech item.
- [x] Засеять пару passed skills.
- [x] Проверить появление Contrast Duel.
- [x] Запустить Contrast Duel.
- [x] Проверить, что непрошедшая пара не показывает кнопку дуэли.
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
- [x] Проверить loading state при медленном сетевом ответе.
- [x] Замокать ошибку загрузки `packs/index.json`.
- [x] Проверить понятное сообщение ошибки карты.
- [x] Проверить, что error state не оставляет неработающие skill links.

### 3.2 Skill actions

- [x] Открыть первый drill через `Дрилл`.
- [x] Открыть YouGlish и проверить новый tab с encoded query.
- [x] Открыть Reverso и проверить новый tab с encoded query.
- [x] Закрыть внешний tab и вернуться в приложение.
- [x] Засеять accuracy > 90% и проверить появление `Спринт`.
- [x] Засеять accuracy = 90% и проверить, что sprint gate не проходит.
- [x] Запустить Sprint.
- [x] Проверить memory tier для существующего skill state.
- [x] Проверить, что длинное название skill не ломает карточку.
- [x] Проверить все layout viewport из раздела 10.

## 4. Обычный drill (`/drill/:skillId`)

### 4.1 Загрузка и базовое состояние

- [x] Открыть `/drill/a1_be_affirm` напрямую.
- [x] Увидеть русский stimulus.
- [x] Увидеть label `Переведи на английский`.
- [x] Поле автоматически получает focus.
- [x] Проверить progress counter и корректное уменьшение после перехода.
- [x] Проверить loading state на медленном pack request.
- [x] Замокать ошибку pack request.
- [x] Проверить error state drill.
- [x] Открыть несуществующий skill id.
- [x] Проверить понятное сообщение для несуществующего skill.

### 4.2 Ввод и локальная проверка

- [x] Оставить поле пустым и нажать `Проверить`.
- [x] Ввести русский текст и проверить tier 0 rejection.
- [x] Ввести ответ, совпадающий с русским stimulus.
- [x] Ввести правильный ответ `It's love.`.
- [x] Ввести неправильный ответ.
- [x] Ввести accepted alternative `This is love.`.
- [x] Проверить case-insensitivity.
- [x] Проверить terminal punctuation tolerance.
- [x] Проверить contraction tolerance.
- [x] Проверить single typo tier 2.
- [x] Проверить морфологическую ошибку не как typo.
- [x] Нажать Enter вместо кнопки.
- [x] Проверить, что повторный submit не создаёт дубль.

### 4.3 Feedback и REWRITE

- [x] Правильный ответ показывает `✓ Верно`.
- [x] Неправильный ответ показывает `✗ Неверно` после self-report.
- [x] Self-check показывает эталон.
- [x] Нажать `Я был прав`.
- [x] Нажать `Ошибся`.
- [x] После ошибки поле очищается для REWRITE.
- [x] Ввести правильный REWRITE.
- [x] Ввести неправильный REWRITE.
- [x] Проверить повторную постановку item в очередь после неверного REWRITE.
- [x] Нажать `Дальше` после подтверждённого ответа.
- [x] Дойти до конца маленького seeded queue.
- [x] Увидеть итоговую статистику сессии.
- [x] Нажать возврат на карту после drill.
- [x] Проверить сохранение attempt и skill state после итога.

### 4.4 Hints и give up

- [x] Нажать `Подсказка` один раз.
- [x] Проверить первый hint level.
- [x] Нажать `Подсказка` повторно.
- [x] Проверить ladder hints.
- [x] Убедиться, что hint не меняет verdict и не штрафует ответ.
- [x] Нажать `Сдаться`.
- [x] Проверить reveal reference.
- [x] Проверить обязательный REWRITE после reveal.
- [x] Проверить Ctrl+H.
- [x] Проверить Ctrl+G.

### 4.5 AI actions в feedback

- [x] При настроенном mock Judge проверить `Ошибки`.
- [x] Проверить, что `Ошибки` раскрывает эталон и требует REWRITE.
- [x] Проверить `Разбор`.
- [x] Проверить, что `Разбор` раскрывает эталон и требует REWRITE.
- [x] Проверить `Варианты` без обязательного REWRITE, если эталон не раскрыт.
- [x] Проверить `Нюансы` без обязательного REWRITE, если эталон не раскрыт.
- [x] Проверить `Спросить репетитора`.
- [x] Проверить TutorPanel и ответ mock provider.
- [x] Открыть TutorChat.
- [x] Отправить сообщение в TutorChat.
- [x] Проверить лимит шести ходов.
- [x] Проверить кэш повторного tutor action.
- [x] Проверить invalid AI response и fallback.
- [x] Проверить timeout первого provider и fallback второго.
- [x] Проверить exhausted chain → self-check.
- [x] Проверить отсутствие Judge configuration → self-check.
- [x] Нажать флаг `ИИ ошибся`.
- [x] Проверить запись в `judgeDisputes`.
- [x] Проверить удаление принятого варианта из accepted cache.

### 4.6 Speaking и audio внутри drill

- [x] После правильного ответа проверить auto-play.
- [x] Отключить auto-play в Settings и проверить отсутствие озвучки.
- [x] Нажать `Записать`.
- [x] Проверить disabled state `Остановить` до начала записи.
- [x] Нажать `Остановить` после записи.
- [x] Проверить playback recorded audio.
- [x] Проверить сценарий без MediaRecorder.
- [x] Проверить сценарий без SpeechRecognition.
- [x] Убедиться, что ошибки микрофона не блокируют текстовый drill.

## 5. Review/session (`/session`)

- [x] Запустить review с Today.
- [x] Проверить session title и session-specific copy.
- [x] Проверить смешанную очередь минимум из двух навыков.
- [x] Пройти правильный ответ.
- [x] Пройти неправильный ответ через self-check и REWRITE.
- [x] Проверить итог session stats.
- [x] Проверить `Сегодня` return link.
- [x] Открыть `/session` напрямую без pending session.
- [x] Увидеть понятное пустое состояние при прямом открытии `/session`.
- [x] Проверить, что StrictMode не съедает pending session.
- [x] Проверить session record и FSRS update в IndexedDB.

## 6. Fluency Sprint (`/sprint`)

- [x] Засеять skill accuracy > 90%.
- [x] Открыть sprint с карты курса.
- [x] Проверить раунд 1 timer 4.
- [x] Проверить раунд 2 timer 3.
- [x] Проверить раунд 3 timer 2.
- [x] Проверить, что sprint не использует REWRITE и AI Judge.
- [x] Проверить, что ошибка не штрафует FSRS как обычный drill.
- [x] Проверить завершение по исчерпанию items.
- [x] Проверить завершение по таймеру.
- [x] Проверить sprint summary.
- [x] Проверить возврат на карту.
- [x] Открыть `/sprint` без pending session.
- [x] Проверить отсутствие StrictMode race.

## 7. Listening (`/listening`)

### 7.1 Общие действия

- [x] Запустить listening с Today после seed attempt.
- [x] Увидеть текущий режим и stimulus.
- [x] Нажать play/replay.
- [x] Изменить скорость 0.7×, 0.85×, 1×.
- [x] Проверить radiogroup и pressed state.
- [x] Проверить `Дальше`.
- [x] Проверить итог listening session.
- [x] Открыть `/listening` без pending session.
- [x] Проверить понятное пустое состояние.

### 7.2 Dictation

- [x] Прослушать фразу.
- [x] Ввести правильный английский ответ.
- [x] Ввести неправильный ответ.
- [x] Проверить word diff.
- [x] Проверить максимум трёх повторов.
- [x] Проверить отсутствие LLM-запроса.

### 7.3 Comprehension

- [x] Прослушать фразу.
- [x] Ввести правильный русский смысл.
- [x] Ввести неправильный смысл.
- [x] Проверить self-check UI.
- [x] Убедиться, что текст не говорит ошибочно про отсутствие AI key.

### 7.4 Dictogloss/reconstruction

- [x] Прослушать фразу один раз.
- [x] Восстановить английскую фразу.
- [x] Проверить неправильный ответ и reference.
- [x] Проверить self-check/rewrite flow.
- [x] Проверить отсутствие LLM-запроса.

### 7.5 TTS

- [x] Settings: выбрать US voice.
- [x] Settings: выбрать UK voice.
- [x] Settings: выбрать female voice.
- [x] Settings: выбрать male voice.
- [x] Settings: выбрать 0.7×/0.85×/1×.
- [x] Проверить preview voice.
- [x] Включить Quality voice offline.
- [x] Дождаться загрузки Kokoro mock/реальной модели только в отдельном
  ручном эксперименте, не в CI.
- [x] Повторить уже озвученный текст и проверить cache hit.
- [ ] Проверить fallback на Web Speech при ошибке Kokoro.
- [x] Проверить offline после предварительного cache.
- [ ] Человеческим слухом проверить wh-question intonation.

## 8. Settings (`/settings`)

### 8.1 Theme и язык

- [x] Переключить светлую тему в тёмную.
- [x] Переключить тёмную тему обратно в светлую.
- [x] Reload и проверить сохранение темы.
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
- [-] Model-based quality voice and its loading state were retired on 2026-07-18 because of CPU impact; browser-native speech is now the only supported path.
- [x] Нажать `Проверить голос`.
- [x] Проверить graceful error при недоступном speech API.

### 8.3 LanguageTool

- [x] Включить self-hosted LanguageTool.
- [x] Изменить server URL.
- [x] Reload и проверить persistence.
- [x] Проверить, что public `languagetool.org` не вызывается.
- [x] Замокать network error self-hosted server.
- [x] Проверить graceful fallback to Judge/self-check.

### 8.4 AI provider credentials

- [x] Gemini key field имеет label.
- [x] Не вводить реальный ключ.
- [x] Сохранить fake key в отдельном тестовом context.
- [x] Проверить fake-key validation через mock.
- [x] Проверить auth error через mock 401/403.
- [x] Проверить Groq key field.
- [x] Проверить OpenRouter key field.
- [x] Проверить GigaChat Authorization key field.
- [x] Проверить Yandex API key и folder ID fields.
- [x] Проверить local OpenAI-compatible base URL и model.
- [x] Проверить proxy URL.
- [x] Проверить, что key не попадает в console.
- [x] Проверить, что key не попадает в screenshot/trace/error message.

### 8.5 Routing по ролям

- [x] При чистом профиле Judge route пуст.
- [x] Добавить mock provider в Judge chain.
- [x] Добавить mock provider в Tutor chain.
- [x] Добавить mock provider в Generator chain.
- [x] Переставить provider кнопками `Выше` и `Ниже`.
- [x] Удалить provider кнопкой `Убрать`.
- [x] Нажать `Вернуть плановые дефолты`.
- [x] Проверить сохранение routing после reload.
- [x] Проверить status configured/unreachable.
- [x] Проверить `При недоступности судьи — сразу самопроверка`.
- [x] Проверить ежедневный budget state.

### 8.6 Prompt editor

- [x] Найти JUDGE_SYSTEM.
- [x] Сохранить корректный mock JUDGE_SYSTEM.
- [x] Проверить smoke-test prompt.
- [x] Ввести invalid prompt.
- [x] Проверить invalid response message.
- [x] Сбросить JUDGE_SYSTEM к дефолту.
- [x] Проверить TUTOR_SYSTEM save/reset.
- [x] Проверить ACTION_ERRORS save/reset.
- [x] Проверить ACTION_EXPLAIN save/reset.
- [x] Проверить ACTION_VARIANTS save/reset.
- [x] Проверить ACTION_NUANCES save/reset.
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
- [x] Проверить обязательный встречный вопрос в mock fixture.
- [x] Проверить 15-turn cap.
- [x] Проверить budget warning.
- [x] Нажать `Закончить`.
- [x] Проверить summary.
- [x] Проверить `recurring_tags` в errorProfile.

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

- [x] 390×844 — Today.
- [x] 390×844 — Course Map.
- [x] 390×844 — Drill.
- [x] 390×844 — Review.
- [x] 390×844 — Settings.
- [x] 768×1024 — ключевые страницы.
- [x] 1366×768 — ключевые страницы.
- [x] 1440×900 — ключевые страницы.
- [x] 1920×1080 — ключевые страницы.
- [x] Mobile navigation не обрезается.
- [x] Course card actions не перекрываются.
- [x] Drill CTA остаётся кликабельным после scroll.
- [x] Settings fields не выходят за viewport по горизонтали.
- [x] Fixed/sticky элементы не закрывают контент.

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
- [x] All buttons have accessible names.
- [x] All form fields have labels.
- [x] Keyboard navigation works.
- [x] Focus is visible.
- [ ] No serious/critical axe violations.
- [x] Tutor dialogs/panels have correct role when opened.
- [x] Dialog/panel focus management works when opened and closed.

## 14. Persistence and isolation

- [ ] Each Playwright test starts with clean IndexedDB.
- [ ] Each Playwright test starts with clean localStorage.
- [ ] Each Playwright test starts with clean sessionStorage.
- [ ] New browser context starts clean.
- [x] Correct attempt persists after reload.
- [ ] Wrong + rewrite attempts persist after reload.
- [x] Settings persist after reload.
- [ ] Review FSRS fields persist after session finish.
- [ ] Different tests do not see each other's progress.
- [ ] Fixed-time tests use deterministic clock only where required.
- [ ] No arbitrary sleeps used to stabilize tests.

## 15. AI routing matrix (mock-only)

- [x] Successful first provider.
- [x] First provider timeout → second provider.
- [x] First provider 429 → second provider.
- [x] First provider 401/403 → second provider with auth notice.
- [x] Invalid JSON response → retry, then next provider.
- [x] Invalid schema response → retry, then next provider.
- [x] Cyrillic explanation failure → retry with stronger instruction.
- [x] Exhausted chain → tier 4 self-check.
- [x] Empty Judge route → tier 4 self-check.
- [x] Manual override changes provider order.
- [x] No real provider endpoint is requested.
- [x] No fake/real key appears in console, screenshot, trace or error.
- [x] Repeated accepted answer uses local/cache tier.
- [x] Tutor action cache invalidates after prompt edit.

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
| 2026-07-17 | Drill tier 0 | Пустой/русский ответ показывал self-check и эталон вместо мгновенного локального предупреждения | Исправлено: tier 0 передаёт причину в DrillScreen, UI показывает `Ответ должен быть по-английски.` без AI-вызова |
| 2026-07-17 | acceptedCache | Принятый judge-вариант записывался, но повторный drill не читал cache и снова вызывал provider | Исправлено: DrillScreen загружает acceptedCache перед tier 1; MCP и E2E подтверждают cache hit |
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

- [x] Manual inventory status as of 2026-07-18: 449 checklist items; 411 checked, 30 open, 2 blocked, 6 N/A.
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
- [x] GitHub Actions run #12 on `b89f2f2` succeeded: app-functional (including cross-browser, Chromium CDP and layout), Windows canonical visual, Windows/Ubuntu/macOS smoke and Python pipeline all passed.

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
- Tier 0 MCP smoke: empty, Cyrillic and RU-stimulus inputs all showed the localized English-only alert, no self-check and no console errors.
- Local checker MCP matrix: accepted alternative, case-insensitivity, punctuation, contractions, single typo, morphology guard, Enter submit and duplicate-submit guard passed.
- Course Map/Drill network faults: gated loading states and mocked 503 responses showed recoverable errors; Course Map error rendered no skill links.
- Sprint MCP smoke: strict 0.90 gate, 0.91 launch, 4:00 → 3:00 → 2:00 rounds, 30 wrong answers and final summary passed.
- Listening Dictation/Comprehension MCP smoke: word diff, replay limit `0` disabled, no AI requests, and correct listening self-check copy passed.
- Mock invalid-JSON judge response retried twice then fell back to secondary; acceptedCache repeated answer stayed at one provider request across drills.
- Layout MCP matrix covered Today, Course Map, Drill and Settings at 390×844, 768×1024, 1366×768, 1440×900 and 1920×1080; no horizontal overflow or interactive-element overlap was observed.

### Оставшиеся ограничения

- [-] Service worker/PWA offline mode is not implemented in the current PLAN phase.
- [ ] Old backup import against a future Dexie migration is not yet covered; current schema is v6.
- [!] Computer Use connector is unavailable in the current environment, so the final physical-user smoke cannot be honestly marked complete.
- [ ] External provider live calls and real TTS audio quality remain intentionally untested; all QA uses mocks or local browser speech.

### Manual MCP continuation — 2026-07-18

- Quality voice: the real Kokoro model downloaded in the isolated manual experiment, enabled state survived reload, Preview voice worked, and the second preview used the cached model; `console.error` stayed at 0. The browser emitted only the expected missing `content-length` warning during streaming.
- Free Talk: Travel topic started, mocked assistant returned a counter-question, 15 user turns were accepted, the input became disabled with the budget warning, and Finish rendered the summary. Reload before Finish showed Resume; resume and transcript persistence worked.
- Review completion: a two-item seeded queue finished through correct → wrong → self-check → rewrite → requeued answer; the UI showed `2 correct out of 3`, matching the persisted IndexedDB session stats, and Back to Today returned to the home screen.
- Settings/routing: UK voice, female voice, 0.7× speed, dark theme, TUTOR_SYSTEM save/reset, and a fake local provider survived reload; Judge routing was configured without a real key.
- AI actions: mocked Explain/Variants/Nuances and TutorChat were exercised; Judge dispute logging and accepted-cache removal persisted in IndexedDB. TutorChat Enter no longer triggers the drill's global submit alert.
- Dictogloss: correct reconstruction, incorrect reconstruction with reference/self-check, final `1 correct out of 2`, and no LLM network request passed through the browser.
- Today/Contrast Duel: with one passed and one in-progress skill the duel button was absent; after both were passed it appeared and opened `/session`.
- Course Map and mobile Review: existing memory tier rendered as `🟢 ~100% retained`; skill titles and actions stayed inside the viewport; at 390×844 Review had `scrollWidth === clientWidth` and an in-viewport CTA.
- Sprint completion: a 30-item wrong-answer run reached `Sprint complete!`, showed `0 correct out of 30`, and `Back to course map` returned to `/course-map`.
- Sprint timer completion: with a deterministic accelerated timer, the UI reached `Sprint complete!` and exposed `Back to course map`; no answer was entered before the accelerated timer expired (`0 correct out of 0`).
- AI fallback matrix: a timed-out fake local provider fell through to a mocked Gemini response; an exhausted chain and an empty Judge route both rendered self-check. A fake Gemini key validation was run with mocked 200 and 401 responses; no real key or external provider was used.
- Manual persistence/a11y continuation: correct drill attempt and settings survived reload; accessibility snapshot checks found names for all buttons, labels for all fields, keyboard focus, and no horizontal overflow on Today, Course Map, Drill, and Settings at the inspected viewport.
- Manual AI continuation: invalid-schema primary fell through to mocked Gemini; a non-Cyrillic answer triggered the stronger Russian instruction; manual Gemini override was selected and then returned to auto; prompt edit produced a new `tutorActionCache` hash before the default prompt was restored.
- Auto-play and TutorChat follow-up: production MCP confirmed that a correct answer reaches Web Speech when Gemini/Kokoro are disabled. The prior `allowLocalFallback: false` gate violated the PLAN fallback chain and was removed. TutorChat is now a labelled non-modal `region`, moves focus to its input on open, and returns it to the trigger on close.
- Settings prompts and preferences: valid and invalid Judge prompts, all five save/reset editors, US/female/0.7×/0.85×/1×, light-theme reload, LanguageTool URL persistence, routing reload, and self-check toggle were inspected; no public LanguageTool request occurred.

## 20. TTS research and implementation note — 2026-07-17

- 2026-07-19 (manual QA continuation): with `speechSynthesis` deliberately unavailable in the production MCP page, Voice preview returned to an enabled state without console errors or page errors. Audio remains supplementary and does not block the Settings screen or drills.
- 2026-07-19 (manual QA continuation): production MCP Free Talk with a mocked local provider persisted the completed summary and wrote `recurring_tags: ['article']` to IndexedDB `errorProfile` as `{ count30d: 1 }`. The two provider requests were mock-only; console errors and page errors stayed at zero.
- 2026-07-19 (manual QA continuation): found that the LanguageTool toggle persisted but was not connected to the answer cascade, despite PLAN §7.2 tier 2.5 and §13.3. Added self-hosted-only `/v2/check` candidate detection: a grammar-clean same-word-bag answer still requires Judge confirmation; an invalid endpoint, response, or 503 falls through without blocking the drill. MCP production replay confirmed both mocked 200→Judge and 503→Judge paths; no public LanguageTool request or application `pageerror` occurred.

> Superseded on 2026-07-18: all model and cloud TTS paths were removed after a CPU-impact report. The app now uses only browser-native Web Speech; the retained manual check is whether the selected system voice is acceptable by ear.

- [x] Official Gemini TTS documentation checked: Interactions API, exact-text audio output, voice selection, accent and pace prompting.
- [x] Official Gemini pricing checked: `gemini-3.1-flash-tts-preview` currently lists free input/output on the free tier; Preview limits and policy may change.
- [x] Google Cloud TTS, Azure Speech, and ElevenLabs checked as alternatives. They require account credentials and have different quotas or billing constraints; none is silently enabled.
- [x] Implemented Gemini TTS as explicit BYOK opt-in in Settings. The key is read from existing local settings, never committed, and never included in error text.
- [x] Added local audio caching and fallback chain: Gemini -> Kokoro when enabled -> browser Web Speech when cloud speech is not selected.
- [x] Deterministic unit coverage added with mocked fetch and a fake API key; no live provider call is allowed in automated QA.
- [x] Automatic flows never use local speech fallback. When Gemini is selected, provider errors do not silently switch to system speech.
- [ ] Human listening check of the selected Chrome/Firefox system voice remains open; this environment cannot honestly judge audio by ear.
