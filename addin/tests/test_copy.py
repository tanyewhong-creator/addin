"""Unit tests for addin.onboarding.copy."""

import pytest

from addin.onboarding.copy import lookup, COPY


def test_lookup_known_key_returns_string():
    out = lookup("welcome.title")
    assert isinstance(out, str) and len(out) > 0


def test_lookup_lowercase_first_words_in_all_copy():
    """All addin copy is lowercase per COPY-STYLE.md (except wordmark 'A/addin').

    Iterates EVERY entry in COPY, every line, every first word — so a
    contributor introducing a Capitalized first word in any screen
    fails the suite, not just welcome.body.
    """
    for key, value in COPY.items():
        if not isinstance(value, str):
            continue
        for line in value.split("\n"):
            line = line.strip()
            if not line:
                continue
            # Skip lines whose first char is non-alpha (numbers, punctuation, indents).
            if not line[0].isalpha():
                continue
            # Wordmark forms are permitted with capital A.
            if line.startswith("A/addin") or line.startswith("a/addin"):
                continue
            first_word = line.split(" ", 1)[0].rstrip(".,;:")
            assert first_word == first_word.lower(), (
                f"Capitalized first word {first_word!r} in copy[{key!r}] line {line!r}"
            )


def test_lookup_unknown_key_raises_keyerror():
    with pytest.raises(KeyError):
        lookup("nonexistent.key")


def test_lookup_forbidden_words_absent():
    """Per COPY-STYLE.md: no 'magic', 'wishes', 'genie', 'sparkles'."""
    forbidden = ["magic", "wishes", "genie", "sparkles"]
    for key, value in COPY.items():
        if not isinstance(value, str):
            continue
        lowered = value.lower()
        for word in forbidden:
            assert word not in lowered, (
                f"Forbidden word {word!r} in copy[{key!r}]"
            )


def test_lookup_no_exclamation_marks():
    """Per COPY-STYLE.md: no exclamation marks."""
    for key, value in COPY.items():
        if not isinstance(value, str):
            continue
        assert "!" not in value, f"Exclamation in copy[{key!r}]"


def test_lookup_aladdin_pronunciation_only_in_origin_or_readme():
    """Per spec §1.3: the Aladdin reference is reserved for README/About.
    The CLI copy keys do NOT mention Aladdin.
    """
    for key, value in COPY.items():
        if not isinstance(value, str):
            continue
        assert "Aladdin" not in value and "aladdin" not in value, (
            f"Aladdin reference in CLI copy[{key!r}] — reserve for README"
        )


def test_required_keys_present():
    """The 5 onboarding screens from spec §9.2 are all keyed."""
    required = [
        "welcome.title",
        "welcome.body",
        "model.title",
        "model.body",
        "telegram.title",
        "telegram.body",
        "profile.title",
        "profile.body",
        "done.summary",
    ]
    for key in required:
        assert key in COPY, f"Missing required onboarding key: {key}"
