"""Tests for addin-specific doctor checks (spec §10.4)."""

from __future__ import annotations

import importlib
import json
from pathlib import Path

import pytest


@pytest.fixture
def fake_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Create a fake home directory and reload the checks module into it."""
    home = tmp_path / "fakehome"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    import addin.doctor.checks as checks_mod
    importlib.reload(checks_mod)
    return home


def _patch_version_none(monkeypatch: pytest.MonkeyPatch) -> None:
    """Suppress live git calls so tests don't depend on tag state."""
    import addin.doctor.checks as checks_mod
    monkeypatch.setattr(checks_mod, "_addin_version", lambda: None)


def test_skill_bundle_complete(fake_home: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture) -> None:
    """All 4 skills present → no missing-skill warnings, no issues returned."""
    import addin.doctor.checks as checks

    _patch_version_none(monkeypatch)

    skills_root = fake_home / ".hermes" / "skills" / "addin"
    for name in ["audit-log", "private-vault", "ops-brief", "workflow-recorder"]:
        skill_dir = skills_root / name
        skill_dir.mkdir(parents=True, exist_ok=True)
        (skill_dir / "SKILL.md").write_text(f"# {name}\n", encoding="utf-8")

    issues = checks.run_addin_checks()

    captured = capsys.readouterr()
    assert "Custom skill missing" not in captured.out
    assert issues == [] or not any("addin custom skill" in i for i in issues)


def test_skill_bundle_missing_one(fake_home: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture) -> None:
    """Only 3 skills present → one missing-skill warning in stdout AND 1 issue."""
    import addin.doctor.checks as checks

    _patch_version_none(monkeypatch)

    skills_root = fake_home / ".hermes" / "skills" / "addin"
    # Create only 3 of the 4 expected skills (omit "ops-brief")
    for name in ["audit-log", "private-vault", "workflow-recorder"]:
        skill_dir = skills_root / name
        skill_dir.mkdir(parents=True, exist_ok=True)
        (skill_dir / "SKILL.md").write_text(f"# {name}\n", encoding="utf-8")

    issues = checks.run_addin_checks()

    captured = capsys.readouterr()
    assert "Custom skill missing" in captured.out
    skill_issues = [i for i in issues if "addin custom skill" in i]
    assert len(skill_issues) == 1
    assert "ops-brief" in skill_issues[0]


def test_addin_symlink_present_and_correct(fake_home: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture) -> None:
    """~/.addin → ~/.hermes symlink correct → no warning in output."""
    import addin.doctor.checks as checks

    _patch_version_none(monkeypatch)

    hermes_dir = fake_home / ".hermes"
    hermes_dir.mkdir(parents=True, exist_ok=True)
    addin_link = fake_home / ".addin"
    addin_link.symlink_to(hermes_dir)

    issues = checks.run_addin_checks()

    captured = capsys.readouterr()
    assert "expected ~/.hermes per spec" not in captured.out
    assert "~/.addin exists but is not a symlink" not in captured.out
    # Should have the ok line confirming the symlink
    assert "~/.addin symlink" in captured.out


def test_audit_log_dir_writable(fake_home: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture) -> None:
    """~/.hermes/logs/audit/ exists and is writable → 'writable' line, no issue."""
    import addin.doctor.checks as checks

    _patch_version_none(monkeypatch)

    audit_dir = fake_home / ".hermes" / "logs" / "audit"
    audit_dir.mkdir(parents=True, exist_ok=True)

    issues = checks.run_addin_checks()

    captured = capsys.readouterr()
    assert "Audit log dir writable" in captured.out
    assert not any("Audit log directory not writable" in i for i in issues)


def test_nudges_corrupt_returns_issue(fake_home: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture) -> None:
    """Malformed nudges.json → 'malformed' in stdout AND 1 issue returned."""
    import addin.doctor.checks as checks

    _patch_version_none(monkeypatch)

    curator_dir = fake_home / ".hermes" / "curator"
    curator_dir.mkdir(parents=True, exist_ok=True)
    nudge_file = curator_dir / "nudges.json"
    nudge_file.write_text("not valid json {{{", encoding="utf-8")

    issues = checks.run_addin_checks()

    captured = capsys.readouterr()
    assert "malformed" in captured.out
    nudge_issues = [i for i in issues if "nudge state malformed" in i]
    assert len(nudge_issues) == 1
