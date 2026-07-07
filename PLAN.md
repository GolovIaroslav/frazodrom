# PLAN.md — English Pattern Trainer

**Версия 1.0 · 2026-07-07 · Название: «Фразодром» · репо: github.com/GolovIaroslav/frazodrom**

Решения юзера (2026-07-07): платформа — веб-PWA; публичный бесплатный сайт (каждый со своим API-ключом); название — «Фразодром».

Тренажёр английского в духе DadEnglish / English Dog: перевод предложений RU→EN по грамматическим паттернам, доведение конструкций до автоматизма, ИИ-репетитор по BYOK-ключу, интервальные повторения, listening/speaking, уровни A1–C1, экзамены. Полностью бесплатный стек: открытый корпус предложений + free-tier LLM + браузерные speech-API + статический хостинг.

---

## §0. Как пользоваться этим планом (инструкция для Codex)

1. **Одна фаза = одна сессия.** Фазы описаны в §16. Тебе дают команду «Реализуй Фазу N» — читаешь §0, §16.N и только те разделы, на которые фаза ссылается. Не реализуй будущие фазы, не рефактори чужие зоны.
2. **Язык:** код, коммиты, комментарии, docstrings — английский. UI приложения — русский. Общение с юзером — русский.
3. **Коммиты:** короткие, conventional commits, только заголовок без body (`feat(drill): add hint ladder`). Не упоминать AI в коммитах.
4. **Метки ⚠️VERIFY:** факт может устареть (лимиты API, версии библиотек). Проверенные значения на 2026-07 собраны в §17.2. Если факт устарел или отсутствует — не гугли сам: остановись и попроси юзера прогнать готовый запрос из §17.3 через его ресёрч-ИИ, результат внеси в §17.2.
5. **После фазы:** прогнать acceptance-критерии фазы, поставить галочку в чек-листе §16, дописать 3–5 строк в журнал в конце этого файла (что сделано, что отложено, что заметил).
6. **Не делать без явного запроса юзера:** платные API, аккаунты/бэкенд/база на сервере, сбор аналитики, новые .md-файлы.
7. Все схемы JSON в плане нормативные: если реализация требует поменять схему — меняй, но фиксируй в журнале и обновляй схему здесь же.

---

## §1. Продукт

### 1.1 Для кого и зачем

Основной пользователь: русскоязычный, уровень A2–B1 в чтении, заметно слабее в активном построении фраз и говорении. Цель — **автоматизм**: увидел мысль по-русски → мгновенно собрал корректную английскую фразу, письменно и устно.

Приложение — публичное, бесплатное, без регистрации: открыл сайт (PWA), всё хранится локально в браузере, свой API-ключ подключается по желанию и даёт «репетитора».

### 1.2 Что приложение ДЕЛАЕТ

- Дриллы перевода RU→EN по паттернам (ядро продукта): 100+ предложений на конструкцию, подсказки, «сдаться», озвучка, мгновенная проверка.
- ИИ-репетитор: разбор ошибки в чате, наводящие вопросы, персональные добивающие примеры, генерация урока по запросу.
- Проверка «правильный, но другой перевод» — трёхуровневый каскад (локально → кэш → LLM-судья), см. §7.
- Интервальные повторения (FSRS) на уровне навыков, а не заучивания конкретных предложений (§10).
- Listening (диктант с эталонным TTS: американский/британский, мужской/женский голос) и Speaking (голосовой ввод — опционально, юзер выбирает голос или текст) (§9).
- Уровни A1–C1, placement-тест, быстрый скип модулей/уровней, экзамены модулей и уровней (§11).
- Работает офлайн после первой загрузки (кроме LLM-фич).

### 1.3 Что приложение НЕ делает (non-goals)

- Не учит отдельным словам в отрыве от предложений — никаких словарных карточек «word → перевод». Частотные списки используются только внутри пайплайна как фильтр сложности.
- Не пытается покрыть «весь английский» — только ~75 самых переносимых конструкций (§3).
- Нет сервера, аккаунтов, подписок, платежей, сбора данных.
- Не генерирует основной контент LLM'ом в рантайме — базовые уроки собраны заранее из корпуса; LLM в рантайме только проверяет, объясняет и генерирует опциональные доп. уроки.
- Не готовит к конкретным экзаменам (IELTS/TOEFL).

### 1.4 Ключевые принципы

1. **Local-first**: весь прогресс в IndexedDB, экспорт/импорт бэкапа в JSON-файл.
2. **Корпус > генерация**: предложения из Tatoeba (проверенные людьми), LLM — добор дефицита офлайн-пайплайном и опциональные уроки по запросу.
3. **BYOK (bring your own key)**: Gemini (основной), OpenRouter, Groq, Ollama (локальный). Без ключа приложение полноценно работает в «локальном» режиме (проверка по базе принятых ответов + самопроверка).
4. **Бюджетная дисциплина LLM**: дневные счётчики, кэш принятых ответов, дешёвая модель для проверки, graceful degradation.
5. **Всё бесплатно**: статический хостинг (GitHub/Cloudflare Pages), free-tier LLM, открытые данные (CC-BY с атрибуцией).

---

## §2. Методологический фундамент

Каждая механика приложения привязана к подтверждённому принципу обучения — ничего «на рандом».

| Принцип (источник) | Механика в приложении |
|---|---|
| **Pattern practice / output-first**: активное построение фраз эффективнее пассивного узнавания (output hypothesis, Swain; практика English Dog/DadEnglish) | Ядро — письменный/устный перевод RU→EN, а не multiple choice. Ученик всегда строит предложение сам. |
| **Retrieval practice (testing effect)**: вспоминание укрепляет память сильнее перечитывания | Теория — 3–6 предложений, свёрнута по умолчанию. 95% времени — попытки вспомнить и построить. |
| **Spaced repetition**: интервальные повторения; FSRS — современный алгоритм, дефолт в Anki с 2023 | FSRS-карточки на уровне навыков + «пиявки» (§10). |
| **Interleaving**: перемешивание тем эффективнее блочной зубрёжки | В каждой сессии ~30% предложений из ранее пройденных навыков (§6.2). |
| **Comprehensible input, i+1** (Krashen; рекомендации ER Foundation: лёгкий приятный материал) | Лексика предложения не выше CEFR-уровня навыка (правило 95% покрытия, §4.5). Listening на своём уровне, со скоростью 0.8×/1×. |
| **Immediate corrective feedback**: мгновенная, короткая, по одной ошибке | Проверка сразу; объяснение ≤2 предложений; разбор одной ошибки за раз (§7, §8). |
| **Shadowing + ASR** для произношения (исследования 2025: связка shadowing и распознавания речи улучшает fluency/точность) | Speaking-режим: услышал → повторил → STT-транскрипт → диф с эталоном; авто-озвучка после правильного ответа. |
| **Nation, Four Strands**: баланс input / output / language focus / fluency | Дрилл (output+form) + listening (input) + review на скорость (fluency) + микротеория (form). |
| **Снижение тревожности через AI-собеседника** (мета-анализы 2025–2026: чат-боты дают наибольший прирост в speaking/writing) | Ошибки не наказываются: подсказки без штрафа, «сдаться» → перепечатать правильный ответ; тон репетитора тёплый, сократический (LearnLM/Study Mode-подход). |
| **Дозирование**: короткие ежедневные сессии эффективнее редких длинных | Сессия 15–25 минут, дневная цель по предложениям, streak (§12). |

Первоисточники для Codex (читать не обязательно, ссылки для README): englishprofile.org (EVP/EGP), learnenglish.britishcouncil.org, test-english.com, oxfordlearnersdictionaries.com (Oxford 3000/5000), erfoundation.org (extensive reading), github.com/open-spaced-repetition (FSRS), ai.google.dev (LearnLM/Gemini).

---

## §3. Учебная программа

### 3.1 Иерархия

```
Уровень (A1..C1)
└── Модуль (3–6 навыков + экзамен модуля)
    └── Навык / skill (= семейство паттернов, единица обучения и SRS)
        └── Предложения (60–150 шт., распределены по саб-дриллам)
```

Прогрессия: навыки модуля → экзамен модуля (≥80%) → следующий модуль. Уровень закрывается экзаменом уровня (§11). В настройках есть тумблер «свободный режим» — снять блокировки и ходить по карте свободно (автономия важнее жёсткости).

### 3.2 Анатомия навыка

Каждый навык содержит (формат пака — §4.8):

- `pattern` — формула («Do + you/we/they + V1 …?»);
- `theory_ru` — микротеория, 3–6 предложений простым языком, одна формула, два примера. Генерируется пайплайном (§8.6), правится вручную при вычитке;
- `common_errors` — 3–5 типичных ошибок русскоязычных (для подсказок и репетитора);
- предложения с саб-типами: `affirm` (утверждение), `neg` (отрицание), `question` (общий вопрос), `wh` (спец. вопрос), `short_answer`, `mixed` (контраст с соседним паттерном);
- `probe_item_ids` — 2–3 репрезентативных предложения для placement/skip-тестов;
- `youglish_query` — фраза для виджета YouGlish.

Квоты предложений на навык: A1 — 100–150, A2 — 100–140, B1 — 80–120, B2 — 60–100, C1 — 40–80. Распределение саб-типов по умолчанию: affirm 40%, question 25%, neg 15%, wh 10%, mixed 10% (для вопросительных навыков — зеркально).

### 3.3 Структура дрилл-сессии (15–25 мин)

