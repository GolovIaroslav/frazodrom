"""CEFR lexical scoring (§4.5) — Ф1 scope: wordfreq only, no LLM pass.

Rule: a sentence is level L if >=95% of its content-word lemmas (NOUN,
VERB, ADJ, ADV) belong to vocabulary <=L; otherwise the level climbs.
Default Zipf thresholds (lemma frequency, `wordfreq`, MIT-licensed, no
Oxford list required):

    A1 >= 4.9   A2 >= 4.5   B1 >= 4.0   B2 >= 3.5   C1 < 3.5

These are the plan's stated defaults; calibration against CEFR-SP /
ReadMe++ ground truth happens in `calibrate.py` and is recorded in
PLAN.md's session log, not hardcoded here.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl
import spacy
from wordfreq import zipf_frequency

CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1"]
ZIPF_THRESHOLDS = {"A1": 4.9, "A2": 4.5, "B1": 4.0, "B2": 3.5, "C1": 0.0}
CONTENT_POS = {"NOUN", "VERB", "ADJ", "ADV"}
COVERAGE_THRESHOLD = 0.95


def word_level(lemma: str) -> str:
    zipf = zipf_frequency(lemma.lower(), "en")
    for level in CEFR_ORDER:
        if zipf >= ZIPF_THRESHOLDS[level]:
            return level
    return "C1"


def sentence_level(content_lemmas: list[str]) -> str:
    if not content_lemmas:
        return "A1"
    word_levels = [word_level(lemma) for lemma in content_lemmas]
    for i, level in enumerate(CEFR_ORDER):
        allowed = set(CEFR_ORDER[: i + 1])
        covered = sum(1 for wl in word_levels if wl in allowed)
        if covered / len(word_levels) >= COVERAGE_THRESHOLD:
            return level
    return "C1"


def level(tagged_path: Path, out_dir: Path, *, batch_size: int = 200) -> Path:
    df = pl.read_parquet(tagged_path)
    nlp = spacy.load("en_core_web_sm", disable=["ner"])

    en_texts = df["en"].to_list()
    cefr_lex: list[str] = []
    for doc in nlp.pipe(en_texts, batch_size=batch_size):
        content_lemmas = [t.lemma_ for t in doc if t.pos_ in CONTENT_POS]
        cefr_lex.append(sentence_level(content_lemmas))

    df = df.with_columns(pl.Series("cefr_lex", cefr_lex, dtype=pl.Utf8))

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "leveled.parquet"
    df.write_parquet(out_path)
    return out_path
