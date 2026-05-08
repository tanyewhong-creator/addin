"""JSONL audit log for the Privacy panel (Phase 2b).

Append-only log at ~/.hermes/logs/audit/audit.jsonl. One JSON object per
line. Schema:

    {"ts": "2026-05-08T12:34:56.789012+00:00",
     "actor": "user" | "addin" | "external",
     "action": "skill.captured" | "nudge.dismissed" | "network.egress" | ...,
     "target": "<short identifier>",
     "meta": {<optional extra>}}

Reader returns events newest-first by reverse-streaming the file.
Rotation/compaction is intentionally deferred to a later phase — for v2.b
the log is single-file and grows append-only.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_AUDIT_DIR = Path(os.path.expanduser("~/.hermes/logs/audit"))
_AUDIT_LOG = _AUDIT_DIR / "audit.jsonl"


def _ensure_dir() -> None:
    _AUDIT_DIR.mkdir(parents=True, exist_ok=True)


def record_event(
    *,
    actor: str,
    action: str,
    target: str,
    meta: dict[str, Any] | None = None,
) -> None:
    """Append one JSON event to the audit log. Best-effort — never raises."""
    try:
        _ensure_dir()
        event = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "actor": actor,
            "action": action,
            "target": target,
        }
        if meta:
            event["meta"] = meta
        with _AUDIT_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(event, separators=(",", ":")) + "\n")
    except OSError:
        # Audit logging must never crash the caller. Swallow IO errors.
        return


def read_events(
    *,
    limit: int = 50,
    actor: str | None = None,
    action_prefix: str | None = None,
) -> list[dict[str, Any]]:
    """Return up to `limit` events, newest-first.

    For v2.b we read the entire file and reverse-iterate. The file is
    expected to stay small (low-traffic dashboard); pagination beyond
    `limit` requires a future rotation/index strategy.
    """
    if not _AUDIT_LOG.exists():
        return []
    out: list[dict[str, Any]] = []
    try:
        text = _AUDIT_LOG.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []
    for line in reversed(text.splitlines()):
        if not line.strip():
            continue
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if actor is not None and ev.get("actor") != actor:
            continue
        if action_prefix is not None and not str(ev.get("action", "")).startswith(action_prefix):
            continue
        out.append(ev)
        if len(out) >= limit:
            break
    return out


def total_seen() -> int:
    """Count of events on disk (best-effort; used for pagination metadata)."""
    if not _AUDIT_LOG.exists():
        return 0
    try:
        with _AUDIT_LOG.open("rb") as f:
            return sum(1 for _ in f)
    except OSError:
        return 0
