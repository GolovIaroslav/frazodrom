"""Normalize and filter the raw corpus into data/clean/pairs.parquet (§4.3).

Steps applied (numbering matches PLAN.md §4.3):
1. Unicode NFC, straighten quotes/apostrophes, collapse whitespace.
2. EN length 2-18 tokens.
3. EN latin+punct only; RU cyrillic (+ latin names) only.
4. Drop exact/near duplicate (en_norm, ru_norm) pairs.
5. Profanity filter.
6. Drop telegraphic/fragment lines (ALL CAPS, ellipsis).
7. `ru_norm` is kept so later steps can group alternate EN translations of
   the same RU sentence into `en_accepted` — see §4.3.7 and curate.py.

Step 8 (Tom/Mary name-swap) is an optional flag deferred past Ф1 — see
implementation-notes.md.
"""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path

import polars as pl

_QUOTE_MAP = str.maketrans(
    {
        "‘": "'",
        "’": "'",
        "“": '"',
        "”": '"',
        "«": '"',
        "»": '"',
    }
)
_WS_RE = re.compile(r"\s+")
_PUNCT_STRIP_RE = re.compile(r"[^\w\s]", flags=re.UNICODE)
_EN_ALLOWED_RE = re.compile(r"^[A-Za-z0-9\s.,!?'\";:\-()]+$")
_RU_ALLOWED_RE = re.compile(r"^[А-Яа-яЁё0-9A-Za-z\s.,!?'\";:\-()]+$")
_ATTRIBUTION_ID_RE = re.compile(r"#(\d+)\s*\(([^)]+)\)")

# Small, easily-extended stoplist; real profanity filtering can graduate to
# `better-profanity` if this proves too coarse during proofreading (Ф6).
_PROFANITY = {"fuck", "shit", "bitch", "cunt", "asshole", "nigger", "faggot"}


def _normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text.translate(_QUOTE_MAP)
    return _WS_RE.sub(" ", text).strip()


def normalize_for_dedup(text: str) -> str:
    """Lowercase, punctuation-stripped form used for near-dup and grouping."""
    text = _PUNCT_STRIP_RE.sub("", text.lower())
    return _WS_RE.sub(" ", text).strip()


def _token_count(text: str) -> int:
    return len(text.split())


def _is_all_caps_fragment(text: str) -> bool:
    letters = [c for c in text if c.isalpha()]
    return len(letters) > 2 and all(c.isupper() for c in letters)


def _has_profanity(text_lower: str) -> bool:
    words = set(re.findall(r"[a-z']+", text_lower))
    return not words.isdisjoint(_PROFANITY)


def _parse_attribution(attribution: str) -> tuple[str, str]:
    """Return (tatoeba_en_sentence_id, attribution_author) for source/attribution fields."""
    match = _ATTRIBUTION_ID_RE.search(attribution)
    if not match:
        return "", ""
    return match.group(1), match.group(2)


def load_raw_pairs(txt_path: Path) -> pl.DataFrame:
    rows: list[tuple[str, str, str]] = []
    with txt_path.open(encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 3:
                continue
            en, ru, attribution = parts[0], parts[1], parts[2]
            rows.append((en, ru, attribution))
    return pl.DataFrame(rows, schema=["en", "ru", "attribution"], orient="row")


def clean(txt_path: Path, out_dir: Path) -> Path:
    df = load_raw_pairs(txt_path)

    df = df.with_columns(
        pl.col("en").map_elements(_normalize_text, return_dtype=pl.Utf8),
        pl.col("ru").map_elements(_normalize_text, return_dtype=pl.Utf8),
    )

    df = df.filter(
        pl.col("en").map_elements(
            lambda t: 2 <= _token_count(t) <= 18, return_dtype=pl.Boolean
        )
    )
    df = df.filter(
        pl.col("en").map_elements(lambda t: bool(_EN_ALLOWED_RE.match(t)), return_dtype=pl.Boolean)
    )
    df = df.filter(
        pl.col("ru").map_elements(lambda t: bool(_RU_ALLOWED_RE.match(t)), return_dtype=pl.Boolean)
    )
    df = df.filter(
        pl.col("en").map_elements(
            lambda t: not _is_all_caps_fragment(t) and "..." not in t, return_dtype=pl.Boolean
        )
    )
    df = df.filter(
        pl.col("en").map_elements(
            lambda t: not _has_profanity(t.lower()), return_dtype=pl.Boolean
        )
    )

    df = df.with_columns(
        pl.col("en").map_elements(normalize_for_dedup, return_dtype=pl.Utf8).alias("en_norm"),
        pl.col("ru").map_elements(normalize_for_dedup, return_dtype=pl.Utf8).alias("ru_norm"),
        pl.col("attribution")
        .map_elements(lambda a: _parse_attribution(a)[0], return_dtype=pl.Utf8)
        .alias("tatoeba_id"),
        pl.col("attribution")
        .map_elements(lambda a: _parse_attribution(a)[1], return_dtype=pl.Utf8)
        .alias("author"),
    )

    df = df.unique(subset=["en_norm", "ru_norm"], keep="first")

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "pairs.parquet"
    df.write_parquet(out_path)
    return out_path
