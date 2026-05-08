"""Tests for the curator nudge state-store (Phase 2b)."""

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
    import addin.nudges as nudges_mod
    importlib.reload(audit_mod)
    importlib.reload(nudges_mod)
    return home


def test_add_then_list_pending(fake_home: Path) -> None:
    import addin.nudges as nudges

    n = nudges.add(
        text="i noticed you ran git rebase three times today — capture as a skill?",
        suggested_command="git rebase -i HEAD~5",
    )
    assert isinstance(n.id, str) and len(n.id) >= 6
    assert n.state == "pending"

    pending = nudges.list_pending()
    assert len(pending) == 1
    assert pending[0].id == n.id


def test_capture_changes_state_and_audits(fake_home: Path) -> None:
    import addin.audit as audit
    import addin.nudges as nudges

    n = nudges.add(text="capture me")
    nudges.capture(n.id)

    assert nudges.list_pending() == []
    events = audit.read_events(limit=5, action_prefix="nudge.")
    assert any(e["action"] == "nudge.captured" and e["target"] == n.id for e in events)


def test_dismiss_removes_from_pending_and_audits(fake_home: Path) -> None:
    import addin.audit as audit
    import addin.nudges as nudges

    n = nudges.add(text="dismiss me")
    nudges.dismiss(n.id)

    assert nudges.list_pending() == []
    events = audit.read_events(limit=5, action_prefix="nudge.")
    assert any(e["action"] == "nudge.dismissed" and e["target"] == n.id for e in events)


def test_capture_unknown_id_raises_keyerror(fake_home: Path) -> None:
    import addin.nudges as nudges

    with pytest.raises(KeyError):
        nudges.capture("not-a-real-id")


def test_state_file_is_human_editable_json(fake_home: Path) -> None:
    import addin.nudges as nudges

    nudges.add(text="hello")
    state_path = fake_home / ".hermes" / "curator" / "nudges.json"
    payload = json.loads(state_path.read_text(encoding="utf-8"))
    assert "nudges" in payload and isinstance(payload["nudges"], list)
    assert payload["nudges"][0]["text"] == "hello"
