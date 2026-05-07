# CHANGELOG-ADDIN

This file tracks A/addin overlay changes only. Upstream hermes-agent changes are recorded
in the upstream `CHANGELOG.md`, which is preserved unchanged.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to a versioning scheme of `MAJOR.MINOR.PATCH+addin.N` where `MAJOR.MINOR`
tracks the upstream version.

## [2.0.0+addin.0] — Phase 0 complete

_2026-05-07_

## [Unreleased]

### Phase 0 — Foundations

- Forked `nousresearch/hermes-agent` to `tanyewhong-creator/addin`.
- Added `NOTICE.md` per spec §1.5.
- Set up `upstream` and `main` branch topology per spec §2.1.
- Added overlay-marker check script (`scripts/check-overlay-markers.sh`).
- Added GitHub Actions for weekly upstream-merge PRs and hourly urgent-sync polling.
- Added `addin-www` Astro scaffold (separate repo).
- Bound `addin.tanyewhong.com` to Cloudflare Pages.
