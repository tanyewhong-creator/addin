# CHANGELOG-ADDIN

This file tracks A/addin overlay changes only. Upstream hermes-agent changes are recorded
in the upstream `CHANGELOG.md`, which is preserved unchanged.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to a versioning scheme of `MAJOR.MINOR.PATCH+addin.N` where `MAJOR.MINOR`
tracks the upstream version.

## [Unreleased]

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
