"""Addin-side API endpoints for inspectability panels (Phase 2a).

Mounted on upstream's FastAPI app via a small marked overlay in
hermes_cli/web_server.py. Routes live under /api/addin/*.

Spec: docs/superpowers/specs/2026-05-07-addin-2.0-design.md §7.3, §7.4.

These endpoints back the Privacy and Evolve panels — they expose
filesystem facts about ~/.hermes/ that already exist on disk, with no
new logging or tracking infrastructure. Phase 2b adds the audit and
egress hooks needed for the v2.b panels.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

from addin import nudges as nudges_mod

from addin import audit as audit_mod

router = APIRouter()


_HERMES_HOME = Path(os.path.expanduser("~/.hermes"))


def _dir_size(p: Path) -> int:
    """Return total bytes under p (best-effort; ignores permission errors)."""
    if not p.exists():
        return 0
    total = 0
    try:
        for root, _dirs, files in os.walk(p, onerror=lambda _e: None):
            for f in files:
                fp = Path(root) / f
                try:
                    total += fp.stat().st_size
                except OSError:
                    continue
    except OSError:
        pass
    return total


def _read_memory_file(path: Path) -> tuple[int, datetime | None]:
    """Return (entry_count, last_modified) for a memory markdown file.

    Entries are top-level bullets — lines starting with '- ' or '* ' at
    column 0. Empty/missing files report 0 entries.
    """
    if not path.exists() or not path.is_file():
        return 0, None
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return 0, None
    count = 0
    for line in text.splitlines():
        if line.startswith("- ") or line.startswith("* "):
            count += 1
    try:
        mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    except OSError:
        mtime = None
    return count, mtime


@router.get("/memory/overview")
def memory_overview() -> dict[str, Any]:
    """Counts and last-modified for ~/.hermes/memories/{MEMORY,USER}.md.

    Returns 0/None for missing files rather than 404 — the UI renders an
    empty-state when no memory exists yet.
    """
    mem_dir = _HERMES_HOME / "memories"
    project_path = mem_dir / "MEMORY.md"
    user_path = mem_dir / "USER.md"

    project_count, project_mtime = _read_memory_file(project_path)
    user_count, user_mtime = _read_memory_file(user_path)

    last_modified: datetime | None = None
    for m in (project_mtime, user_mtime):
        if m is not None and (last_modified is None or m > last_modified):
            last_modified = m

    return {
        "count": project_count + user_count,
        "user_entries": user_count,
        "project_entries": project_count,
        "last_modified": last_modified.isoformat() if last_modified else None,
        "memories_dir": str(mem_dir),
        "memories_dir_exists": mem_dir.exists(),
    }


@router.get("/data-residency")
def data_residency() -> dict[str, Any]:
    """Report where addin data lives on disk and how big it is.

    The "home_path" is the path the user types (`~/.addin`) and the
    "real_path" is its canonical resolution — typically a symlink target
    inside `~/.hermes/`. Encryption is reported as off in v2.a; v2.b adds
    optional at-rest encryption.
    """
    home_typed = Path("~/.addin")
    home_resolved = Path(os.path.expanduser("~/.addin"))
    is_symlink = home_resolved.is_symlink()
    try:
        real = home_resolved.resolve(strict=False)
    except OSError:
        real = home_resolved

    # If ~/.addin doesn't exist (fresh installs without the symlink yet),
    # fall back to ~/.hermes so the panel still shows a real footprint.
    measure_target = real if real.exists() else _HERMES_HOME
    size = _dir_size(measure_target)

    return {
        "home_path": str(home_typed),
        "real_path": str(real),
        "exists": real.exists(),
        "is_symlink": is_symlink,
        "size_bytes": size,
        "encrypted": False,
        "measured_path": str(measure_target),
    }


_AUDIT_LIMIT_MAX = 500


@router.get("/audit")
def audit_log(
    limit: int = 50,
    actor: str | None = None,
    action_prefix: str | None = None,
) -> dict[str, Any]:
    """Return recent audit events, newest-first.

    `limit` is clamped to [1, 500]. `actor` filters by exact actor;
    `action_prefix` filters by action namespace (e.g. "nudge.").
    """
    safe_limit = max(1, min(int(limit), _AUDIT_LIMIT_MAX))
    events = audit_mod.read_events(
        limit=safe_limit, actor=actor, action_prefix=action_prefix
    )
    return {
        "events": events,
        "total_seen": audit_mod.total_seen(),
        "limit": safe_limit,
    }


@router.get("/network-egress")
def network_egress() -> dict[str, Any]:
    """Distinct outbound hosts in the last 24 hours.

    Sourced from the audit log (action='network.egress'). Hosts are
    deduped on the host string; per-host count is included.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    # Pull a generous slice and filter; v2.b log is small.
    raw = audit_mod.read_events(limit=10_000, action_prefix="network.egress")
    counts: dict[str, int] = {}
    for ev in raw:
        ts_raw = ev.get("ts")
        if not isinstance(ts_raw, str):
            continue
        try:
            ts = datetime.fromisoformat(ts_raw)
        except ValueError:
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts < cutoff:
            continue
        host = ev.get("target")
        if not isinstance(host, str):
            continue
        counts[host] = counts.get(host, 0) + 1

    hosts = sorted(
        ({"host": h, "count": c} for h, c in counts.items()),
        key=lambda x: (-x["count"], x["host"]),
    )
    return {
        "window_hours": 24,
        "distinct_hosts": len(counts),
        "hosts": hosts,
    }


