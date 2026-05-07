"""Unit tests for addin.cli.version."""

import os

from addin.cli.version import format_version


def test_format_version_includes_addin_identity(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    out = format_version(
        addin_version="2.0.1+addin.0",
        upstream_version="0.12.4",
        overlay_sha="abc1234",
    )
    assert "A/addin 2.0.1+addin.0 (Aladdin)" in out


def test_format_version_includes_upstream_line(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    out = format_version(
        addin_version="2.0.1+addin.0",
        upstream_version="0.12.4",
        overlay_sha="abc1234",
    )
    assert "upstream: hermes-agent 0.12.4" in out


def test_format_version_includes_overlay_sha(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    out = format_version(
        addin_version="2.0.1+addin.0",
        upstream_version="0.12.4",
        overlay_sha="abc1234",
    )
    assert "overlay-commit: abc1234" in out


def test_format_version_includes_python(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    out = format_version(
        addin_version="2.0.1+addin.0",
        upstream_version="0.12.4",
        overlay_sha="abc1234",
    )
    # We don't assert exact version (it varies), just that the line is present.
    assert "python:" in out


def test_format_version_resolves_symlinked_home(tmp_path, monkeypatch):
    """When ADDIN_HOME points at a symlink, version output shows '-> target'."""
    real_home = tmp_path / ".hermes"
    real_home.mkdir()
    link_home = tmp_path / ".addin"
    link_home.symlink_to(real_home)
    monkeypatch.setenv("HERMES_HOME", str(link_home))

    out = format_version(
        addin_version="2.0.1+addin.0",
        upstream_version="0.12.4",
        overlay_sha="abc1234",
    )
    assert f"home: {link_home} -> {real_home}" in out


def test_format_version_no_symlink(tmp_path, monkeypatch):
    """When HERMES_HOME is a real dir (not a symlink), no arrow shown."""
    real_home = tmp_path / ".hermes"
    real_home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(real_home))

    out = format_version(
        addin_version="2.0.1+addin.0",
        upstream_version="0.12.4",
        overlay_sha="abc1234",
    )
    assert f"home: {real_home}" in out
    assert " -> " not in out


def test_format_version_falls_back_when_hermes_home_unset(monkeypatch, tmp_path):
    """When HERMES_HOME is unset, falls back to ~/.hermes per spec §4.5."""
    monkeypatch.delenv("HERMES_HOME", raising=False)
    monkeypatch.setenv("HOME", str(tmp_path))
    out = format_version(
        addin_version="2.0.1+addin.0",
        upstream_version="0.12.4",
        overlay_sha="abc1234",
    )
    assert ".hermes" in out
