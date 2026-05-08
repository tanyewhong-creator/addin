"""Tests for the socket-connect egress hook (Phase 2b).

These tests exercise the wrapper by attempting connections to localhost
on an unused port — the wrapper records the audit event before the real
connect fails. No actual network traffic is generated.
"""

from __future__ import annotations

import socket
from pathlib import Path
from unittest.mock import patch

import pytest


@pytest.fixture
def fake_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    home = tmp_path / "fakehome"
    home.mkdir()
    monkeypatch.setenv("HOME", str(home))
    import importlib

    import addin.audit as audit_mod
    import addin.network.egress as egress_mod
    importlib.reload(audit_mod)
    importlib.reload(egress_mod)
    return home


def _try_connect(host: str, port: int, family: int = socket.AF_INET) -> None:
    """Best-effort connect attempt that exercises the wrapper without
    depending on a remote service. Connect failures are swallowed."""
    s = socket.socket(family, socket.SOCK_STREAM)
    s.settimeout(0.1)
    try:
        s.connect((host, port))
    except OSError:
        pass  # connection refused / timeout / unreachable — expected
    finally:
        s.close()


def test_install_hook_records_event_per_connect(fake_home: Path) -> None:
    import addin.audit as audit
    import addin.network.egress as egress

    egress.install_hook()
    try:
        _try_connect("127.0.0.1", 1)
    finally:
        egress.uninstall_hook()

    events = audit.read_events(limit=10, action_prefix="network_egress")
    assert any(
        e["target"] == "127.0.0.1" and e.get("meta", {}).get("port") == 1
        for e in events
    )


def test_install_hook_is_idempotent(fake_home: Path) -> None:
    import addin.network.egress as egress

    egress.install_hook()
    egress.install_hook()  # second call is a no-op
    assert egress.is_installed()
    egress.uninstall_hook()
    assert not egress.is_installed()


def test_hook_skips_unix_and_non_inet(fake_home: Path, tmp_path: Path) -> None:
    """AF_UNIX sockets should not produce egress events."""
    import addin.audit as audit
    import addin.network.egress as egress

    unix_path = str(tmp_path / "addin-egress-test.sock")
    egress.install_hook()
    try:
        try:
            s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            try:
                s.connect(unix_path)
            except OSError:
                pass
            s.close()
        except (OSError, AttributeError):
            pass  # AF_UNIX may not exist on all platforms
    finally:
        egress.uninstall_hook()

    events = audit.read_events(limit=20, action_prefix="network_egress")
    assert all(e["target"] != unix_path for e in events)


def test_hook_safe_when_audit_unavailable(fake_home: Path) -> None:
    """If record_event raises, the connect must still proceed."""
    import addin.network.egress as egress

    egress.install_hook()
    try:
        with patch("addin.audit.record_event", side_effect=RuntimeError("boom")):
            # Connect attempt must still raise (the underlying OSError),
            # NOT the RuntimeError from record_event — proving the
            # wrapper swallowed the audit failure and proceeded to call
            # the real connect.
            with pytest.raises(OSError):
                _try_connect_raising("127.0.0.1", 1)
    finally:
        egress.uninstall_hook()


def _try_connect_raising(host: str, port: int) -> None:
    """Variant of _try_connect that propagates the OSError so the test
    can verify the connect was actually attempted (not short-circuited
    by the audit failure)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.1)
    try:
        s.connect((host, port))
    finally:
        s.close()