@router.get("/skills/evolve")
def skills_evolve() -> dict[str, Any]:
    """Recently-modified skills and curator status for the Evolve tab.

    Returns the 10 most-recently-modified skill directories under
    ~/.hermes/skills/. Curator state is reported as "unknown" in v2.a —
    upstream's curator hook lands in v2.b.
    """
    skills_dir = _HERMES_HOME / "skills"
    recent: list[dict[str, Any]] = []
    if skills_dir.exists() and skills_dir.is_dir():
        try:
            entries = []
            for child in skills_dir.iterdir():
                if not child.is_dir() or child.name.startswith("."):
                    continue
                try:
                    mtime = child.stat().st_mtime
                except OSError:
                    continue
                entries.append((child.name, mtime))
            entries.sort(key=lambda e: e[1], reverse=True)
            for name, mtime in entries[:10]:
                recent.append({
                    "name": name,
                    "modified": datetime.fromtimestamp(
                        mtime, tz=timezone.utc
                    ).isoformat(),
                })
        except OSError:
            pass

    curator_log = _HERMES_HOME / "logs" / "curator"
    curator_last_run: str | None = None
    if curator_log.exists():
        try:
            mtime = curator_log.stat().st_mtime
            curator_last_run = datetime.fromtimestamp(
                mtime, tz=timezone.utc
            ).isoformat()
        except OSError:
            pass

    pending = nudges_mod.list_pending()
    pending_payload = {
        "count": len(pending),
        "items": [nudges_mod.to_dict(n) for n in pending],
    }

    return {
        "recent_skills": recent,
        "skills_dir": str(skills_dir),
        "skills_dir_exists": skills_dir.exists(),
        "curator_status": "unknown",
        "curator_last_run": curator_last_run,
        "pending_nudges": pending_payload,
    }


def _evolve_response_for_action() -> dict[str, Any]:
    """Shared payload returned by capture/dismiss so the UI can update."""
    pending = nudges_mod.list_pending()
    return {
        "pending_nudges": {
            "count": len(pending),
            "items": [nudges_mod.to_dict(n) for n in pending],
        }
    }


@router.post("/nudges/{nudge_id}/capture")
def capture_nudge(nudge_id: str) -> dict[str, Any]:
    try:
        nudges_mod.capture(nudge_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown nudge: {nudge_id}")
    return _evolve_response_for_action()


@router.post("/nudges/{nudge_id}/dismiss")
def dismiss_nudge(nudge_id: str) -> dict[str, Any]:
    try:
        nudges_mod.dismiss(nudge_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown nudge: {nudge_id}")
    return _evolve_response_for_action()
