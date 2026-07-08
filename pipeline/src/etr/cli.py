"""Frazodrom data pipeline CLI.

Ф1 scope: fetch, clean, tag (rules only), level, curate, emit, validate
are real. gapfill/enrich(LLM)/audio stay stubs — they need an LLM pass or
TTS, out of scope until Ф3/Ф9 (see PLAN.md §16).
"""

from __future__ import annotations

from pathlib import Path

import typer

app = typer.Typer(
    name="etr",
    help="Frazodrom data pipeline: fetch -> clean -> tag -> level -> curate -> "
    "gapfill -> enrich -> emit -> validate.",
    no_args_is_help=True,
)

_REPO_ROOT = Path(__file__).resolve().parents[3]
_DATA_DIR = _REPO_ROOT / "data"
_PACKS_DIR = _REPO_ROOT / "packs"


def _stub(command: str, phase: str, description: str) -> None:
    typer.echo(f"etr {command}: {description} — not implemented yet ({phase})")


@app.command()
def fetch(force: bool = False) -> None:
    """Download rus-eng.zip (+ optional full Tatoeba exports) into data/raw/."""
    from etr.fetch import fetch as fetch_impl

    path = fetch_impl(_DATA_DIR, force=force)
    typer.echo(f"etr fetch: corpus ready at {path}")


@app.command()
def clean() -> None:
    """Normalize/filter -> data/clean/pairs.parquet."""
    from etr.clean import clean as clean_impl

    txt_path = _DATA_DIR / "raw" / "rus.txt"
    if not txt_path.exists():
        typer.echo("etr clean: data/raw/rus.txt missing — run `etr fetch` first.")
        raise typer.Exit(code=1)
    path = clean_impl(txt_path, _DATA_DIR / "clean")
    typer.echo(f"etr clean: wrote {path}")


@app.command()
def tag() -> None:
    """Rule-based tagger (Ф1: no LLM pass yet) -> data/tagged/."""
    from etr.tag import tag as tag_impl

    pairs_path = _DATA_DIR / "clean" / "pairs.parquet"
    if not pairs_path.exists():
        typer.echo("etr tag: data/clean/pairs.parquet missing — run `etr clean` first.")
        raise typer.Exit(code=1)
    path = tag_impl(pairs_path, _DATA_DIR / "tagged")
    typer.echo(f"etr tag: wrote {path}")


@app.command()
def level() -> None:
    """CEFR lexical scoring (wordfreq, Ф1: no LLM pass yet)."""
    from etr.level import level as level_impl

    tagged_path = _DATA_DIR / "tagged" / "tagged.parquet"
    if not tagged_path.exists():
        typer.echo("etr level: data/tagged/tagged.parquet missing — run `etr tag` first.")
        raise typer.Exit(code=1)
    path = level_impl(tagged_path, _DATA_DIR / "leveled")
    typer.echo(f"etr level: wrote {path}")


@app.command()
def curate() -> None:
    """Quotas, diversity, sub-types, difficulty -> data/curated/."""
    from etr.curate import curate as curate_impl

    leveled_path = _DATA_DIR / "leveled" / "leveled.parquet"
    if not leveled_path.exists():
        typer.echo("etr curate: data/leveled/leveled.parquet missing — run `etr level` first.")
        raise typer.Exit(code=1)
    items_path, summary_path = curate_impl(leveled_path, _DATA_DIR / "curated")
    typer.echo(f"etr curate: wrote {items_path}, summary at {summary_path}")


@app.command()
def gapfill() -> None:
    """LLM generation to fill skill gaps."""
    _stub("gapfill", "Ф3", "LLM generation to fill skill gaps")


@app.command()
def enrich() -> None:
    """theory_ru, common_errors, probe items, youglish_query."""
    typer.echo(
        "etr enrich: Ф1 skill metadata is hand-authored and embedded directly in "
        "etr.enrich.SKILL_META (consumed by `etr emit`); an LLM-generated enrich pass "
        "for later skills lands in a future phase."
    )


@app.command()
def emit() -> None:
    """Emit packs/{skill_id}.json + packs/index.json."""
    from etr.emit import emit as emit_impl

    curated_path = _DATA_DIR / "curated" / "curated.parquet"
    if not curated_path.exists():
        typer.echo("etr emit: data/curated/curated.parquet missing — run `etr curate` first.")
        raise typer.Exit(code=1)
    index_path = emit_impl(curated_path, _PACKS_DIR)
    typer.echo(f"etr emit: wrote {index_path}")


@app.command()
def validate() -> None:
    """Lint packs: schema, quotas, duplicates, level vocabulary."""
    from etr.validate import validate as validate_impl

    problems = validate_impl(_PACKS_DIR)
    if not problems:
        typer.echo("etr validate: OK, no problems found.")
        return
    for problem in problems:
        typer.echo(f"- {problem}")
    typer.echo(f"etr validate: {len(problems)} problem(s) found.")
    raise typer.Exit(code=1)


@app.command()
def audio() -> None:
    """(Optional, future phase) TTS pregeneration via edge-tts."""
    _stub("audio", "future", "TTS pregeneration via edge-tts")


def main() -> None:
    app()


if __name__ == "__main__":
    main()
