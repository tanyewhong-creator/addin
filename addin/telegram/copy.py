"""addin Telegram bot copy — keyed strings for /start, /help, error replies.

Same fallback-on-KeyError pattern as addin/onboarding/copy.py: upstream's
bot dispatcher consults lookup() first, falls back to its own copy on miss.

Spec §9.3 (bot replies) and §9.5 (voice rules).
"""

from __future__ import annotations

COPY: dict[str, str] = {
    "bot.start": (
        "A/addin 2.0.\n"
        "local-first autonomous operator.\n"
        "\n"
        "i remember what you tell me. i run things on schedule. i learn from how you work.\n"
        "\n"
        "to use me here, the operator on the other end (you, on your machine)\n"
        "needs to authorize this chat. run on your machine:\n"
        "\n"
        "   addin pairing code\n"
        "\n"
        "then paste the 6-digit code back here."
    ),
    "bot.help": (
        "i am A/addin, your operator.\n"
        "\n"
        "i respond to plain messages. some shortcuts:\n"
        "\n"
        "  /new        start a fresh conversation\n"
        "  /reset      clear the current context\n"
        "  /model      switch the underlying model\n"
        "  /skills     list active skills\n"
        "  /pause      stop accepting messages temporarily\n"
        "  /platforms  show where i'm reachable\n"
        "\n"
        "ask me to do anything you'd ask in a terminal."
    ),
    "bot.error_offline": (
        "i can't reach my brain right now. (network or api outage upstream.)\n"
        "the operator gets notified — try again in a minute."
    ),
}


def lookup(key: str) -> str:
    """Return the addin override for key. Raises KeyError if not defined.

    Callers should fall back to upstream's built-in copy on KeyError —
    this lets new upstream bot commands ship in upstream voice on the
    first merge after they land.
    """
    return COPY[key]
