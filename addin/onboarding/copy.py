"""addin onboarding copy — keyed strings for the 5-screen setup wizard.

Upstream's hermes_cli/setup.py is patched (with ADDIN-OVERLAY markers)
to consult lookup() before its own built-in strings. Missing keys raise
KeyError so the upstream caller can fall back to its own string. This
fallback-on-missing pattern means upstream can add new wizard steps and
they will render in upstream voice on the first merge after they land —
we localize on the next addin release.

Spec §9.2 (wizard screens) and §9.5 (voice rules).
"""

from __future__ import annotations

# Public dict so test_copy.py can iterate every entry for voice-rule checks.
COPY: dict[str, str] = {
    "welcome.title": "welcome to A/addin 2.0.",
    "welcome.body": (
        "a local-first autonomous operator.\n"
        "this is a one-time setup — pick a model, optionally pair telegram,\n"
        "choose a profile name. takes about 90 seconds.\n"
        "\n"
        "press enter to begin, or q to skip and edit ~/.addin/config.yaml manually."
    ),
    "model.title": "model · choose your inference provider.",
    "model.body": (
        "a/addin runs on whatever model you choose. local, hosted, or your own endpoint.\n"
        "\n"
        "  [1] nous portal       (login required)\n"
        "  [2] openrouter        (api key, 200+ models)\n"
        "  [3] openai            (api key)\n"
        "  [4] anthropic         (api key)\n"
        "  [5] custom endpoint   (any openai-compatible url)"
    ),
    "telegram.title": "telegram · connect your remote operator console. (optional — skip with s)",
    "telegram.body": (
        "a/addin reaches you through one external channel: a telegram bot you own.\n"
        "the bot token belongs to you. messages are end-to-end controllable.\n"
        "\n"
        "  1. open @botfather in telegram\n"
        "  2. /newbot, follow the prompts\n"
        "  3. paste the token below"
    ),
    "profile.title": "profile · isolated agent context.",
    "profile.body": (
        "each profile has its own memory, skills, and config.\n"
        "you can have many — work, personal, experiments."
    ),
    "done.summary": (
        "   ╱╲\n"
        "  ╱  ╲   set.\n"
        "  ╲  ╱\n"
        "   ╲╱\n"
        "\n"
        "change anything later: ~/.addin/config.yaml or addin setup"
    ),
}


def lookup(key: str) -> str:
    """Return the addin copy string for a key.

    Args:
        key: A dotted key like 'welcome.body' or 'model.title'.

    Returns:
        The string for the key.

    Raises:
        KeyError: When the key isn't defined. Callers should fall back
            to upstream's built-in copy on KeyError to handle new
            upstream wizard steps gracefully across merges.
    """
    return COPY[key]