1. **Разминка**: 5–8 due-предложений из SRS-очереди (если есть).
2. **Теория** (только при первом входе в навык, свёрнута повторно): формула + 2 примера.
3. **Основной дрилл**: 12–20 новых предложений навыка, сложность по нарастающей (`difficulty` 1→5).
4. **Interleave**: каждые ~3 предложения вставляется 1 из ранее пройденных навыков (30% объёма).
5. **Ошибка** → предложение возвращается в очередь через 2–4 позиции, пока не будет отвечено верно (in-session requeue).
6. **Финал**: сводка (точность, время, ошибки по тегам) + при наличии ключа — 1–3 персональных предложения от LLM на самую частую ошибку сессии + кнопка «Разобрать с репетитором».
7. **Опционально**: голосовой раунд — 5 предложений из сессии устно (§9.4).

### 3.4 Карта навыков v1.0 (~75 навыков)

Список собран из English Profile (EGP/EVP), синлабусов British Council и Test-English, списка паттернов юзера. Это **нормативный минимум**; допускается коррекция ±10% на фазах Ф1/Ф6 с фиксацией в журнале. `id` — стабильные, не переименовывать.

**A1** (4 модуля, 22 навыка)

| id | Паттерн | Пример |
|---|---|---|
| **М A1-1 «Быть и указывать»** | | |
| `a1_be_affirm` | I am / he is / they are | I am a student. |
| `a1_be_neg_quest` | Are you…? / He isn't… | Are you at home? |
| `a1_pronouns_poss` | my / your / his / her | This is her book. |
| `a1_this_that` | this / that / these / those | These are my friends. |
| `a1_there_is` | There is / There are | There are two windows in the room. |
| **М A1-2 «Настоящее простое»** | | |
| `a1_pres_simple_i` | I / you / we / they + V1 | I live in this city. |
| `a1_pres_simple_3rd` | He / she + V-s | He works in an office. |
| `a1_do_questions` | Do you + V1…? | Do you often read? |
| `a1_does_questions` | Does he + V1…? | Does she speak English? |
| `a1_dont_doesnt` | don't / doesn't + V1 | I don't eat meat. |
| `a1_freq_adverbs` | usually / never (позиция) | He usually gets up early. |
| **М A1-3 «Мир вокруг»** | | |
| `a1_have` | have / has (+ have got) | I have a car. |
| `a1_can` | can / can't | I can swim. |
| `a1_prep_place` | in / on / under / next to | The book is on the table. |
| `a1_prep_time` | in / on / at | The lesson is at 9 o'clock. |
| `a1_articles_basic` | a/an vs the | I see a dog. The dog is big. |
| `a1_plural_quant` | мн. число, How many | How many brothers do you have? |
| **М A1-4 «Общение»** | | |
| `a1_wh_questions` | What / Where / Who / When / How | Where do you live? |
| `a1_like_want` | like / want / need + to V / N | I want to learn English. |
| `a1_would_like` | I'd like… | I would like a coffee, please. |
| `a1_imperatives` | Open… / Don't… | Open the window, please. |
| `a1_short_answers` | Yes, I do. / No, he isn't. | Yes, I do. |

**A2** (5 модулей, 20 навыков)

| id | Паттерн | Пример |
|---|---|---|
| **М A2-1 «Сейчас и вообще»** | | |
| `a2_pres_cont` | am/is/are + V-ing | I am reading now. |
| `a2_pres_simple_vs_cont` | контраст Simple/Continuous | I usually walk, but today I'm taking the bus. |
| `a2_pres_cont_future` | Continuous для планов | We are meeting tomorrow. |
| **М A2-2 «Прошлое»** | | |
| `a2_past_simple_reg` | V-ed | Yesterday I worked late. |
| `a2_past_simple_irreg` | went / saw / made | He went home. |
| `a2_did_questions_neg` | Did you…? / didn't | Did you see this movie? |
| `a2_was_were` | was / were | We were tired. |
| **М A2-3 «Будущее»** | | |
| `a2_going_to` | be going to + V1 | I am going to buy a ticket. |
| `a2_will` | will / won't | I will help you. |
| **М A2-4 «Сравнение и количество»** | | |
| `a2_comparatives` | -er / more … than | This house is bigger. |
| `a2_superlatives` | the -est / the most | This is the best day of my life. |
| `a2_some_any_much_many` | some/any/much/many/a lot of | We don't have much time. |
| `a2_countable_uncount` | advice / money / news | I need some advice. |
| **М A2-5 «Модальность и связки»** | | |
| `a2_have_to_must` | have to / must | I have to go. |
| `a2_should` | should / shouldn't | You should rest. |
| `a2_verb_patterns_basic` | want to V / enjoy V-ing | I enjoy cooking. |
| `a2_too_enough` | too / enough | It's too expensive. |
| `a2_conjunctions` | because / so / but / when | I stayed home because I was sick. |
| `a2_pres_perf_intro` | Have you ever…? | Have you ever been to London? |
| `a2_object_pronouns` | me / him / them | Call me tomorrow. |

**B1** (4 модуля, 16 навыков)

| id | Паттерн | Пример |
|---|---|---|
| **М B1-1 «Опыт и длительность»** | | |
| `b1_pres_perf_vs_past` | Perfect vs Past Simple | I have lost my keys. / I lost them yesterday. |
| `b1_pres_perf_cont` | have been V-ing | I have been learning English for two years. |
| `b1_past_cont` | was V-ing, when/while | I was reading when he called. |
| `b1_used_to` | used to + V1 | I used to smoke. |
| **М B1-2 «Условия и вероятность»** | | |
| `b1_first_cond` | If + Present, will | If it rains, we will stay home. |
| `b1_second_cond` | If + Past, would | If I were you, I would wait. |
| `b1_modals_probability` | must / might / can't be | He must be tired. |
| **М B1-3 «Пассив и структура»** | | |
| `b1_passive` | is done / was built | This house was built in 1990. |
| `b1_relative_clauses` | who / which / that / where | The man who lives next door is a doctor. |
| `b1_indirect_questions` | Could you tell me where…? | Could you tell me where the station is? |
| **М B1-4 «Чужая речь и оттенки»** | | |
| `b1_reported_statements` | He said (that)… | He said he was busy. |
| `b1_reported_questions` | She asked where… | She asked where I lived. |
| `b1_gerund_vs_inf` | stop doing / stop to do | Stop talking, please. |
| `b1_so_such` | so + adj / such + N | It was such an interesting movie. |
| `b1_linking_contrast` | although / despite / however | Although it was late, we continued. |
| `b1_phrasal_verbs_1` | 20 базовых фразовых | Turn off the light. |

**B2** (3 модуля, 12 навыков)

| id | Паттерн | Пример |
|---|---|---|
| **М B2-1 «Нереальное»** | | |
| `b2_third_cond` | If + Past Perfect, would have | If you had told me, I would have helped. |
| `b2_mixed_cond` | смешанные условия | If I hadn't left, I would live there now. |
| `b2_wish` | wish / if only | I wish I knew French. |
| `b2_modal_deduction_past` | must have / can't have | He must have forgotten. |
| **М B2-2 «Продвинутая структура»** | | |
| `b2_causative` | have/get something done | I had my hair cut. |
| `b2_passive_advanced` | I was told that… / being done | I was told that the meeting was cancelled. |
| `b2_relative_advanced` | whose / reduced clauses | The girl sitting by the window is my sister. |
| `b2_participle_clauses` | Having finished, … | Having finished the work, he left. |
| **М B2-3 «Дискурс»** | | |
| `b2_future_perfect` | will have done (by…) | I will have finished by Friday. |
| `b2_reported_advanced` | advise / suggest / warn | He advised me to wait. |
| `b2_linking_advanced` | however / therefore / moreover | The plan, however, has one weakness. |
| `b2_phrasal_verbs_2` | 20 продвинутых фразовых | We need to put off the meeting. |

**C1** (2 модуля, 8 навыков)

| id | Паттерн | Пример |
|---|---|---|
| **М C1-1 «Эмфаза и стиль»** | | |
| `c1_inversion` | Not only did he… / Hardly had… | Not only did he come, but he also helped. |
| `c1_cleft` | What I need is… / It was X that… | What I need is time. |
| `c1_emphatic_do` | I do appreciate… | I do appreciate your help. |
| `c1_unreal_past` | It's time we… / would rather | It's time we left. |
| **М C1-2 «Формальный регистр»** | | |
| `c1_advanced_cond` | Should you… / But for… | Should you need anything, call me. |
| `c1_hedging` | It could be argued… / tend to | It could be argued that this approach is safer. |
| `c1_nominalization` | формальные перифразы | The failure of the plan surprised everyone. |
| `c1_ellipsis_substitution` | If so / I think so / do so | If so, let me know. |

---

## §4. Данные: источники и пайплайн

### 4.1 Источники (решение)

| Роль | Источник | Формат | Лицензия | Комментарий |
|---|---|---|---|---|
| **Основной корпус пар RU↔EN** | manythings.org/anki/`rus-eng.zip` (производная Tatoeba, английская сторона вычитана) | TSV: `eng \t rus \t attribution` | CC-BY 2.0 FR | 536 124 пары (подтв. 2026-07). Быстрый старт |
| **Канонический/резервный корпус** | tatoeba.org/downloads: `sentences.tar.bz2` (id, lang, text) + `links.tar.bz2` (граф переводов) | TSV | CC-BY 2.0 FR (часть CC0) | Полный граф → у одного RU несколько EN переводов = бесплатные accepted answers. Обновляется по субботам (подтв. 2026-07) |
| **Частотные диапазоны лексики** | python-пакет `wordfreq` (MIT) | lib | MIT | Zipf-частоты для CEFR-разметки (§4.5). Открытая альтернатива Oxford-спискам |
| **Опциональный якорь CEFR-лексики** | Oxford 3000/5000 CSV (юзер кладёт файл локально сам) | CSV | copyright Oxford | НЕ коммитить в репо; пайплайн работает и без него |
| **Карта тем → CEFR** | English Profile (EGP), синлабусы British Council / Test-English | справочно | — | Уже отражена в §3.4; при спорах о уровне навыка — сверяться туда |
| **Добор дефицита (B2–C1)** | Генерация Gemini офлайн-пайплайном | JSON | — | Помечается `source: "generated"` (§4.7) |

