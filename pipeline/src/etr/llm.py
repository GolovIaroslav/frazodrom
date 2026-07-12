"""Offline Gemini structured-output support for the course pipeline (§4.4, §4.7).

The cache is deliberately local and excludes credentials.  A caller supplies the
transport so parsing and cache behaviour stay fully testable without a network
call.  Production uses Gemini Flash-Lite in JSON mode; no LLM code runs in app/.
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

CEFR = Literal["A1", "A2", "B1", "B2", "C1"]
_CEFR_VALUES = {"A1", "A2", "B1", "B2", "C1"}


@dataclass(frozen=True)
class TagDecision:
    ok: bool
    ru_ok: bool
    cefr: CEFR
    skills: tuple[str, ...]


class TaggerCache:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as db:
            db.execute(
                """CREATE TABLE IF NOT EXISTS tag_decisions (
                model TEXT NOT NULL, prompt_hash TEXT NOT NULL, sentence_id TEXT NOT NULL,
                ok INTEGER NOT NULL, ru_ok INTEGER NOT NULL, cefr TEXT NOT NULL,
                skills_json TEXT NOT NULL,
                PRIMARY KEY (model, prompt_hash, sentence_id)
                )"""
            )

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.path)

    def get(self, model: str, prompt: str, sentence_id: str) -> TagDecision | None:
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
        with self._connect() as db:
            row = db.execute(
                "SELECT ok, ru_ok, cefr, skills_json FROM tag_decisions "
                "WHERE model=? AND prompt_hash=? AND sentence_id=?",
                (model, prompt_hash, sentence_id),
            ).fetchone()
        if row is None:
            return None
        return TagDecision(
            ok=bool(row[0]), ru_ok=bool(row[1]), cefr=row[2], skills=tuple(json.loads(row[3]))
        )

    def put(self, model: str, prompt: str, sentence_id: str, decision: TagDecision) -> None:
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
        with self._connect() as db:
            db.execute(
                "INSERT OR REPLACE INTO tag_decisions VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    model,
                    prompt_hash,
                    sentence_id,
                    decision.ok,
                    decision.ru_ok,
                    decision.cefr,
                    json.dumps(decision.skills),
                ),
            )


def parse_tag_decisions(text: str, expected_ids: set[str]) -> dict[str, TagDecision]:
    try:
        raw = json.loads(text)
        rows = raw["results"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise ValueError("invalid tagger JSON") from exc
    result: dict[str, TagDecision] = {}
    for row in rows:
        sentence_id, ok, ru_ok, cefr, skills = (
            row.get("id"),
            row.get("ok"),
            row.get("ru_ok"),
            row.get("cefr"),
            row.get("skills"),
        )
        if (
            not isinstance(sentence_id, str)
            or not isinstance(ok, bool)
            or not isinstance(ru_ok, bool)
            or cefr not in _CEFR_VALUES
            or not isinstance(skills, list)
            or not all(isinstance(skill, str) for skill in skills)
        ):
            raise ValueError("invalid tagger decision")
        result[sentence_id] = TagDecision(ok=ok, ru_ok=ru_ok, cefr=cefr, skills=tuple(skills))
    if set(result) != expected_ids:
        raise ValueError("tagger response has missing ids or unexpected ids")
    return result


class JsonBatchClient:
    def __init__(
        self, model: str, prompt: str, cache: TaggerCache, transport: Callable[[str], str]
    ) -> None:
        self.model = model
        self.prompt = prompt
        self.cache = cache
        self.transport = transport

    def tag(self, items: Mapping[str, str]) -> dict[str, TagDecision]:
        result: dict[str, TagDecision] = {}
        missing: dict[str, str] = {}
        for sentence_id, text in items.items():
            cached = self.cache.get(self.model, self.prompt, sentence_id)
            if cached is None:
                missing[sentence_id] = text
            else:
                result[sentence_id] = cached
        if missing:
            payload = json.dumps({"SENTENCES": [{"id": k, "en": v} for k, v in missing.items()]})
            parsed = parse_tag_decisions(self.transport(payload), set(missing))
            for sentence_id, decision in parsed.items():
                self.cache.put(self.model, self.prompt, sentence_id, decision)
            result.update(parsed)
        return result


def gemini_transport(*, model: str, system_instruction: str) -> Callable[[str], str]:
    """Build a Gemini JSON transport without exposing the API key in output/logs."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required for the LLM pipeline pass")

    def send(payload: str) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model,
            contents=payload,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0,
                response_mime_type="application/json",
                response_json_schema={
                    "type": "object",
                    "properties": {
                        "results": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "ok": {"type": "boolean"},
                                    "ru_ok": {"type": "boolean"},
                                    "cefr": {"type": "string", "enum": sorted(_CEFR_VALUES)},
                                    "skills": {"type": "array", "items": {"type": "string"}},
                                },
                                "required": ["id", "ok", "ru_ok", "cefr", "skills"],
                            },
                        }
                    },
                    "required": ["results"],
                },
            ),
        )
        if not response.text:
            raise RuntimeError("Gemini returned an empty structured response")
        return response.text

    return send
