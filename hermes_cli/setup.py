"""Interactive setup wizard for Hermes Agent (config lives in ~/.hermes/).

Independently-runnable sections: Model & Provider, Terminal Backend, Agent Settings, Messaging
Platforms, Tools. Section bodies live in sibling setup_* modules and are re-exported here; they
resolve shared prompt/config helpers lazily through this module so test patches on
``hermes_cli.setup.<name>`` keep working.
"""

import importlib.util
import logging
import os
import re
import sys
import copy
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path
from typing import Callable

from hermes_cli.curses_ui import MenuNavigationEvent, MenuNavigationStart
# Config helpers are re-exported (tests patch them on this module). display_hermes_home is
# imported lazily at call sites (stale-module safety during hermes update).
from hermes_cli.config import (
    cfg_get, DEFAULT_CONFIG, get_hermes_home, get_config_path, get_env_path, load_config, save_config,
    save_env_value, remove_env_value, get_env_value, ensure_hermes_home,
)
from hermes_cli.colors import Colors, color
from hermes_cli.cli_output import print_error, print_info, print_success, print_warning
from hermes_cli.secret_prompt import masked_secret_prompt

logger = logging.getLogger(__name__)

# ADDIN-OVERLAY-BEGIN: addin copy override per spec §9.4
def _resolve_copy(key: str, fallback: str) -> str:
    """Return the addin override for key, falling back to fallback on miss.

    Decoupled from the rest of this module so removing the addin overlay
    is a one-block delete.
    """
    try:
        from addin.onboarding.copy import lookup
        return lookup(key)
    except (ImportError, KeyError):
        return fallback
# ADDIN-OVERLAY-END

PROJECT_ROOT = Path(__file__).parent.parent.resolve()

_DOCS_BASE = "https://hermes-agent.nousresearch.com/docs"
_BRACKETED_PASTE_PATTERN = re.compile(r"\x1b\[\s*200~|\x1b\[\s*201~")


def print_header(title: str, *, gap: bool = False):
    """Print a section header (``gap`` adds an extra blank line before it)."""
    if gap:
        print()
    print()
    print(color(f"◆ {title}", Colors.CYAN, Colors.BOLD))


def _info(*lines: str | None) -> None:
    """print_info each line in order; ``None`` emits a bare blank ``print()``."""
    for line in lines:
        print() if line is None else print_info(line)


def _sub_dict(parent: dict, key: str) -> dict:
    """``parent[key]`` as a dict, replacing a missing or non-dict value with ``{}``."""
    child = parent.get(key)
    if not isinstance(child, dict):
        child = parent[key] = {}
    return child


def _current_reasoning_effort(config: dict) -> str:
    agent_cfg = config.get("agent")
    if isinstance(agent_cfg, dict):
        return str(agent_cfg.get("reasoning_effort") or "").strip().lower()
    return ""


def _set_reasoning_effort(config: dict, effort: str) -> None:
    _sub_dict(config, "agent")["reasoning_effort"] = effort


def is_interactive_stdin() -> bool:
    """Return True when stdin looks like a usable interactive TTY."""
    try:
        return bool(sys.stdin.isatty())
    except Exception:
        return False


def print_noninteractive_setup_guidance(reason: str | None = None) -> None:
    """Print guidance for headless/non-interactive setup flows."""
    print()
    print(color("⚕ Hermes Setup — Non-interactive mode", Colors.CYAN, Colors.BOLD))
    print()
    if reason:
        print_info(reason)
    _info("The interactive wizard cannot be used here.", None,
          "Configure Hermes using environment variables or config commands:",
          "  hermes config set model.provider custom",
          "  hermes config set model.base_url http://localhost:8080/v1",
          "  hermes config set model.default your-model-name", None,
          "Or set OPENROUTER_API_KEY / OPENAI_API_KEY in your environment.",
          "Run 'hermes setup' in an interactive terminal to use the full wizard.", None)


def _sanitize_pasted_input(value: str) -> str:
    """Strip terminal bracketed-paste control markers from pasted text."""
    return _BRACKETED_PASTE_PATTERN.sub("", value) if isinstance(value, str) and value else value


def prompt(question: str, default: str = None, password: bool = False) -> str:
    """Prompt for input with optional default."""
    display = color(f"{question} [{default}]: " if default else f"{question}: ", Colors.YELLOW)
    try:
        if password:
            value = masked_secret_prompt(display)
        else:
            from hermes_cli.cli_output import line_input
            value = line_input(display)
        return _sanitize_pasted_input(value).strip() or default or ""
    except (KeyboardInterrupt, EOFError):
        print()
        sys.exit(1)


# ── Setup navigation (Escape cancels, Left arrow goes back): a ContextVar state machine shared
# with the curses menus. ──


class _SetupControlFlow(BaseException):
    """Bypass provider error handlers that intentionally catch ``Exception`` so navigation reaches
    the outer state machine unchanged and it can replay the prior prompt."""


class _SetupCancelled(_SetupControlFlow):
    """Internal control flow for cancelling the interactive setup wizard."""


class _SetupGoBack(_SetupControlFlow):
    """Internal control flow for returning to an earlier setup choice."""

    def __init__(self, prompt_index: int):
        super().__init__(prompt_index)
        self.prompt_index = prompt_index


class _SetupNavigationState:
    """Per-invocation navigation state for the synchronous setup wizard."""

    def __init__(self, *, section_index: int = -1, prompt_index: int = 0):
        self.reset(section_index)
        self.prompt_index = prompt_index

    def reset(self, section_index: int = -1, replay: list | None = None) -> None:
        """Rewind per-section counters (entering a section, or leaving the wizard)."""
        self.section_index = section_index
        self.prompt_index = 0
        self.active_prompt_index = -1
        self.resolved_choices: list[object] = []
        self.replay_choices: list[object] = copy.deepcopy(replay or [])


_SETUP_NAVIGATION: ContextVar[_SetupNavigationState | None] = ContextVar("hermes_setup_navigation", default=None)


def _handle_setup_menu_navigation(event: MenuNavigationEvent, value: object = None) -> MenuNavigationStart | None:
    """Translate shared curses menu events into setup control flow."""
    state = _SETUP_NAVIGATION.get()
    if state is None:
        return None
    if event is MenuNavigationEvent.BEGIN:
        if state.section_index < 0:
            state.active_prompt_index = -1
            return MenuNavigationStart()
        idx = state.active_prompt_index = state.prompt_index
        state.prompt_index += 1
        allow_back = state.section_index > 0 or idx > 0
        if idx < len(state.replay_choices):
            return MenuNavigationStart(allow_back=allow_back, replay_value=copy.deepcopy(state.replay_choices[idx]))
        return MenuNavigationStart(allow_back=allow_back)
    if event is MenuNavigationEvent.RESOLVE:
        prompt_index = state.active_prompt_index
        if prompt_index >= 0:  # replace this answer and drop every later one
            state.resolved_choices[prompt_index:] = [copy.deepcopy(value)]
        return None
    if event is MenuNavigationEvent.CANCEL:
        raise _SetupCancelled()
    if event is MenuNavigationEvent.BACK:
        raise _SetupGoBack(state.active_prompt_index)
    return None


@contextmanager
def _setup_navigation_scope():
    """Install and reliably restore the setup menu navigation context."""
    from hermes_cli.curses_ui import reset_menu_navigation_handler, set_menu_navigation_handler
    token = _SETUP_NAVIGATION.set(_SetupNavigationState())
    menu_token = set_menu_navigation_handler(_handle_setup_menu_navigation)
    try:
        yield
    finally:
        reset_menu_navigation_handler(menu_token)
        _SETUP_NAVIGATION.reset(token)


