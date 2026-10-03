#!/bin/bash
# Rebuilds every mod, then validates, tests and type-checks each one.
# Exits non-zero if anything fails. Usage: bash scripts/check.sh [mod ...]
#
#   TSC    a TypeScript compiler (default: the first tsc found on PATH or
#          in a sibling project's node_modules)
#   TYPES  this Claude Code build's claude-code.d.ts (default: the newest
#          one the plugin-authoring skill wrote under /private/tmp)
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

TSC="${TSC:-$(command -v tsc || ls /Users/*/Desktop/*/*/node_modules/.bin/tsc 2>/dev/null | head -1)}"
TYPES="${TYPES:-$(ls -t /private/tmp/claude-*/bundled-skills/*/*/plugin-authoring/types/claude-code.d.ts 2>/dev/null | head -1)}"
[ -x "$TSC" ] || { echo "check: no tsc found; set TSC" >&2; exit 2; }
[ -f "$TYPES" ] || { echo "check: no claude-code.d.ts found; load the plugin-authoring skill or set TYPES" >&2; exit 2; }

node "$ROOT/scripts/build.mjs" || exit 1

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
failed=0

typecheck() {
  cat > "$TMP/tsconfig.json" <<JSON
{ "compilerOptions": { "target": "es2023", "lib": ["es2023"], "types": [], "module": "esnext",
    "moduleResolution": "bundler", "strict": true, "noUncheckedIndexedAccess": true, "noEmit": true,
    "skipLibCheck": true, "jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment" },
  "include": ["$TYPES", "$1/hooks", "$1/tests"] }
JSON
  "$TSC" -p "$TMP/tsconfig.json" > "$TMP/tsc.out" 2>&1
}

if [ $# -gt 0 ]; then mods=("$@"); else mods=($(ls "$ROOT/plugins")); fi

for name in "${mods[@]}"; do
  dir="$ROOT/plugins/$name"
  v=$(claude plugin validate "$dir" 2>&1); vcode=$?
  t=$(claude plugin test "$dir" 2>&1); tcode=$?
  typecheck "$dir"; ccode=$?
  summary=$(printf '%s' "$t" | grep -E '^ *[0-9]+ (pass|fail)' | tr '\n' ' ')
  if [ $vcode -ne 0 ] || [ $tcode -ne 0 ] || [ $ccode -ne 0 ]; then
    failed=$((failed + 1))
    echo "FAIL $name | validate=$vcode test=$tcode typecheck=$ccode | $summary"
    [ $vcode -ne 0 ] && printf '%s\n' "$v" | tail -6
    [ $tcode -ne 0 ] && printf '%s\n' "$t" | grep -E '\(fail\)|Error' | head -8
    [ $ccode -ne 0 ] && grep 'error TS' "$TMP/tsc.out" | head -5
  else
    echo "ok   $name | $summary"
  fi
done

for engine in "$ROOT"/engines/*/; do
  typecheck "${engine%/}" || { failed=$((failed + 1)); echo "FAIL engine $(basename "$engine") typecheck"; grep 'error TS' "$TMP/tsc.out" | head -5; }
done

claude plugin validate "$ROOT" > "$TMP/market.out" 2>&1 || { failed=$((failed + 1)); echo "FAIL marketplace"; tail -5 "$TMP/market.out"; }

echo "check: $failed failure(s)"
[ $failed -eq 0 ]
