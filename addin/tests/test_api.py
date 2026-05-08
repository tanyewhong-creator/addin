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
    import importlib

    import addin.audit as audit_mod
    import addin.nudges as nudges_mod
    import addin.api as api_mod
    importlib.reload(audit_mod)
    importlib.reload(nudges_mod)
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
    # Phase 2b: pending_nudges is now { "count": int, "items": [Nudge] }.
    assert data["pending_nudges"] == {"count": 0, "items": []}
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
    # Endpoint must clamp limit to <= 500.
    assert r.json()["limit"] == 500


def test_network_egress_endpoint_returns_distinct_24h(fake_hermes_home: Path) -> None:
    import addin.api as api_mod
    import addin.audit as audit

    audit.record_event(
        actor="addin", action="network.egress", target="api.openai.com",
        meta={"port": 443},
    )
    audit.record_event(
        actor="addin", action="network.egress", target="api.openai.com",
        meta={"port": 443},
    )
    audit.record_event(
        actor="addin", action="network.egress", target="github.com",
        meta={"port": 443},
    )

    client = _client(api_mod)
    r = client.get("/api/addin/network-egress")
    assert r.status_code == 200
    data = r.json()
    assert data["window_hours"] == 24
    assert data["distinct_hosts"] == 2
    assert {h["host"] for h in data["hosts"]} == {"api.openai.com", "github.com"}
    counts = {h["host"]: h["count"] for h in data["hosts"]}
    assert counts == {"api.openai.com": 2, "github.com": 1}
    # Sort: highest count first, then alpha â api.openai.com (2) before github.com (1).
    assert data["hosts"][0]["host"] == "api.openai.com"


def test_network_egress_endpoint_excludes_old_events(
    fake_hermes_home: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Events older than 24h must be excluded from the distinct-host set."""
    import json
    from datetime import datetime, timedelta, timezone

    import addin.api as api_mod
    import addin.audit as audit

    # Write one fresh event, then an ancient one by hand.
    audit.record_event(
        actor="addin", action="network.egress", target="fresh.example.com",
        meta={"port": 443},
    )
    log = fake_hermes_home / ".hermes" / "logs" / "audit" / "audit.jsonl"
    old_ts = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    with log.open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "ts": old_ts, "actor": "addin",
            "action": "network.egress", "target": "ancient.example.com",
            "meta": {"port": 443},
        }) + "\n")

    client = _client(api_mod)
    r = client.get("/api/addin/network-egress")
    hosts = {h["host"] for h in r.json()["hosts"]}
    assert "fresh.example.com" in hosts
    assert "ancient.example.com" not in hosts

def test_skills_evolve_returns_real_nudges(fake_hermes_home: Path) -> None:
    import addin.api as api_mod
    import addin.nudges as nudges

    n = nudges.add(text="capture me")
    client = _client(api_mod)
    r = client.get("/api/addin/skills/evolve")
    data = r.json()
    assert data["pending_nudges"]["count"] == 1
    assert data["pending_nudges"]["items"][0]["id"] == n.id


def test_capture_endpoint_marks_captured(fake_hermes_home: Path) -> None:
    import addin.api as api_mod
    import addin.nudges as nudges

    n = nudges.add(text="capture me")
    client = _client(api_mod)
    r = client.post(f"/api/addin/nudges/{n.id}/capture")
    assert r.status_code == 200
    assert r.json()["pending_nudges"]["count"] == 0


def test_dismiss_endpoint_marks_dismissed(fake_hermes_home: Path) -> None:
    import addin.api as api_mod
    import addin.nudges as nudges

    n = nudges.add(text="dismiss me")
    client = _client(api_mod)
    r = client.post(f"/api/addin/nudges/{n.id}/dismiss")
    assert r.status_code == 200
    assert r.json()["pending_nudges"]["count"] == 0


def test_capture_unknown_id_returns_404(fake_hermes_home: Path) -> None:
    import addin.api as api_mod

    client = _client(api_mod)
    r = client.post("/api/addin/nudges/deadbeef/capture")
    assert r.status_code == 404