Требование лицензии CC-BY: в приложении обязательна страница «Данные и лицензии» с атрибуцией Tatoeba и упоминанием авторов (поле attribution из manythings) — §14.4.

### 4.2 Схема пайплайна

```
fetch → clean → pair → tag(rules) → tag(llm) → level → curate → gapfill → enrich → emit → validate → [audio]
```

Стек пайплайна: Python ≥3.12 (в системе 3.14), `uv` (есть), polars, spaCy `en_core_web_sm`, wordfreq, `google-genai`, typer (CLI `etr`), sqlite3 (кэш LLM-вызовов), pytest. Отдельная папка `pipeline/` в монорепо (§5.1). Все шаги идемпотентны и резюмируемы; промежуточные артефакты в `data/` (gitignored), результат — `packs/*.json` (коммитится). `fetch` шлёт браузерный User-Agent — manythings отдаёт 406 «голым» клиентам (замечено 2026-07-07).

CLI:

```bash
uv run etr fetch      # скачать rus-eng.zip (+ опц. полные экспорты Tatoeba) в data/raw/
uv run etr clean      # нормализация/фильтры → data/clean/pairs.parquet
uv run etr tag        # rule-based теггер + LLM-пасс для неоднозначных → data/tagged/
uv run etr level      # CEFR-оценка лексики (§4.5)
uv run etr curate     # квоты, диверсити, саб-дриллы, difficulty → data/curated/
uv run etr gapfill    # LLM-догенерация дефицитных навыков (§4.7)
uv run etr enrich     # theory_ru, common_errors, probe items, youglish_query
uv run etr emit       # → packs/{skill_id}.json + packs/index.json
uv run etr validate   # линт паков: схема, квоты, дубли, лексика уровня
uv run etr audio      # (опционально, Ф9) прегенерация озвучки edge-tts
```

### 4.3 Clean: правила фильтрации

Вход: пары `(en, ru, attribution)`. Отбрасываем/чиним:

1. Unicode-нормализация NFC; кавычки/апострофы → прямые; схлопнуть пробелы.
2. Длина EN: 2–18 токенов (для паков A1–A2 верхний предел 12).
3. EN содержит только латиницу+пунктуацию; RU — кириллицу (допускается латиница в именах).
4. Дубликаты: точные и «почти» (нормализованная форма без пунктуации/регистра).
5. Профанити-фильтр по стоп-списку (better-profanity или собственный список).
6. Телеграфные/обрывочные строки (нет глагола и >2 токенов; всё капсом; многоточия).
7. **Группировка для accepted answers**: `group by normalize(ru)` → все связанные EN-варианты сохраняются в `en_accepted` будущего item (главный `en_main` = самый короткий частотный вариант). При использовании полного графа Tatoeba брать только прямые связи (не переводы переводов).
8. **Tom/Mary-скос Tatoeba**: предложений с именами собственными ≤20% на навык. Опциональный шаг `--name-swap`: парная замена по словарю (`Tom↔Том` → случайное имя из 20 пар `Alex↔Алекс`…), только при точном соответствии в обеих половинах пары.

### 4.4 Tag: разметка паттернов (два пасса)

**Пасс 1 — rule-based (spaCy POS/deps + regex), покрывает ~80% A1–B1.** Каждому навыку — детектор с required/forbidden признаками. Примеры (полная карта — `pipeline/src/etr/rules.py`, golden-тесты обязательны):

| Навык | Детектор (эскиз) |
|---|---|
| `a1_do_questions` | `^(do)\b … \?$`, root=VB (base), нет wh-слова в начале |
| `a1_does_questions` | `^(does)\b … \?$` |
| `a1_there_is` | лемма-старт `there` + be |
| `a2_going_to` | `(am|is|are|was|were) going to VB` |
| `a2_pres_cont` | aux be + VBG, нет `going to`, нет будущих маркеров |
| `a2_past_simple_*` | root VBD, нет aux have/be |
| `a2_pres_perf_intro` | `(have|has) … VBN` + (`ever|never`/`?`) |
| `b1_passive` | be + VBN, subject≠agent (нет VBG рядом) |
| `b1_second_cond` | `if` + VBD в придаточном + `would VB` в главном |
| `b1_relative_clauses` | `who|which|that|where` как relativizer (dep=relcl) |
| `b2_causative` | `(have|get|had|got) + NP + VBN` |
| `b2_modal_deduction_past` | `(must|might|may|can't|could) have VBN` |
| `c1_inversion` | старт `Not only|Hardly|Never|Rarely|No sooner` + инверсия aux |

Предложение может попасть в несколько кандидатов → выбирается самый специфичный (порядок приоритета задан в rules.py); при конфликте — «ambiguous».

**Пасс 2 — LLM-верификация** только для (а) ambiguous, (б) навыков с низкой точностью правил (B2–C1), (в) выборочной валидации 5% от каждого навыка. Батчи по 25 предложений, temperature 0, JSON-ответ, промпт `TAGGER_SYSTEM` (§8.6). Кэш в `pipeline/cache.sqlite` с ключом `(model, prompt_hash, sentence_id)` — перезапуск ничего не пересчитывает. Оценка объёма: ~50k кандидатов → LLM нужен ~30% → ~600 батч-вызовов; влезает во free tier Gemini за 1–3 дня или стоит копейки на Flash-Lite. ⚠️VERIFY актуальные лимиты (§17.2).

### 4.5 Level: CEFR-оценка предложения

Правило 95% лексического покрытия: предложение уровня L, если ≥95% его знаменательных слов (лемм) входят в лексику ≤L, иначе уровень поднимается или предложение отбрасывается для этого навыка.

Диапазоны лексики по умолчанию — через `wordfreq` Zipf-частоту леммы (открыто, MIT):

| CEFR | Zipf-порог (лемма) | ~соответствие |
|---|---|---|
| A1 | ≥ 4.9 | ~top-1000 |
| A2 | ≥ 4.5 | ~top-2000 |
| B1 | ≥ 4.0 | ~top-4500 |
| B2 | ≥ 3.5 | ~top-9000 |
| C1 | < 3.5 | остальное |

Служебные слова (стоп-лист) не учитываются. Если юзер положил `data/local/oxford_cefr.csv` (Oxford 3000/5000 с уровнями) — он используется как приоритетный якорь, wordfreq — как fallback. Итоговый уровень предложения = max(уровень навыка, лексический уровень). Пороги калибруются на Ф1 по выборке: 30 предложений/уровень проверяются вручную, пороги двигаются, значения фиксируются в журнале.

### 4.6 Curate: отбор в навык

Для каждого навыка из кандидатов отбираем до квоты (§3.2):

1. Лексика проходит уровень (§4.5), длина в лимите уровня.
2. **Диверсити**: не более 4 предложений на одну глагольную лемму; не более 20% с именами собственными; сортировка на разнообразие тематики (грубая эвристика по ключевым существительным).
3. Распределение по саб-типам (affirm/neg/question/wh/short_answer/mixed) согласно §3.2.
4. `difficulty` 1–5 внутри навыка: по длине + лексическому уровню + наличию модификаторов.
5. Если после отбора < 60% квоты → навык попадает в очередь `gapfill`.

### 4.7 Gapfill: LLM-догенерация (офлайн)

Для дефицитных навыков (в основном B2–C1) Gemini генерирует пары по промпту `GAPFILL_SYSTEM` (§8.6): бытовые темы, лексика в пределах уровня, 4–12 слов, разные глаголы, `en_accepted` с 1–3 альтернативами. Затем **валидационный пасс другой моделью/вторым вызовом** (`TAGGER_SYSTEM` с ok-флагом) + опционально self-hosted LanguageTool (§13.3). Помечается `source: "generated:<model>:<date>"`. Доля generated в навыке ≤50%, в A1–B1 стремиться к 0%.

### 4.8 Формат пака (нормативная схема)

`packs/{skill_id}.json`:

```json
{
  "schema_version": 1,
  "skill": {
    "id": "a1_do_questions",
    "cefr": "A1",
    "module": "a1_m2",
    "module_title_ru": "Настоящее простое",
    "title_ru": "Вопросы с Do you…?",
    "pattern": "Do + you/we/they + V1 …?",
    "theory_ru": "3–6 предложений…",
    "common_errors": [
      {"tag": "aux_missing", "ru": "Пропуск do: ~You like tea?~ → Do you like tea?"}
    ],
    "probe_item_ids": ["s_00123", "s_00456", "s_00789"],
    "youglish_query": "do you usually"
  },
  "items": [
    {
      "id": "s_00123",
      "ru": "Ты часто забываешь имена?",
      "en_main": "Do you often forget names?",
      "en_accepted": ["Do you forget names often?"],
      "sub": "question",
      "difficulty": 2,
      "cefr_lex": "A1",
      "source": "tatoeba:1234567",
      "attribution": "CK"
    }
  ]
}
```