def _run_setup_steps(steps: list[tuple[str, Callable[[], None]]]) -> None:
    """Run setup sections with left-arrow navigation: at a section's first choice it returns to
    the previous section; from a later choice it replays earlier selections invisibly and reopens
    only the preceding prompt."""
    state = _SETUP_NAVIGATION.get()
    section_index = 0
    answers_by_section: dict[int, list[object]] = {}
    replay_by_section: dict[int, list[object]] = {}

    def _record_answers() -> None:
        if state is not None:
            answers_by_section[section_index] = copy.deepcopy(state.resolved_choices)

    try:
        while section_index < len(steps):
            label, action = steps[section_index]
            if state is not None:
                state.reset(section_index, replay_by_section.pop(section_index, []))
            try:
                action()
            except _SetupGoBack as navigation:
                _record_answers()
                if navigation.prompt_index > 0:
                    previous_index = section_index
                    target_prompt = navigation.prompt_index - 1
                else:
                    previous_index = max(0, section_index - 1)
                    target_prompt = max(0, len(answers_by_section.get(previous_index, [])) - 1)
                replay_by_section[previous_index] = copy.deepcopy(
                    answers_by_section.get(previous_index, [])[:target_prompt])
                print()
                if previous_index == section_index:
                    print_info(f"Returning to the previous choice in {label}...")
                else:
                    print_info(f"Returning to {steps[previous_index][0]}...")
                section_index = previous_index
                continue
            _record_answers()
            section_index += 1
    finally:
        if state is not None:
            state.reset()


def run_setup_action_with_navigation(
    label: str, action: Callable[[], None], *, cancelled_message: str = "Setup cancelled."
) -> None:
    """Run a setup-style menu flow with Escape and nested Left navigation — for commands such as
    ``hermes model`` that use the wizard's pickers outside ``run_setup_wizard``."""
    with _setup_navigation_scope():
        try:
            _run_setup_steps([(label, action)])
        except _SetupCancelled:
            _info(None, cancelled_message)


# ── Prompt primitives ──


def _curses_prompt_choice(question: str, choices: list, default: int = 0, description: str | None = None) -> int:
    """Single-select menu using curses. Delegates to curses_radiolist."""
    from hermes_cli.curses_ui import curses_radiolist
    return curses_radiolist(question, choices, selected=default, cancel_returns=-1, description=description)


def prompt_choice(question: str, choices: list, default: int = 0, description: str | None = None) -> int:
    """Prompt for a choice from a list with arrow key navigation. Escape cancels an active setup
    wizard; outside setup it keeps the default (the curses component owns its own numbered
    fallback, so a cancel result must never open another prompt). Ctrl+C exits the wizard."""
    idx = _curses_prompt_choice(question, choices, default, description=description)
    if idx < 0:
        return default
    if idx == default:
        _info("  Skipped (keeping current)", None)
        return default
    print()
    return idx


def is_noninteractive() -> bool:
    """True when no human is available to answer a prompt: the dashboard/desktop spawn CLI actions
    with ``stdin=DEVNULL`` and ``HERMES_NONINTERACTIVE=1`` (``hermes_cli/web_server.py``), where a
    prompt that aborts on EOF would kill the spawned action — callers fall back to their default."""
    return os.environ.get("HERMES_NONINTERACTIVE", "").strip().lower() in {"1", "true", "yes", "on"}


def prompt_yes_no(question: str, default: bool = True) -> bool:
    """Prompt for yes/no. Ctrl+C exits; empty input, ``HERMES_NONINTERACTIVE=1`` or a
    closed/redirected stdin return ``default`` instead of aborting the whole process."""
    if is_noninteractive():
        return default
    # Inside setup, route binary selections through the curses menu so ESC and left-arrow work
    # consistently; every other caller keeps the traditional line prompt.
    if _SETUP_NAVIGATION.get() is not None:
        return _curses_prompt_choice(question, ["Yes", "No"], 0 if default else 1) == 0
    default_str = "Y/n" if default else "y/N"
    while True:
        try:
            value = input(color(f"{question} [{default_str}]: ", Colors.YELLOW)).strip().lower()
        except KeyboardInterrupt:
            print()
            sys.exit(1)
        except EOFError:
            # No stdin (closed/redirected, e.g. stdin=DEVNULL): accept the default so the caller
            # proceeds unattended instead of failing the whole command.
            print()
            return default
        answer = {"": default, "y": True, "yes": True, "n": False, "no": False}.get(value)
        if answer is not None:
            return answer
        print_error("Please enter 'y' or 'n'")


def prompt_checklist(title: str, items: list, pre_selected: list = None) -> list:
    """Multi-select checklist; returns the sorted indices of selected items. ``pre_selected``
    start checked; Space toggles, Enter confirms, cancel keeps the pre-selection."""
    from hermes_cli.curses_ui import curses_checklist
    pre = set(pre_selected or [])
    return sorted(curses_checklist(title, items, pre, cancel_returns=pre))


def _section_rule(title: str) -> None:
    """Blank-padded cyan ``─── title ───`` divider used by the key-entry screens."""
    print()
    print(color(f"  ─── {title} ───", Colors.CYAN))
    print()


def _prompt_api_key(var: dict):
    """Display a nicely formatted API key input screen for a single env var."""
    tools = var.get("tools", [])
    tools_str = ", ".join(tools[:3])
    if len(tools) > 3:
        tools_str += f", +{len(tools) - 3} more"
    _section_rule(var.get("description", var["name"]))
    if tools_str:
        print_info(f"  Enables: {tools_str}")
    if var.get("url"):
        print_info(f"  Get your key at: {var['url']}")
    print()
    _prompt_and_save_env_var(var, "  ✓ Saved", "  Skipped (configure later with 'hermes setup')")


def _prompt_and_save_env_var(var: dict, saved_msg: str, skipped_msg: str) -> None:
    """Prompt for one env-var value (masked when secret); persist and confirm, or report the skip."""
    value = prompt(f"  {var.get('prompt', var['name'])}", password=bool(var.get("password")))
    if value:
        save_env_value(var["name"], value)
        print_success(saved_msg)
    else:
        print_warning(skipped_msg)


def _module_installed(name: str) -> bool:
    try:
        return importlib.util.find_spec(name) is not None
    except Exception:
        return False


def _print_banner(*lines: str) -> None:
    """Print the magenta box banner: top border, the given body lines, bottom border."""
    print()
    print(color("┌─────────────────────────────────────────────────────────┐", Colors.MAGENTA))
    for line in lines:
        print(color(line, Colors.MAGENTA))
    print(color("└─────────────────────────────────────────────────────────┘", Colors.MAGENTA))


# ── Section 1: Model & Provider Configuration ──


def setup_model_provider(config: dict, *, quick: bool = False):
    """Configure the inference provider and default model via the ``hermes model`` flow (one code
    path — any provider added there is available here). *quick* is accepted for the first-time
    quick setup caller; rotation, vision and TTS keep safe defaults either way."""
    from hermes_cli.config import load_config, save_config
<<<<<<< HEAD

    # ADDIN-OVERLAY-BEGIN: addin copy model.title + model.body
    print_header(_resolve_copy("model.title", "Inference Provider"))
    print_info(_resolve_copy("model.body", "Choose how to connect to your main chat model."))
    # ADDIN-OVERLAY-END
    print_info(f"   Guide: {_DOCS_BASE}/integrations/providers")
    print()

    # Delegate to the shared hermes model flow — handles provider picker,
    # credential prompting, model selection, and config persistence.
=======
    print_header("Inference Provider")
    _info("Choose how to connect to your main chat model.",
          f"   Guide: {_DOCS_BASE}/integrations/providers", None)
>>>>>>> 2237be355906fbe6065ce1815711eee52b2d646e
    from hermes_cli.main import select_provider_and_model
    try:
        select_provider_and_model()
    except (SystemExit, KeyboardInterrupt):
        _info(None, "Provider setup skipped.")
    except Exception as exc:
        logger.debug("select_provider_and_model error during setup: %s", exc)
        print_warning(f"Provider setup encountered an error: {exc}")
        print_info("You can try again later with: hermes model")

    # Re-sync from disk in place: cmd_model saved via its own load/save cycle and the wizard's
    # final save_config(config) must not clobber it with stale values. Rotation, vision and TTS
    # keep safe defaults (configure via `hermes auth add` / `hermes setup tts`).
    config.clear()
    config.update(load_config())
    save_config(config)


