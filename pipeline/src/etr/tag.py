"""Rule-based tagging pass (§4.4 pass 1) — Ф1 scope, no LLM pass yet.

Runs every cleaned sentence through spaCy and every skill detector in
`rules.py`. A sentence may match multiple non-conflicting skills (§4.4) —
all matches are kept as a list; `curate` decides which skill(s) actually
use the sentence (cap: a sentence serves at most 2 skills in the final
packs).
"""

from __future__ import annotations

from pathlib import Path

import polars as pl
import spacy

from etr.rules import SKILL_DETECTORS, infer_sub_type

SKILL_IDS = tuple(SKILL_DETECTORS)


def tag(pairs_path: Path, out_dir: Path, *, batch_size: int = 200) -> Path:
    df = pl.read_parquet(pairs_path)
    nlp = spacy.load("en_core_web_sm", disable=["ner"])

    en_texts = df["en"].to_list()
    matched_skills: list[list[str]] = []
    sub_types: list[list[str]] = []
    root_lemmas: list[str] = []
    has_proper_noun: list[bool] = []
    token_counts: list[int] = []

    for doc in nlp.pipe(en_texts, batch_size=batch_size):
        hits = [skill_id for skill_id, detector in SKILL_DETECTORS.items() if detector(doc)]
        matched_skills.append(hits)
        sub_types.append([infer_sub_type(skill_id, doc) for skill_id in hits])
        root = next((t for t in doc if t.dep_ == "ROOT"), None)
        root_lemmas.append(root.lemma_.lower() if root is not None else "")
        has_proper_noun.append(any(t.pos_ == "PROPN" for t in doc))
        token_counts.append(sum(1 for t in doc if not t.is_punct))

    df = df.with_columns(
        pl.Series("skills", matched_skills, dtype=pl.List(pl.Utf8)),
        pl.Series("sub_types", sub_types, dtype=pl.List(pl.Utf8)),
        pl.Series("root_lemma", root_lemmas, dtype=pl.Utf8),
        pl.Series("has_proper_noun", has_proper_noun, dtype=pl.Boolean),
        pl.Series("token_count", token_counts, dtype=pl.Int64),
    )
    df = df.filter(pl.col("skills").list.len() > 0)

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "tagged.parquet"
    df.write_parquet(out_path)
    return out_path
