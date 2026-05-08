"""Tests for `addin nudge add` CLI (Phase 2b)."""

from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture
def fake_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    home = tmp_path / "fakehome"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    import importlib

    import addin.audit as audit_mod
    import addin.nudges as nudges_mod
    importlib.reload(audit_mod)
    importlib.reload(nudges_mod)
    return home


def test_cli_add_creates_pending_nudge(
    fake_home: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    import addin.cli.nudge as cli
    import addin.nudges as nudges

    rc = cli.main(["add", "you ran ls 12 times today — capture?"])
    assert rc == 0
    pending = nudges.list_pending()
    assert len(pending) == 1
    assert pending[0].text.startswith("you ran ls")
    out = capsys.readouterr().out
    assert pending[0].id in out


def test_cli_add_with_suggested_command(fake_home: Path) -> None:
    import addin.cli.nudge as cli
    import addin.nudges as nudges

    rc = cli.main(["add", "rebase pattern", "--cmd", "git rebase -i HEAD~5"])
    assert rc == 0
    n = nudges.list_pending()[0]
    assert n.suggested_command == "git rebase -i HEAD~5"


def test_cli_add_requires_text(fake_home: Path) -> None:
    import addin.cli.nudge as cli

    with pytest.raises(SystemExit) as ex:
        cli.main(["add"])
    assert ex.value.code != 0


def test_cli_unknown_subcommand_fails(fake_home: Path) -> None:
    import addin.cli.nudge as cli

    with pytest.raises(SystemExit):
        cli.main(["zap"])
