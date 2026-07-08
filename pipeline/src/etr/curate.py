"""Curate: quotas, diversity, sub-types, difficulty -> data/curated/ (§4.6).

Ф1 scope: modules A1-1 and A1-2 only (11 skills — the plan's roadmap text
says "10", the module tables in §3.4 list 11; module scope wins, see
implementation-notes.md). No gapfill: if a skill undershoots quota, we
lower the quota floor rather than generate (§4.6 rule 5), since gapfill
is out of scope without an LLM pass in Ф1.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import polars as pl
import spacy

# For these skills the ROOT verb is always "be" (or "there is/are"), so
# capping diversity by root_lemma would gut the skill entirely. Use the
# lemma of the sentence's topic word (its last content word) instead.
_TOPIC_KEY_SKILLS = {"a1_be_affirm", "a1_be_neg_quest", "a1_there_is"}
_CONTENT_POS = {"NOUN", "PROPN", "ADJ"}
_nlp_topic = None


def _topic_lemma(text: str) -> str:
    global _nlp_topic
    if _nlp_topic is None:
        _nlp_topic = spacy.load("en_core_web_sm", disable=["ner", "parser"])
    doc = _nlp_topic(text)
    content = [t.lemma_.lower() for t in doc if t.pos_ in _CONTENT_POS]
    return content[-1] if content else ""

QUOTA_MIN = 100
QUOTA_MAX = 150
MAX_LEN_A1 = 12
MAX_PER_VERB_LEMMA = 4
MAX_PROPER_NOUN_SHARE = 0.20
MAX_SKILLS_PER_SENTENCE = 2

# §3.2 default sub-type distribution.
SUB_TYPE_TARGETS = {"affirm": 0.40, "question": 0.25, "neg": 0.15, "wh": 0.10, "mixed": 0.10}

# Skills whose pattern structurally spans more than one sub-type (e.g.
# a1_be_neg_quest covers both "Are you...?" questions and "He isn't..."
# negatives) get a proportional cap per sub-type during selection, so the
# natural corpus skew (e.g. "never" sentences vastly outnumber "always"
# ones) doesn't blow past §3.2's target distribution. Single-subtype
# skills (the module already splits do_questions/does_questions/
# dont_doesnt/etc. by sub-type at the skill-id level) don't need this.
MULTI_SUBTYPE_SKILLS = {"a1_be_neg_quest", "a1_freq_adverbs"}

# Module + display order for A1-1 "Быть и указывать" and A1-2 "Настоящее простое" (§3.4).
SKILL_ORDER: list[str] = [
    "a1_be_affirm",
    "a1_be_neg_quest",
    "a1_pronouns_poss",
    "a1_this_that",
    "a1_there_is",
    "a1_pres_simple_i",
    "a1_pres_simple_3rd",
    "a1_do_questions",
    "a1_does_questions",
    "a1_dont_doesnt",
    "a1_freq_adverbs",
]

SKILL_MODULE = {
    "a1_be_affirm": "a1_m1",
    "a1_be_neg_quest": "a1_m1",
    "a1_pronouns_poss": "a1_m1",
    "a1_this_that": "a1_m1",
    "a1_there_is": "a1_m1",
    "a1_pres_simple_i": "a1_m2",
    "a1_pres_simple_3rd": "a1_m2",
    "a1_do_questions": "a1_m2",
    "a1_does_questions": "a1_m2",
    "a1_dont_doesnt": "a1_m2",
    "a1_freq_adverbs": "a1_m2",
}


@dataclass
class CuratedItem:
    skill_id: str
    item_id: str
    ru: str
    en_main: str
    en_accepted: list[str]
    sub: str
    difficulty: int
    cefr_lex: str
    source: str
    attribution: str


def _difficulty(token_count: int) -> int:
    return max(1, min(5, round(token_count / 2)))


def _make_item_id(tatoeba_id: str, en_norm: str, used_ids: set[str]) -> str:
    base = f"s_{tatoeba_id}" if tatoeba_id else f"s_{abs(hash(en_norm)) % 10_000_000}"
    candidate = base
    suffix_ord = ord("b")
    while candidate in used_ids:
        candidate = f"{base}{chr(suffix_ord)}"
        suffix_ord += 1
    return candidate


def _accepted_variants(
    df: pl.DataFrame, skill_id: str, ru_norm: str, en_norm_main: str, limit: int = 2
) -> list[str]:
    rows = df.filter(
        (pl.col("ru_norm") == ru_norm)
        & (pl.col("en_norm") != en_norm_main)
        & (pl.col("skills").list.contains(skill_id))
    )
    if rows.height == 0:
        return []
    rows = rows.sort("token_count")
    seen: set[str] = set()
    out: list[str] = []
    for en in rows["en"].to_list():
        if en in seen:
            continue
        seen.add(en)
        out.append(en)
        if len(out) >= limit:
            break
    return out


def curate(leveled_path: Path, out_dir: Path) -> tuple[Path, Path]:
    df = pl.read_parquet(leveled_path)
    df = df.filter((pl.col("cefr_lex") == "A1") & (pl.col("token_count") <= MAX_LEN_A1))

    usage_count: dict[str, int] = {}
    used_ids: set[str] = set()
    all_items: list[CuratedItem] = []
    summary: dict[str, dict[str, int]] = {}

    for skill_id in SKILL_ORDER:
        candidates = df.filter(pl.col("skills").list.contains(skill_id))
        # deterministic order: shortest/most-frequent-shaped sentences first,
        # non-proper-noun preferred, then stable tie-break on tatoeba_id.
        candidates = candidates.sort(["has_proper_noun", "token_count", "tatoeba_id"])

        sub_type_caps: dict[str, int] = {}
        if skill_id in MULTI_SUBTYPE_SKILLS:
            present_subs: set[str] = set()
            for skills_list, sub_types_list in zip(
                candidates["skills"].to_list(), candidates["sub_types"].to_list(), strict=True
            ):
                present_subs.add(sub_types_list[skills_list.index(skill_id)])
            weight_sum = sum(SUB_TYPE_TARGETS[s] for s in present_subs)
            sub_type_caps = {
                s: round(SUB_TYPE_TARGETS[s] / weight_sum * QUOTA_MAX) for s in present_subs
            }

        verb_lemma_count: dict[str, int] = {}
        proper_noun_count = 0
        sub_type_count: dict[str, int] = {}
        ru_norm_seen: set[str] = set()
        picked: list[CuratedItem] = []

        for row in candidates.iter_rows(named=True):
            if len(picked) >= QUOTA_MAX:
                break
            en_norm = row["en_norm"]
            if usage_count.get(en_norm, 0) >= MAX_SKILLS_PER_SENTENCE:
                continue
            if row["ru_norm"] in ru_norm_seen:
                continue
            if skill_id in _TOPIC_KEY_SKILLS:
                lemma = _topic_lemma(row["en"])
                cap = MAX_PER_VERB_LEMMA + 2
            else:
                lemma = row["root_lemma"] or ""
                cap = MAX_PER_VERB_LEMMA
            if verb_lemma_count.get(lemma, 0) >= cap:
                continue
            if row["has_proper_noun"]:
                # Absolute cap against quota_min (not the running total) so a
                # shrinking candidate pool near the end can't push the final
                # ratio over the limit retroactively.
                if proper_noun_count >= int(MAX_PROPER_NOUN_SHARE * QUOTA_MIN):
                    continue

            skills_list = row["skills"]
            sub_types_list = row["sub_types"]
            sub = sub_types_list[skills_list.index(skill_id)]

            if sub_type_caps and sub_type_count.get(sub, 0) >= sub_type_caps.get(sub, QUOTA_MAX):
                continue

            item_id = _make_item_id(row["tatoeba_id"], en_norm, used_ids)
            used_ids.add(item_id)
            accepted = _accepted_variants(df, skill_id, row["ru_norm"], en_norm)

            picked.append(
                CuratedItem(
                    skill_id=skill_id,
                    item_id=item_id,
                    ru=row["ru"],
                    en_main=row["en"],
                    en_accepted=accepted,
                    sub=sub,
                    difficulty=_difficulty(row["token_count"]),
                    cefr_lex=row["cefr_lex"],
                    source=(
                        f"tatoeba:{row['tatoeba_id']}" if row["tatoeba_id"] else "tatoeba:unknown"
                    ),
                    attribution=row["author"] or "",
                )
            )
            usage_count[en_norm] = usage_count.get(en_norm, 0) + 1
            verb_lemma_count[lemma] = verb_lemma_count.get(lemma, 0) + 1
            ru_norm_seen.add(row["ru_norm"])
            sub_type_count[sub] = sub_type_count.get(sub, 0) + 1
            if row["has_proper_noun"]:
                proper_noun_count += 1

        all_items.extend(picked)
        summary[skill_id] = {
            "picked": len(picked),
            "quota_min": QUOTA_MIN,
            "quota_max": QUOTA_MAX,
            "below_min": int(len(picked) < QUOTA_MIN),
        }

    out_dir.mkdir(parents=True, exist_ok=True)
    items_df = pl.DataFrame(
        [
            {
                "skill_id": it.skill_id,
                "item_id": it.item_id,
                "ru": it.ru,
                "en_main": it.en_main,
                "en_accepted": it.en_accepted,
                "sub": it.sub,
                "difficulty": it.difficulty,
                "cefr_lex": it.cefr_lex,
                "source": it.source,
                "attribution": it.attribution,
            }
            for it in all_items
        ]
    )
    items_path = out_dir / "curated.parquet"
    items_df.write_parquet(items_path)

    summary_path = out_dir / "curate_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    return items_path, summary_path
