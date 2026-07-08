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


def test_fetch_stub_exits_cleanly() -> None:
    result = runner.invoke(app, ["fetch"])
    assert result.exit_code == 0
    assert "not implemented yet" in result.output
