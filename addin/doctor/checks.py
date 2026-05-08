"""Addin-specific doctor checks — runs after upstream's checks per spec §10.4.

Imports the upstream `check_ok` / `check_warn` / `check_fail` / `check_info`
helpers + `color` / `Colors` so the section visually matches the rest of
`hermes doctor`'s output. Returns a list of issue strings the upstream
summary appends to its own.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import List


def _addin_version() -> str | None:
    """Return the latest addin tag via `git describe`, or None."""
    repo_root = Path(__file__).resolve().parents[2]  # addin/ -> repo
    try:
        result = subprocess.run(
            [
                "git", "-C", str(repo_root),
                "describe", "--tags",
                "--match=v*+addin.*",
                "--abbrev=0",
            ],
            capture_output=True, text=True, timeout=2,
        )
        if result.returncode == 0:
            tag = result.stdout.strip()
            return tag or None
    except (OSError, subprocess.TimeoutExpired):
        pass
    return None


def run_addin_checks() -> List[str]:
    """Run addin-specific checks. Returns list of issue strings for the summary."""
    from hermes_cli.doctor import (
        check_ok, check_warn, check_fail, check_info, color, Colors,
    )

    issues: List[str] = []

    print()
    print(color("◆ A/addin Overlay", Colors.CYAN, Colors.BOLD))

    # 1. Addin version
    version = _addin_version()
    if version:
        check_ok(f"A/addin version: {version}")
    else:
        check_info("A/addin version: unknown (no tag)")

    # 2. Custom skill bundle
    skills_root = Path(os.path.expanduser("~/.hermes/skills/addin"))
    expected = ["audit-log", "private-vault", "ops-brief", "workflow-recorder"]
    for name in expected:
        skill_md = skills_root / name / "SKILL.md"
        if skill_md.exists():
            check_ok(f"Custom skill: {name}")
        else:
            check_warn(f"Custom skill missing: {name}")
            issues.append(f"addin custom skill not installed: {name}")

    # 3. ~/.addin symlink (spec §4.2)
    addin_dir = Path(os.path.expanduser("~/.addin"))
    hermes_dir = Path(os.path.expanduser("~/.hermes"))
    if addin_dir.is_symlink():
        try:
            target = addin_dir.resolve(strict=False)
            if target == hermes_dir.resolve(strict=False):
                check_ok(f"~/.addin symlink → {target}")
            else:
                check_warn(f"~/.addin → {target} (expected ~/.hermes per spec §4.2)")
        except OSError:
            check_warn("~/.addin symlink unreadable")
    elif addin_dir.exists():
        check_warn("~/.addin exists but is not a symlink (run 'addin setup')")
    else:
        check_info("~/.addin symlink not present (run 'addin setup' to create)")

    # 4. Audit log writability
    audit_dir = hermes_dir / "logs" / "audit"
    if audit_dir.exists():
        if os.access(audit_dir, os.W_OK):
            check_ok(f"Audit log dir writable: {audit_dir}")
        else:
            check_fail(f"Audit log dir not writable: {audit_dir}")
            issues.append(f"Audit log directory not writable: {audit_dir}")
    else:
        check_info("Audit log dir not created yet (will appear on first event)")

    # 5. Curator nudge state
    nudge_file = hermes_dir / "curator" / "nudges.json"
    if nudge_file.exists():
        try:
            payload = json.loads(nudge_file.read_text(encoding="utf-8"))
            count = len(payload.get("nudges", [])) if isinstance(payload, dict) else 0
            check_ok(f"Curator nudge state parses ({count} entries)")
        except (OSError, json.JSONDecodeError):
            check_fail(f"Curator nudge state malformed: {nudge_file}")
            issues.append(f"Curator nudge state malformed: {nudge_file}")

    return issues
