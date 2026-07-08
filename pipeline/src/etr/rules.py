"""Rule-based pattern detectors for skill tagging (§4.4 pass 1).

Each detector takes a spaCy ``Doc`` for an English sentence and returns
``True`` if the sentence is a natural example of that skill's pattern.
Detectors are intentionally conservative (favor precision over recall):
``curate`` picks from an oversupplied corpus (536k pairs for ~1-1.5k
needed sentences per module), so missing a valid sentence is cheap while
tagging a bad one is not.

Golden tests live in ``tests/test_rules.py`` — any bug found in review
must first become a case there before being fixed here (CLAUDE.md).
"""

from __future__ import annotations

from collections.abc import Callable

from spacy.tokens import Doc, Token

FREQ_ADVERBS = {
    "always",
    "usually",
    "often",
    "sometimes",
    "occasionally",
    "rarely",
    "seldom",
    "never",
}

POSS_PRONOUNS = {"my", "your", "his", "her", "its", "our", "their"}
DEM_DETERMINERS = {"this", "that", "these", "those"}
SUBJ_1_2_PL = {"i", "you", "we", "they"}
SUBJ_3RD_SG = {"he", "she", "it"}


def _is_question(doc: Doc) -> bool:
    return doc.text.strip().endswith("?")


def _has_neg(doc: Doc) -> bool:
    return any(t.dep_ == "neg" or t.lemma_ == "not" for t in doc)


def _root(doc: Doc) -> Token | None:
    for t in doc:
        if t.dep_ == "ROOT":
            return t
    return None


def _finite_subject(verb: Token) -> Token | None:
    for child in verb.children:
        if child.dep_ in ("nsubj", "nsubjpass", "expl"):
            return child
    return None


_FINITE_BE_TAGS = {"VBP", "VBZ"}


def detect_a1_be_affirm(doc: Doc) -> bool:
    """I am / he is / they are (affirmative, no question, no negation)."""
    if _is_question(doc) or _has_neg(doc):
        return False
    root = _root(doc)
    if root is None or root.lemma_ != "be" or root.tag_ not in _FINITE_BE_TAGS:
        return False
    subj = _finite_subject(root)
    return subj is not None and subj.dep_ != "expl"


def detect_a1_be_neg_quest(doc: Doc) -> bool:
    """Are you...? / He isn't... — question or negation with BE."""
    root = _root(doc)
    if root is None or root.lemma_ != "be" or root.tag_ not in _FINITE_BE_TAGS:
        return False
    subj = _finite_subject(root)
    if subj is None or subj.dep_ == "expl":
        return False
    if _is_question(doc):
        first = doc[0]
        return first.lemma_.lower() == "be" and first.i < subj.i
    return _has_neg(doc)


def detect_a1_pronouns_poss(doc: Doc) -> bool:
    """my / your / his / her / its / our / their as a determiner."""
    return any(
        t.pos_ in ("DET", "PRON") and t.lemma_.lower() in POSS_PRONOUNS and t.dep_ == "poss"
        for t in doc
    )


def detect_a1_this_that(doc: Doc) -> bool:
    """this / that / these / those (determiner or pronoun)."""
    return any(t.lemma_.lower() in DEM_DETERMINERS and t.pos_ in ("DET", "PRON") for t in doc)


def detect_a1_there_is(doc: Doc) -> bool:
    """There is / There are (existential there, present tense only)."""
    root = _root(doc)
    if root is None or root.lemma_ != "be" or root.tag_ not in _FINITE_BE_TAGS:
        return False
    return any(c.dep_ == "expl" and c.lemma_.lower() == "there" for c in root.children)


def detect_a1_pres_simple_i(doc: Doc) -> bool:
    """I / you / we / they + V1 (present simple, non-3rd-person)."""
    if _is_question(doc) or _has_neg(doc):
        return False
    root = _root(doc)
    if root is None or root.pos_ != "VERB" or root.tag_ != "VBP":
        return False
    subj = _finite_subject(root)
    return subj is not None and subj.lemma_.lower() in SUBJ_1_2_PL


def detect_a1_pres_simple_3rd(doc: Doc) -> bool:
    """He / she + V-s (present simple, 3rd person singular)."""
    if _is_question(doc) or _has_neg(doc):
        return False
    root = _root(doc)
    if root is None or root.pos_ != "VERB" or root.tag_ != "VBZ":
        return False
    subj = _finite_subject(root)
    if subj is None:
        return False
    if subj.lemma_.lower() in SUBJ_3RD_SG:
        return True
    return subj.pos_ == "NOUN" and subj.tag_ == "NN"


def detect_a1_do_questions(doc: Doc) -> bool:
    """Do you/we/they + V1…?"""
    if not _is_question(doc) or len(doc) < 2:
        return False
    first = doc[0]
    return first.text.lower() == "do"


def detect_a1_does_questions(doc: Doc) -> bool:
    """Does he/she + V1…?"""
    if not _is_question(doc) or len(doc) < 2:
        return False
    return doc[0].text.lower() == "does"


def detect_a1_dont_doesnt(doc: Doc) -> bool:
    """don't / doesn't + V1 — requires an explicit subject (excludes bare
    imperatives like "Don't help.", which have no nsubj)."""
    if _is_question(doc):
        return False
    lowered = doc.text.lower()
    if "don't" not in lowered and "doesn't" not in lowered and "dont" not in lowered:
        return False
    has_neg_aux_do = any(t.lemma_ == "do" and t.dep_ == "aux" and _has_neg(doc) for t in doc)
    has_subject = any(t.dep_ == "nsubj" for t in doc)
    return has_neg_aux_do and has_subject


def detect_a1_freq_adverbs(doc: Doc) -> bool:
    """usually / never etc. modifying the verb (excludes bare imperatives
    like "Never give up.", which have no explicit subject)."""
    has_freq_adverb = any(
        t.lemma_.lower() in FREQ_ADVERBS and t.pos_ == "ADV" and t.dep_ in ("advmod", "neg")
        for t in doc
    )
    has_subject = any(t.dep_ == "nsubj" for t in doc)
    return has_freq_adverb and has_subject


SKILL_DETECTORS: dict[str, Callable[[Doc], bool]] = {
    "a1_be_affirm": detect_a1_be_affirm,
    "a1_be_neg_quest": detect_a1_be_neg_quest,
    "a1_pronouns_poss": detect_a1_pronouns_poss,
    "a1_this_that": detect_a1_this_that,
    "a1_there_is": detect_a1_there_is,
    "a1_pres_simple_i": detect_a1_pres_simple_i,
    "a1_pres_simple_3rd": detect_a1_pres_simple_3rd,
    "a1_do_questions": detect_a1_do_questions,
    "a1_does_questions": detect_a1_does_questions,
    "a1_dont_doesnt": detect_a1_dont_doesnt,
    "a1_freq_adverbs": detect_a1_freq_adverbs,
}

# A skill's sub-type (§3.2) inferred from a matched sentence — used by curate
# for the affirm/question/neg/wh distribution target.
_SUB_TYPE_HINT: dict[str, str] = {
    "a1_do_questions": "question",
    "a1_does_questions": "question",
    "a1_dont_doesnt": "neg",
}


def infer_sub_type(skill_id: str, doc: Doc) -> str:
    hinted = _SUB_TYPE_HINT.get(skill_id)
    if hinted:
        return hinted
    if _is_question(doc):
        first = doc[0].lemma_.lower()
        if first in ("what", "where", "who", "when", "how", "why", "which"):
            return "wh"
        return "question"
    if _has_neg(doc):
        return "neg"
    return "affirm"
