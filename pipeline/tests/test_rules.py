"""Golden tests for rule-based skill detectors (§4.4, CLAUDE.md: bug -> test first)."""

from __future__ import annotations

import pytest
import spacy

from etr.rules import SKILL_DETECTORS

_NLP = spacy.load("en_core_web_sm")

# (skill_id, sentence, expected) — every skill needs at least one positive and
# one clearly-negative case; add more as review finds bad tags.
CASES: list[tuple[str, str, bool]] = [
    ("a1_be_affirm", "I am a student.", True),
    ("a1_be_affirm", "They are happy.", True),
    ("a1_be_affirm", "Are you at home?", False),
    ("a1_be_affirm", "He isn't here.", False),
    ("a1_be_affirm", "There is a book on the table.", False),
    ("a1_be_affirm", "Be yourself.", False),  # imperative, spaCy mis-tags "yourself" as nsubj
    ("a1_be_affirm", "Don't be late.", False),  # imperative negative
    ("a1_be_neg_quest", "Are you at home?", True),
    ("a1_be_neg_quest", "He isn't here.", True),
    ("a1_be_neg_quest", "I am a student.", False),
    ("a1_pronouns_poss", "This is her book.", True),
    ("a1_pronouns_poss", "I have a car.", False),
    ("a1_this_that", "These are my friends.", True),
    ("a1_this_that", "That is a nice car.", True),
    ("a1_this_that", "I like this.", True),
    ("a1_this_that", "I have a car.", False),
    ("a1_there_is", "There are two windows in the room.", True),
    ("a1_there_is", "There is a book on the table.", True),
    ("a1_there_is", "This is a book.", False),
    ("a1_there_is", "There were three letters.", False),  # past tense out of scope
    ("a1_pres_simple_i", "I live in this city.", True),
    ("a1_pres_simple_i", "They work in an office.", True),
    ("a1_pres_simple_i", "He works in an office.", False),
    ("a1_pres_simple_i", "I don't eat meat.", False),
    ("a1_pres_simple_3rd", "He works in an office.", True),
    ("a1_pres_simple_3rd", "She speaks English.", True),
    ("a1_pres_simple_3rd", "I live in this city.", False),
    ("a1_pres_simple_3rd", "Does she speak English?", False),
    ("a1_do_questions", "Do you often read?", True),
    ("a1_do_questions", "Does she speak English?", False),
    ("a1_do_questions", "I don't eat meat.", False),
    ("a1_does_questions", "Does she speak English?", True),
    ("a1_does_questions", "Do you often read?", False),
    ("a1_dont_doesnt", "I don't eat meat.", True),
    ("a1_dont_doesnt", "She doesn't like coffee.", True),
    ("a1_dont_doesnt", "Do you often read?", False),
    ("a1_dont_doesnt", "Don't help.", False),  # bare imperative, no subject
    ("a1_dont_doesnt", "Don't wait.", False),
    ("a1_freq_adverbs", "He usually gets up early.", True),
    ("a1_freq_adverbs", "I never eat meat.", True),
    ("a1_freq_adverbs", "I live in this city.", False),
    ("a1_freq_adverbs", "Never give up.", False),  # bare imperative, no subject
]


@pytest.mark.parametrize("skill_id,sentence,expected", CASES)
def test_detector(skill_id: str, sentence: str, expected: bool) -> None:
    doc = _NLP(sentence)
    detector = SKILL_DETECTORS[skill_id]
    assert detector(doc) is expected, f"{skill_id} on {sentence!r}: expected {expected}"


def test_all_skills_covered_by_at_least_one_positive_case() -> None:
    positive_skills = {skill for skill, _, expected in CASES if expected}
    assert positive_skills == set(SKILL_DETECTORS)