`packs/index.json`: версия курса, список уровней→модулей→навыков (id, title_ru, cefr, count, checksum файла) — по нему приложение строит карту курса и качает паки лениво.

Размер: пак ~20–40 КБ, весь курс A1–C1 < 4 МБ JSON — статика, кэшируется service worker'ом.

### 4.9 Validate: линт паков (обязательный CI-шаг)

- JSON-схема (см. выше) валидна для каждого пака; все id уникальны глобально.
- Квоты и распределение саб-типов в допуске ±20%.
- Нет дублей нормализованных `ru` внутри навыка; `en_main ∈ en_accepted` запрещено (main хранится отдельно).
- Лексический уровень каждого item ≤ уровня навыка.
- `probe_item_ids` существуют; у каждого навыка есть theory_ru и ≥3 common_errors.
- Доля generated и доля имён собственных в лимитах.

---

## §5. Архитектура приложения

### 5.1 Монорепо

```
frazodrom/
├── PLAN.md               # этот файл (нормативный)
├── README.md             # для юзеров: установка, BYOK-гайд (§18)
├── app/                  # Vite + React PWA (основное приложение)
│   └── src/{engine,checker,llm,tts,srs,screens,components,db,i18n}
├── pipeline/             # Python: корпус → паки (§4)
│   └── src/etr/{fetch,clean,rules,tag,level,curate,gapfill,enrich,emit,validate}.py
├── packs/                # сгенерированные паки JSON — КОММИТЯТСЯ (воспроизводимость + бесплатный хостинг)
├── proxy/                # опциональный однофайловый node-прокси для CORS-провайдеров (§8.2)
├── data/                 # raw/interim пайплайна — gitignored
└── .github/workflows/ci.yml
```

### 5.2 Стек приложения (решение)

| Слой | Выбор | Почему |
|---|---|---|
| Сборка/UI | Vite + React + TypeScript strict + Tailwind | просто для агентной разработки, быстрый dev loop |
| Состояние | Zustand | минимум церемоний |
| Хранилище | Dexie (IndexedDB) | local-first, транзакции, простые миграции |
| SRS | `ts-fsrs` v5 (FSRS-6) | стандарт де-факто, поддерживается (подтв. 2026-07) |
| Валидация | zod | контракты LLM-ответов и паков |
| PWA | vite-plugin-pwa (Workbox) | офлайн-шелл + кэш паков |
| Бэкенд | **нет** | статический хостинг; BYOK-вызовы напрямую из браузера |

Среда: Node ≥20 (в системе v26), Python ≥3.12 (в системе 3.14), uv установлен.

### 5.3 Схема Dexie (клиентская БД)

| Таблица | Ключ | Содержимое |
|---|---|---|
| `kv` | key | настройки: ключи провайдеров, голос, дневная цель, свободный режим, роутинг ролей |
| `packs` | skillId | скачанный пак (JSON) + version/checksum |
| `skillState` | skillId | status: `locked/available/in_progress/passed`, FSRS-поля карточки, счётчики точности |
| `itemState` | itemId | seenCount, failCount, isLeech, FSRS-поля (только для пиявок) |
| `attempts` | ++id | itemId, ts, ввод юзера, verdict, verdictSource: `local/cache/llm/self`, error_tags |
| `acceptedCache` | ruHash | подтверждённые альтернативные EN-ответы: `[{en, source, ts}]` |
| `errorProfile` | tag | скользящий счётчик за 30 дней |
| `sessions` | ++id | тип, skillIds, статистика, длительность |
| `exams` | ++id | scope (module/level), score, passed, ts |
| `providerBudget` | providerId+date | счётчик вызовов за день по ролям |

Паки грузятся лениво: открыл навык → fetch `packs/{id}.json` → в Dexie. Кнопка «Скачать весь курс» прокачивает все паки для полного офлайна. Экспорт/импорт: вся БД → один JSON-файл (бэкап прогресса), экран «Настройки → Данные».

### 5.4 Экраны

1. **Онбординг** (3 шага: что это → выбор пути: placement / выбрать уровень вручную / «начать с нуля»).
2. **Сегодня** (главная): продолжить модуль, due-повторения, streak, дневная цель.
3. **Карта курса**: уровни → модули → навыки со статусами; тумблер свободного режима.
4. **Навык**: теория, статистика, кнопки «Дрилл» / «YouGlish» / «Reverso», probe-инфо.
5. **Дрилл-сессия** (ядро, §6).
6. **Репетитор** (шторка поверх дрилла, §8.5).
7. **Review-сессия** (SRS, §10).
8. **Listening** и **Speaking** (§9).
9. **Экзамен** (модуль/уровень, §11).
10. **AI-урок по запросу** (§8.4).
11. **Настройки**: ключи и роутинг LLM, голос/акцент/скорость, цель дня, данные (экспорт/импорт/сброс), LanguageTool URL.
12. **Данные и лицензии** (§14.4).

---

## §6. Drill engine

### 6.1 Машина состояний предложения

```
show(ru) → input → check (каскад §7)
  ├─ correct/acceptable  → фидбек ✓ (+ «естественнее: …» если есть) → автоозвучка → next
  ├─ minor_error         → жёлтый фидбек: правка + тег → REWRITE → next (засчитано с пометкой)
  └─ wrong               → красный фидбек: краткое «что не так» → input остаётся:
       retry | hint (L1 формула → L2 пословное открытие: первые буквы → слово целиком) |
       give up | кнопки репетитора §8.5 («Ошибки» / «Разбор» / «Варианты» / «Нюансы»)
       → как только верный ответ стал видим юзеру (give up, «Ошибки», «Разбор»,
         corrected/natural от judge) — переход дальше ТОЛЬКО через REWRITE

  REWRITE (закрепление): верный ответ и разбор скрываются, поле очищается →
       юзер пишет перевод заново с нуля → проверка tier 1–2 → успех → next;
       fail → ответ показывается снова → снова REWRITE (цикл до успеха)

  любой fail → предложение дополнительно возвращается в очередь через 2–4 позиции
       и попадает в разминку следующей сессии
```

**REWRITE — принципиальное отличие от English Dog**, где после разбора просто идёшь дальше: прочитать правильный ответ ≠ уметь его построить. Пока юзер не воспроизвёл предложение сам по пустому полю, «понял глазами» не превращается в навык (retrieval practice, §2). Цепочка: написал → ошибка → разбор + верный ответ → написал заново сам → (цикл до успеха) → дальше.

Подсказки, retry и REWRITE не «наказываются» очками — наказание разрушает мотивацию; но предложение с fail попадает в разминку следующей сессии.

### 6.2 Построитель очереди сессии

Параметры: `newTarget` (12–20), `interleaveRatio` (0.3), `reviewWarmup` (5–8). Алгоритм: разминка из due/failed → новые предложения навыка по difficulty 1→5 с саб-дриллами в порядке affirm → question → neg → wh → mixed; каждое ~3-е предложение — interleave из пройденных навыков модуля/уровня (равновероятно, приоритет недавним ошибкам). Requeue вставляется на позицию +2..4.

### 6.3 Управление

Enter — проверить; повторный Enter — дальше. `Ctrl+H` — подсказка, `Ctrl+G` — сдаться, `Ctrl+P` — озвучить. Автофокус инпута всегда. На мобиле — крупные кнопки под инпутом. У каждого предложения меню «⚑ плохое предложение» → локальный блэклист (исключается из ротации) + экспорт `blacklist.txt` из настроек (скармливается пайплайну при следующей сборке паков).

---

## §7. Проверка ответа (каскад)

Главная проблема продукта: «перевёл правильно, но не так, как ожидалось». Решение — каскад, где LLM только на верхнем этаже, с кэшем.

### 7.1 Нормализация (обе стороны: ввод и эталоны)

`normalize(s) → Set<string>` (множество канонических форм из-за ветвлений неоднозначности):

1. NFC, lowercase, типографские апострофы/кавычки → прямые, схлопнуть пробелы, убрать финальные `.!?`.
2. Контракции → полные формы по таблице (`don't→do not`, `won't→will not`, `can't→cannot`, `i'm→i am`, `they're→they are`, `let's→let us`, …). Неоднозначные `'s`/`'d` дают ветвление: `he's → {he is, he has}`, `i'd → {i would, i had}` — результат = множество вариантов.
3. Числительные-слова 0–100 → цифры (`two → 2`).
4. BrE → AmE по явному словарю ~40 слов (`colour→color`, `favourite→favorite`, `centre→center`, `organise→organize`, `travelling→traveling`, `grey→gray`, `programme→program`, `neighbour→neighbor`, `realise→realize`, `theatre→theater`, …) — файл `app/src/checker/britishAmerican.ts`. Никаких суффиксных эвристик (ложные срабатывания типа *hour*).

### 7.2 Каскад

```
tier 1  EXACT      normalize(user) ∩ normalize(en_main ∪ en_accepted ∪ acceptedCache[ruHash]) ≠ ∅  → correct
tier 2  NEAR       наилучший эталон по token-diff; допускается ≤1 опечатка на предложение:
                   слово len≥4, edit distance 1, И правка НЕ создаёт/убирает морфемный суффикс
                   {s, es, ed, ing, er, est} и не меняет служебное слово (a/an/the/do/did/is…)
                   → correct с пометкой «опечатка: …». Разница в артикле/предлоге/форме глагола — НЕ опечатка.
tier 2.5 (опция)   self-hosted LanguageTool, если настроен (§13.3): чистая грамматика юзера +
                   совпадение мешка лемм с эталоном → кандидат в acceptable, идёт на tier 3 за подтверждением
tier 3  LLM JUDGE  если есть ключ и бюджет: промпт §8.6-JUDGE, JSON, zod, timeout 8s, 1 retry.
                   verdict=correct|acceptable и add_to_accepted → записать в acceptedCache
tier 4  SELF       нет ключа/бюджета/сети: показать эталоны + кнопки «Я был прав» / «Ошибся»
                   (verdictSource='self'; честность — забота юзера, это его обучение)
```

