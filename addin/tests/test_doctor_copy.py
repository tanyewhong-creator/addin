"""Unit tests for addin.doctor.copy."""

import pytest

from addin.doctor.copy import lookup, COPY


def test_lookup_known_key_returns_string():
    out = lookup("doctor.banner.title")
    assert isinstance(out, str) and len(out) > 0


def test_lookup_unknown_key_raises_keyerror():
    with pytest.raises(KeyError):
        lookup("nonexistent.key")


def test_banner_title_uses_addin_wordmark():
    """The banner replacement must surface 'A/addin' (the wordmark per spec §1.1)."""
    title = lookup("doctor.banner.title")
    assert "A/addin" in title


def test_banner_title_drops_hermes_branding():
    """Per spec §1.6, the addin doctor must not say 'Hermes' in its banner."""
    title = lookup("doctor.banner.title")
    assert "Hermes" not in title
