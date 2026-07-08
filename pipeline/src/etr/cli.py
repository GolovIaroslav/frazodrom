"""Frazodrom data pipeline CLI.

Ф0 scaffold: every command is a stub that prints a placeholder message and
exits cleanly. Real logic lands in later phases (see PLAN.md §16).
"""

from __future__ import annotations

import typer

app = typer.Typer(
    name="etr",
    help="Frazodrom data pipeline: fetch -> clean -> tag -> level -> curate -> "
    "gapfill -> enrich -> emit -> validate.",
    no_args_is_help=True,
)


def _stub(command: str, phase: str, description: str) -> None:
    typer.echo(f"etr {command}: {description} — not implemented yet ({phase})")


@app.command()
def fetch() -> None:
    """Download rus-eng.zip (+ optional full Tatoeba exports) into data/raw/."""
    _stub("fetch", "Ф1", "download rus-eng.zip (+ optional full Tatoeba exports) into data/raw/")


@app.command()
def clean() -> None:
    """Normalize/filter -> data/clean/pairs.parquet."""
    _stub("clean", "Ф1", "normalize/filter into data/clean/pairs.parquet")


@app.command()
def tag() -> None:
    """Rule-based tagger + LLM pass for ambiguous cases -> data/tagged/."""
    _stub("tag", "Ф2", "rule-based tagger + LLM pass for ambiguous cases into data/tagged/")


@app.command()
def level() -> None:
    """CEFR lexical scoring."""
    _stub("level", "Ф2", "CEFR lexical scoring")


@app.command()
def curate() -> None:
    """Quotas, diversity, sub-drills, difficulty -> data/curated/."""
    _stub("curate", "Ф3", "quotas, diversity, sub-drills, difficulty into data/curated/")


@app.command()
def gapfill() -> None:
    """LLM generation to fill skill gaps."""
    _stub("gapfill", "Ф3", "LLM generation to fill skill gaps")


@app.command()
def enrich() -> None:
    """theory_ru, common_errors, probe items, youglish_query."""
    _stub("enrich", "Ф3", "theory_ru, common_errors, probe items, youglish_query")


@app.command()
def emit() -> None:
    """Emit packs/{skill_id}.json + packs/index.json."""
    _stub("emit", "Ф4", "emit packs/{skill_id}.json + packs/index.json")


@app.command()
def validate() -> None:
    """Lint packs: schema, quotas, duplicates, level vocabulary."""
    _stub("validate", "Ф4", "lint packs: schema, quotas, duplicates, level vocabulary")


@app.command()
def audio() -> None:
    """(Optional, future phase) TTS pregeneration via edge-tts."""
    _stub("audio", "future", "TTS pregeneration via edge-tts")


def main() -> None:
    app()


if __name__ == "__main__":
    main()
