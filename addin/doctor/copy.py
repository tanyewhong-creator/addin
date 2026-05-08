"""addin doctor copy — keyed strings overriding hermes_cli/doctor.py output.

Upstream's hermes_cli/doctor.py is patched (with ADDIN-OVERLAY markers)
to consult lookup() before its built-in strings. Missing keys raise
KeyError so the upstream caller falls back to its own string. This
fallback-on-missing pattern means upstream can add new doctor sections
and they will render in upstream voice on the first merge after they
land — we localize on the next addin release.

Spec §10.4 (branded addin doctor) and §1 (identity).
"""

from __future__ import annotations

# Public dict so test_doctor_copy.py can iterate every entry for voice-rule checks.
COPY: dict[str, str] = {
    "doctor.banner.title": "🩺 A/addin Doctor",
}


def lookup(key: str) -> str:
    """Return the addin doctor copy for `key`, or raise KeyError on miss."""
    return COPY[key]
