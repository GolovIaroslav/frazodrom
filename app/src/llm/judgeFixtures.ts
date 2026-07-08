// PLAN.md §7.5 — 60-100 hand-labeled judge cases ("user answer -> expected
// verdict"), covering articles, prepositions, "pattern avoided", BrE/AmE,
// and minor-vs-wrong. These serve two purposes:
//   1. Fixtures for a live accuracy run against real candidate models
//      (§7.5's mini-benchmark) — NOT run in this sandbox, see BLOCKERS.md.
//   2. Vitest data for the zod contract + tier-3/4 cascade wiring, against a
//      mocked provider standing in for a real model (see judge.test.ts).
//
// `expected` is this project's hand-labeled ground truth, not a live model's
// output — do not treat a mocked-provider "100% match" as a real benchmark
// result.

import type { JudgeVerdict } from './judge';

export type JudgeFixtureCategory =
  | 'article'
  | 'preposition'
  | 'pattern_avoided'
  | 'bre_ame'
  | 'minor_vs_wrong'
  | 'other';

export interface JudgeFixtureCase {
  id: string;
  category: JudgeFixtureCategory;
  ru: string;
  userAnswer: string;
  refs: string[];
  pattern: string;
  level: string;
  expected: JudgeVerdict['verdict'];
  expectedAddToAccepted: boolean;
}

