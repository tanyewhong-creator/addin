"""Unit tests for addin.telegram.copy — voice-rule enforcement."""

import pytest

from addin.telegram.copy import lookup, COPY


def test_required_keys_present():
    for key in ["bot.start", "bot.help", "bot.error_offline"]:
        assert key in COPY


def test_lookup_unknown_key_raises_keyerror():
    with pytest.raises(KeyError):
        lookup("does.not.exist")


def test_no_exclamation_marks():
    for key, value in COPY.items():
        assert "!" not in value, f"Exclamation in copy[{key!r}]"


def test_no_forbidden_words():
    forbidden = ["magic", "wishes", "genie", "sparkles"]
    for key, value in COPY.items():
        lowered = value.lower()
        for word in forbidden:
            assert word not in lowered, f"Forbidden {word!r} in copy[{key!r}]"


def test_no_aladdin_in_telegram_copy():
    """Per spec §1.3: Aladdin reference is reserved for README/About only."""
    for key, value in COPY.items():
        assert "Aladdin" not in value and "aladdin" not in value, (
            f"Aladdin reference in telegram copy[{key!r}] — reserve for README"
        )


def test_first_person_i_is_lowercase_in_telegram():
    """Per spec §9.5: agent's first-person 'i' is permitted on Telegram + nudges.

    Confirm we use lowercase 'i' (per addin voice rules — i.e., we DID NOT
    accidentally write 'I am A/addin' with a capital).
    """
    body = lookup("bot.help")
    import re
    matches = re.findall(r"\bI\b", body)
    assert not matches, f"Found capital-I first-person in bot.help: {matches}"
