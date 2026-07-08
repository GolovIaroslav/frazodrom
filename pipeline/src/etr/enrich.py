"""Enrich: theory_ru, common_errors, youglish_query (§4.8, §3.2).

Ф1 scope: hand-authored static metadata for the 11 A1-1/A1-2 skills, not
pipeline-generated. The normal design runs this through an LLM (§8.6),
but Ф1 is explicitly "без LLM" — so this content is written directly,
the same way it would be corrected during the manual proofreading pass
in Ф6 anyway. See implementation-notes.md.
"""

from __future__ import annotations

from typing import TypedDict


class CommonError(TypedDict):
    tag: str
    ru: str


class SkillMeta(TypedDict):
    module: str
    module_title_ru: str
    title_ru: str
    pattern: str
    theory_ru: str
    common_errors: list[CommonError]
    youglish_query: str


SKILL_META: dict[str, SkillMeta] = {
    "a1_be_affirm": {
        "module": "a1_m1",
        "module_title_ru": "Быть и указывать",
        "title_ru": "Глагол to be: I am / he is / they are",
        "pattern": "I am / he (she, it) is / we (you, they) are + …",
        "theory_ru": (
            "Глагол **to be** («быть») в настоящем времени меняется по лицам: **am** — с I, "
            "**is** — с he/she/it, **are** — с we/you/they. В отличие от русского, в английском "
            "предложении это слово нельзя пропустить: не ~I student~, а **I am a student**. "
            "После to be может идти существительное, прилагательное или место: **She is happy**, "
            "**They are at home**."
        ),
        "common_errors": [
            {"tag": "be_missing", "ru": "Пропуск глагола: ~I a student~ → I **am** a student."},
            {
                "tag": "be_wrong_form",
                "ru": "Не то лицо: ~He am~ / ~They is~ → He **is**, They **are**.",
            },
            {
                "tag": "ru_calc",
                "ru": "Калька с русского без глагола: ~She happy~ → She **is** happy.",
            },
        ],
        "youglish_query": "I am a student",
    },
    "a1_be_neg_quest": {
        "module": "a1_m1",
        "module_title_ru": "Быть и указывать",
        "title_ru": "to be: вопросы и отрицания",
        "pattern": "Am/Is/Are + подлежащее…? / подлежащее + am not / isn't / aren't …",
        "theory_ru": (
            "Чтобы задать вопрос с to be, глагол выходит на первое место: **Are you** at home? "
            "Для отрицания добавляется **not** сразу после глагола: **is not** = **isn't**, "
            "**are not** = **aren't** (для I обычно просто **I'm not**, форма ~amn't~ не "
            "используется). Никакого do/does здесь не нужно — это особенность именно to be."
        ),
        "common_errors": [
            {
                "tag": "do_support_extra",
                "ru": "Лишний do: ~Do you at home?~ → **Are** you at home?",
            },
            {"tag": "neg_missing_not", "ru": "Пропуск not: ~He isn~ → He **isn't**."},
            {"tag": "amnt", "ru": "Несуществующая форма ~amn't~ → **I'm not**."},
        ],
        "youglish_query": "are you at home",
    },
    "a1_pronouns_poss": {
        "module": "a1_m1",
        "module_title_ru": "Быть и указывать",
        "title_ru": "Притяжательные местоимения: my / your / his / her",
        "pattern": "my / your / his / her / its / our / their + существительное",
        "theory_ru": (
            "Притяжательные местоимения (**my, your, his, her, its, our, their**) стоят "
            "перед существительным и показывают, кому что принадлежит: **This is her book.** "
            "Важно не путать **his/her** (зависят от пола ВЛАДЕЛЬЦА, а не предмета) — "
            "это частая ошибка у русскоязычных, потому что в русском род определяется иначе."
        ),
        "common_errors": [
            {
                "tag": "his_her_confusion",
                "ru": "Путаница рода владельца: ~Her book~ о книге брата → **His** book.",
            },
            {
                "tag": "poss_pronoun_missing",
                "ru": "Пропуск местоимения: ~This is book~ → This is **her** book.",
            },
            {"tag": "its_apostrophe", "ru": "Its (притяж.) vs it's (= it is) — разные слова."},
        ],
        "youglish_query": "this is her book",
    },
    "a1_this_that": {
        "module": "a1_m1",
        "module_title_ru": "Быть и указывать",
        "title_ru": "this / that / these / those",
        "pattern": "this/that (ед. ч.) — these/those (мн. ч.)",
        "theory_ru": (
            "**This/these** — для близких предметов («этот/эти»), **that/those** — для "
            "далёких («тот/те»). Число существительного должно совпадать: **this book** "
            "(ед. ч.), но **these books** (мн. ч.) — нельзя сказать ~this books~."
        ),
        "common_errors": [
            {
                "tag": "number_mismatch",
                "ru": "Рассогласование числа: ~this books~ → **these** books.",
            },
            {
                "tag": "this_that_distance",
                "ru": "Путаница близко/далеко: про предмет вдалеке — **that**, не this.",
            },
            {
                "tag": "demonstrative_omitted",
                "ru": "Пропуск слова: ~Is my book~ (указывая на книгу) → **This** is my book.",
            },
        ],
        "youglish_query": "these are my friends",
    },
    "a1_there_is": {
        "module": "a1_m1",
        "module_title_ru": "Быть и указывать",
        "title_ru": "There is / There are",
        "pattern": "There is + сущ. в ед. ч. / There are + сущ. во мн. ч.",
        "theory_ru": (
            "**There is/are** используется, чтобы сказать о существовании чего-либо "
            "(«есть», «имеется») — в русском часто нет подлежащего вообще: «В комнате два "
            "окна» → **There are two windows in the room.** Число глагола зависит от "
            "существительного после него: **There is a book** (ед. ч.), **there are books** "
            "(мн. ч.)."
        ),
        "common_errors": [
            {
                "tag": "there_omitted",
                "ru": "Пропуск there (калька с русского): ~Is a book~ → **There is** a book.",
            },
            {
                "tag": "is_are_agreement",
                "ru": "Рассогласование: ~There is two windows~ → There **are** two windows.",
            },
            {
                "tag": "there_it_confusion",
                "ru": "Путаница there/it: ~It is a book on the table~ → **There is** a book…",
            },
        ],
        "youglish_query": "there are two windows",
    },
    "a1_pres_simple_i": {
        "module": "a1_m2",
        "module_title_ru": "Настоящее простое",
        "title_ru": "Present Simple: I / you / we / they + V1",
        "pattern": "I/you/we/they + глагол в форме словаря (V1)",
        "theory_ru": (
            "Present Simple описывает привычные действия и факты: **I live in this city.** "
            "С подлежащими I/you/we/they глагол берётся в базовой форме (как в словаре), "
            "без окончаний: **I work**, не ~I works~."
        ),
        "common_errors": [
            {"tag": "s_ending_extra", "ru": "Лишнее -s: ~I works~ → I **work**."},
            {
                "tag": "be_instead_of_verb",
                "ru": "Лишний am/is/are перед смысловым глаголом: ~I am live~ → I **live**.",
            },
            {
                "tag": "ing_instead_of_v1",
                "ru": "Форма -ing вместо простой: ~I working~ → I **work**.",
            },
        ],
        "youglish_query": "I live in this city",
    },
    "a1_pres_simple_3rd": {
        "module": "a1_m2",
        "module_title_ru": "Настоящее простое",
        "title_ru": "Present Simple: he / she + V-s",
        "pattern": "he/she/it + глагол + -s/-es",
        "theory_ru": (
            "С подлежащими he/she/it к глаголу в настоящем простом времени добавляется "
            "окончание **-s** (или **-es** после -s/-sh/-ch/-x/-o, и -y → -ies): "
            "**He works**, **She watches**, **He goes**. Это окончание легко забыть — "
            "самая частая ошибка русскоязычных в Present Simple."
        ),
        "common_errors": [
            {"tag": "s_ending_missing", "ru": "Пропуск -s: ~He work~ → He **works**."},
            {"tag": "es_ending", "ru": "Забыто -es: ~He go~ → He **goes**."},
            {"tag": "y_to_ies", "ru": "study → studies, а не ~studys~."},
        ],
        "youglish_query": "he works in an office",
    },
    "a1_do_questions": {
        "module": "a1_m2",
        "module_title_ru": "Настоящее простое",
        "title_ru": "Вопросы с Do you…?",
        "pattern": "Do + I/you/we/they + V1 …?",
        "theory_ru": (
            "Вопрос в Present Simple строится с помощью вспомогательного **do** — оно "
            "выходит на первое место, а смысловой глагол остаётся в базовой форме: "
            "**Do you often read?** (не ~Do you read often?~ как ~Read you often?~). "
            "Без do построить общий вопрос в этом времени нельзя."
        ),
        "common_errors": [
            {
                "tag": "do_missing",
                "ru": "Пропуск do: ~You read often?~ → **Do** you read often?",
            },
            {
                "tag": "verb_conjugated",
                "ru": "Лишнее окончание после do: ~Do you reads?~ → Do you **read**?",
            },
            {
                "tag": "word_order",
                "ru": "Порядок слов как в русском: ~You read often?~ → **Do** you read often?",
            },
        ],
        "youglish_query": "do you often read",
    },
    "a1_does_questions": {
        "module": "a1_m2",
        "module_title_ru": "Настоящее простое",
        "title_ru": "Вопросы с Does he/she…?",
        "pattern": "Does + he/she/it + V1 …?",
        "theory_ru": (
            "С he/she/it вопрос строится через **does**, а смысловой глагол теряет "
            "окончание -s, потому что does уже «взяло» его на себя: **Does she speak "
            "English?** (не ~Does she speaks?~)."
        ),
        "common_errors": [
            {
                "tag": "double_s",
                "ru": "Двойное окончание: ~Does she speaks?~ → Does she **speak**?",
            },
            {"tag": "do_instead_of_does", "ru": "~Do he speak?~ → **Does** he speak?"},
            {
                "tag": "word_order",
                "ru": (
                    "Порядок слов как в русском: ~She speaks English?~ → "
                    "**Does** she speak English?"
                ),
            },
        ],
        "youglish_query": "does she speak english",
    },
    "a1_dont_doesnt": {
        "module": "a1_m2",
        "module_title_ru": "Настоящее простое",
        "title_ru": "Отрицание: don't / doesn't",
        "pattern": "I/you/we/they + don't + V1; he/she/it + doesn't + V1",
        "theory_ru": (
            "Отрицание в Present Simple образуется с помощью **do not (don't)** для "
            "I/you/we/they и **does not (doesn't)** для he/she/it — глагол после них всегда "
            "в базовой форме: **I don't eat meat**, **She doesn't like coffee** (не ~doesn't "
            "likes~)."
        ),
        "common_errors": [
            {
                "tag": "double_negative_ending",
                "ru": "Окончание после doesn't: ~doesn't likes~ → doesn't **like**.",
            },
            {
                "tag": "dont_doesnt_confusion",
                "ru": "Путаница форм: ~She don't~ → She **doesn't**.",
            },
            {
                "tag": "no_instead_of_dont",
                "ru": "Русское «нет» дословно: ~I no eat meat~ → I **don't** eat meat.",
            },
        ],
        "youglish_query": "I don't eat meat",
    },
    "a1_freq_adverbs": {
        "module": "a1_m2",
        "module_title_ru": "Настоящее простое",
        "title_ru": "Наречия частотности: usually / never",
        "pattern": "подлежащее + always/usually/often/sometimes/rarely/never + V1",
        "theory_ru": (
            "Наречия частоты (**always, usually, often, sometimes, rarely, never**) обычно "
            "стоят ПЕРЕД смысловым глаголом, но ПОСЛЕ to be: **He usually gets up early**, "
            "но **He is usually tired**. В русском такое наречие может стоять где угодно "
            "в предложении — это не работает в английском."
        ),
        "common_errors": [
            {
                "tag": "adverb_position",
                "ru": "Наречие после глагола: ~He gets usually up~ → He **usually** gets up.",
            },
            {
                "tag": "adverb_before_be",
                "ru": "Наречие перед be: ~He usually is~ → He **is usually**.",
            },
            {
                "tag": "double_negative",
                "ru": "Never + doesn't вместе: ~He doesn't never~ → He **never** works late.",
            },
        ],
        "youglish_query": "he usually gets up early",
    },
}