Экономика: в день-1 до LLM доходит ~30% попыток, к неделе — <10% (кэш растёт). При дневной цели 30–60 предложений это 5–20 вызовов/день — на порядки меньше free-tier лимитов (§17.2).

### 7.3 Теги ошибок (нормативный enum)

```
word_order | verb_tense | verb_form | aux_missing | article | preposition |
agreement | pronoun | vocab_choice | spelling | word_missing | word_extra | unnatural
```

Judge обязан использовать только их (zod-enum). По ним строится errorProfile и режим «охота на ошибки» (§10.4).

### 7.4 Контракт judge (zod)

```ts
const JudgeVerdict = z.object({
  verdict: z.enum(["correct", "acceptable", "minor_error", "wrong"]),
  error_tags: z.array(z.enum(ERROR_TAGS)).max(3),
  explanation_ru: z.string().max(280),   // ≤ 2 коротких предложения
  corrected: z.string(),                 // минимальная правка ответа юзера
  natural: z.string(),                   // как сказал бы носитель
  add_to_accepted: z.boolean(),
});
```

---

## §8. AI-слой (BYOK)

### 8.1 Интерфейс провайдера

```ts
type Role = "judge" | "tutor" | "generator";
interface ChatRequest { system: string; messages: Msg[]; json?: boolean; maxTokens?: number }
interface LLMProvider {
  id: string; label: string;
  isConfigured(): boolean;                       // ключ введён / URL доступен
  chat(req: ChatRequest, signal?: AbortSignal): Promise<string>;
}
```

Роутинг ролей — конфиг в настройках (редактируемый список фолбэков):

```json
{
  "judge":     ["gemini:flash-lite", "groq:llama-8b", "ollama:default"],
  "tutor":     ["gemini:flash", "openrouter:free", "ollama:default"],
  "generator": ["gemini:flash", "openrouter:free"]
}
```

Алиасы моделей — в одном файле конфига (на 2026-07: `flash` = gemini-3.5-flash, `flash-lite` = gemini-3.1-flash-lite, `groq:llama-8b` = llama-3.1-8b-instant); обновляются без правки кода.

### 8.2 Провайдеры (состояние на 2026-07, детали в §17.2)

| Провайдер | Free tier | Из браузера | Роль |
|---|---|---|---|
| **Gemini** (основной) | free tier есть (подтв. 2026-07-07): бесплатны gemini-3.5-flash, gemini-3.1-flash-lite, 2.5-flash/lite; статичных RPD в доках больше нет — смотреть AI Studio → «View your active rate limits» (юзер видел 1500 RPD у 3.5 Flash); RPD сбрасывается в полночь Pacific | ✅ работает (`@google/genai`); в адаптере ретраи на CORS/503-инциденты | все роли |
| **Groq** | llama-3.1-8b-instant **14 400 RPD** (30 RPM/6K TPM); 70B и прочие ~1000 RPD; whisper-large-v3 (STT) 2000 RPD; лимиты на организацию (подтв. 2026-07-07) | ⚠️ CORS ненадёжен → через `proxy/` (локальный однофайловый node) | judge (+Whisper STT) |
| **OpenRouter** | :free модели: всего **50 RPD** без пополнения (20 RPM); 1000 RPD после разового пополнения $10 (подтв. 2026-07-07) | ⚠️VERIFY CORS на Ф3; иначе proxy | резерв tutor/generator |
| **Ollama** | локально, безлимит | ✅ localhost | всё офлайн, для гиков |

`proxy/serve.mjs`: один файл, `node proxy/serve.mjs` → localhost:8787, прозрачно пробрасывает `/groq/*`, `/openrouter/*` с ключами из `.env`; настройка «URL прокси» в приложении. Не обязателен: Gemini-only покрывает всё.

### 8.3 Бюджеты

Дневные счётчики per provider+role в `providerBudget`. Дефолты: judge 800/д, tutor 150/д, generator 50/д (правится в настройках). Исчерпан → тихий даунгрейд на следующий фолбэк → tier 4; баннер «LLM-бюджет на сегодня израсходован, работаю локально». Никогда не блокировать обучение из-за LLM.

### 8.4 AI-урок по запросу

Экран: юзер пишет тему свободно («телефонные разговоры», «прошедшее время про путешествия») → `generator` строит урок из 15 предложений (промпт LESSON_GEN) → урок проходит через обычный drill engine. Предложения эфемерны (не в SRS), но зафейленные становятся пиявками (§10.3), а сам урок можно сохранить кнопкой (уходит в Dexie как локальный пак `custom_*`). Это «ИИ генерирует целый урок за один запрос» — дёшево: 1 вызов = целая сессия.

Разновидность — **«Мои слова»** (аналог «Мой словарь» в English Dog): юзер вводит список английских слов → приложение (а) находит предложения с этими словами в скачанных паках и (б) при наличии ключа догенеривает дрилл-предложения с ними через generator. Слова тренируются только внутри предложений — отдельных карточек «слово→перевод» не делаем (§1.3).

### 8.5 Репетитор: 4 действия + чат

Два слоя:

1. **Действия-кнопки** (как у English Dog): «Ошибки» / «Разбор» / «Варианты» / «Нюансы». Каждая — один одноразовый LLM-вызов со своим промптом (§8.6, блок ACTION_*) на полном контексте: RU, ответ юзера, верный ответ + accepted-варианты, verdict, error_tags, паттерн, уровень. **Кэш**: результаты «Вариантов» и «Нюансов» зависят только от предложения → кэшируются в Dexie per item навсегда (повторные клики и повторные встречи предложения бесплатны); «Ошибки» и «Разбор» зависят от ответа юзера → кэш per (item + hash нормализованного ответа).
2. **Чат** («Спросить репетитора»): свободные до-вопросы после действий, сократический стиль (TUTOR_SYSTEM), максимум 6 ходов, потом мягкое «вернёмся к дриллу». История чата не персистится (экономия и простота), выжимка ошибки — в errorProfile.

Все вызовы — из бюджета tutor (§8.3). Любое действие, раскрывшее верный ответ («Ошибки», «Разбор», give up), включает обязательный REWRITE (§6.1).

### 8.6 Промпты (нормативные, английский)

**JUDGE_SYSTEM** (рантайм, role=judge):

```
You are a strict but fair grader of English translations for Russian-speaking learners.
Input: RU (stimulus), USER (learner's answer), REFS (known correct translations),
PATTERN (the grammar pattern being drilled), LEVEL (CEFR).
Rules:
1. USER need not match REFS word-for-word. Any natural, grammatically correct English
   sentence with the same meaning that USES the drilled PATTERN is correct/acceptable.
2. If USER is correct but avoids the drilled PATTERN (paraphrase), verdict="acceptable",
   add_to_accepted=false, explanation_ru must say the pattern was avoided.
3. Ignore capitalization, terminal punctuation, contractions, US/UK spelling.
4. minor_error = meaning preserved, exactly one small slip (article, preposition, single
   wrong form). wrong = meaning changed, pattern broken, or 2+ grammar errors.
5. explanation_ru: Russian, max 2 short sentences, about THE error only. No praise, no lecture.
6. corrected = USER's sentence with minimal edits. natural = how a native speaker would say it.
7. error_tags only from: [word_order, verb_tense, verb_form, aux_missing, article, preposition,
   agreement, pronoun, vocab_choice, spelling, word_missing, word_extra, unnatural].
8. add_to_accepted=true ONLY if USER is fully correct AND uses the drilled pattern.
Respond with ONLY valid JSON:
{"verdict":"correct|acceptable|minor_error|wrong","error_tags":[],"explanation_ru":"",
 "corrected":"","natural":"","add_to_accepted":false}
```

**TUTOR_SYSTEM** (рантайм, role=tutor):

```
You are a warm, concise English tutor for a Russian-speaking learner (CEFR {LEVEL}).
Context: drilling pattern "{PATTERN}"; the learner made this mistake:
RU="{RU}", their answer="{USER}", correct="{REF}", error_tags={TAGS}.
Rules:
- Reply in Russian; English only inside examples. Max 120 words per reply.
- Socratic first: if the learner can plausibly find the fix, ask ONE guiding question
  instead of explaining. Explain directly on the second miss.
- One concept per reply. Plain words, no linguistics jargon.
- When the learner gets it, give exactly 2 fresh RU→EN micro-examples of the same pattern.
- Never drift off the current mistake. Never grade — grading happens elsewhere.
```

**Действия-кнопки репетитора** (рантайм, role=tutor; §8.5). В начало каждого из четырёх промптов подставляется общий контекст:

```
CONTEXT
RU (task): "{RU}"
LEARNER (their answer): "{USER}"
CORRECT (main): "{REF}"; also accepted: {REFS}
VERDICT: {VERDICT}; error_tags: {TAGS}
PATTERN drilled: "{PATTERN}" (CEFR {LEVEL})
Write in Russian; English only inside examples. Plain language, no linguistics jargon.
```

**ACTION_ERRORS** («Ошибки»):