# ── Section 3: Agent Settings ──


def _apply_default_agent_settings(config: dict):
    """Apply recommended defaults for all agent settings without prompting."""
    config.setdefault("agent", {})["max_turns"] = 150
    # config.yaml is authoritative for max_turns (the gateway bridges it into HERMES_MAX_ITERATIONS);
    # a stale .env entry silently shadowing it caused the 60-vs-500 bug, so drop it.
    remove_env_value("HERMES_MAX_ITERATIONS")
    config.setdefault("display", {})["tool_progress"] = "all"
    config.setdefault("compression", {})["enabled"] = True
    config["compression"]["threshold"] = 0.50
    save_config(config)
    print_success("Applied recommended defaults:")
    _info("  Max iterations: 150", "  Tool progress: all", "  Compression threshold: 0.50",
          "  Run `hermes setup agent` later to customize.")


def _prompt_number(label: str, current, cast=int):
    """Prompt for a number; ``None`` when the answer does not parse."""
    try:
        return cast(prompt(label, str(current)))
    except ValueError:
        return None


def _prompt_int_setting(section: dict, key: str, label: str, current, accept) -> None:
    """Prompt for an int; store it under *key* only when it parses and *accept* holds."""
    value = _prompt_number(label, current)
    if value is not None and accept(value):
        section[key] = value


_TOOL_PROGRESS_HELP = (
    "Tool Progress Display", "Controls how much tool activity is shown (CLI and messaging).",
    "  off     — Silent, just the final response",
    "  new     — Show tool name only when it changes (less noise)",
    "  all     — Show every tool call with a short preview",
    "  verbose — Full args, results, and debug logs",
    "  log     — Silent in chat; write every tool call to ~/.hermes/logs/tool_calls.log (gateway only)",
)
def setup_agent_settings(config: dict):
    """Configure agent behavior: iterations, progress display and compression."""
    print_header("Agent Settings")
    _info(f"   Guide: {_DOCS_BASE}/user-guide/configuration", None)

    # ── Max Iterations ── (config.yaml is authoritative; never surface a stale legacy .env value)
    # If a legacy .env entry is still around (from pre-PR#18413 setups), prefer the config value so we don't
    # surface a stale number to the user.
    current_max = str(cfg_get(config, "agent", "max_turns", default=90))
    _info("Maximum tool-calling iterations per conversation.",
          "Higher = more complex tasks, but costs more tokens.",
          f"Press Enter to keep {current_max}. Use 90 for most tasks or 150+ for open exploration.")
    max_iter = _prompt_number("Max iterations", current_max)
    if max_iter is None:
        print_warning("Invalid number, keeping current value")
    elif max_iter > 0:
        # config.yaml only; gateway/run.py derives HERMES_MAX_ITERATIONS from agent.max_turns.
        config.setdefault("agent", {})["max_turns"] = max_iter
        config.pop("max_turns", None)
        remove_env_value("HERMES_MAX_ITERATIONS")
        print_success(f"Max iterations set to {max_iter}")

    # ── Tool Progress Display ──
    _info("", *_TOOL_PROGRESS_HELP)
    current_mode = cfg_get(config, "display", "tool_progress", default="all")
    mode = prompt("Tool progress mode", current_mode)
    if mode.lower() in {"off", "new", "all", "verbose", "log"}:
        config.setdefault("display", {})["tool_progress"] = mode.lower()
        save_config(config)
        print_success(f"Tool progress set to: {mode.lower()}")
    else:
        print_warning(f"Unknown mode '{mode}', keeping '{current_mode}'")

    # ── Context Compression ──
    print_header("Context Compression")
    _info("Automatically summarizes old messages when context gets too long.",
          "Higher threshold = compress later (use more context). Lower = compress sooner.")
    config.setdefault("compression", {})["enabled"] = True
    current_threshold = cfg_get(config, "compression", "threshold", default=0.50)
    threshold = _prompt_number("Compression threshold (0.5-0.95)", current_threshold, float)
    if threshold is not None and 0.5 <= threshold <= 0.95:
        config["compression"]["threshold"] = threshold
    print_success(f"Context compression threshold set to {config['compression'].get('threshold', 0.50)}")

    save_config(config)


<<<<<<< HEAD
# =============================================================================
# Section 4: Messaging Platforms (Gateway)
# =============================================================================


def _setup_telegram():
    """Configure Telegram bot credentials and allowlist."""
    # ADDIN-OVERLAY-BEGIN: addin copy telegram.title
    print_header(_resolve_copy("telegram.title", "Telegram"))
    # ADDIN-OVERLAY-END
    existing = get_env_value("TELEGRAM_BOT_TOKEN")
    if existing:
        print_info("Telegram: already configured")
        if not prompt_yes_no("Reconfigure Telegram?", False):
            # Check missing allowlist on existing config
            if not get_env_value("TELEGRAM_ALLOWED_USERS"):
                print_info("⚠️  Telegram has no user allowlist - anyone can use your bot!")
                if prompt_yes_no("Add allowed users now?", True):
                    print_info("   To find your Telegram user ID: message @userinfobot")
                    allowed_users = prompt("Allowed user IDs (comma-separated)")
                    if allowed_users:
                        save_env_value("TELEGRAM_ALLOWED_USERS", allowed_users.replace(" ", ""))
                        print_success("Telegram allowlist configured")
            return

    # ADDIN-OVERLAY-BEGIN: addin copy telegram.body
    print_info(_resolve_copy("telegram.body", "Create a bot via @BotFather on Telegram"))
    # ADDIN-OVERLAY-END
    import re

    while True:
        token = prompt("Telegram bot token", password=True)
        if not token:
            return
        if not re.match(r"^\d+:[A-Za-z0-9_-]{30,}$", token):
            print_error(
                "Invalid token format. Expected: <numeric_id>:<alphanumeric_hash> "
                "(e.g., 123456789:ABCdefGHI-jklMNOpqrSTUvwxYZ)"
            )
            continue
        break
    save_env_value("TELEGRAM_BOT_TOKEN", token)
    print_success("Telegram token saved")

    print()
    print_info("🔒 Security: Restrict who can use your bot")
    print_info("   To find your Telegram user ID:")
    print_info("   1. Message @userinfobot on Telegram")
    print_info("   2. It will reply with your numeric ID (e.g., 123456789)")
    print()
    allowed_users = prompt(
        "Allowed user IDs (comma-separated, leave empty for open access)"
    )
    if allowed_users:
        save_env_value("TELEGRAM_ALLOWED_USERS", allowed_users.replace(" ", ""))
        print_success("Telegram allowlist configured - only listed users can use the bot")
    else:
        print_info("⚠️  No allowlist set - anyone who finds your bot can use it!")

    print()
    print_info("📬 Home Channel: where Hermes delivers cron job results,")
    print_info("   cross-platform messages, and notifications.")
    print_info("   For Telegram DMs, this is your user ID (same as above).")

    first_user_id = allowed_users.split(",")[0].strip() if allowed_users else ""
    if first_user_id:
        if prompt_yes_no(f"Use your user ID ({first_user_id}) as the home channel?", True):
            save_env_value("TELEGRAM_HOME_CHANNEL", first_user_id)
            print_success(f"Telegram home channel set to {first_user_id}")
        else:
            home_channel = prompt("Home channel ID (or leave empty to set later with /set-home in Telegram)")
            if home_channel:
                save_env_value("TELEGRAM_HOME_CHANNEL", home_channel)
    else:
        print_info("   You can also set this later by typing /set-home in your Telegram chat.")
        home_channel = prompt("Home channel ID (leave empty to set later)")
        if home_channel:
            save_env_value("TELEGRAM_HOME_CHANNEL", home_channel)


