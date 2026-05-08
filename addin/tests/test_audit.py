"""Tests for the JSONL audit log writer/reader (Phase 2b)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest


@pytest.fixture
def fake_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    home = tmp_path / "fakehome"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    import importlib

    import addin.audit as audit_mod
    importlib.reload(audit_mod)
    return home


def test_record_event_appends_jsonl(fake_home: Path) -> None:
    import addin.audit as audit

    audit.record_event(actor="addin", action="skill.captured", target="git-rebase")
    audit.record_event(actor="user", action="nudge.dismissed", target="abc123")

    log = fake_home / ".hermes" / "logs" / "audit" / "audit.jsonl"
    lines = log.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 2
    first = json.loads(lines[0])
    assert first["actor"] == "addin"
    assert first["action"] == "skill.captured"
    assert first["target"] == "git-rebase"
    assert "ts" in first  # ISO-8601 UTC


def test_record_event_creates_dir_idempotently(fake_home: Path) -> None:
    import addin.audit as audit

    audit.record_event(actor="addin", action="boot", target="dashboard")
    audit.record_event(actor="addin", action="boot", target="dashboard")
    log = fake_home / ".hermes" / "logs" / "audit" / "audit.jsonl"
    assert len(log.read_text(encoding="utf-8").splitlines()) == 2


def test_read_events_returns_newest_first(fake_home: Path) -> None:
    import addin.audit as audit

    for i in range(5):
        audit.record_event(actor="addin", action=f"action.{i}", target=str(i))

    events = audit.read_events(limit=3)
    assert [e["action"] for e in events] == ["action.4", "action.3", "action.2"]


def test_read_events_filters_by_actor_and_prefix(fake_home: Path) -> None:
    import addin.audit as audit

    audit.record_event(actor="user", action="nudge.captured", target="x")
    audit.record_event(actor="addin", action="network_egress", target="api.example.com")
    audit.record_event(actor="addin", action="nudge.dismissed", target="y")

    e = audit.read_events(limit=10, actor="addin", action_prefix="nudge.")
    assert len(e) == 1
    assert e[0]["action"] == "nudge.dismissed"
