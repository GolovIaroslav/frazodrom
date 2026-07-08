"""Validate: lint packs/*.json (§4.9, mandatory CI step).

Returns a list of human-readable problems; an empty list means the packs
are clean. Sub-type distribution is only checked for skills that
naturally span more than one sub-type — several A1-2 skills are split
into separate skill ids per sub-type by design (e.g. `a1_do_questions`
vs `a1_dont_doesnt`), so a single-subtype skill isn't a distribution bug.
See implementation-notes.md.
"""

from __future__ import annotations

import json
from pathlib import Path

import spacy

from etr.clean import normalize_for_dedup
from etr.curate import MULTI_SUBTYPE_SKILLS, QUOTA_MIN, SUB_TYPE_TARGETS
from etr.rules import SKILL_DETECTORS

SUB_TYPE_TOLERANCE = 0.20
MAX_PROPER_NOUN_SHARE = 0.20
MAX_GENERATED_SHARE = 0.0  # Ф1: no gapfill yet

_REQUIRED_ITEM_FIELDS = {
    "id",
    "ru",
    "en_main",
    "en_accepted",
    "sub",
    "difficulty",
    "cefr_lex",
    "source",
    "attribution",
}
_REQUIRED_SKILL_FIELDS = {
    "id",
    "cefr",
    "module",
    "module_title_ru",
    "title_ru",
    "pattern",
    "theory_ru",
    "common_errors",
    "probe_item_ids",
    "youglish_query",
}


def _looks_like_proper_noun_sentence(text: str) -> bool:
    words = text.rstrip(".!?").split()
    return any(w[0].isupper() and w.lower() != "i" for w in words[1:] if w)


def validate(packs_dir: Path) -> list[str]:
    problems: list[str] = []
    nlp = spacy.load("en_core_web_sm", disable=["ner"])

    pack_files = sorted(p for p in packs_dir.glob("*.json") if p.name != "index.json")
    if not pack_files:
        return ["no pack files found in packs/"]

    all_item_ids: set[str] = set()

    for pack_path in pack_files:
        pack = json.loads(pack_path.read_text(encoding="utf-8"))
        skill = pack.get("skill", {})
        skill_id = skill.get("id", pack_path.stem)
        items = pack.get("items", [])

        missing_skill_fields = _REQUIRED_SKILL_FIELDS - set(skill)
        if missing_skill_fields:
            problems.append(f"{skill_id}: missing skill fields {sorted(missing_skill_fields)}")

        if not skill.get("theory_ru", "").strip():
            problems.append(f"{skill_id}: empty theory_ru")
        if len(skill.get("common_errors", [])) < 3:
            problems.append(f"{skill_id}: fewer than 3 common_errors")

        if len(items) < int(QUOTA_MIN * 0.6):
            problems.append(f"{skill_id}: only {len(items)} items (< 60% of quota_min)")

        item_ids_here = set()
        ru_seen: set[str] = set()
        sub_counts: dict[str, int] = {}
        proper_noun_count = 0
        generated_count = 0

        for item in items:
            missing_item_fields = _REQUIRED_ITEM_FIELDS - set(item)
            if missing_item_fields:
                problems.append(
                    f"{skill_id}/{item.get('id')}: missing item fields "
                    f"{sorted(missing_item_fields)}"
                )
                continue

            item_id = item["id"]
            if item_id in all_item_ids:
                problems.append(f"{skill_id}/{item_id}: duplicate id across packs")
            all_item_ids.add(item_id)
            item_ids_here.add(item_id)

            ru_norm = normalize_for_dedup(item["ru"])
            if ru_norm in ru_seen:
                problems.append(f"{skill_id}/{item_id}: duplicate ru within skill")
            ru_seen.add(ru_norm)

            if item["en_main"] in item["en_accepted"]:
                problems.append(f"{skill_id}/{item_id}: en_main duplicated in en_accepted")

            if item["cefr_lex"] != skill["cefr"]:
                problems.append(
                    f"{skill_id}/{item_id}: cefr_lex {item['cefr_lex']} > skill cefr "
                    f"{skill['cefr']}"
                )

            for accepted in item["en_accepted"]:
                doc = nlp(accepted)
                if not SKILL_DETECTORS[skill_id](doc):
                    problems.append(
                        f"{skill_id}/{item_id}: en_accepted {accepted!r} doesn't match "
                        f"the skill's own pattern detector"
                    )

            sub_counts[item["sub"]] = sub_counts.get(item["sub"], 0) + 1
            if _looks_like_proper_noun_sentence(item["en_main"]):
                proper_noun_count += 1
            if str(item["source"]).startswith("generated"):
                generated_count += 1

        for probe_id in skill.get("probe_item_ids", []):
            if probe_id not in item_ids_here:
                problems.append(f"{skill_id}: probe_item_id {probe_id} not found among items")

        if items:
            if skill_id in MULTI_SUBTYPE_SKILLS and len(sub_counts) > 1:
                present = set(sub_counts)
                weight_sum = sum(SUB_TYPE_TARGETS[s] for s in present)
                for sub in present:
                    target = SUB_TYPE_TARGETS[sub] / weight_sum
                    actual = sub_counts.get(sub, 0) / len(items)
                    if abs(actual - target) > SUB_TYPE_TOLERANCE:
                        problems.append(
                            f"{skill_id}: sub-type {sub} at {actual:.0%}, target {target:.0%} "
                            f"(tolerance ±{SUB_TYPE_TOLERANCE:.0%})"
                        )
            if proper_noun_count / len(items) > MAX_PROPER_NOUN_SHARE:
                problems.append(
                    f"{skill_id}: proper-noun share "
                    f"{proper_noun_count / len(items):.0%} > {MAX_PROPER_NOUN_SHARE:.0%}"
                )
            if generated_count / len(items) > MAX_GENERATED_SHARE:
                problems.append(
                    f"{skill_id}: generated share "
                    f"{generated_count / len(items):.0%} > {MAX_GENERATED_SHARE:.0%}"
                )

    index_path = packs_dir / "index.json"
    if not index_path.exists():
        problems.append("packs/index.json is missing")

    return problems