def _setup_discord():
    """Configure Discord bot credentials and allowlist."""
    print_header("Discord")
    existing = get_env_value("DISCORD_BOT_TOKEN")
    if existing:
        print_info("Discord: already configured")
        if not prompt_yes_no("Reconfigure Discord?", False):
            if not get_env_value("DISCORD_ALLOWED_USERS"):
                print_info("⚠️  Discord has no user allowlist - anyone can use your bot!")
                if prompt_yes_no("Add allowed users now?", True):
                    print_info("   To find Discord ID: Enable Developer Mode, right-click name → Copy ID")
                    allowed_users = prompt("Allowed user IDs (comma-separated)")
                    if allowed_users:
                        cleaned_ids = _clean_discord_user_ids(allowed_users)
                        save_env_value("DISCORD_ALLOWED_USERS", ",".join(cleaned_ids))
                        print_success("Discord allowlist configured")
            return

    print_info("Create a bot at https://discord.com/developers/applications")
    token = prompt("Discord bot token", password=True)
    if not token:
        return
    save_env_value("DISCORD_BOT_TOKEN", token)
    print_success("Discord token saved")

    print()
    print_info("🔒 Security: Restrict who can use your bot")
    print_info("   To find your Discord user ID:")
    print_info("   1. Enable Developer Mode in Discord settings")
    print_info("   2. Right-click your name → Copy ID")
    print()
    print_info("   You can also use Discord usernames (resolved on gateway start).")
    print()
    allowed_users = prompt(
        "Allowed user IDs or usernames (comma-separated, leave empty for open access)"
    )
    if allowed_users:
        cleaned_ids = _clean_discord_user_ids(allowed_users)
        save_env_value("DISCORD_ALLOWED_USERS", ",".join(cleaned_ids))
        print_success("Discord allowlist configured")
    else:
        print_info("⚠️  No allowlist set - anyone in servers with your bot can use it!")

    print()
    print_info("📬 Home Channel: where Hermes delivers cron job results,")
    print_info("   cross-platform messages, and notifications.")
    print_info("   To get a channel ID: right-click a channel → Copy Channel ID")
    print_info("   (requires Developer Mode in Discord settings)")
    print_info("   You can also set this later by typing /set-home in a Discord channel.")
    home_channel = prompt("Home channel ID (leave empty to set later with /set-home)")
    if home_channel:
        save_env_value("DISCORD_HOME_CHANNEL", home_channel)


def _clean_discord_user_ids(raw: str) -> list:
    """Strip common Discord mention prefixes from a comma-separated ID string."""
    cleaned = []
    for uid in raw.replace(" ", "").split(","):
        uid = uid.strip()
        if uid.startswith("<@") and uid.endswith(">"):
            uid = uid.lstrip("<@!").rstrip(">")
        if uid.lower().startswith("user:"):
            uid = uid[5:]
        if uid:
            cleaned.append(uid)
    return cleaned


def _setup_slack():
    """Configure Slack bot credentials."""
    print_header("Slack")
    existing = get_env_value("SLACK_BOT_TOKEN")
    if existing:
        print_info("Slack: already configured")
        if not prompt_yes_no("Reconfigure Slack?", False):
            # Even without reconfiguring, offer to refresh the manifest so
            # new commands (e.g. /btw, /stop, ...) get registered in Slack.
            if prompt_yes_no(
                "Regenerate the Slack app manifest with the latest command "
                "list? (recommended after `hermes update`)",
                True,
            ):
                _write_slack_manifest_and_instruct()
            return

    print_info("Steps to create a Slack app:")
    print_info("   1. Go to https://api.slack.com/apps → Create New App")
    print_info("      Pick 'From an app manifest' — we'll generate one for you below.")
    print_info("   2. Enable Socket Mode: Settings → Socket Mode → Enable")
    print_info("      • Create an App-Level Token with 'connections:write' scope")
    print_info("   3. Install to Workspace: Settings → Install App")
    print_info("   4. After installing, invite the bot to channels: /invite @YourBot")
    print()
    print_info("   Full guide: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack/")
    print()

    # Generate and write manifest up-front so the user can paste it into
    # the "Create from manifest" flow instead of clicking through scopes /
    # events / slash commands one at a time.
    _write_slack_manifest_and_instruct()

    print()
    bot_token = prompt("Slack Bot Token (xoxb-...)", password=True)
    if not bot_token:
        return
    save_env_value("SLACK_BOT_TOKEN", bot_token)
    app_token = prompt("Slack App Token (xapp-...)", password=True)
    if app_token:
        save_env_value("SLACK_APP_TOKEN", app_token)
    print_success("Slack tokens saved")

    print()
    print_info("🔒 Security: Restrict who can use your bot")
    print_info("   To find a Member ID: click a user's name → View full profile → ⋮ → Copy member ID")
    print()
    allowed_users = prompt(
        "Allowed user IDs (comma-separated, leave empty to deny everyone except paired users)"
    )
    if allowed_users:
        save_env_value("SLACK_ALLOWED_USERS", allowed_users.replace(" ", ""))
        print_success("Slack allowlist configured")
    else:
        print_warning("⚠️  No Slack allowlist set - unpaired users will be denied by default.")
        print_info("   Set SLACK_ALLOW_ALL_USERS=true or GATEWAY_ALLOW_ALL_USERS=true only if you intentionally want open workspace access.")

    print()
    print_info("📬 Home Channel: where Hermes delivers cron job results,")
    print_info("   cross-platform messages, and notifications.")
    print_info("   To get a channel ID: open the channel in Slack, then right-click")
    print_info("   the channel name → Copy link — the ID starts with C (e.g. C01ABC2DE3F).")
    print_info("   You can also set this later by typing /set-home in a Slack channel.")
    home_channel = prompt("Home channel ID (leave empty to set later with /set-home)")
    if home_channel:
        save_env_value("SLACK_HOME_CHANNEL", home_channel.strip())