```
List the learner's mistakes, one by one. For each: quote the wrong fragment → show the fix
→ explain WHY in one short sentence (rule or usage).
Max 3 mistakes, most important first; if more remain, add one line "Ещё мелочи: …".
If the answer is fully correct — say so and name one thing done well.
Format: numbered list. Under 90 words total.
```

**ACTION_EXPLAIN** («Разбор»):

```
Explain how the CORRECT sentence is built, like a tutor at a whiteboard:
1) skeleton: the word order / pattern formula applied to THIS sentence;
2) why the key forms are used (tense, auxiliary, article) — only those that matter here;
3) one memory hook: a mini-rule or analogy the learner can reuse in similar sentences.
Do not analyse the learner's answer here (that is the Errors button). Under 110 words.
```

**ACTION_VARIANTS** («Варианты»; кэш per item — ответ юзера в контекст не подставляется):

```
Give 3-5 natural English translations of RU, from most standard to conversational.
Label each: (нейтральный) / (разговорный) / (формальный) where relevant.
After each — max one short line in Russian: when this version fits.
Only sentences a native speaker would actually say; no invented rare phrasings.
```

**ACTION_NUANCES** («Нюансы»; кэш per item — ответ юзера в контекст не подставляется):

```
Point out the subtleties of this sentence that Russian speakers usually miss:
close synonyms and which one natives prefer here, articles, prepositions, collocations,
register, false friends. Max 4 bullets, one sentence each. Only nuances REAL for this
sentence — no generic grammar lecture. If there is a classic RU-speaker trap, start with it.
```

**LESSON_GEN_SYSTEM** (рантайм, role=generator):

```
You create a one-shot drill lesson for a Russian-speaking English learner.
Input: TOPIC (free text), LEVEL (CEFR), N (default 15), WEAK_TAGS (learner's frequent errors).
Output ONLY valid JSON:
{"title_ru":"","theory_ru":"3-5 short sentences","items":[
  {"ru":"","en_main":"","en_accepted":[""],"sub":"affirm|neg|question|wh|mixed"}]}
Rules: natural everyday sentences, 4-12 words; vocabulary within LEVEL; idiomatic Russian
stimuli (never word-by-word calques); vary verbs and subjects; no rare proper nouns;
bias 30% of items toward WEAK_TAGS if given; en_accepted = 1-3 alternative correct translations.
```

**TAGGER_SYSTEM** (пайплайн):

```
You classify English sentences for a grammar-drill course.
Input: SKILLS = [{id, pattern, description}]; SENTENCES = [{id, en, ru}].
For each sentence decide: (a) skill = the ONE skill it best drills, or "none";
(b) cefr = A1..C1 considering both grammar and vocabulary; (c) ok=false if awkward,
offensive, archaic, telegraphic, or not self-contained; (d) ru_ok=false if the Russian
translation is unnatural or does not match the English meaning.
Be conservative: several patterns at once or none clearly → "none".
Output ONLY valid JSON: {"results":[{"id":"","skill":"","cefr":"","ok":true,"ru_ok":true}]}
```

**THEORY_GEN_SYSTEM** (пайплайн):

```
Write a micro-theory block in Russian for skill "{TITLE}" (CEFR {LEVEL}, pattern: {PATTERN}).
Output JSON: {"theory_ru":"","common_errors":[{"tag":"","ru":""}],"youglish_query":""}
theory_ru: 3-6 short sentences, plain language, one formula line, 2 inline examples,
no linguistics jargon. common_errors: 3-5 typical mistakes of Russian speakers with this
pattern (tag from the standard enum; ru = one line with a wrong→right mini example).
youglish_query: 2-4 English words capturing the pattern for a YouGlish search.
```

**GAPFILL_SYSTEM** (пайплайн):

```
You write drill sentences for skill "{TITLE}" (pattern: {PATTERN}, CEFR {LEVEL}).
Generate {N} pairs. Output ONLY valid JSON:
{"items":[{"ru":"","en_main":"","en_accepted":[""],"sub":""}]}
Constraints: everyday topics (home, work, food, travel, plans, feelings, small talk);
vocabulary strictly within CEFR {LEVEL}; 4-12 words; no verb lemma used twice; natural
idiomatic Russian; en_accepted = 1-3 alternatives; follow this sub-type mix: {MIX}.
```

---

## §9. Аудио: TTS, STT, listening, speaking

### 9.1 TTS (цепочка, от лучшего к запасному)

1. **kokoro-js** (основной): Apache-2.0, модель 82M, квантованная ~86 МБ, работает в браузере (WASM/WebGPU, transformers.js/ONNX), 11+ английских голосов US/UK, мужские/женские (подтв. 2026-07, §17.2). Ленивая загрузка: кнопка «Включить качественный голос» → скачивание модели с прогрессом → кэш в CacheStorage → офлайн навсегда. Названия голосов (`af_*`/`am_*` — US женск./мужск., `bf_*`/`bm_*` — UK) уточнить по model card на Ф5.
2. **Web Speech `speechSynthesis`** (мгновенный fallback): системные голоса, работает везде, качество зависит от ОС.
   - Лёгкая альтернатива Kokoro для слабых устройств: **KittenTTS** (15–80 МБ, Apache-2.0, статус developer preview) или Piper/sherpa-onnx WASM — решить на Ф5 по факту производительности, необязательно.
3. **Gemini TTS** (BYOK-опция, не обязателен).
4. **edge-tts прегенерация** (пайплайн, Ф9, опционально): библиотека жива (v7.2.8, 2026-03), голоса en-US-Jenny/Guy, en-GB-Sonia/Ryan; прегенерить только топ-предложения A1–A2 в opus, если рантайм-TTS окажется недостаточен. Неофициальный API — только офлайн-прегенерация, никогда в рантайме.

Настройки: акцент US/UK, пол, скорость 0.7/0.85/1.0, автоозвучка правильного ответа (default on).

### 9.2 Listening (2 режима)

- **Диктант**: слышу EN → печатаю EN. Проверка каскадом tier 1–2 + подсветка дифа по словам. До 3 повторов, регулировка скорости, без штрафов.
- **Понимание**: слышу EN → печатаю смысл по-русски. Проверка мягкая: нормализованное сравнение с `ru` + self-check кнопки (LLM не нужен).

Материал — те же паки (предложения пройденных навыков), отдельная сессия с экрана «Сегодня».

### 9.3 STT

- **Web Speech `SpeechRecognition`** — порядок попыток (Chrome 139+ умеет on-device, подтв. 2026-07-07):
  1) локально: `SpeechRecognition.available()` → при необходимости `install()` языкового пакета → `recognition.processLocally = true` (приватно, офлайн);
  2) обычный облачный Web Speech (Chrome/Edge, нужна сеть);
  3) без STT — shadowing с самооценкой (услышал → повторил вслух → сам отметил).
  Язык en-US/en-GB по настройке акцента.
- BYOK-апгрейды: MediaRecorder → **Groq Whisper** через `proxy/` (free 2000 RPD) или аудио в Gemini → транскрипт + краткая оценка произношения.
- Тяжёлый офлайн-вариант (Whisper WASM / Transformers.js) — бэклог, в основные фазы не входит.

### 9.4 Speaking (не основной режим; юзер выбирает голос или текст)

- **Перевод вслух**: RU на экране → говорю EN → STT-транскрипт → тот же каскад проверки → диф.
- **Shadowing**: слышу эталон (TTS) → повторяю → STT-диф подсвечивает расхождения по словам.
- Голосовой раунд в конце обычного дрилла (§3.3 п.7) — те же предложения, что уже написал.

---

## §10. Интервальные повторения (FSRS)

### 10.1 Карточки на НАВЫК, не на предложение

Ключевое решение: FSRS-карточка = навык. Повторение навыка тянет 6–10 **свежих или давно не виданных** предложений этого навыка — тренируется перенос паттерна, а не заучивание конкретной фразы. `ts-fsrs` v5, desired retention 0.9, дефолтные параметры FSRS-6.

### 10.2 Оценка сессии → рейтинг FSRS

| Точность сессии по навыку | Rating |
|---|---|
| < 60% | Again |
| 60–79% | Hard |
| 80–92% | Good |
| > 92% | Easy |

### 10.3 Пиявки (leeches)

Предложение, зафейленное ≥2 раз в разных сессиях → личная FSRS-карточка (оценка по факту ответа: fail=Again, с подсказкой=Hard, чисто=Good). Пиявки показываются в разминке и review-сессиях, пока не выйдут в стабильность >30 дней.

### 10.4 Охота на ошибки

`errorProfile` держит счётчики тегов за 30 дней. Режим «Охота на ошибки»: топ-3 тега → карта tag→skills (статическая таблица в коде: `article → [a1_articles_basic]`, `aux_missing → [a1_do_questions, a1_does_questions, a2_did_questions_neg]`, `verb_tense → [b1_pres_perf_vs_past, a2_past_simple_*]`, …) → сессия из этих навыков + при наличии ключа 5 персональных предложений от generator с `WEAK_TAGS`.

### 10.5 Дневной план (экран «Сегодня»)

1. Due-навыки по FSRS (максимум 3 review-сессии).
2. Пиявки (вплетаются в разминки).
3. Новый материал текущего модуля.
4. Предложение «охоты», если какой-то тег > порога.

---

## §11. Placement, скипы, экзамены (всё детерминировано, без LLM)

### 11.1 Placement (~10 мин, ≤25 предложений)

