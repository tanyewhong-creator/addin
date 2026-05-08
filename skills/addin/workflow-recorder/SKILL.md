---
name: workflow-recorder
description: "Turn repeated user actions into pending nudges so the curator (and the user) can capture them as skills."
version: 1.0.0
author: A/addin
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [nudges, curator, observation, addin]
    related_skills: [audit-log, ops-brief]
---

# Workflow Recorder

## overview

Phase 2b shipped the nudge state-store and the capture/dismiss UI in the curator
panel. This skill is the observational frontend that decides what is nudge-worthy.

The v2.0 ship is content-only: the agent reads this skill and uses the existing
`addin nudge add` CLI (or `addin.nudges.add` in Python) to record observations
manually when it notices a repeating pattern in the conversation. The v2.1+
engineering goal is automatic detection via shell-history mining and command-pattern
heuristics — that work is explicitly out of scope for Phase 2c.

## when to use

Use this skill when the agent notices, during a session, that:

- The user has run the same command or asked for the same operation multiple times
  across recent sessions (e.g., "user ran `git rebase -i HEAD~5` three times this
  week"; "user keeps asking the agent to format JSON output as a table").
- A repeated action is non-trivial enough that a skill or alias would save real
  keystrokes or cognitive load.
- The action has a stable, reproducible shape — the same command with the same
  structure each time, not a one-off that happened to repeat.

## when not to use

- **One-off requests** — a single occurrence is not a pattern. Wait for at least
  three observations before proposing a nudge.
- **Agent-internal patterns** — this skill is for *user* behaviour the agent has
  observed, not for the agent's own internal routing or tool-selection habits.
- **Chat-level questions** — "did you mean X?" or "should I use Y instead?" belong
  in the chat response, not in the curator. The curator surface is for actionable
  capture/dismiss decisions, not for dialogue.

## what makes a good nudge

Three criteria must all be met before calling `addin nudge add`:

1. **Observed ≥ 3 times** in a rolling 7-day window. The threshold is configurable
   in principle, but resist over-nudging — a flooded curator panel is an ignored one.
2. **Non-trivial** — the captured form must save real keystrokes or cognitive load.
   A three-character alias is borderline; a multi-step workflow with flags the user
   always gets wrong is a good candidate.
3. **Stable shape** — the action looks structurally the same each time. If the
   arguments vary substantially from run to run, it is not yet ripe for capture.

The spec §7.4 canonical example: "i noticed you ran `git rebase -i HEAD~5` three
times today — capture as a skill?"

## nudge writing voice

Nudge text appears on Telegram and in the dashboard curator panel. Per spec §1.4,
first-person "i" (lowercase) is permitted and preferred on these surfaces — it reads
as the agent speaking, not as a system notification.

**Good:**

```
i noticed you reach for git rebase -i HEAD~5 three times today — capture as a skill?
i've seen you format JSON as a markdown table four times this week — want a shortcut?
```

**Bad:**

```
Repeated action detected: git rebase -i HEAD~5    ← impersonal system-log voice
You should capture this workflow as a skill.       ← prescriptive, not observational
Upgrade to addin pro for automatic detection.      ← marketing copy; never acceptable
```

Keep it under 120 characters. The curator panel truncates longer text.

## how to record

**CLI:**

```sh
addin nudge add "i noticed you reach for git rebase -i HEAD~5 three times today — capture as a skill?" --cmd "git rebase -i HEAD~5"
```

**Python (in-process):**

```python
from addin import nudges

nudges.add(
    text="i noticed you reach for git rebase -i HEAD~5 three times today — capture as a skill?",
    suggested_command="git rebase -i HEAD~5",
)
```

`nudges.add` returns the new `Nudge` object and fires a `nudge.created` audit event
(see `audit-log` skill, action-namespace reference). The nudge is written atomically
to `~/.hermes/curator/nudges.json` via tmpfile + rename — the file is human-editable
if the user wants to tweak the text before capturing.

`suggested_command` is optional. If the pattern is a workflow rather than a single
command, omit it and describe the workflow in the `text` field.

## after the user captures or dismisses

When the user acts on a nudge in the curator panel, the audit log records:

- `nudge.captured` (actor: `user`) — the user approved the suggestion; the nudge
  state transitions to `"captured"`.
- `nudge.dismissed` (actor: `user`) — the user declined; state becomes `"dismissed"`.

Use those events as feedback to calibrate future nudges. Concretely:

- Before calling `nudges.add`, check existing nudges with `nudges.list_all()` and
  filter by `suggested_command`. If an identical command was already dismissed, do
  not re-suggest it — the user has already expressed a preference.
- If a nudge was captured, the pattern is now a skill or habit; no further nudging
  is needed for that exact command.

```python
from addin import nudges

def already_handled(cmd: str) -> bool:
    """Return True if a nudge for this command was already captured or dismissed."""
    return any(
        n.suggested_command == cmd and n.state in ("captured", "dismissed")
        for n in nudges.list_all()
    )
```

## anti-patterns

- **Repeat suggestions** — always deduplicate by `suggested_command` (or by text
  similarity if no command applies) before calling `nudges.add`. A curator panel
  with five identical entries erodes trust in the whole surface.
- **Chat-question nudges** — nudges are for the curator, not for in-chat dialogue.
  "Did you mean to use `--force-with-lease` here?" belongs in the chat response.
- **Marketing copy** — the curator is sacred. Its authority comes from honest, low-
  frequency, high-value observations. Any nudge that reads like product promotion
  degrades that authority permanently.
- **Premature nudging** — one or two repetitions is correlation, not pattern. Wait
  for the third observation; the spec threshold is there for a reason.

## future work

v2.1+ engineering goals: shell-history mining to detect patterns without requiring
the agent to observe them in-session; command-pattern heuristics (edit-distance
clustering) to group near-identical invocations; time-of-day clustering to surface
patterns tied to the user's routine; and a dedupe primitive baked into
`addin/nudges.py` so callers do not have to implement `already_handled` themselves.
v2.0 leaves all detection to the agent's in-session judgment when reading session
context — the state-store and capture/dismiss UI are production-ready; the
observation layer is the v2.1 work.
