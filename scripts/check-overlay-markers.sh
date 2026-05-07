#!/usr/bin/env bash
# scripts/check-overlay-markers.sh — see header in repo for full docs.

set -euo pipefail

UPSTREAM_REF="${ADDIN_UPSTREAM_REF:-origin/upstream}"
EXEMPT_FILE="$(dirname "$0")/.overlay-exempt"

if ! git rev-parse --verify "$UPSTREAM_REF" >/dev/null 2>&1; then
    echo "error: $UPSTREAM_REF does not exist locally. Run: git fetch origin upstream:upstream" >&2
    exit 2
fi

declare -A EXEMPT
if [[ -f "$EXEMPT_FILE" ]]; then
    while IFS= read -r line; do
        line="${line%%#*}"
        line="${line//[[:space:]]/}"
        [[ -z "$line" ]] || EXEMPT["$line"]=1
    done < "$EXEMPT_FILE"
fi

mapfile -t UPSTREAM_FILES < <(
    git diff --name-only --diff-filter=M "$UPSTREAM_REF"...HEAD
)

VIOLATIONS=0
CHECKED=0

for f in "${UPSTREAM_FILES[@]}"; do
    if [[ -n "${EXEMPT[$f]:-}" ]]; then
        continue
    fi
    CHECKED=$((CHECKED + 1))

    diff_output=$(git diff "$UPSTREAM_REF"...HEAD -- "$f")
    added_lines=$(echo "$diff_output" | grep -E '^\+[^+]' || true)
    [[ -z "$added_lines" ]] && continue

    stripped=$(echo "$added_lines" | sed 's/^\+//')
    if echo "$stripped" | grep -qE '# *ADDIN-OVERLAY(:|-BEGIN|-END)'; then
        continue
    fi

    if grep -qE '# *ADDIN-OVERLAY(:|-BEGIN|-END)' "$f" 2>/dev/null; then
        continue
    fi

    echo "violation: $f modifies upstream content without an ADDIN-OVERLAY marker"
    VIOLATIONS=$((VIOLATIONS + 1))
done

if [[ $VIOLATIONS -gt 0 ]]; then
    echo
    echo "$VIOLATIONS upstream file(s) modified without overlay markers."
    echo "fix: wrap the change with '# ADDIN-OVERLAY-BEGIN' / '# ADDIN-OVERLAY-END'"
    echo "     or add a single-line '# ADDIN-OVERLAY: <reason>' comment,"
    echo "     or list the path in scripts/.overlay-exempt for whole-file replacements."
    exit 1
fi

echo "ok — $CHECKED upstream file(s) modified, all marked or exempt."