Адаптивная лестница по probe-предложениям (§3.2): старт на A2 → ступень = 5 предложений уровня (probe разных модулей) → ≥4 верно = вверх, ≤2 = вниз, 3 = зона найдена; повторное посещение ступени завершает тест. Результат: рекомендуемый стартовый модуль; всё ниже — `passed(auto)`, модули найденного уровня размечаются по 2 probe (2/2 → passed). Экран результата честный: «Похоже на B1. Начнём с М B1-1, но карта открыта — решаешь ты».

### 11.2 Скип-тест модуля (в любой момент)

8 предложений модуля (probe + difficulty 4–5), без подсказок; ≥7 → модуль `passed`. «Знал, но подзабыл» → быстро прошёл лестницу скипов и оказался на своём фронтире.

### 11.3 Экзамен модуля

16 предложений всех навыков модуля, без подсказок, одна попытка на предложение; pass ≥80%. Fail → показывается разбор ошибок по тегам + рекомендация «повторить навыки X, Y», retry через 4 часа.

### 11.4 Экзамен уровня

30 предложений (все модули, взвешенно по слабым) + 6 listening-диктантов. Pass: ≥80% общий и ≥4/6 listening. Финальный экран-«сертификат» (canvas-картинка «A2 закрыт», сохраняется в галерею) — маленький праздник, нулевая инфраструктура.

---

## §12. UX и мотивация

- **Мобайл-first**, тёмная+светлая тема, минимализм, крупная типографика, всё управляется с клавиатуры на десктопе.
- **Время до первого предложения < 60 секунд** с первого захода (онбординг не мучает).
- **Streak** (дни с ≥1 сессией), **дневная цель** (default 30 предложений), **XP+combo** за серии верных ответов, **карта-«метро»** прогресса уровня, экзамен = «босс», бейджи (модуль/уровень/1000 предложений/7-дневный streak).
- Праздновать сдержанно (конфетти только на экзаменах), никаких дарк-паттернов, пуш-спама и «заплати за жизнь». Опциональные локальные PWA-уведомления «пора позаниматься» (opt-in).
- Тон UI: короткий, дружелюбный, на «ты», без канцелярита и без сюсюканья.
- Под каждым LLM-разбором — мелкий дисклеймер «ИИ может ошибаться, перепроверяй» (как у English Dog).
- А11у: focus-visible, контрасты, reduced-motion.

---

## §13. Внешние интеграции

### 13.1 YouGlish (произношение в живой речи)

Официальный Widget/JS API, бесплатен для некоммерческого образования (подтв. 2026-07; лимиты free-тира не документированы). Интеграция: на экране навыка кнопка «Послушать в живой речи» → по клику монтируется виджет с `youglish_query` навыка и фильтром акцента (US/UK из настроек). Только по клику (не автозагрузка — бережём квоту), в sandbox-iframe; при ошибке квоты блок скрывается до завтра.

### 13.2 Reverso Context (контекстные переводы)

Официального API нет — только deep link в новой вкладке: `https://context.reverso.net/translation/english-russian/{phrase}`. Кнопка на фидбеке ответа («посмотреть употребление») и на экране навыка. Глубже не интегрировать.

### 13.3 LanguageTool self-hosted (опция для продвинутых)

`docker run -d -p 8010:8010 erikvl87/languagetool` → в настройках URL `http://localhost:8010`. Используется: (а) tier 2.5 каскада §7.2; (б) валидация gapfill в пайплайне. Публичный API languagetool.org НЕ использовать (запрет автоматических запросов, 20 req/min).

### 13.4 ReadLang — не интегрируем

Публичного API нет. Собственный мини-модуль чтения (клик-перевод по своим пакам) — backlog после Ф9.

---

## §14. Хостинг, PWA, приватность

1. **Хостинг**: GitHub Pages или Cloudflare Pages (оба бесплатны; выбрать на Ф8 — критерий: простота CI-деплоя из Actions). Всё статика: app build + `packs/`.
2. **PWA**: precache — shell и `packs/index.json`; runtime-cache — паки; кнопка «Скачать весь курс» (+ модель kokoro в CacheStorage). Полный офлайн, кроме LLM/STT/YouGlish.
3. **Ключи**: только localStorage, никуда не отправляются кроме самого провайдера. Экран настроек с честным предупреждением: «ключ живёт в этом браузере; используй ключ без привязанного биллинга». CSP: `default-src 'self'` + разрешённые хосты провайдеров + YouGlish iframe. Никакой телеметрии/аналитики.
4. **Страница «Данные и лицензии»** (обязательная, CC-BY): Tatoeba (CC-BY 2.0 FR), поимённая атрибуция авторов предложений (поле attribution — агрегированный список), Kokoro (Apache-2.0), прочие зависимости.
5. **Бэкап**: экспорт/импорт всей Dexie в JSON-файл — защита от потери IndexedDB.

---

## §15. Тестирование и quality gates

| Слой | Инструмент | Что покрываем |
|---|---|---|
| Checker/normalizer | Vitest, табличные тесты **≥120 кейсов** | контракции и ветвление `'s/'d`, BrE/AmE, цифры↔слова, «опечатка vs морфология» (`work/works` — НЕ опечатка), артикли/предлоги → error, кэш-хиты |
| Drill engine | Vitest | очередь, interleave, requeue, hint ladder, REWRITE-цикл (ответ скрыт → поле пусто → успех) |
| SRS | Vitest + fake timers | маппинг рейтингов, due-логика, пиявки |
| LLM-контракты | Vitest + zod + записанные фикстуры | валидные/битые JSON judge/generator, retry-ветка |
| E2E | Playwright | смоук: онбординг → дрилл → ошибка → разбор → REWRITE → финал; офлайн-режим |
| Пайплайн | pytest, golden-тесты | правила теггера (фикстуры на каждый навык), clean-фильтры, level-пороги, `etr validate` |
| CI | GitHub Actions | eslint+prettier, tsc, vitest, playwright (смоук), ruff+mypy+pytest, `etr validate`, build |

Правило: любой баг чекера → сначала кейс в таблицу тестов, потом фикс.

---

## §16. Роадмап (фаза = сессия Codex)

- [ ] **Ф0. Каркас.** Монорепо §5.1; `app/` (Vite+React+TS+Tailwind+Zustand+Dexie+router, пустые экраны §5.4, тёмная/светлая тема); `pipeline/` (uv-проект, typer CLI `etr` со стабами команд §4.2); CI §15. *AC: `npm run dev` показывает шелл с навигацией; `uv run etr --help` перечисляет команды; CI зелёный.*
- [ ] **Ф1. Пайплайн MVP → паки A1.** `fetch/clean/tag(rules)/level/curate/emit/validate` для модулей A1-1, A1-2 (10 навыков) на manythings-корпусе, без LLM. Golden-тесты правил. *AC: `etr validate` зелёный; в PR — 30 случайных предложений на ручную проверку; `packs/index.json` корректен.*
- [ ] **Ф2. Ядро дрилла.** Session engine §6, экран дрилла, каскад проверки tier 1–2 (§7), прогресс в Dexie, карта курса, загрузка паков. *AC: модуль A1-1 проходится целиком офлайн; vitest checker ≥120 кейсов зелёный; время до первого предложения <60 с.*
- [ ] **Ф3. AI-слой.** Адаптеры Gemini/OpenRouter/Ollama (+proxy для Groq), настройки ключей и роутинга §8, judge (tier 3) + acceptedCache + бюджеты + self-check (tier 4), репетитор §8.5: 4 действия («Ошибки»/«Разбор»/«Варианты»/«Нюансы») с кэшем + чат. *AC: с ключом неверный ответ получает вердикт ≤8 с, повтор того же ответа бьёт в кэш без вызова; повторный клик «Варианты» на том же предложении не тратит вызов; без ключа всё работает через tier 4.*
- [ ] **Ф4. SRS.** ts-fsrs, карточки навыков, пиявки, review-сессии, errorProfile + «охота на ошибки» §10, экран «Сегодня». *AC: due-логика покрыта тестами с fake timers; review мешает ≥2 навыка.*
- [ ] **Ф5. Аудио + listening.** kokoro-js (ленивая загрузка, выбор голоса US/UK м/ж, скорость), Web Speech fallback, автоозвучка; listening-сессии §9.2. *AC: диктант играется; после кэширования модели TTS работает офлайн; переключение голосов живое.*
- [ ] **Ф6. Полный курс A1–B1 + экзамены.** LLM-пасс теггера, theory_gen, gapfill дефицита (§4.4–4.7); placement §11.1, скип-тесты, экзамены модулей/уровней. *AC: placement ≤25 предложений выдаёт карту; экзамены гейтят прогресс; `etr validate` зелёный на всех паках A1–B1.*
- [ ] **Ф7. Speaking + интеграции.** Голосовой ввод §9.3–9.4, YouGlish-виджет, Reverso-ссылки, LanguageTool-тумблер §13. *AC: перевод вслух работает в Chrome; YouGlish открывается с query навыка по клику.*
- [ ] **Ф8. Полировка + деплой.** Геймификация §12, PWA-офлайн §14, экспорт/импорт бэкапа, страница лицензий, README+BYOK-гайд §18, деплой на Pages, AI-урок по запросу §8.4. *AC: приложение устанавливается как PWA; свежее устройство проходит путь целиком; деплой по пушу в main.*
- [ ] **Ф9. B2–C1 + опции.** Паки B2/C1 (gapfill-heavy), опциональная прегенерация аудио edge-tts, бэклог: reading-модуль, Capacitor-обёртка, импорт своего списка предложений, тематические сборники поверх тегов (предлоги / фразовые / разговорник), доп. навыки (числительные, словообразование/суффиксы).

**Шаблон промпта для сессии Codex:**

