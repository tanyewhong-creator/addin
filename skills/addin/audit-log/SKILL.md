---
name: audit-log
description: "Read and interpret the addin audit log: events, actors, actions, dashboard, API."
version: 1.0.0
author: A/addin
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [audit, privacy, observability, addin]
---

# Audit Log

## overview

The audit log is A/addin's append-only event record — the core of the Privacy panel's
inspectability promise. Every outbound network connection, nudge lifecycle event, and
state-corruption recovery is written there in real time. Users can inspect it to see
exactly what the agent has done, which hosts it has reached out to, and when nudges
were created, captured, or dismissed. It is the factual ground truth that backs the
privacy disclosure copy in the dashboard.

## when to use

Use this skill when the user wants to:

- See what actions the agent has taken since the dashboard started
- Check which external hosts the agent has connected to (egress audit)
- Review when a nudge was created, captured, or dismissed
- Understand why `nudge.state_corrupt` appeared in the Audit-log tab
- Query events programmatically (Python, curl)

## when not to use

- **Operational / error logs** — process-level errors, tracebacks, startup messages:
  look at `~/.hermes/logs/agent.log` instead; the audit log contains only structured
  semantic events, not diagnostic noise.
- **Chat history** — conversation transcripts live under `~/.hermes/sessions/`; they
  are never written to the audit log.
- **File-access history** — no filesystem audit exists in v2.b (see *what's not in
  the audit log* below).

## where the log lives

```
~/.hermes/logs/audit/audit.jsonl
```

Single file, append-only JSONL (one JSON object per line), no rotation in v2.b.
The directory is created on first write. The file survives dashboard restarts.

## event schema

Each line is a compact JSON object:

```json
{"ts":"2026-05-08T14:22:01.003412+00:00","actor":"addin","action":"network.egress","target":"api.anthropic.com","meta":{"port":443,"family":2}}
```

| field    | type              | description                                                    |
|----------|-------------------|----------------------------------------------------------------|
| `ts`     | ISO-8601 UTC str  | wall-clock timestamp at moment of record                       |
| `actor`  | str               | who triggered the event: `"addin"`, `"user"`, or `"external"` |
| `action` | dotted str        | namespaced action identifier (see action-namespace reference)  |
| `target` | str               | short identifier of the thing acted on (host, nudge id, path)  |
| `meta`   | object (optional) | action-specific extra fields; absent when empty                |

`meta` is omitted from the line entirely when the caller passes nothing — do not
assume it is always present when parsing.

## reading via python (in-process)

```python
from addin.audit import read_events, total_seen

# most-recent 10 events (newest first)
events = read_events(limit=10)

# filter by actor
addin_events = read_events(limit=50, actor="addin")

# filter by action prefix
egress = read_events(limit=100, action_prefix="network.egress")

# combine filters
user_nudges = read_events(limit=20, actor="user", action_prefix="nudge.")

# total count for pagination metadata
n = total_seen()
```

`read_events` returns a `list[dict]`, newest-first. It reverse-streams the file,
so it is efficient for small `limit` values even on a large log. When no matching
events exist it returns `[]` — it never raises on a missing or empty file.

`total_seen()` counts all lines on disk (best-effort); it is used by the HTTP API
to populate pagination metadata.

## reading via the dashboard

Navigate to the dashboard and open the **Audit-log** tab under `/memory`.

- The table shows events newest-first, paginated in batches of 50.
- The **actor** filter dropdown limits display to `addin`, `user`, or all actors.
- Pagination controls appear at the bottom when `total_seen()` exceeds the page size.
- The tab auto-refreshes every 30 seconds while the page is open.

## reading via the http api

The audit endpoint sits behind the same auth middleware as all other `/api/*` routes.
Authenticate the same way you would for any other dashboard API call (session cookie
from a logged-in browser, or the `X-Hermes-Token` header if token auth is configured).

```bash
# most-recent 20 events
curl -s 'http://localhost:PORT/api/addin/audit?limit=20' \
  -H 'X-Hermes-Token: YOUR_TOKEN' | jq .

# filter by actor and action prefix
curl -s 'http://localhost:PORT/api/addin/audit?limit=50&actor=addin&action_prefix=network.' \
  -H 'X-Hermes-Token: YOUR_TOKEN' | jq .events
```

Replace `PORT` with the dashboard port (default `8000`). The response shape is:

```json
{"events": [...], "total": 142}
```

where `total` is `total_seen()` and `events` is the filtered newest-first slice.

## action-namespace reference

Actions use a dotted lowercase namespace: `<namespace>.<verb>`. All namespaces and
verbs are lowercase ASCII; no spaces; no camelCase.

| action                  | actor     | description                                                                    |
|-------------------------|-----------|--------------------------------------------------------------------------------|
| `network.egress`        | `addin`   | one outbound TCP connect via AF_INET / AF_INET6; `meta` contains `port`, `family` |
| `nudge.created`         | `addin`   | a new nudge was appended to the nudge store                                    |
| `nudge.captured`        | `user`    | user clicked Capture on a pending nudge                                        |
| `nudge.dismissed`       | `user`    | user clicked Dismiss on a pending nudge                                        |
| `nudge.state_corrupt`   | `addin`   | `nudges.json` failed JSON parsing; corrupt file quarantined; `target` is the quarantine path |

**Schema policy:** new actions must be dotted, lowercase, namespace-prefixed. Prefer
verbs in past tense (`created`, `dismissed`) for state changes; use present-tense
descriptors (`egress`) for continuous events. Add new namespaces in `addin/audit.py`
docstring when introducing them.

## what's not in the audit log

- **Chat content** — conversation transcripts are stored separately at
  `~/.hermes/sessions/` and are never echoed into the audit log.
- **File reads and writes** — no filesystem audit hook exists in v2.b. The egress
  hook patches `socket.socket.connect`; a comparable VFS hook is deferred.
- **CLI-only invocations** — the egress hook is installed by the dashboard startup
  path. CLI commands (`hermes ...`, `addin ...`) that run without the dashboard
  running bypass the hook entirely. This is disclosed in the v2.0.7 privacy-panel
  disclosure copy: "network audit requires the dashboard to be running."

## future work

v2.1+ deferrals: log rotation with configurable max-size and a `.N` suffix scheme;
an indexed reader (SQLite or a reverse-sorted offset index) to make large-limit
queries sub-linear; optional per-event HMAC integrity hashing so the log can be
verified against tampering; and an export action on the dashboard Audit-log tab
that streams the raw JSONL to the browser.
