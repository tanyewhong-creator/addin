# CHANGELOG-ADDIN

This file tracks A/addin overlay changes only. Upstream hermes-agent changes are recorded
in the upstream `CHANGELOG.md`, which is preserved unchanged.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to a versioning scheme of `MAJOR.MINOR.PATCH+addin.N` where `MAJOR.MINOR`
tracks the upstream version.

## [Unreleased]

## [2.0.7+addin.0] — Phase 2b (audit log + egress hook + nudge actions)

_2026-05-08_

Phase 2b lands the audit-event source, network-egress hook, and curator
nudge actions that v2.0.6 stubbed. The Privacy panel now shows real
data on every metric block; the Evolve panel surfaces real pending
nudges with capture/dismiss inline actions.

### Added

- `addin/audit.py` — append-only JSONL audit log at
  `~/.hermes/logs/audit/audit.jsonl`.
- `addin/network/egress.py` — `socket.socket.connect` wrapper that
  records one `network_egress` audit event per outbound TCP connect.
  Installed on first import of `addin.api` (i.e., when the dashboard
  server boots).
- `addin/nudges.py` — curator nudge state-store at
  `~/.hermes/curator/nudges.json`.
- `addin/cli/nudge.py` — `addin nudge add "<text>" [--cmd <command>]`
  for seeding nudges from the shell.
- `GET /api/addin/audit` — paginated event reader with actor and
  action-prefix filters.
- `GET /api/addin/network-egress` — distinct hosts in the last 24h.
- `POST /api/addin/nudges/{id}/{capture,dismiss}` — nudge actions; both
  write a `nudge.captured` / `nudge.dismissed` audit event.

### Changed

- `GET /api/addin/skills/evolve` — `pending_nudges` is now
  `{ count, items[] }` (was `0`).
- Privacy panel:
  - "network egress" card shows live distinct-host count.
  - "last action audited" card shows the most-recent event summary.
  - Audit-log tab is a paginated table with actor filter (replaces
    the v2.a deferral message).
- Evolve panel pending-nudges section renders a real list with
  per-nudge **capture** / **dismiss** buttons (replaces the count
  placeholder).

### Discipline

- Marker count unchanged at 6 upstream files.
- Web-addin: 79 tests pass (was 72).
- Python addin: 68 tests pass (was 41).

### Deferred (Phase 2c / v2.0.8+)

- Automatic nudge generation (workflow-recorder skill, Phase 2c).
- Audit-log rotation / compaction.
- Network-policy UI (Phase 4 per spec §3.7 / §10.5).

## [2.0.6+addin.0] — Phase 2a (inspectability foundations)

_2026-05-08_

### Privacy Panel (the differentiator)

