#!/usr/bin/env bash
# Builds this package in watch mode and runs building-blocks' prototype viewer against it.
#
#   ./dev-with-bb.sh                 viewer on http://localhost:6017
#   ./dev-with-bb.sh --port 6027     any other `prototype-lab dev` option is passed through
#   ./dev-with-bb.sh --watch-only    only the watch build, for a viewer started some other way
#
# building-blocks must be linked to this checkout first (its pnpm-workspace.yaml overrides
# vinta-prototype-lab with link:../vinta-prototype-lab). back-to-npm.sh undoes that.
# A change to src/ reloads the page. A change to the Vite plugin (src/node, src/dev) needs the viewer
# restarted: stop this script with Ctrl-C and run it again.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bb="${BB_DIR:-$(cd "$here/.." && pwd)/building-blocks}"
port=6017
watch_only=false
passthrough=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --watch-only) watch_only=true ;;
    --port) port="$2"; shift ;;
    *) passthrough+=("$1") ;;
  esac
  shift
done

if [[ "$watch_only" == false ]]; then
  linked="$(cd "$bb/packages/prototype-lab/node_modules/vinta-prototype-lab" 2>/dev/null && pwd -P || true)"
  if [[ "$linked" != "$(cd "$here" && pwd -P)" ]]; then
    echo "building-blocks at $bb does not use this checkout (it resolves vinta-prototype-lab to: ${linked:-nothing})." >&2
    echo "Add 'overrides: { vinta-prototype-lab: link:../vinta-prototype-lab }' to its pnpm-workspace.yaml and run pnpm install." >&2
    exit 1
  fi
fi

cd "$here"

# One full build first, so dist/ is complete before anything reads it.
pnpm build

pids=()
stop() {
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap stop EXIT INT TERM

# --no-clean: a rebuild must not empty dist/ under a running viewer, or viewer.css goes with it.
pnpm exec tsdown --watch --no-clean &
pids+=($!)
pnpm exec tailwindcss -i src/viewer.css -o dist/viewer.css --minify --watch=always &
pids+=($!)

if [[ "$watch_only" == true ]]; then
  wait
else
  pnpm -C "$bb" -F @vinta-bb/prototype-lab dev --port "$port" ${passthrough[@]+"${passthrough[@]}"}
fi