export const judgeFixtures: JudgeFixtureCase[] = [
  // --- articles (15) ---
  { id: 'art-01', category: 'article', ru: 'Я вижу кошку.', userAnswer: 'I see cat.', refs: ['I see a cat.'], pattern: 'a/an — indefinite article', level: 'A1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'art-02', category: 'article', ru: 'Она учительница.', userAnswer: 'She is teacher.', refs: ['She is a teacher.'], pattern: 'a/an — profession', level: 'A1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'art-03', category: 'article', ru: 'Солнце светит ярко.', userAnswer: 'Sun is shining brightly.', refs: ['The sun is shining brightly.'], pattern: 'the — unique reference', level: 'A2', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'art-04', category: 'article', ru: 'У меня есть машина.', userAnswer: 'I have a car.', refs: ['I have a car.'], pattern: 'a/an — indefinite article', level: 'A1', expected: 'correct', expectedAddToAccepted: true },
  { id: 'art-05', category: 'article', ru: 'Книга на столе.', userAnswer: 'The book is on table.', refs: ['The book is on the table.'], pattern: 'the — definite article', level: 'A1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'art-06', category: 'article', ru: 'Он врач.', userAnswer: 'He is a doctor.', refs: ['He is a doctor.'], pattern: 'a/an — profession', level: 'A1', expected: 'correct', expectedAddToAccepted: true },
  { id: 'art-07', category: 'article', ru: 'Дай мне яблоко.', userAnswer: 'Give me apple.', refs: ['Give me an apple.'], pattern: 'a/an before vowel sound', level: 'A1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'art-08', category: 'article', ru: 'Это лучший день в моей жизни.', userAnswer: 'This is best day of my life.', refs: ['This is the best day of my life.'], pattern: 'the — superlative', level: 'A2', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'art-09', category: 'article', ru: 'Дети играют в парке.', userAnswer: 'The children are playing in the park.', refs: ['Children are playing in the park.'], pattern: 'zero article — plural generic', level: 'A2', expected: 'acceptable', expectedAddToAccepted: false },
  { id: 'art-10', category: 'article', ru: 'Я люблю музыку.', userAnswer: 'I love the music.', refs: ['I love music.'], pattern: 'zero article — uncountable', level: 'A2', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'art-11', category: 'article', ru: 'Она пошла в школу.', userAnswer: 'She went to a school.', refs: ['She went to school.'], pattern: 'zero article — institution', level: 'A2', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'art-12', category: 'article', ru: 'Собака — верный друг.', userAnswer: 'A dog is a loyal friend.', refs: ['A dog is a loyal friend.', 'The dog is a loyal friend.'], pattern: 'a/an — generic reference', level: 'B1', expected: 'correct', expectedAddToAccepted: true },
  { id: 'art-13', category: 'article', ru: 'У неё есть идея.', userAnswer: 'She has idea.', refs: ['She has an idea.'], pattern: 'a/an — indefinite article', level: 'A1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'art-14', category: 'article', ru: 'Это единственный выход.', userAnswer: 'This is only way out.', refs: ['This is the only way out.'], pattern: 'the — only/superlative-like', level: 'B1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'art-15', category: 'article', ru: 'Я родился в маленьком городе.', userAnswer: 'I was born in a small town.', refs: ['I was born in a small town.'], pattern: 'a/an — indefinite article', level: 'A2', expected: 'correct', expectedAddToAccepted: true },

  // --- prepositions (15) ---
  { id: 'prep-01', category: 'preposition', ru: 'Встретимся в понедельник.', userAnswer: "Let's meet in Monday.", refs: ["Let's meet on Monday."], pattern: 'preposition + day of week', level: 'A1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'prep-02', category: 'preposition', ru: 'Я живу в этой улице.', userAnswer: 'I live in this street.', refs: ['I live on this street.'], pattern: 'preposition + street', level: 'A2', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'prep-03', category: 'preposition', ru: 'Она хороша в математике.', userAnswer: 'She is good in math.', refs: ['She is good at math.'], pattern: 'good at + skill', level: 'A2', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'prep-04', category: 'preposition', ru: 'Мы приехали на автобусе.', userAnswer: 'We arrived by bus.', refs: ['We arrived by bus.'], pattern: 'by + transport', level: 'A2', expected: 'correct', expectedAddToAccepted: true },
  { id: 'prep-05', category: 'preposition', ru: 'Он думает о будущем.', userAnswer: 'He thinks about the future.', refs: ['He thinks about the future.'], pattern: 'think about', level: 'A2', expected: 'correct', expectedAddToAccepted: true },
  { id: 'prep-06', category: 'preposition', ru: 'Зависит от погоды.', userAnswer: 'It depends of the weather.', refs: ['It depends on the weather.'], pattern: 'depend on', level: 'B1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'prep-07', category: 'preposition', ru: 'Я боюсь пауков.', userAnswer: 'I am afraid from spiders.', refs: ['I am afraid of spiders.'], pattern: 'afraid of', level: 'A2', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'prep-08', category: 'preposition', ru: 'Она вышла замуж за врача.', userAnswer: 'She married with a doctor.', refs: ['She married a doctor.'], pattern: 'marry (no preposition)', level: 'B1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'prep-09', category: 'preposition', ru: 'Спасибо за помощь.', userAnswer: 'Thanks for the help.', refs: ['Thanks for the help.', 'Thank you for your help.'], pattern: 'thanks for', level: 'A1', expected: 'correct', expectedAddToAccepted: true },
  { id: 'prep-10', category: 'preposition', ru: 'Мы прибыли в аэропорт вовремя.', userAnswer: 'We arrived to the airport on time.', refs: ['We arrived at the airport on time.'], pattern: 'arrive at/in', level: 'A2', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'prep-11', category: 'preposition', ru: 'Она интересуется искусством.', userAnswer: 'She is interested on art.', refs: ['She is interested in art.'], pattern: 'interested in', level: 'A2', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'prep-12', category: 'preposition', ru: 'Поезд отходит в 9 утра.', userAnswer: 'The train leaves at 9 am.', refs: ['The train leaves at 9 am.'], pattern: 'at + clock time', level: 'A1', expected: 'correct', expectedAddToAccepted: true },
  { id: 'prep-13', category: 'preposition', ru: 'Он женат на актрисе.', userAnswer: 'He is married with an actress.', refs: ['He is married to an actress.'], pattern: 'married to', level: 'B1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'prep-14', category: 'preposition', ru: 'Мы обсудили это по телефону.', userAnswer: 'We discussed it on the phone.', refs: ['We discussed it on the phone.'], pattern: 'on the phone', level: 'A2', expected: 'correct', expectedAddToAccepted: true },
  { id: 'prep-15', category: 'preposition', ru: 'Она пожаловалась на шум.', userAnswer: 'She complained about the noise.', refs: ['She complained about the noise.'], pattern: 'complain about', level: 'B1', expected: 'correct', expectedAddToAccepted: true },

  // --- pattern avoided — correct English, wrong/paraphrased pattern (10) ---
  { id: 'pat-01', category: 'pattern_avoided', ru: 'Она читает книгу уже два часа.', userAnswer: 'She started reading a book two hours ago.', refs: ['She has been reading a book for two hours.'], pattern: 'present perfect continuous', level: 'B1', expected: 'acceptable', expectedAddToAccepted: false },
  { id: 'pat-02', category: 'pattern_avoided', ru: 'Если бы я был богат, я бы путешествовал.', userAnswer: 'I don’t have money, so I can’t travel.', refs: ['If I were rich, I would travel.'], pattern: 'second conditional', level: 'B1', expected: 'acceptable', expectedAddToAccepted: false },
  { id: 'pat-03', category: 'pattern_avoided', ru: 'К моменту, когда мы пришли, фильм уже начался.', userAnswer: 'The movie started before we arrived.', refs: ['By the time we arrived, the movie had already started.'], pattern: 'past perfect', level: 'B1', expected: 'acceptable', expectedAddToAccepted: false },
  { id: 'pat-04', category: 'pattern_avoided', ru: 'Дом строится рабочими.', userAnswer: 'Workers are building the house.', refs: ['The house is being built by workers.'], pattern: 'passive voice', level: 'B1', expected: 'acceptable', expectedAddToAccepted: false },
  { id: 'pat-05', category: 'pattern_avoided', ru: 'Я бы хотел, чтобы ты пришёл раньше.', userAnswer: 'You should have come earlier.', refs: ['I wish you had come earlier.'], pattern: 'I wish + past perfect', level: 'B2', expected: 'acceptable', expectedAddToAccepted: false },
  { id: 'pat-06', category: 'pattern_avoided', ru: 'Он, должно быть, забыл о встрече.', userAnswer: 'Maybe he forgot about the meeting.', refs: ['He must have forgotten about the meeting.'], pattern: 'modal perfect (must have)', level: 'B2', expected: 'acceptable', expectedAddToAccepted: false },
  { id: 'pat-07', category: 'pattern_avoided', ru: 'Я привык рано вставать.', userAnswer: 'I always wake up early, it is normal for me.', refs: ["I am used to waking up early."], pattern: 'be used to + gerund', level: 'B1', expected: 'acceptable', expectedAddToAccepted: false },
  { id: 'pat-08', category: 'pattern_avoided', ru: 'Ей нужно было позвонить, но она забыла.', userAnswer: 'She forgot to call.', refs: ['She was supposed to call, but she forgot.'], pattern: 'be supposed to', level: 'B1', expected: 'acceptable', expectedAddToAccepted: false },
  { id: 'pat-09', category: 'pattern_avoided', ru: 'Чем больше он ест, тем толще становится.', userAnswer: 'He eats a lot, so he gets fatter.', refs: ['The more he eats, the fatter he gets.'], pattern: 'the more..., the more...', level: 'B2', expected: 'acceptable', expectedAddToAccepted: false },
  { id: 'pat-10', category: 'pattern_avoided', ru: 'Не будь дождя, мы бы пошли гулять.', userAnswer: "It's raining, so we can't go for a walk.", refs: ['If it weren’t raining, we would go for a walk.'], pattern: 'second conditional', level: 'B1', expected: 'acceptable', expectedAddToAccepted: false },

  // --- BrE/AmE (10) ---
  { id: 'bre-01', category: 'bre_ame', ru: 'Какой у тебя любимый цвет?', userAnswer: 'What is your favourite colour?', refs: ['What is your favorite color?'], pattern: 'possessive question', level: 'A1', expected: 'correct', expectedAddToAccepted: true },
  { id: 'bre-02', category: 'bre_ame', ru: 'Центр города очень красивый.', userAnswer: 'The city centre is very beautiful.', refs: ['The city center is very beautiful.'], pattern: 'noun + adjective', level: 'A2', expected: 'correct', expectedAddToAccepted: true },
  { id: 'bre-03', category: 'bre_ame', ru: 'Она изучала литературу в университете.', userAnswer: 'She studied literature at university.', refs: ['She studied literature in college.'], pattern: 'past simple', level: 'B1', expected: 'correct', expectedAddToAccepted: true },
  { id: 'bre-04', category: 'bre_ame', ru: 'Мы организовали вечеринку.', userAnswer: 'We organised a party.', refs: ['We organized a party.'], pattern: 'past simple -ise/-ize', level: 'A2', expected: 'correct', expectedAddToAccepted: true },
  { id: 'bre-05', category: 'bre_ame', ru: 'Небо стало серым.', userAnswer: 'The sky turned grey.', refs: ['The sky turned gray.'], pattern: 'colour adjective', level: 'A2', expected: 'correct', expectedAddToAccepted: true },
  { id: 'bre-06', category: 'bre_ame', ru: 'Мы много путешествовали в том году.', userAnswer: 'We were travelling a lot that year.', refs: ['We were traveling a lot that year.'], pattern: 'past continuous', level: 'B1', expected: 'correct', expectedAddToAccepted: true },
  { id: 'bre-07', category: 'bre_ame', ru: 'Он выучил стихотворение наизусть.', userAnswer: 'He learnt the poem by heart.', refs: ['He learned the poem by heart.'], pattern: 'past simple learn', level: 'B1', expected: 'correct', expectedAddToAccepted: true },
  { id: 'bre-08', category: 'bre_ame', ru: 'Она осознала свою ошибку.', userAnswer: 'She realised her mistake.', refs: ['She realized her mistake.'], pattern: 'past simple -ise/-ize', level: 'B1', expected: 'correct', expectedAddToAccepted: true },
  { id: 'bre-09', category: 'bre_ame', ru: 'Мой сосед очень дружелюбный.', userAnswer: 'My neighbour is very friendly.', refs: ['My neighbor is very friendly.'], pattern: 'noun + adjective', level: 'A2', expected: 'correct', expectedAddToAccepted: true },
  { id: 'bre-10', category: 'bre_ame', ru: 'Свеча сгорела дотла.', userAnswer: 'The candle burnt out completely.', refs: ['The candle burned out completely.'], pattern: 'past simple burn', level: 'B1', expected: 'correct', expectedAddToAccepted: true },

  // --- minor vs wrong (15) ---
  { id: 'mvw-01', category: 'minor_vs_wrong', ru: 'Вчера я пошёл в магазин.', userAnswer: 'Yesterday I go to the shop.', refs: ['Yesterday I went to the shop.'], pattern: 'past simple', level: 'A1', expected: 'wrong', expectedAddToAccepted: false },
  { id: 'mvw-02', category: 'minor_vs_wrong', ru: 'Она не любит кофе.', userAnswer: 'She no like coffee.', refs: ["She doesn't like coffee."], pattern: 'negation with auxiliary', level: 'A1', expected: 'wrong', expectedAddToAccepted: false },
  { id: 'mvw-03', category: 'minor_vs_wrong', ru: 'Ты видел мой телефон?', userAnswer: 'You seen my phone?', refs: ['Have you seen my phone?'], pattern: 'present perfect question (aux missing)', level: 'A2', expected: 'wrong', expectedAddToAccepted: false },
  { id: 'mvw-04', category: 'minor_vs_wrong', ru: 'Я хочу купить новую машину.', userAnswer: 'I want buy a new car.', refs: ['I want to buy a new car.'], pattern: 'want + to-infinitive', level: 'A1', expected: 'wrong', expectedAddToAccepted: false },
  { id: 'mvw-05', category: 'minor_vs_wrong', ru: 'Мои родители живут в деревне.', userAnswer: 'My parents lives in a village.', refs: ['My parents live in a village.'], pattern: 'subject-verb agreement', level: 'A1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'mvw-06', category: 'minor_vs_wrong', ru: 'Она готовит ужин каждый вечер.', userAnswer: 'She cook dinner every evening.', refs: ['She cooks dinner every evening.'], pattern: 'present simple 3rd person -s', level: 'A1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'mvw-07', category: 'minor_vs_wrong', ru: 'Мы уже поели.', userAnswer: 'We already eaten.', refs: ['We have already eaten.'], pattern: 'present perfect (aux missing)', level: 'A2', expected: 'wrong', expectedAddToAccepted: false },
  { id: 'mvw-08', category: 'minor_vs_wrong', ru: 'Он играет на гитаре очень хорошо.', userAnswer: 'He plays guitar very good.', refs: ['He plays the guitar very well.'], pattern: 'adverb vs adjective', level: 'A2', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'mvw-09', category: 'minor_vs_wrong', ru: 'Собака гналась за котом.', userAnswer: 'The dog chased for the cat.', refs: ['The dog chased the cat.'], pattern: 'transitive verb (extra word)', level: 'B1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'mvw-10', category: 'minor_vs_wrong', ru: 'Мне нравится читать книги.', userAnswer: 'Me like read books.', refs: ['I like reading books.'], pattern: 'pronoun + gerund', level: 'A1', expected: 'wrong', expectedAddToAccepted: false },
  { id: 'mvw-11', category: 'minor_vs_wrong', ru: 'Завтра будет дождь.', userAnswer: 'Tomorrow it will rains.', refs: ['Tomorrow it will rain.'], pattern: 'will + base verb', level: 'A1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'mvw-12', category: 'minor_vs_wrong', ru: 'Они переехали в другой город два года назад.', userAnswer: 'They move to another city two years ago.', refs: ['They moved to another city two years ago.'], pattern: 'past simple', level: 'A2', expected: 'wrong', expectedAddToAccepted: false },
  { id: 'mvw-13', category: 'minor_vs_wrong', ru: 'У неё нет братьев и сестёр.', userAnswer: 'She have no brothers or sisters.', refs: ['She has no brothers or sisters.'], pattern: 'subject-verb agreement', level: 'A1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'mvw-14', category: 'minor_vs_wrong', ru: 'Мы будем скучать по тебе.', userAnswer: 'We will miss for you.', refs: ['We will miss you.'], pattern: 'transitive verb (extra word)', level: 'A2', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'mvw-15', category: 'minor_vs_wrong', ru: 'Я никогда не был в Париже.', userAnswer: 'I never was in Paris.', refs: ["I have never been to Paris."], pattern: 'present perfect (verb form)', level: 'B1', expected: 'wrong', expectedAddToAccepted: false },

  // --- other (agreement/pronoun/vocab/word order/spelling — 5) ---
  { id: 'oth-01', category: 'other', ru: 'Каждый студент должен сдать работу.', userAnswer: 'Every students must submit their work.', refs: ['Every student must submit their work.'], pattern: 'every + singular noun', level: 'B1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'oth-02', category: 'other', ru: 'Она дала книгу мне.', userAnswer: 'She gave the book to I.', refs: ['She gave the book to me.'], pattern: 'object pronoun', level: 'A1', expected: 'minor_error', expectedAddToAccepted: false },
  { id: 'oth-03', category: 'other', ru: 'Я очень взволнован этой новостью.', userAnswer: 'I am very nervous about this news.', refs: ['I am very excited about this news.'], pattern: 'vocab choice — false friend', level: 'B1', expected: 'wrong', expectedAddToAccepted: false },
  { id: 'oth-04', category: 'other', ru: 'Куда ты идёшь сегодня вечером?', userAnswer: 'Where you are going tonight?', refs: ['Where are you going tonight?'], pattern: 'question word order', level: 'A1', expected: 'wrong', expectedAddToAccepted: false },
  { id: 'oth-05', category: 'other', ru: 'Она получила письмо вчера.', userAnswer: 'She recieved a letter yesterday.', refs: ['She received a letter yesterday.'], pattern: 'past simple (spelling)', level: 'A2', expected: 'minor_error', expectedAddToAccepted: false },
];