- New `/memory` page with 3 sub-tabs: Overview, Privacy, Audit log (per spec §7.2 IA, §7.3).
- Privacy tab renders 4 metric blocks per spec §7.3:
  - **Memory entries** — live count, parsed from `~/.hermes/memories/{USER,MEMORY}.md` via new `/api/addin/memory/overview`.
  - **Data residency** — real-time path + size + symlink target via new `/api/addin/data-residency`. Reports `~/.addin → ~/.hermes` symlink, recursive size, and at-rest encryption status (off in v2.a).
  - **Network egress** — stub for v2.b (requires addin-side HTTP-client hook).
  - **Last action audited** — stub for v2.b (requires addin-side audit hook into upstream's tool dispatcher).
- Overview tab shows total/user/project entry counts and last-modified timestamp.
- Audit log tab honestly directs users to `~/.hermes/logs/` for v2.a; addin-side audit ships in v2.b.

### Evolve Panel

- `/skills` restructured into 3 sub-tabs: Installed, Hub, Evolve (per spec §7.2, §7.4).
- Installed tab carries forward the Phase 1d list view, unchanged.
- Hub tab is an honest v2.b stub pointing to addinskills.io.
- Evolve tab renders recently-modified skills (filesystem mtime from `~/.hermes/skills/`), curator status (filesystem-derived from `~/.hermes/logs/curator/`), and a 0-nudges placeholder via new `/api/addin/skills/evolve`. Live curator state and interactive nudge actions ship in v2.b.

### Backend

- New addin-side FastAPI module `addin/api.py` mounts under `/api/addin/*` via a marked overlay in `hermes_cli/web_server.py` (one block, after plugin mount, before SPA catch-all).
- 4 new pytest cases for the addin module (counts, missing dirs, residency, skills evolve).
- 8 new web-addin Vitest cases covering tab structure, mocked-fetch loads, and stub-content presence.

### Discipline

- Marker count: 6 modified upstream files (was 5; web_server.py added).
- Web-addin: 72 tests pass (was 64).
- Python addin: 41 tests pass (was 37).

### Deferred (Phase 2b)

- Audit log infrastructure (event source + ingestion + display).
- Network egress tracking (addin-side HTTP-client hook).
- Curator nudge actions (capture/dismiss buttons that POST to upstream).
- Live curator state surfacing.

## [2.0.5+addin.0] — Phase 1e (Phase 1 cutline complete)

_2026-05-08_

### Component library

- New primitives: `Modal` (Esc/backdrop close, hairline border) and `Toast` (auto-dismiss with success/danger intents). Library now at 22 components.

### Dashboard

- `/settings` is now editable: Config tab provides a JSON-view editor with PUT to `/api/config`. YAML round-tripping deferred to v2.1.
- `/settings` Env tab lists configured env-var keys (values masked). Editing deferred to v2.1.
- Other `/settings` tabs (models, mcp, profiles, docs) render an honest "ships in v2.1" stub.

### Phase 1 cutline closed

- All six Phase 1 DoD criteria from spec §10.6 are now met:
  1. One-command install with no upstream "hermes" string in user-facing surfaces
  2. Chat works (CLI + Telegram); dashboard `/chat` honestly directs users to the CLI
  3. Settings work (Config editable, Env listed, Models/MCP/Profiles deferred)
  4. Marketing site exists at addin.tanyewhong.com with working install command
  5. Upstream-merge automation runs cleanly
  6. Unimplemented dashboard routes render honest "ships in v2.1" stubs

### Discipline

- Marker count unchanged at 5 upstream files. No new patches in 1e.

## [2.0.4+addin.0] — Phase 1d (skills + sessions + Telegram rebrand)

_2026-05-08_

### Dashboard

- `/skills` route — functional list view of installed skills (name + description + category, plus enabled flag).
- `/sessions` route — functional recent-history list (server-capped at 50; timestamp from epoch seconds; live indicator for active sessions).
- `/chat` route — chat-specific stub explicitly pointing users to the `addin` CLI; browser chat deferred until a streaming protocol is designed.

### Telegram

- `/start`, `/help`, agent-failure-error replies routed through `addin.telegram.copy.lookup` with KeyError-fallback to upstream copy.
- `/start` discovery: upstream has no dedicated `/start` handler (falls through to unknown-command branch); the overlay wraps that branch with a `command == "start"` redirect to the addin welcome.
- One marked overlay on `gateway/run.py`.

### Installer

- `addin-install.sh` now checks `python3.11 -c "import ensurepip"` and exits with a platform-specific install hint when the venv module is missing (e.g., stock Debian 12 needs `apt install python3.11-venv`).

### Discipline

- 5 upstream files now modified (was 4); marker check still exits 0.
- 6 voice-rule unit tests on the new Telegram copy module; total addin Python tests: 37 passed + 1 skipped.

## [2.0.3+addin.0] — Phase 1c complete (dashboard wire-up)

_2026-05-07_

### Dashboard

- React Router app at `web-addin/src/` consumes the Phase 1b component library.
- 7 top-level routes (chat, skills, memory, cron, sessions, logs, settings).
- `/settings` is functional: read-only viewer of upstream's `/api/config`.
- The other 6 routes render an honest "ships in v2.1" stub.
- Vite dev-server proxies `/api` to upstream's `web_server.py` on port 9119.

### Wire-up

- `addin/cli/__init__.py` sets `HERMES_WEB_DIST` to `<repo>/web-addin/dist/` before delegating to upstream — no upstream patches needed (upstream's `web_server.py` already supports this env var).
- `addin-install.sh` now builds `web-addin/dist/` at install time (requires Node 22+).
- `addin dashboard` opens the A/addin-branded UI on http://localhost:9119.

### Discipline

- **Zero new upstream-file modifications.** Marker check unchanged at "4 upstream files modified".

## [2.0.2+addin.0] — Phase 1b complete (component library + token layer)

_2026-05-07_

### Component library

- New `web-addin/` Vite 8 + React 19 + TS 6 + Tailwind v4 app, sibling to upstream `web/`.
- Token layer: CSS custom properties for colors / type / space / motion, bridged to Tailwind via `@theme`.
- 20 components shipped:
  - **Primitives**: Button (3 variants × 3 sizes × 2 intents), Input, Textarea, Field (with a11y wiring), Card, Spinner, Icon (with allowlist).
  - **Layout**: Stack, Cluster, Container.
  - **Typography**: Heading (H1–H4), Text, Caption, Label.
  - **Composites**: TopBar, PageShell, PageHeader, MessageRow, EmptyState, CommandBar (⌘K shell).
- 48 unit tests (Vitest 4 + React Testing Library) covering rendering, variants, a11y, edge cases.
- Storybook 10 with 20 `*.stories.tsx` files — at least one story per component.
- ESLint flat config with `no-restricted-imports` rule: importing a lucide icon outside `src/ui/icons/allowlist.ts` is an error.

### Discipline

- Zero new upstream-file modifications. `web-addin/` is purely additive sibling-file content.
- All token decisions match spec §5.1 Variant B (JetBrains Mono · neutral grays · reserved red+amber · 0px radius · 1px hairlines · no shadows).
- `addin/` Python overlay (Phase 1a) untouched.

### Out of scope (deferred)

- Modal, Toast, Tabs, Select, Checkbox, Radio, Switch — added in Phase 1c when a dashboard page needs them.
- AuditEntry, SkillRow, EvolveTab composites — Phase 2 inspectability.
- Storybook hosting — Phase 1c or 1d.
- `@addin/ui` npm publish — addin-www can consume via path until then.

## [2.0.1+addin.0] — Phase 1a complete (CLI dual-name + onboarding)

_2026-05-07_

### CLI dual-name

- New `addin` console script registered alongside upstream `hermes`.
- Argv normalization (`sys.argv[0]` → `"hermes"`) before upstream import.
- `ADDIN_*` env-var aliasing onto `HERMES_*` with set-don't-override semantics.
- `ADDIN_ORIGINAL_ARGV0` recorded for telemetry/debugging.
- `~/.addin → ~/.hermes` symlink created by installer; refuses to clobber a real dir.

### Branding

- Branded ASCII banner at every CLI invocation. `ADDIN_BANNER=upstream` debug escape hatch.
- `addin --version` shows A/addin identity, upstream version, overlay SHA, python, home (with symlink target when ADDIN_HOME is exported).
- `addin setup` wizard routes 6 of 9 user-facing strings through `addin.onboarding.copy.lookup` with KeyError-fallback to upstream copy. Punted: profile screens (no upstream equivalent — owned by addin in 1b/1c), done.summary (250-line dynamic render — structural rewrite for 1b).

### Distribution

- `scripts/addin-install.sh` published at https://addin.tanyewhong.com/install.sh.
- Curl-runnable on Linux + macOS. `addin-www` prebuild hook keeps the served script in sync with the addin repo's main branch.

### Marker discipline

- 4 upstream files modified, all marked: `pyproject.toml`, `hermes_cli/banner.py`, `hermes_cli/main.py`, `hermes_cli/setup.py`.
- 1 additional `[tool.setuptools.packages.find]` include update needed to expose `addin*` to setuptools — also marked.

### Tests

- 29 unit tests + 1 skipped placeholder. Coverage: env aliasing, argv normalization, version formatter (incl. symlink rendering + HOME fallback), banner content (incl. spec amendment), copy lookup with voice-rule iteration over all keys, fallback-on-missing.
- End-to-end install verified in a clean Ubuntu 24.04 container.

## [2.0.0+addin.0] — Phase 0 complete


_2026-05-07_

### Foundations

- Forked `nousresearch/hermes-agent` to `tanyewhong-creator/addin` (full history preserved).
- Added `NOTICE.md` per spec §1.5.
- Set up `upstream` and `main` branch topology per spec §2.1.
- Added overlay-marker check script (`scripts/check-overlay-markers.sh`) and PR workflow.
- Added GitHub Actions for weekly upstream-merge PRs and hourly urgent-release watcher.
- Configured Dependabot for security and dependency updates.
- Added CODEOWNERS for overlay paths.
- Created `tanyewhong-creator/addin-www` repo with Astro 5 + Tailwind v4 scaffold.
- Bound `addin.tanyewhong.com` to Cloudflare Pages with auto-deploy on push to `main`.
