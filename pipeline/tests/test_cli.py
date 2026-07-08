from pathlib import Path

import pytest
from typer.testing import CliRunner

from etr.cli import app

runner = CliRunner()


def test_help_lists_all_commands() -> None:
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    for command in [
        "fetch",
        "clean",
        "tag",
        "level",
        "curate",
        "gapfill",
        "enrich",
        "emit",
        "validate",
        "audio",
    ]:
        assert command in result.output


def test_enrich_is_informational_and_touches_no_io() -> None:
    result = runner.invoke(app, ["enrich"])
    assert result.exit_code == 0


def test_clean_without_fetch_reports_helpful_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # clean/tag/level/curate/emit all guard on their upstream artifact existing;
    # exercise one of them without running the (network-dependent) fetch step.
    import etr.cli as cli_module

    monkeypatch.setattr(cli_module, "_DATA_DIR", tmp_path / "data")
    result = runner.invoke(app, ["clean"])
    assert result.exit_code == 1
    assert "run `etr fetch` first" in result.output
