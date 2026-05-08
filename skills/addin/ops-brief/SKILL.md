---
name: ops-brief
description: "Generate a daily ops brief from the audit log: what the agent did, where it connected, what it suggested."
version: 1.0.0
author: A/addin
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [ops, summary, audit, addin]
    related_skills: [audit-log, workflow-recorder]
---

# Ops Brief

## overview

A daily brief in the same spirit as the Privacy panel: a one-page summary of the
agent's recent activity. Useful for a morning review, a weekly retrospective, or
any time the user wants to understand what the agent has been doing on their behalf.

The brief reads only from data the user already owns:

| source | what it contains |
|--------|-----------------|
| `~/.hermes/logs/audit/audit.jsonl` | structured event record (see `audit-log` skill) |
| `~/.hermes/curator/nudges.json` | nudge state — pending, captured, dismissed |
| `~/.hermes/sessions/` | session metadata (titles only; no message bodies) |

No outbound network calls are made to generate a brief.

## when to use

Use this skill when the user asks:

- "What did the agent do yesterday?"
- "Which external hosts did the agent connect to this week?"
- "How many nudges are pending?"
- "Give me a summary of recent activity."

Also useful as a weekly retrospective: generate briefs for each of the past seven
days and roll them up manually.

## when not to use

- **Real-time monitoring** — the Audit-log tab in the dashboard auto-refreshes
  every 30 seconds and is the right tool for live observation. The ops brief is a
  point-in-time digest, not a live feed.
- **Production telemetry or SLA reporting** — this is a personal-ops tool scoped
  to a single user's local agent. It is not suitable as a substitute for server
  monitoring, uptime tracking, or multi-user reporting.

## brief contents

A well-formed ops brief covers four sections:

### activity

- Total audit events in the period
- New sessions opened
- Nudges created / captured / dismissed

### network

Top 5 distinct hosts the agent connected to in the period, sourced from
`network.egress` events. Each entry shows the host and the number of distinct
connections. Because the egress hook records only hostname and port (never request
bodies), the brief exposes exactly what the user consented to track.

### nudges

- Pending count (unreviewed)
- Captured count (turned into skills or notes)
- Dismissed count (user declined)

### anomalies

Anything that looks unusual — flag it for the user's attention, don't suppress it:

- An `action` namespace prefix not seen in the previous period
- A host connected to exactly once (potentially unexpected)
- A nudge that has been in `pending` state for more than 7 days

## how to generate one

Use `addin.audit.read_events()` and `addin.nudges.list_all()` directly. The snippet
below is a minimal starting point the user can adapt or ask the agent to run:

```python
from datetime import datetime, timedelta, timezone
from addin import audit, nudges

# define the window (default: last 24 hours)
cutoff = datetime.now(timezone.utc) - timedelta(days=1)

# pull events and filter to the window
events = audit.read_events(limit=10_000)
recent = [
    e for e in events
    if datetime.fromisoformat(e["ts"]) >= cutoff
]

# egress events only
egress = [e for e in recent if e["action"] == "network.egress"]
hosts = {}
for e in egress:
    hosts[e["target"]] = hosts.get(e["target"], 0) + 1
top_hosts = sorted(hosts.items(), key=lambda x: x[1], reverse=True)[:5]

# nudge summary
all_nudges = nudges.list_all()
pending   = [n for n in all_nudges if n.state == "pending"]
captured  = [n for n in all_nudges if n.state == "captured"]
dismissed = [n for n in all_nudges if n.state == "dismissed"]

# stale nudges (pending > 7 days)
stale_cutoff = datetime.now(timezone.utc) - timedelta(days=7)
stale = [
    n for n in pending
    if n.created and datetime.fromisoformat(n.created) < stale_cutoff
]

# render
print(f"=== ops brief {cutoff.date()} → now ===")
print(f"events (24h): {len(recent)}  |  egress: {len(egress)}")
print(f"nudges — pending: {len(pending)}, captured: {len(captured)}, dismissed: {len(dismissed)}")
print(f"top hosts: {top_hosts}")
if stale:
    print(f"stale nudges (>7d): {[n.id for n in stale]}")
```

Action namespaces follow the conventions in the `audit-log` skill: `network.egress`,
`nudge.created`, `nudge.captured`, `nudge.dismissed`, `nudge.state_corrupt`. Filter
by `action_prefix` in `read_events()` to isolate a namespace:

```python
nudge_events = audit.read_events(limit=500, action_prefix="nudge.")
```

## scheduling

In v2.0 the brief is generated on demand: ask the agent to run the script above, or
paste it into a Python session. There is no automatic scheduling in v2.0.

v2.1+ may add a pre-built hermes cron template:

```sh
addin cron add --skill ops-brief --schedule "0 9 * * *"
```

For now, the upstream `hermes cron` functionality (dashboard Cron page) can be used
to schedule an arbitrary command on the same cadence — the agent can help configure
it if the user asks.

## redaction discipline

The brief surfaces audit metadata — hostname, action name, target identifier — but
never chat content. Specifically:

- Session previews, if shown, come from the `/api/sessions` endpoint's short title
  field only. Message bodies are never read or displayed.
- Nudge text is included (it was written by the agent and is already visible in the
  dashboard curator panel), but the `suggested_command` field is kept brief.
- No secret values appear: the egress hook records hosts and ports only (see
  `private-vault` skill for the full redaction posture).

## future work

v2.1+ deferrals: a built-in `addin brief` CLI that wraps the script above; markdown
export to a daily-notes vault; weekly aggregation with trend lines; a configurable
lookback window; and an anomaly-detection heuristic that flags hosts appearing for
the first time.
