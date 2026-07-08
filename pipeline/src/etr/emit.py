"""Emit packs/{skill_id}.json + packs/index.json (§4.8).

Deterministic: stable sort of skills and items so a re-run with unchanged
input data produces a zero git diff (§4.8).
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import cast

import polars as pl

from etr.curate import SKILL_MODULE, SKILL_ORDER
from etr.enrich import SKILL_META

SCHEMA_VERSION = 1
CEFR_BY_SKILL = dict.fromkeys(SKILL_ORDER, "A1")
MODULE_TITLES = {
    "a1_m1": "Быть и указывать",
    "a1_m2": "Настоящее простое",
}


def _probe_item_ids(items: list[dict[str, object]]) -> list[str]:
    by_difficulty: dict[int, str] = {}
    for it in items:
        d = cast(int, it["difficulty"])
        by_difficulty.setdefault(d, cast(str, it["id"]))
    picks = [by_difficulty[d] for d in sorted(by_difficulty) if d in by_difficulty]
    if len(picks) >= 3:
        low, mid, high = picks[0], picks[len(picks) // 2], picks[-1]
        return [low, mid, high] if len({low, mid, high}) == 3 else picks[:3]
    first_id = cast(str, items[0]["id"])
    return (picks + [first_id] * 3)[:3]


def emit(curated_path: Path, packs_dir: Path) -> Path:
    df = pl.read_parquet(curated_path)
    packs_dir.mkdir(parents=True, exist_ok=True)

    index_skills: list[dict[str, object]] = []

    for skill_id in SKILL_ORDER:
        skill_df = df.filter(pl.col("skill_id") == skill_id).sort("item_id")
        if skill_df.height == 0:
            continue

        items = [
            {
                "id": row["item_id"],
                "ru": row["ru"],
                "en_main": row["en_main"],
                "en_accepted": row["en_accepted"],
                "sub": row["sub"],
                "difficulty": row["difficulty"],
                "cefr_lex": row["cefr_lex"],
                "source": row["source"],
                "attribution": row["attribution"],
            }
            for row in skill_df.iter_rows(named=True)
        ]

        meta = SKILL_META[skill_id]
        pack = {
            "schema_version": SCHEMA_VERSION,
            "skill": {
                "id": skill_id,
                "cefr": CEFR_BY_SKILL[skill_id],
                "module": meta["module"],
                "module_title_ru": meta["module_title_ru"],
                "title_ru": meta["title_ru"],
                "pattern": meta["pattern"],
                "theory_ru": meta["theory_ru"],
                "common_errors": meta["common_errors"],
                "probe_item_ids": _probe_item_ids(items),
                "youglish_query": meta["youglish_query"],
            },
            "items": items,
        }

        pack_path = packs_dir / f"{skill_id}.json"
        pack_json = json.dumps(pack, ensure_ascii=False, indent=2, sort_keys=False)
        pack_path.write_text(pack_json + "\n", encoding="utf-8")

        checksum = hashlib.sha256(pack_path.read_bytes()).hexdigest()
        index_skills.append(
            {
                "id": skill_id,
                "title_ru": meta["title_ru"],
                "cefr": CEFR_BY_SKILL[skill_id],
                "module": meta["module"],
                "count": len(items),
                "checksum": checksum,
            }
        )

    index = {
        "version": 1,
        "levels": [
            {
                "cefr": "A1",
                "modules": [
                    {
                        "id": module_id,
                        "title_ru": MODULE_TITLES[module_id],
                        "skills": [s for s in index_skills if s["module"] == module_id],
                    }
                    for module_id in sorted({SKILL_MODULE[s] for s in SKILL_ORDER})
                ],
            }
        ],
    }
    index_path = packs_dir / "index.json"
    index_path.write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return index_path