```
Read PLAN.md §0 and §16, then implement Phase N exactly as specified, consulting the
sections referenced by that phase. Do not implement future phases. Code/commits in
English, UI in Russian, short conventional commits. Facts marked ⚠️VERIFY: check §17.2
first; if stale or missing — stop and ask the user to run the matching query from §17.3.
When done: run the phase's acceptance checks, tick the checkbox in §16, append a 3-5 line
session log at the bottom of PLAN.md.
```

Первая команда юзера Codex'у: `Read PLAN.md §0 and §16, then implement Phase 0 …` (по шаблону).

---

## §17. Риски, проверенные факты, запросы для ресёрча

### 17.1 Риски

| Риск | Митигация |
|---|---|
| Gemini free tier изменится | лимиты только в конфиге/настройках; каскад §7 деградирует изящно; Groq/Ollama как фолбэки |
| CORS у Groq/OpenRouter из браузера | `proxy/` однофайловый; Gemini-only покрывает 100% функций |
| kokoro-js тормозит на слабом телефоне | fallback Web Speech всегда доступен; модель грузится только по явному желанию |
| edge-tts неофициальный, может сломаться | только офлайн-прегенерация (Ф9, опция), рантайм не зависит |
| Web Speech STT только Chrome+сеть | speaking — опциональный режим; self-rate fallback |
| Скос Tatoeba (Tom/Mary, странные фразы) | квоты имён §4.3, curate §4.6, кнопка «плохое предложение» → blacklist → пайплайн |
| YouGlish лимиты не документированы | загрузка виджета только по клику; авто-скрытие блока при ошибках |
| Oxford-списки под копирайтом | дефолт — открытый wordfreq; Oxford CSV только как локальный файл юзера, не в репо |
| Потеря IndexedDB | экспорт/импорт бэкапа JSON §14.5 |
| Ключ в localStorage | предупреждение в UI, CSP, «ключ без биллинга», никакого стороннего JS кроме YouGlish-iframe |

### 17.2 Проверенные факты (2026-07-07)

| Факт | Значение | Источник |
|---|---|---|
| Gemini free tier | есть, не отменён: бесплатны gemini-3.5-flash, gemini-3.1-flash-lite, 2.5-flash/lite (3.1-pro-preview — нет); статичных RPD в доках больше нет — смотреть AI Studio → «View your active rate limits»; reset в полночь PT | ai.google.dev/gemini-api/docs/pricing (2026-07-07) |
| `@google/genai` в браузере | работает с API-ключом; Google предупреждает про ключ на клиенте (для BYOK ок); встречаются CORS/503 инциденты → ретраи в адаптере | ai.google.dev/gemini-api/docs/libraries |
| kokoro-js | v1.2.1, Apache-2.0, 82M (~86 МБ квант.), WASM/WebGPU, экосистема живая (13.5M скачиваний модели/мес, топ-5 open TTS); лёгкая запаска — KittenTTS (preview), Piper WASM | github.com/hexgrad/kokoro (2026-07-07) |
| edge-tts | v7.2.8 (2026-03-22), работает; SSML урезан Microsoft'ом | pypi.org/project/edge-tts |
| ts-fsrs | v5.4.1, FSRS-6, Node ≥20, поддерживается; лучшей замены нет, SM-2 не брать; параметр-оптимизация — отдельный backend-binding, нам не нужен | open-spaced-repetition.github.io/ts-fsrs (2026-07-07) |
| Tatoeba exports | работает (System operational), sentences / links / tags / CC0-subset, TSV, обновление по субботам 06:30 UTC; CC-BY 2.0 FR + CC0-подмножество | tatoeba.org/en/downloads (2026-07-07) |
| manythings rus-eng | доступен (страница обновлена 2026-02-13), **536 124** пары, TSV; качать с браузерным User-Agent (406 «голым» клиентам) | manythings.org/anki (2026-07-07) |
| YouGlish | Widget/JS API бесплатны для некоммерч. образования; лимиты не опубликованы | youglish.com/api/doc/widget |
| Groq free | план Free $0, лимиты по моделям на организацию: llama-3.1-8b-instant **14 400 RPD**/30 RPM/6K TPM; 70B/qwen/gpt-oss ~1000 RPD; **whisper-large-v3 2000 RPD** (STT); точные цифры — Console → Limits и x-ratelimit-заголовки | console.groq.com/docs/rate-limits (2026-07-07) |
| OpenRouter free | :free модели живы; **50 RPD** без пополнения (20 RPM), 1000 RPD после разового пополнения $10; failed-попытки тоже считаются; CORS ⚠️ проверить на Ф3 | openrouter.ai/pricing (2026-07-07) |
| Web Speech STT | бесплатно, без ключей; Chrome 139+ умеет **on-device**: `available()`/`install()` + `processLocally=true`; облачный режим — fallback; Firefox не поддерживает | developer.chrome.com/blog/new-in-chrome-139 (2026-07-07) |
| LanguageTool self-host | образ `erikvl87/languagetool`, порт 8010 | hub.docker.com/r/erikvl87/languagetool |

### 17.3 Готовые запросы для твоего ресёрч-ИИ

Копируй запрос целиком в бесплатный ИИ с поиском, результат неси в сессию Codex соответствующей фазы (или просто обнови таблицу §17.2).

**Статус 2026-07-07:** юзер прогнал проверки — Gemini/Groq/OpenRouter лимиты, kokoro-js, Tatoeba/manythings, ts-fsrs, Web Speech внесены в §17.2. **Осталось до соответствующих фаз:** №1 (CORS Groq/OpenRouter — до Ф3), точный список имён голосов kokoro (до Ф5), №6–№10 — по мере надобности.

1. **(Ф3, CORS)** `Проверь на июль 2026: разрешает ли api.groq.com CORS-запросы напрямую из браузера с API-ключом (groq-sdk dangerouslyAllowBrowser)? А openrouter.ai/api/v1 — можно ли делать fetch прямо из браузера? Дай ссылки на официальные доки/обсуждения.`
2. **(Ф3, Gemini)** `Актуальные лимиты бесплатного тира Gemini API на сегодня: какие модели бесплатны, RPM/RPD для flash и flash-lite. Официальная страница ai.google.dev/gemini-api/docs/rate-limits. Плюс: работает ли @google/genai из браузера без прокси?`
3. **(Ф5, TTS)** `Пакет kokoro-js (hexgrad/kokoro): последняя версия, точный список английских голосов (af_/am_/bf_/bm_), размер квантованной модели, пример инициализации в браузере через WebGPU, производительность на среднем Android.`
4. **(Ф5, голоса)** `Web Speech API SpeechSynthesis и SpeechRecognition в 2026: поддержка браузеров, работает ли распознавание офлайн/на устройстве в Chrome Android, какие ограничения.`
5. **(Ф1, данные)** `Точный формат файлов Tatoeba: sentences.tar.bz2 и links.tar.bz2 — колонки, кодировка, как собрать все английские переводы одного русского предложения. И формат rus.txt из manythings.org/anki/rus-eng.zip.`
6. **(Ф6, LLM-разметка)** `Лучшие практики батч-классификации коротких текстов через Gemini Flash-Lite в JSON-режиме 2026: structured output, temperature, сколько предложений класть в один запрос, как обрабатывать отказы парсинга.`
7. **(Ф7, YouGlish)** `YouGlish widget/JS API 2026: условия бесплатного использования для некоммерческого образовательного сайта, есть ли дневные лимиты запросов виджета, как задать accent filter US/UK программно.`
8. **(Ф8, хостинг)** `GitHub Pages vs Cloudflare Pages в 2026 для PWA со статическими JSON-файлами: лимиты размера/трафика, поддержка service worker, деплой из GitHub Actions — что проще и надёжнее.`
9. **(Ф9, прегенерация)** `edge-tts python в 2026: стабильность, троттлинг при массовой генерации, лучшие нейронные голоса en-US и en-GB, женские и мужские, для учебной озвучки коротких фраз.`
10. **(Ф2, методика проверки)** `Как учебные приложения-переводчики (English Dog, Clozemaster, Speakly) принимают альтернативные правильные переводы: список accepted answers, нормализация, что считают опечаткой. Примеры и обсуждения.`

---

## §18. README.md — каркас (пишется на Ф8)

1. **Что это** (1 абзац + GIF) и ссылка на живое приложение.
2. **Быстрый старт юзера**: открыть сайт → placement → заниматься. Без ключа работает всё, кроме ИИ-репетитора.
3. **BYOK-гайд**:
   - Gemini: aistudio.google.com → Get API key → вставить в Настройки. Где смотреть свои лимиты (страница rate limits в AI Studio). Рекомендация: ключ без привязанного биллинга.
   - Groq / OpenRouter (опционально): где взять ключ; когда нужен `node proxy/serve.mjs`.
   - Ollama (опционально): `ollama serve` + модель, URL в настройках.
   - Приватность: ключ хранится только в браузере.
4. **LanguageTool self-host** (опционально): `docker run -d -p 8010:8010 erikvl87/languagetool` + тумблер в настройках.
5. **Разработка**: `npm i && npm run dev`; пайплайн: `uv sync && uv run etr --help`; как пересобрать паки; как добавить навык (§3.4 → rules.py → квоты).
6. **Данные и лицензии**: Tatoeba CC-BY, Kokoro Apache-2.0, дисклеймер «не замена преподавателю».

---

## Журнал сессий

> Codex: после каждой фазы добавляй сюда 3–5 строк: дата, фаза, что сделано, отклонения от плана, что заметил.

*(пусто — реализация не начата)*


