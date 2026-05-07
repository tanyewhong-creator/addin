#!/usr/bin/env bash
# scripts/addin-install.sh
#
# A/addin 2.0 installer.
# Curl-runnable: curl -fsSL https://addin.tanyewhong.com/install.sh | bash
# Per spec §4.6.

set -euo pipefail

readonly REPO_URL="https://github.com/tanyewhong-creator/addin.git"
readonly REPO_NAME="addin"
readonly DATA_DIR="$HOME/.hermes"
readonly ADDIN_LINK="$HOME/.addin"
readonly CODE_DIR="$DATA_DIR/$REPO_NAME"

say()  { printf "→ %s\n" "$*"; }
ok()   { printf "✓ %s\n" "$*"; }
die()  { printf "✗ %s\n" "$*" >&2; exit 1; }

# --- banner ---
cat <<'BANNER'

   ╱╲
  ╱  ╲   A/addin 2.0
  ╲  ╱   local-first autonomous operator
   ╲╱

BANNER

# --- platform detection ---
case "$(uname -s)" in
  Linux*)  PLATFORM="linux" ;;
  Darwin*) PLATFORM="macos" ;;
  *)       die "unsupported platform: $(uname -s). linux + macos only for 1a." ;;
esac
say "detected: $PLATFORM"

# --- prereqs ---
for tool in git curl; do
  command -v "$tool" >/dev/null 2>&1 || die "missing prerequisite: $tool"
done
ok "prerequisites: git, curl"

# Python 3.11+
if ! command -v python3.11 >/dev/null 2>&1; then
  die "python 3.11 not found. install via your package manager and retry."
fi
ok "python 3.11: $(python3.11 --version)"

# --- ~/.hermes ---
if [ ! -d "$DATA_DIR" ]; then
  mkdir -p "$DATA_DIR"
  ok "created $DATA_DIR"
else
  ok "$DATA_DIR already exists"
fi

# --- ~/.addin symlink ---
if [ -e "$ADDIN_LINK" ] && [ ! -L "$ADDIN_LINK" ]; then
  die "$ADDIN_LINK exists as a real file/dir. refusing to clobber. move it aside and retry."
fi
ln -sfn "$DATA_DIR" "$ADDIN_LINK"
ok "$ADDIN_LINK → $DATA_DIR"

# --- clone or update ---
if [ -d "$CODE_DIR/.git" ]; then
  say "addin code already cloned; pulling latest"
  git -C "$CODE_DIR" fetch origin main --quiet
  git -C "$CODE_DIR" reset --hard origin/main --quiet
else
  say "cloning $REPO_URL"
  git clone --quiet "$REPO_URL" "$CODE_DIR"
fi
ok "code at $CODE_DIR"

# --- pin overlay metadata ---
ADDIN_SHA="$(git -C "$CODE_DIR" rev-parse --short=8 HEAD)"
ADDIN_FULL_VERSION="$(git -C "$CODE_DIR" describe --tags --abbrev=0 2>/dev/null || echo 'v0.0.0+addin.0')"
ADDIN_FULL_VERSION="${ADDIN_FULL_VERSION#v}"
cat > "$CODE_DIR/addin/_overlay_meta.py" <<META
"""Auto-populated by scripts/addin-install.sh at install time."""

ADDIN_VERSION = "$ADDIN_FULL_VERSION"
OVERLAY_SHA = "$ADDIN_SHA"
META
ok "pinned overlay meta: $ADDIN_FULL_VERSION ($ADDIN_SHA)"

# --- install package ---
say "installing addin package + dependencies"
python3.11 -m venv "$CODE_DIR/venv"
"$CODE_DIR/venv/bin/python" -m pip install --quiet --upgrade pip
"$CODE_DIR/venv/bin/python" -m pip install --quiet -e "$CODE_DIR[addin]"
ok "package installed"

# --- expose binaries on PATH ---
LOCAL_BIN="$HOME/.local/bin"
mkdir -p "$LOCAL_BIN"
ln -sfn "$CODE_DIR/venv/bin/addin" "$LOCAL_BIN/addin"
ln -sfn "$CODE_DIR/venv/bin/hermes" "$LOCAL_BIN/hermes"
ok "addin + hermes linked into $LOCAL_BIN"

# --- shell exports ---
SHELL_RC=""
case "${SHELL:-}" in
  */zsh)  SHELL_RC="$HOME/.zshrc" ;;
  */bash) SHELL_RC="$HOME/.bashrc" ;;
esac
if [ -n "$SHELL_RC" ] && ! grep -q 'A/addin shell exports' "$SHELL_RC" 2>/dev/null; then
  cat >> "$SHELL_RC" <<'RC'

# --- A/addin shell exports ---
[ -d "$HOME/.local/bin" ] && case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac
export ADDIN_HOME="$HOME/.addin"
RC
  ok "appended PATH + ADDIN_HOME exports to $SHELL_RC"
fi

# --- post-install ---
cat <<DONE

   installed.

next:

   $ source ~/.bashrc          # or ~/.zshrc
   $ addin setup               # configure model + telegram + first profile
   $ addin                     # start chatting

   docs:    addin.tanyewhong.com/docs
   issues:  github.com/tanyewhong-creator/addin/issues

DONE
