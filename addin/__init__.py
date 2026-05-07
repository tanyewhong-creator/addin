"""A/addin 2.0 — local-first autonomous AI operator.

A soft fork of hermes-agent (https://github.com/NousResearch/hermes-agent),
MIT-licensed. The addin/ package contains all overlay code that brands the
user-facing surfaces while leaving upstream internals untouched.

Spec: docs/superpowers/specs/2026-05-07-addin-2.0-design.md
"""

__all__ = ["__version__"]

# Populated at install time by scripts/addin-install.sh; falls back to dev marker.
try:
    from addin._overlay_meta import ADDIN_VERSION as __version__
except ImportError:
    __version__ = "0.0.0+addin.dev"
