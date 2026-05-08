"""TCP egress hook: monkey-patch ``socket.socket.connect`` so each
outbound IPv4/IPv6 connect produces a ``network.egress`` audit event.

The hook is best-effort and intentionally narrow:
  - AF_INET and AF_INET6 only (skip AF_UNIX, AF_NETLINK, …).
  - The wrapper calls ``audit.record_event`` *before* the real connect,
    inside a try/except — never blocks or reorders the underlying call.
  - ``install_hook()`` is idempotent; ``uninstall_hook()`` restores the
    original method (used by tests).

Limitations: only catches connections that go through Python's
``socket.socket.connect``. Native code (e.g. C extensions opening their
own sockets) bypasses this. For v2.b that covers httpx/requests/urllib3,
which is what the agent uses.
"""

from __future__ import annotations

import socket
from typing import Any, Callable

from addin import audit

_INSTALLED = False
_ORIGINAL: Callable[..., Any] | None = None


def is_installed() -> bool:
    return _INSTALLED


def _extract_host_port(address: Any) -> tuple[str, int] | None:
    """Pull (host, port) out of a connect argument; None if not IPv4/IPv6."""
    if not isinstance(address, tuple) or len(address) < 2:
        return None
    host, port = address[0], address[1]
    if not isinstance(host, str) or not isinstance(port, int):
        return None
    return host, port


def _make_wrapper(original: Callable[..., Any]) -> Callable[..., Any]:
    def connect(self: socket.socket, address: Any) -> Any:
        if self.family in (socket.AF_INET, socket.AF_INET6):
            hp = _extract_host_port(address)
            if hp is not None:
                host, port = hp
                try:
                    audit.record_event(
                        actor="addin",
                        action="network.egress",
                        target=host,
                        meta={"port": port, "family": int(self.family)},
                    )
                except Exception:  # noqa: BLE001 — never block the call
                    pass
        return original(self, address)

    connect.__addin_egress_wrapper__ = True  # type: ignore[attr-defined]
    return connect


def install_hook() -> None:
    """Install the egress wrapper on ``socket.socket.connect``. Idempotent."""
    global _INSTALLED, _ORIGINAL
    if _INSTALLED:
        return
    current = socket.socket.connect
    if getattr(current, "__addin_egress_wrapper__", False):
        # A previous interpreter run left it installed (shouldn't happen in
        # practice, but be defensive).
        _INSTALLED = True
        return
    _ORIGINAL = current
    socket.socket.connect = _make_wrapper(current)  # type: ignore[method-assign]
    _INSTALLED = True


def uninstall_hook() -> None:
    """Restore the original ``socket.socket.connect``. Used by tests.

    Defensive: if a third party (gevent, APM agent, etc.) installed its
    own wrapper *over* ours after our install, blindly restoring would
    clobber the chain. We only restore when the current connect is
    still our wrapper. Otherwise we just clear our state and leave
    whatever's installed alone.
    """
    global _INSTALLED, _ORIGINAL
    current = socket.socket.connect
    if (
        _INSTALLED
        and _ORIGINAL is not None
        and getattr(current, "__addin_egress_wrapper__", False)
    ):
        socket.socket.connect = _ORIGINAL  # type: ignore[method-assign]
    _ORIGINAL = None
    _INSTALLED = False
