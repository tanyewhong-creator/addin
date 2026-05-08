"""Curator nudge state store (Phase 2b).

A nudge is an observation-driven skill suggestion (spec §7.4). The
generator that *creates* nudges is the workflow-recorder skill, planned
for Phase 2c. v2.b ships the state file + helpers + capture/dismiss
actions only — nudges enter the system via ``addin nudge add`` (CLI) or
direct calls into ``addin.nudges.add``.

Storage: a single JSON file at ``~/.hermes/curator/nudges.json``.
Human-editable, atomic write via tmpfile + rename.

Schema:
    {"nudges": [
        {"id": "<8-char hex>",
         "text": "<observation copy>",
         "suggested_command": "<optional shell command>",
         "state": "pending" | "captured" | "dismissed",
         "created": "<ISO-8601 UTC>"}
    ]}
"""

from __future__ import annotations

import json
import os
import secrets
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from addin import audit

_NUDGE_DIR = Path(os.path.expanduser("~/.hermes/curator"))
_NUDGE_FILE = _NUDGE_DIR / "nudges.json"


@dataclass
class Nudge:
    id: str
    text: str
    state: str = "pending"  # pending | captured | dismissed
    suggested_command: str | None = None
    created: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def _load() -> list[Nudge]:
    if not _NUDGE_FILE.exists():
        return []
    try:
        payload = json.loads(_NUDGE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    raw = payload.get("nudges", []) if isinstance(payload, dict) else []
    out: list[Nudge] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            out.append(Nudge(
                id=item["id"],
                text=item["text"],
                state=item.get("state", "pending"),
                suggested_command=item.get("suggested_command"),
                created=item.get("created", ""),
            ))
        except KeyError:
            continue
    return out


def _save(nudges: list[Nudge]) -> None:
    _NUDGE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"nudges": [asdict(n) for n in nudges]}
    tmp = _NUDGE_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    os.replace(tmp, _NUDGE_FILE)


def add(*, text: str, suggested_command: str | None = None) -> Nudge:
    """Append a new pending nudge. Returns the created Nudge."""
    nudges = _load()
    n = Nudge(
        id=secrets.token_hex(4),
        text=text,
        suggested_command=suggested_command,
    )
    nudges.append(n)
    _save(nudges)
    audit.record_event(actor="addin", action="nudge.created", target=n.id)
    return n


def list_pending() -> list[Nudge]:
    return [n for n in _load() if n.state == "pending"]


def list_all() -> list[Nudge]:
    return _load()


def capture(nudge_id: str) -> Nudge:
    """Mark a nudge captured; raises KeyError if unknown."""
    nudges = _load()
    for n in nudges:
        if n.id == nudge_id:
            n.state = "captured"
            _save(nudges)
            audit.record_event(actor="user", action="nudge.captured", target=n.id)
            return n
    raise KeyError(nudge_id)


def dismiss(nudge_id: str) -> Nudge:
    """Mark a nudge dismissed; raises KeyError if unknown."""
    nudges = _load()
    for n in nudges:
        if n.id == nudge_id:
            n.state = "dismissed"
            _save(nudges)
            audit.record_event(actor="user", action="nudge.dismissed", target=n.id)
            return n
    raise KeyError(nudge_id)


def to_dict(n: Nudge) -> dict[str, Any]:
    return asdict(n)
