from __future__ import annotations

import json
from pathlib import Path

import pytest

from etr.llm import JsonBatchClient, TagDecision, TaggerCache, parse_tag_decisions


def test_parse_tag_decisions_rejects_missing_sentence() -> None:
    with pytest.raises(ValueError, match="missing ids"):
        parse_tag_decisions(
            json.dumps(
                {
                    "results": [
                        {"id": "one", "ok": True, "ru_ok": True, "cefr": "A1", "skills": []}
                    ]
                }
            ),
            {"one", "two"},
        )


def test_parse_tag_decisions_keeps_structured_values() -> None:
    decisions = parse_tag_decisions(
        json.dumps(
            {
                "results": [
                    {
                        "id": "one",
                        "ok": True,
                        "ru_ok": True,
                        "cefr": "A2",
                        "skills": ["a2_pres_cont"],
                    },
                    {"id": "two", "ok": False, "ru_ok": False, "cefr": "B1", "skills": []},
                ]
            }
        ),
        {"one", "two"},
    )

    assert decisions == {
        "one": TagDecision(ok=True, ru_ok=True, cefr="A2", skills=("a2_pres_cont",)),
        "two": TagDecision(ok=False, ru_ok=False, cefr="B1", skills=()),
    }


def test_cache_is_keyed_by_model_prompt_and_sentence(tmp_path: Path) -> None:
    cache = TaggerCache(tmp_path / "cache.sqlite")
    expected = TagDecision(ok=True, ru_ok=True, cefr="A1", skills=())
    cache.put("flash", "prompt-a", "one", expected)

    assert cache.get("flash", "prompt-a", "one") == expected
    assert cache.get("flash", "prompt-b", "one") is None
    assert cache.get("other", "prompt-a", "one") is None


def test_client_uses_cache_before_transport(tmp_path: Path) -> None:
    calls: list[str] = []

    def transport(_prompt: str) -> str:
        calls.append("called")
        return '{"results":[{"id":"one","ok":true,"ru_ok":true,"cefr":"A1","skills":[]}]}'

    client = JsonBatchClient("flash", "prompt", TaggerCache(tmp_path / "cache.sqlite"), transport)

    assert client.tag({"one": "I work."})["one"].ok is True
    assert client.tag({"one": "I work."})["one"].cefr == "A1"
    assert calls == ["called"]
