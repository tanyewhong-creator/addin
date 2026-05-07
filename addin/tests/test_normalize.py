"""Unit tests for addin.cli._normalize."""

import os

from addin.cli._normalize import alias_addin_env_vars


def test_addin_var_creates_hermes_alias():
    env = {"ADDIN_FOO": "bar"}
    alias_addin_env_vars(env)
    assert env == {"ADDIN_FOO": "bar", "HERMES_FOO": "bar"}


def test_existing_hermes_var_wins():
    env = {"ADDIN_FOO": "bar", "HERMES_FOO": "preset"}
    alias_addin_env_vars(env)
    assert env["HERMES_FOO"] == "preset"  # set-don't-override
    assert env["ADDIN_FOO"] == "bar"


def test_non_addin_vars_untouched():
    env = {"PATH": "/usr/bin", "ADDIN_HOME": "/h"}
    alias_addin_env_vars(env)
    assert env["PATH"] == "/usr/bin"
    assert env["HERMES_HOME"] == "/h"


def test_empty_env():
    env = {}
    alias_addin_env_vars(env)
    assert env == {}


def test_addin_underscore_only_prefix_with_no_suffix_skipped():
    # ADDIN_ alone with no suffix should not produce HERMES_ (empty alias).
    env = {"ADDIN_": "x"}
    alias_addin_env_vars(env)
    assert "HERMES_" not in env


def test_real_environ_in_place(monkeypatch):
    monkeypatch.setenv("ADDIN_TEST_PROBE", "abc")
    monkeypatch.delenv("HERMES_TEST_PROBE", raising=False)
    alias_addin_env_vars(os.environ)
    assert os.environ["HERMES_TEST_PROBE"] == "abc"


from addin.cli._normalize import preserve_argv0_and_normalize


def test_preserve_argv0_records_basename():
    argv = ["/usr/local/bin/addin", "setup"]
    env = {}
    preserve_argv0_and_normalize(argv, env)
    assert env["ADDIN_ORIGINAL_ARGV0"] == "addin"


def test_preserve_argv0_normalizes_to_hermes():
    argv = ["/usr/local/bin/addin", "setup"]
    env = {}
    preserve_argv0_and_normalize(argv, env)
    assert argv[0] == "hermes"


def test_preserve_argv0_does_not_overwrite_existing():
    argv = ["/usr/local/bin/addin"]
    env = {"ADDIN_ORIGINAL_ARGV0": "preset"}
    preserve_argv0_and_normalize(argv, env)
    assert env["ADDIN_ORIGINAL_ARGV0"] == "preset"  # setdefault, not overwrite


def test_preserve_argv0_when_invoked_as_hermes():
    argv = ["/home/u/.local/bin/hermes"]
    env = {}
    preserve_argv0_and_normalize(argv, env)
    assert env["ADDIN_ORIGINAL_ARGV0"] == "hermes"
    assert argv[0] == "hermes"  # unchanged but normalized


def test_preserve_argv0_empty_argv():
    """Empty argv list does not raise; ADDIN_ORIGINAL_ARGV0 set to empty string."""
    argv = []
    env = {}
    preserve_argv0_and_normalize(argv, env)
    assert env["ADDIN_ORIGINAL_ARGV0"] == ""
    assert argv == []