def _write_slack_manifest_and_instruct():
    """Generate the Slack manifest, write it under HERMES_HOME, and print
    paste-into-Slack instructions.

    Exposed as its own helper so both the initial setup flow and the
    "reconfigure? → no" branch can refresh the manifest without the user
    re-entering tokens. Failures are non-fatal — if the manifest write
    fails for any reason, we print a warning and skip rather than abort
    the whole Slack setup.
    """
    try:
        from hermes_cli.slack_cli import _build_full_manifest
        from hermes_constants import get_hermes_home

        manifest = _build_full_manifest(
            bot_name="Hermes",
            bot_description="Your Hermes agent on Slack",
        )
        target = Path(get_hermes_home()) / "slack-manifest.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        import json as _json
        target.write_text(
            _json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print_success(f"Slack app manifest written to: {target}")
        print_info(
            "   Paste it into https://api.slack.com/apps → your app → Features "
            "→ App Manifest → Edit, then Save.  Slack will prompt to "
            "reinstall if scopes or slash commands changed."
        )
        print_info(
            "   Re-run `hermes slack manifest --write` anytime to refresh after "
            "Hermes adds new commands."
        )
    except Exception as exc:  # pragma: no cover - best-effort UX helper
        print_warning(f"Couldn't write Slack manifest: {exc}")
        print_info(
            "   You can generate it manually later with: "
            "hermes slack manifest --write"
        )


def _setup_matrix():
    """Configure Matrix credentials."""
    print_header("Matrix")
    existing = get_env_value("MATRIX_ACCESS_TOKEN") or get_env_value("MATRIX_PASSWORD")
    if existing:
        print_info("Matrix: already configured")
        if not prompt_yes_no("Reconfigure Matrix?", False):
            return

    print_info("Works with any Matrix homeserver (Synapse, Conduit, Dendrite, or matrix.org).")
    print_info("   1. Create a bot user on your homeserver, or use your own account")
    print_info("   2. Get an access token from Element, or provide user ID + password")
    print()
    homeserver = prompt("Homeserver URL (e.g. https://matrix.example.org)")
    if homeserver:
        save_env_value("MATRIX_HOMESERVER", homeserver.rstrip("/"))

    print()
    print_info("Auth: provide an access token (recommended), or user ID + password.")
    token = prompt("Access token (leave empty for password login)", password=True)
    if token:
        save_env_value("MATRIX_ACCESS_TOKEN", token)
        user_id = prompt("User ID (@bot:server — optional, will be auto-detected)")
        if user_id:
            save_env_value("MATRIX_USER_ID", user_id)
        print_success("Matrix access token saved")
    else:
        user_id = prompt("User ID (@bot:server)")
        if user_id:
            save_env_value("MATRIX_USER_ID", user_id)
        password = prompt("Password", password=True)
        if password:
            save_env_value("MATRIX_PASSWORD", password)
            print_success("Matrix credentials saved")

    if token or get_env_value("MATRIX_PASSWORD"):
        print()
        want_e2ee = prompt_yes_no("Enable end-to-end encryption (E2EE)?", False)
        if want_e2ee:
            save_env_value("MATRIX_ENCRYPTION", "true")
            print_success("E2EE enabled")

        matrix_pkg = "mautrix[encryption]" if want_e2ee else "mautrix"
        try:
            __import__("mautrix")
        except ImportError:
            print_info(f"Installing {matrix_pkg}...")
            import subprocess
            uv_bin = shutil.which("uv")
            if uv_bin:
                result = subprocess.run(
                    [uv_bin, "pip", "install", "--python", sys.executable, matrix_pkg],
                    capture_output=True, text=True,
                )
            else:
                result = subprocess.run(
                    [sys.executable, "-m", "pip", "install", matrix_pkg],
                    capture_output=True, text=True,
                )
            if result.returncode == 0:
                print_success(f"{matrix_pkg} installed")
            else:
                print_warning(f"Install failed — run manually: pip install '{matrix_pkg}'")
                if result.stderr:
                    print_info(f"  Error: {result.stderr.strip().splitlines()[-1]}")

        print()
        print_info("🔒 Security: Restrict who can use your bot")
        print_info("   Matrix user IDs look like @username:server")
        print()
        allowed_users = prompt("Allowed user IDs (comma-separated, leave empty for open access)")
        if allowed_users:
            save_env_value("MATRIX_ALLOWED_USERS", allowed_users.replace(" ", ""))
            print_success("Matrix allowlist configured")
        else:
            print_info("⚠️  No allowlist set - anyone who can message the bot can use it!")

        print()
        print_info("📬 Home Room: where Hermes delivers cron job results and notifications.")
        print_info("   Room IDs look like !abc123:server (shown in Element room settings)")
        print_info("   You can also set this later by typing /set-home in a Matrix room.")
        home_room = prompt("Home room ID (leave empty to set later with /set-home)")
        if home_room:
            save_env_value("MATRIX_HOME_ROOM", home_room)


def _setup_mattermost():
    """Configure Mattermost bot credentials."""
    print_header("Mattermost")
    existing = get_env_value("MATTERMOST_TOKEN")
    if existing:
        print_info("Mattermost: already configured")
        if not prompt_yes_no("Reconfigure Mattermost?", False):
            return

    print_info("Works with any self-hosted Mattermost instance.")
    print_info("   1. In Mattermost: Integrations → Bot Accounts → Add Bot Account")
    print_info("   2. Copy the bot token")
    print()
    mm_url = prompt("Mattermost server URL (e.g. https://mm.example.com)")
    if mm_url:
        save_env_value("MATTERMOST_URL", mm_url.rstrip("/"))
    token = prompt("Bot token", password=True)
    if not token:
        return
    save_env_value("MATTERMOST_TOKEN", token)
    print_success("Mattermost token saved")

    print()
    print_info("🔒 Security: Restrict who can use your bot")
    print_info("   To find your user ID: click your avatar → Profile")
    print_info("   or use the API: GET /api/v4/users/me")
    print()
    allowed_users = prompt("Allowed user IDs (comma-separated, leave empty for open access)")
    if allowed_users:
        save_env_value("MATTERMOST_ALLOWED_USERS", allowed_users.replace(" ", ""))
        print_success("Mattermost allowlist configured")
    else:
        print_info("⚠️  No allowlist set - anyone who can message the bot can use it!")

    print()
    print_info("📬 Home Channel: where Hermes delivers cron job results and notifications.")
    print_info("   To get a channel ID: click channel name → View Info → copy the ID")
    print_info("   You can also set this later by typing /set-home in a Mattermost channel.")
    home_channel = prompt("Home channel ID (leave empty to set later with /set-home)")
    if home_channel:
        save_env_value("MATTERMOST_HOME_CHANNEL", home_channel)
    print_info("   Open config in your editor:  hermes config edit")


def _setup_bluebubbles():
    """Configure BlueBubbles iMessage gateway."""
    print_header("BlueBubbles (iMessage)")
    existing = get_env_value("BLUEBUBBLES_SERVER_URL")
    if existing:
        print_info("BlueBubbles: already configured")
        if not prompt_yes_no("Reconfigure BlueBubbles?", False):
            return

    print_info("Connects Hermes to iMessage via BlueBubbles — a free, open-source")
    print_info("macOS server that bridges iMessage to any device.")
    print_info("   Requires a Mac running BlueBubbles Server v1.0.0+")
    print_info("   Download: https://bluebubbles.app/")
    print()
    print_info("In BlueBubbles Server → Settings → API, note your Server URL and Password.")
    print()

    server_url = prompt("BlueBubbles server URL (e.g. http://192.168.1.10:1234)")
    if not server_url:
        print_warning("Server URL is required — skipping BlueBubbles setup")
        return
    save_env_value("BLUEBUBBLES_SERVER_URL", server_url.rstrip("/"))

    password = prompt("BlueBubbles server password", password=True)
    if not password:
        print_warning("Password is required — skipping BlueBubbles setup")
        return
    save_env_value("BLUEBUBBLES_PASSWORD", password)
    print_success("BlueBubbles credentials saved")

    print()
    print_info("🔒 Security: Restrict who can message your bot")
    print_info("   Use iMessage addresses: email (user@icloud.com) or phone (+15551234567)")
    print()
    allowed_users = prompt("Allowed iMessage addresses (comma-separated, leave empty for open access)")
    if allowed_users:
        save_env_value("BLUEBUBBLES_ALLOWED_USERS", allowed_users.replace(" ", ""))
        print_success("BlueBubbles allowlist configured")
    else:
        print_info("⚠️  No allowlist set — anyone who can iMessage you can use the bot!")

    print()
    print_info("📬 Home Channel: phone or email for cron job delivery and notifications.")
    print_info("   You can also set this later with /set-home in your iMessage chat.")
    home_channel = prompt("Home channel address (leave empty to set later)")
    if home_channel:
        save_env_value("BLUEBUBBLES_HOME_CHANNEL", home_channel)

    print()
    print_info("Advanced settings (defaults are fine for most setups):")
    if prompt_yes_no("Configure webhook listener settings?", False):
        webhook_port = prompt("Webhook listener port (default: 8645)")
        if webhook_port:
            try:
                save_env_value("BLUEBUBBLES_WEBHOOK_PORT", str(int(webhook_port)))
                print_success(f"Webhook port set to {webhook_port}")
            except ValueError:
                print_warning("Invalid port number, using default 8645")

    print()
    print_info("Requires the BlueBubbles Private API helper for typing indicators,")
    print_info("read receipts, and tapback reactions. Basic messaging works without it.")
    print_info("   Install: https://docs.bluebubbles.app/helper-bundle/installation")


def _setup_qqbot():
    """Configure QQ Bot (Official API v2) via gateway setup."""
    from hermes_cli.gateway import _setup_qqbot as _gateway_setup_qqbot
    _gateway_setup_qqbot()


def _setup_webhooks():
    """Configure webhook integration."""
    print_header("Webhooks")
    existing = get_env_value("WEBHOOK_ENABLED")
    if existing:
        print_info("Webhooks: already configured")
        if not prompt_yes_no("Reconfigure webhooks?", False):
            return

    print()
    print_warning("⚠  Webhook and SMS platforms require exposing gateway ports to the")
    print_warning("   internet. For security, run the gateway in a sandboxed environment")
    print_warning("   (Docker, VM, etc.) to limit blast radius from prompt injection.")
    print()
    print_info("   Full guide: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/webhooks/")
    print()

    port = prompt("Webhook port (default 8644)")
    if port:
        try:
            save_env_value("WEBHOOK_PORT", str(int(port)))
            print_success(f"Webhook port set to {port}")
        except ValueError:
            print_warning("Invalid port number, using default 8644")

    secret = prompt("Global HMAC secret (shared across all routes)", password=True)
    if secret:
        save_env_value("WEBHOOK_SECRET", secret)
        print_success("Webhook secret saved")
    else:
        print_warning("No secret set — you must configure per-route secrets in config.yaml")

    save_env_value("WEBHOOK_ENABLED", "true")
    print()
    print_success("Webhooks enabled! Next steps:")
    from hermes_constants import display_hermes_home as _dhh
    print_info(f"   1. Define webhook routes in {_dhh()}/config.yaml")
    print_info("   2. Point your service (GitHub, GitLab, etc.) at:")
    print_info("      http://your-server:8644/webhooks/<route-name>")
    print()
    print_info("   Route configuration guide:")
    print_info("   https://hermes-agent.nousresearch.com/docs/user-guide/messaging/webhooks/#configuring-routes")
    print()
    print_info("   Open config in your editor:  hermes config edit")
    print_info("   Open config in your editor:  hermes config edit")


def setup_gateway(config: dict):
    """Configure messaging platform integrations."""
    from hermes_cli.gateway import _all_platforms, _platform_status, _configure_platform

    print_header("Messaging Platforms")
    print_info("Connect to messaging platforms to chat with Hermes from anywhere.")
    print_info("Toggle with Space, confirm with Enter.")
    print()

    platforms = _all_platforms()

    # Build checklist, pre-selecting already-configured platforms.
    items = []
    pre_selected = []
    for i, plat in enumerate(platforms):
        status = _platform_status(plat)
        items.append(f"{plat['emoji']} {plat['label']}  ({status})")
        if status == "configured":
            pre_selected.append(i)

    selected = prompt_checklist("Select platforms to configure:", items, pre_selected)

    if not selected:
        print_info("No platforms selected. Run 'hermes setup gateway' later to configure.")
        return

    for idx in selected:
        _configure_platform(platforms[idx])

    # ── Gateway Service Setup ──
    # Count any platform (built-in or plugin) the user configured during this
    # setup pass — reuses ``_platform_status`` so plugin platforms like IRC
    # are picked up without another hard-coded env-var list.
    def _is_progress(status: str) -> bool:
        s = status.lower()
        return not (
            s == "not configured"
            or s.startswith("partially")
            or s.startswith("plugin disabled")
        )

    any_messaging = any(
        _is_progress(_platform_status(p)) for p in _all_platforms()
    )
    if any_messaging:
        print()
        print_info("━" * 50)
        print_success("Messaging platforms configured!")

        # Check if any home channels are missing
        missing_home = []
        if get_env_value("TELEGRAM_BOT_TOKEN") and not get_env_value(
            "TELEGRAM_HOME_CHANNEL"
        ):
            missing_home.append("Telegram")
        if get_env_value("DISCORD_BOT_TOKEN") and not get_env_value(
            "DISCORD_HOME_CHANNEL"
        ):
            missing_home.append("Discord")
        if get_env_value("SLACK_BOT_TOKEN") and not get_env_value("SLACK_HOME_CHANNEL"):
            missing_home.append("Slack")
        if get_env_value("BLUEBUBBLES_SERVER_URL") and not get_env_value("BLUEBUBBLES_HOME_CHANNEL"):
            missing_home.append("BlueBubbles")
        if get_env_value("QQ_APP_ID") and not (
            get_env_value("QQBOT_HOME_CHANNEL") or get_env_value("QQ_HOME_CHANNEL")
        ):
            missing_home.append("QQBot")

        if missing_home:
            print()
            print_warning(f"No home channel set for: {', '.join(missing_home)}")
            print_info("   Without a home channel, cron jobs and cross-platform")
            print_info("   messages can't be delivered to those platforms.")
            print_info("   Set one later with /set-home in your chat, or:")
            for plat in missing_home:
                print_info(
                    f"     hermes config set {plat.upper()}_HOME_CHANNEL <channel_id>"
                )

        # Offer to install the gateway as a system service
        import platform as _platform

        _is_linux = _platform.system() == "Linux"
        _is_macos = _platform.system() == "Darwin"

        from hermes_cli.gateway import (
            _is_service_installed,
            _is_service_running,
            supports_systemd_services,
            has_conflicting_systemd_units,
            has_legacy_hermes_units,
            install_linux_gateway_from_setup,
            print_systemd_scope_conflict_warning,
            print_legacy_unit_warning,
            systemd_start,
            systemd_restart,
            launchd_install,
            launchd_start,
            launchd_restart,
            UserSystemdUnavailableError,
            SystemScopeRequiresRootError,
            _system_scope_wizard_would_need_root,
            _print_system_scope_remediation,
        )

        service_installed = _is_service_installed()
        service_running = _is_service_running()
        supports_systemd = supports_systemd_services()
        supports_service_manager = supports_systemd or _is_macos

        print()
        if supports_systemd and has_conflicting_systemd_units():
            print_systemd_scope_conflict_warning()
            print()

        if supports_systemd and has_legacy_hermes_units():
            print_legacy_unit_warning()
            print()

        if service_running:
            if supports_systemd and _system_scope_wizard_would_need_root():
                _print_system_scope_remediation("restart")
            elif prompt_yes_no("  Restart the gateway to pick up changes?", True):
                try:
                    if supports_systemd:
                        systemd_restart()
                    elif _is_macos:
                        launchd_restart()
                except UserSystemdUnavailableError as e:
                    print_error("  Restart failed — user systemd not reachable:")
                    for line in str(e).splitlines():
                        print(f"  {line}")
                except SystemScopeRequiresRootError as e:
                    # Defense in depth: the pre-check above should have
                    # caught this, but a race (unit file appearing mid-run)
                    # could still land here. Previously this exited the
                    # whole wizard via sys.exit(1).
                    print_error(f"  Restart failed: {e}")
                    _print_system_scope_remediation("restart")
                except Exception as e:
                    print_error(f"  Restart failed: {e}")
        elif service_installed:
            if supports_systemd and _system_scope_wizard_would_need_root():
                _print_system_scope_remediation("start")
            elif prompt_yes_no("  Start the gateway service?", True):
                try:
                    if supports_systemd:
                        systemd_start()
                    elif _is_macos:
                        launchd_start()
                except UserSystemdUnavailableError as e:
                    print_error("  Start failed — user systemd not reachable:")
                    for line in str(e).splitlines():
                        print(f"  {line}")
                except SystemScopeRequiresRootError as e:
                    print_error(f"  Start failed: {e}")
                    _print_system_scope_remediation("start")
                except Exception as e:
                    print_error(f"  Start failed: {e}")
        elif supports_service_manager:
            svc_name = "systemd" if supports_systemd else "launchd"
            if prompt_yes_no(
                f"  Install the gateway as a {svc_name} service? (runs in background, starts on boot)",
                True,
            ):
                try:
                    installed_scope = None
                    did_install = False
                    if supports_systemd:
                        installed_scope, did_install = install_linux_gateway_from_setup(force=False)
                    else:
                        launchd_install(force=False)
                        did_install = True
                    print()
                    if did_install and prompt_yes_no("  Start the service now?", True):
                        try:
                            if supports_systemd:
                                systemd_start(system=installed_scope == "system")
                            elif _is_macos:
                                launchd_start()
                        except UserSystemdUnavailableError as e:
                            print_error("  Start failed — user systemd not reachable:")
                            for line in str(e).splitlines():
                                print(f"  {line}")
                        except SystemScopeRequiresRootError as e:
                            print_error(f"  Start failed: {e}")
                            _print_system_scope_remediation("start")
                        except Exception as e:
                            print_error(f"  Start failed: {e}")
                except Exception as e:
                    print_error(f"  Install failed: {e}")
                    print_info("  You can try manually: hermes gateway install")
            else:
                print_info("  You can install later: hermes gateway install")
                if supports_systemd:
                    print_info("  Or as a boot-time service: sudo hermes gateway install --system")
                print_info("  Or run in foreground:  hermes gateway")
        else:
            from hermes_constants import is_container
            if is_container():
                print_info("Start the gateway to bring your bots online:")
                print_info("   hermes gateway run          # Run as container main process")
                print_info("")
                print_info("For automatic restarts, use a Docker restart policy:")
                print_info("   docker run --restart unless-stopped ...")
                print_info("   docker restart <container>  # Manual restart")
            else:
                print_info("Start the gateway to bring your bots online:")
                print_info("   hermes gateway              # Run in foreground")

        print_info("━" * 50)


# =============================================================================
# Section 5: Tool Configuration (delegates to unified tools_config.py)
# =============================================================================
=======
# ── Section 5: Tool Configuration (delegates to unified tools_config.py) ──
>>>>>>> 2237be355906fbe6065ce1815711eee52b2d646e


def setup_tools(config: dict, first_install: bool = False):
    """`hermes setup tools` == `hermes tools`: platform selection → toolset toggles → provider keys.
    ``first_install`` selects the simplified flow (no platform menu, prompts for all missing keys)."""
    from hermes_cli.tools_config import tools_command
    tools_command(first_install=first_install, config=config)


# ── Shared Metrics ──


_SEND_CONSENT_EXPLAINER = (
    "", "Sending uploads each daily package to the Nous telemetry",
    "service. Packages carry your profile-scoped install ID, a",
    "stable random UUID that identifies this profile across days",
    "(it contains no personal information and is reset by deleting",
    "the shared-metrics directory). Only packages whose entire",
    "collection period falls inside a recorded consent window are",
    "ever sent — data from before you opt in, or from any gap",
    "while sending was off, stays on this machine. Sending can be", "turned off again at any time.",
)


def setup_telemetry(config: dict):
    """Configure the local shared-metrics subscriber and optional sending."""
    print_header("Shared Metrics")
    _info("Shared metrics contain only bounded counters and histograms.",
          "Collection is local. Sending them to Nous is a separate opt-in.")
    shared_metrics = _sub_dict(_sub_dict(config, "telemetry"), "shared_metrics")
    current = shared_metrics.get("enabled") is True
    shared_metrics["enabled"] = prompt_yes_no("Enable local shared metrics?", default=current)
    if not shared_metrics["enabled"]:
        print_info("Local shared metrics disabled.")
        # Sending cannot outlive collection (send=true would log an error every run, never send).
        if shared_metrics.get("send") is True:
            shared_metrics["send"] = False
            print_info("Sending shared metrics disabled as well.")
        # Turning collection off withdraws send consent too. Recorded unconditionally: the send
        # key may already be false while the consent window is still open, and it must close.
        _record_send_consent_change(enabled=False)
        return
    print_success("Local shared metrics enabled.")
    _info(*_SEND_CONSENT_EXPLAINER)
    shared_metrics["send"] = prompt_yes_no("Send shared metrics to Nous?", default=shared_metrics.get("send") is True)
    _record_send_consent_change(enabled=shared_metrics["send"])
    if shared_metrics["send"]:
        print_success("Sending shared metrics enabled.")
    else:
        print_info("Sending shared metrics disabled (collection stays local).")


def _record_send_consent_change(*, enabled: bool) -> None:
    """Reconcile consent windows at the moment the user decides — same single writer as the relay
    and the sender, so wizard, relay and mid-pass callers cannot disagree."""
    try:
        from hermes_cli.observability.shared_metrics import SharedMetricsStore
        from hermes_cli.observability.shared_metrics_sender import reconcile_send_consent
        from hermes_cli.sqlite_util import write_txn
        with SharedMetricsStore()._connection() as connection, write_txn(connection):
            reconcile_send_consent(connection, enabled)
    except Exception:
        # Never block the wizard on telemetry bookkeeping; the relay reconciles on the next hook.
        logger.debug("Unable to record shared-metrics consent change", exc_info=True)


# Extracted sections, re-exported so callers and test patches keep resolving through
# hermes_cli.setup. They import this module lazily inside bodies, so this is cycle-free.

from hermes_cli.setup_tts import setup_tts  # noqa: E402
from hermes_cli.setup_terminal import setup_terminal_backend  # noqa: E402
from hermes_cli.setup_platforms import setup_gateway  # noqa: E402
from hermes_cli.setup_summary import _print_setup_summary  # noqa: E402,F401
from hermes_cli.setup_migration import _offer_openclaw_migration, _skip_configured_section  # noqa: E402
from hermes_cli.setup_quick import _run_portal_one_shot, _run_quick_setup  # noqa: E402


# ── Main Wizard Orchestrator ──

SETUP_SECTIONS = [
    ("model", "Model & Provider", setup_model_provider),
    ("tts", "Text-to-Speech", setup_tts),
    ("terminal", "Terminal Backend", setup_terminal_backend),
    ("gateway", "Messaging Platforms (Gateway)", setup_gateway),
    ("tools", "Tools", setup_tools),
    ("telemetry", "Shared Metrics", setup_telemetry),
    ("agent", "Agent Settings", setup_agent_settings),
]


def run_setup_wizard(args):
    """Run setup with navigation control scoped to this invocation."""
    with _setup_navigation_scope():
        try:
            return _run_setup_wizard_impl(args)
        except _SetupCancelled:
            _info(None, "Setup cancelled. Remaining sections were not changed.")
            return None


def _backup_config_file(config_path: Path) -> Path | None:
    """Back up config.yaml before setup modifies it; None when absent or copy fails."""
    if not config_path.exists():
        return None
    import shutil
    from datetime import datetime
    backup_path = config_path.with_suffix(f".yaml.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    try:
        shutil.copy2(config_path, backup_path)
        return backup_path
    except Exception:
        return None


def _run_setup_section(config: dict, section: str) -> None:
    """``hermes setup <section>``: run one SETUP_SECTIONS entry under the banner."""
    entry = next(((label, func) for key, label, func in SETUP_SECTIONS if key == section), None)
    if entry is None:
        print_error(f"Unknown setup section: {section}")
        print_info(f"Available sections: {', '.join(k for k, _, _ in SETUP_SECTIONS)}")
        return
    label, func = entry
    _print_banner(f"│     ⚕ Hermes Setup — {label:<34s} │")
    _run_setup_steps([(label, lambda: func(config))])
    save_config(config)
    print()
    print_success(f"{label} configuration complete!")


def _run_full_setup(config: dict, hermes_home, *, is_existing: bool, migration_ran: bool) -> None:
    """Full Setup — run all sections, honoring post-migration skips."""
    print_header("Configuration Location")
    _info(f"Config file:  {get_config_path()}", f"Secrets file: {get_env_path()}",
          f"Data folder:  {hermes_home}", f"Install dir:  {PROJECT_ROOT}", None,
          "You can edit these files directly or use 'hermes config edit'")
    if migration_ran:
        _info(None, "Settings were imported from OpenClaw.",
              "Each section below will show what was imported — press Enter to keep,",
              "or choose to reconfigure if needed.")

    # Agent Settings are not prompted: first installs get defaults, existing keep theirs.
    if not is_existing:
        _apply_default_agent_settings(config)

    def _skip(key: str, label: str) -> bool:
        return migration_ran and _skip_configured_section(config, key, label)

    def _gateway_step() -> None:
        if not _skip("gateway", "Messaging Platforms"):
            setup_gateway(config)
            return
        # A skipped (migrated) gateway section still needs its service so imported platforms
        # and cron jobs become active.
        from hermes_cli.gateway import ensure_gateway_service
        ensure_gateway_service(context="setup")

    def _step(key: str, label: str, run) -> tuple:
        return label, lambda: None if _skip(key, label) else run()

    _run_setup_steps([
        _step("model", "Model & Provider", lambda: setup_model_provider(config)),
        _step("terminal", "Terminal Backend", lambda: setup_terminal_backend(config)),
        ("Messaging Platforms", _gateway_step),
        _step("tools", "Tools", lambda: setup_tools(config, first_install=not is_existing))])


# First-time mode picker: (menu label, setup_quick runner name) — None falls through to Full Setup.
_FIRST_TIME_MODES = (
    ("Quick Setup (Nous Portal) — free OAuth login, no API keys, model + tools (recommended)",
     "_run_first_time_quick_setup"),
    ("Full setup — configure every provider, tool & option yourself (bring your own keys)", None),
    ("Blank Slate — everything off except the bare minimum; opt in to each capability", "_run_blank_slate_setup"),
)


def _run_setup_wizard_impl(args):
    """Run the interactive setup wizard: full/quick (auto-detected), ``--portal``, or one
    ``hermes setup <section>`` from SETUP_SECTIONS."""
    from hermes_cli.config import is_managed, managed_error
    if is_managed():
        managed_error("run setup wizard")
        return
    ensure_hermes_home()
    if getattr(args, "reset", False):
        save_config(copy.deepcopy(DEFAULT_CONFIG))
        print_success("Configuration reset to defaults.")
    reconfigure_requested = bool(getattr(args, "reconfigure", False))
    quick_requested = bool(getattr(args, "quick", False))
    config = load_config()
    hermes_home = get_hermes_home()
    # Back up existing config before setup modifies it (#3522)
    config_path = get_config_path()
    _backup_path = _backup_config_file(config_path)

    # Non-interactive environments (headless SSH, Docker, CI/CD)
    if getattr(args, 'non_interactive', False) or not is_interactive_stdin():
        print_noninteractive_setup_guidance("Running in a non-interactive environment (no TTY detected).")
        return
    if getattr(args, "portal", False):  # one-shot Nous Portal setup; skips the rest
        _run_portal_one_shot(config)
        return
    section = getattr(args, "section", None)
    if section:
        _run_setup_section(config, section)
        return

    # Existing installation == a provider is configured
    from hermes_cli.auth import get_active_provider
<<<<<<< HEAD

    active_provider = get_active_provider()
    is_existing = (
        bool(get_env_value("OPENROUTER_API_KEY"))
        or bool(get_env_value("OPENAI_BASE_URL"))
        or active_provider is not None
    )

    print()
    print(
        color(
            "┌─────────────────────────────────────────────────────────┐",
            Colors.MAGENTA,
        )
    )
    # ADDIN-OVERLAY-BEGIN: addin copy welcome.title
    print(
        color(
            _resolve_copy(
                "welcome.title",
                "│             ⚕ Hermes Agent Setup Wizard                │",
            ),
            Colors.MAGENTA,
        )
    )
    # ADDIN-OVERLAY-END
    print(
        color(
            "├─────────────────────────────────────────────────────────┤",
            Colors.MAGENTA,
        )
    )
    # ADDIN-OVERLAY-BEGIN: addin copy welcome.body
    print(
        color(
            _resolve_copy(
                "welcome.body",
                "│  Let's configure your Hermes Agent installation.       │",
            ),
            Colors.MAGENTA,
        )
    )
    # ADDIN-OVERLAY-END
    print(
        color(
            "│  Press Ctrl+C at any time to exit.                     │", Colors.MAGENTA
        )
    )
    print(
        color(
            "└─────────────────────────────────────────────────────────┘",
            Colors.MAGENTA,
        )
    )

=======
    is_existing = bool(get_env_value("OPENROUTER_API_KEY") or get_env_value("OPENAI_BASE_URL")
                       or get_active_provider() is not None)
    _print_banner("│             ⚕ Hermes Agent Setup Wizard                │",
                  "├─────────────────────────────────────────────────────────┤",
                  "│  Let's configure your Hermes Agent installation.       │",
                  "│  Press Ctrl+C at any time to exit.                     │")
>>>>>>> 2237be355906fbe6065ce1815711eee52b2d646e
    migration_ran = False
    if is_existing:
        # Full reconfigure wizard is the default (Enter keeps each current value); `--quick`
        # narrows it to missing items (partial OpenClaw import, cleared key). --reconfigure is a
        # backwards-compatible no-op here.
        if quick_requested:
            _run_setup_steps([("Quick Setup", lambda: _run_quick_setup(config, hermes_home))])
            return
        print_header("Reconfigure", gap=True)
        print_success("You already have Hermes configured.")
        _info("Running the full wizard — each prompt shows your current value.",
              "Press Enter to keep it, or type a new value to change it.", "",
              "Tip: jump straight to a section with 'hermes setup model|terminal|",
              "     gateway|tools|agent', or fill only missing items with --quick.")
    else:
        # First-time setup (--reconfigure / --quick are meaningless here; fall through)
        print()
        if reconfigure_requested or quick_requested:
            _info("No existing configuration found — running first-time setup.", None)
        migration_ran = _offer_openclaw_migration(hermes_home)  # before configuration begins
        if migration_ran:
            config = load_config()
        setup_mode = prompt_choice("How would you like to set up Hermes?", [label for label, _ in _FIRST_TIME_MODES], 0)
        label, runner = _FIRST_TIME_MODES[setup_mode]
        if runner is not None:
            from hermes_cli import setup_quick
            _run_setup_steps([(label, lambda: getattr(setup_quick, runner)(config, hermes_home, is_existing))])
            return
    _run_full_setup(config, hermes_home, is_existing=is_existing, migration_ran=migration_ran)

    # Save and show summary
    save_config(config)
    if _backup_path and _backup_path.exists():
        _info(f"Previous config backed up to: {_backup_path}",
              "If setup changed a value you customized, restore it with:",
              f"  cp {_backup_path} {config_path}")
    _print_setup_summary(config, hermes_home)


# ---- BEGIN PLUGIN-COMPAT (revert-scheduled; see COMPAT_MANIFEST.md) ----
# Names external plugins imported from this module before the Sep 2026 decomposition.
# Internal code MUST NOT use these (scripts/check_compat_pointers.py fails CI if it does).
# The whole block is removed by reverting the commit that added it.
from typing import Any  # noqa: F401,E402
from typing import Dict  # noqa: F401,E402
from typing import Optional  # noqa: F401,E402
import json  # noqa: F401,E402
import shutil  # noqa: F401,E402


_PLUGIN_COMPAT_LAZY = {
    'get_nous_subscription_features': ('hermes_cli.nous_subscription', 'get_nous_subscription_features'),
    'get_optional_skills_dir': ('hermes_constants', 'get_optional_skills_dir'),
    'managed_nous_tools_enabled': ('tools.tool_backend_helpers', 'managed_nous_tools_enabled'),
}


def __getattr__(name):  # PEP 562 — lazy so no import cycles
    target = _PLUGIN_COMPAT_LAZY.get(name)
    if target is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    import importlib
    from hermes_cli.plugin_compat import warn_once
    warn_once(__name__, name, *target)
    return getattr(importlib.import_module(target[0]), target[1])
# ---- END PLUGIN-COMPAT ----
