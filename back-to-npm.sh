#!/usr/bin/env bash
# Puts building-blocks back on vinta-prototype-lab 0.1.2 from npm, with its local patch, and
# reinstalls. It undoes what linking this checkout changed and nothing else:
#
#   pnpm-workspace.yaml  the `overrides:` entry for vinta-prototype-lab goes, and the commented-out
#                        `patchedDependencies:` entry comes back. Every other line is left as it is.
#   pnpm-lock.yaml       restored from /tmp/bb-backup/pnpm-lock.yaml when that copy exists; then
#                        `pnpm install` brings it in line with the current package.json files.
#
# The result is compared with /tmp/bb-backup/pnpm-workspace.yaml, the copy saved before linking.
# Any difference is printed, and is a change made to the file since then.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bb="${BB_DIR:-$(cd "$here/.." && pwd)/building-blocks}"
backup="${BB_BACKUP_DIR:-/tmp/bb-backup}"
workspace="$bb/pnpm-workspace.yaml"

if [[ ! -f "$workspace" ]]; then
  echo "No pnpm-workspace.yaml at $bb. Set BB_DIR to the building-blocks checkout." >&2
  exit 1
fi
if [[ ! -f "$bb/patches/vinta-prototype-lab@0.1.2.patch" ]]; then
  echo "The patch file $bb/patches/vinta-prototype-lab@0.1.2.patch is missing; nothing to go back to." >&2
  exit 1
fi

# Drop the override block (its comment, key and entry) and uncomment the patch entry.
node - "$workspace" <<'EOF'
const fs = require('node:fs')
const file = process.argv[2]
let text = fs.readFileSync(file, 'utf8')
text = text.replace(
  /\n# Local development: use the viewer from its own checkout next to this repo\.\noverrides:\n  vinta-prototype-lab: link:\.\.\/vinta-prototype-lab\n/,
  ''
)
text = text.replace(
  /# Off while the viewer is linked from \.\.\/vinta-prototype-lab \(see overrides below\), which has\n# these changes in its source\. \.\.\/vinta-prototype-lab\/back-to-npm\.sh turns it back on\.\n# patchedDependencies:\n#   vinta-prototype-lab@0\.1\.2: patches\/vinta-prototype-lab@0\.1\.2\.patch\n/,
  'patchedDependencies:\n  vinta-prototype-lab@0.1.2: patches/vinta-prototype-lab@0.1.2.patch\n'
)
if (/link:\.\.\/vinta-prototype-lab/.test(text) || !/^patchedDependencies:$/m.test(text)) {
  console.error(`Could not undo the link in ${file}: it no longer has the lines linking added. Edit it by hand.`)
  process.exit(1)
}
fs.writeFileSync(file, text)
EOF

if [[ -f "$backup/pnpm-workspace.yaml" ]]; then
  if diff -u "$backup/pnpm-workspace.yaml" "$workspace"; then
    echo "pnpm-workspace.yaml matches the backup."
  else
    echo "pnpm-workspace.yaml differs from the backup in the lines above; those were changed after linking and are kept."
  fi
fi

if [[ -f "$backup/pnpm-lock.yaml" ]]; then
  cp "$backup/pnpm-lock.yaml" "$bb/pnpm-lock.yaml"
else
  echo "No lockfile backup at $backup; pnpm install resolves vinta-prototype-lab@^0.1.2 from npm again."
fi

pnpm -C "$bb" install

resolved="$(cd "$bb/packages/prototype-lab/node_modules/vinta-prototype-lab" && pwd -P)"
echo "vinta-prototype-lab now resolves to: $resolved"
