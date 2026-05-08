"""Tests for addin.api -- Phase 2a Privacy/Evolve panel endpoints."""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture
def fake_hermes_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Build a fake ~/.hermes/ tree and re-import addin.* against it."""
    home = tmp_path / "fakehome"
    hermes = home / ".hermes"
    (hermes / "memories").mkdir(parents=True)
    (hermes / "skills").mkdir()
    (hermes / "logs" / "curator").mkdir(parents=True)

    (hermes / "memories" / "USER.md").write_text(
        "# user memory\n- pref one\n- pref two\n- pref three\n",
        encoding="utf-8",
    )
    (hermes / "memories" / "MEMORY.md").write_text(
        "# project memory\n- fact A\n- fact B\nfreeform\n",
        encoding="utf-8",
    )

    (hermes / "skills" / "alpha").mkdir()
    (hermes / "skills" / "beta").mkdir()

    monkeypatch.setenv("HOME", str(home))

    # Phase 2b: reload modules that cache ~/.hermes paths at import.
    # addin.nudges will be added here in Task 7/8 when it lands.
    import importlib

    import addin.audit as audit_mod
    import addin.api as api_mod
    importlib.reload(audit_mod)
    importlib.reload(api_mod)
    return home


def _client(api_mod) -> TestClient:
    app = FastAPI()
    app.include_router(api_mod.router, prefix="/api/addin")
    return TestClient(app)


def test_memory_overview_counts_entries(fake_hermes_home: Path) -> None:
    import addin.api as api_mod

    client = _client(api_mod)
    r = client.get("/api/addin/memory/overview")
    assert r.status_code == 200
    data = r.json()
    assert data["user_entries"] == 3
    assert data["project_entries"] == 2
    assert data["count"] == 5
    assert data["last_modified"] is not None
    assert data["memories_dir_exists"] is True


def test_data_residency_reports_path_and_size(fake_hermes_home: Path) -> None:
    import addin.api as api_mod

    client = _client(api_mod)
    r = client.get("/api/addin/data-residency")
    assert r.status_code == 200
    data = r.json()
    assert data["home_path"] == "~/.addin"
    # ~/.addin does not exist in the fixture, so it falls back to ~/.hermes.
    assert data["measured_path"].endswith(".hermes")
    assert data["encrypted"] is False
    # We wrote some bytes into the memory files.
    assert data["size_bytes"] > 0


def test_skills_evolve_lists_recent(fake_hermes_home: Path) -> None:
    import addin.api as api_mod

    client = _client(api_mod)
    r = client.get("/api/addin/skills/evolve")
    assert r.status_code == 200
    data = r.json()
    names = {s["name"] for s in data["recent_skills"]}
    assert names == {"alpha", "beta"}
    assert data["skills_dir_exists"] is True
    assert data["pending_nudges"] == 0
    assert data["curator_status"] == "unknown"


def test_memory_overview_handles_missing_dir(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Fresh installs without ~/.hermes/memories/ should not 500."""
    home = tmp_path / "blank"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))

    import importlib

    import addin.api as api_mod
    importlib.reload(api_mod)
    client = _client(api_mod)

    r = client.get("/api/addin/memory/overview")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 0
    assert data["last_modified"] is None
    assert data["memories_dir_exists"] is False


def test_audit_endpoint_returns_recent_events(fake_hermes_home: Path) -> None:
    import addin.api as api_mod
    import addin.audit as audit

    audit.record_event(actor="addin", action="boot", target="dashboard")
    audit.record_event(actor="user", action="nudge.captured", target="x")

    client = _client(api_mod)
    r = client.get("/api/addin/audit")
    assert r.status_code == 200
    data = r.json()
    assert data["total_seen"] == 2
    assert [e["action"] for e in data["events"]] == ["nudge.captured", "boot"]


def test_audit_endpoint_actor_filter(fake_hermes_home: Path) -> None:
    import addin.api as api_mod
    import addin.audit as audit

    audit.record_event(actor="addin", action="boot", target="d")
    audit.record_event(actor="user", action="nudge.captured", target="x")

    client = _client(api_mod)
    r = client.get("/api/addin/audit?actor=user")
    assert r.status_code == 200
    assert all(e["actor"] == "user" for e in r.json()["events"])


def test_audit_endpoint_caps_limit(fake_hermes_home: Path) -> None:
    import addin.api as api_mod

    client = _client(api_mod)
    r = client.get("/api/addin/audit?limit=9999")
    assert r.status_code == 200
    # Endpoint must clamp to <= 500.