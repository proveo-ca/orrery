#!/usr/bin/env bash
# SPEC: _spec/architecture.puml
#
# fetch-themes.sh
#
# Description:
#   Vendors the proveo identity Mermaid + Vega-Lite themes into a project's
#   _spec/themes/ directory. PlantUML is NOT vendored — it is included remotely
#   (see references/rendering.md), so it never needs a local copy.
#
#   By default the themes are copied from the copies bundled with this skill
#   (offline, pinned to the skill version). Pass --remote to pull the latest
#   straight from the identity repo instead.
#
# Usage:
#   bash fetch-themes.sh [target_dir] [--remote]
#
#   target_dir   Project root or themes dir (default: $(pwd)).
#                If it isn't already a .../themes dir, _spec/themes is appended.
#   --remote     Fetch from github.com/proveo-ca/identity instead of bundled assets.
#

set -o errexit
set -o nounset
set -o pipefail

readonly IDENTITY_BASE="https://raw.githubusercontent.com/proveo-ca/identity/main"
readonly THEME_FILES=("proveo.mermaid" "proveo.vega.json" "proveo-dark.vega.json")

# Directory of this script, so we can find ../assets/themes regardless of CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly ASSETS_DIR="${SCRIPT_DIR}/../assets/themes"

usage() {
  cat <<EOF
Usage: $(basename "${0}") [target_dir] [--remote]

Vendors the proveo Mermaid + Vega-Lite themes into <target>/_spec/themes/.
PlantUML is included remotely and is not copied.

Arguments:
  target_dir   Project root or a themes dir (default: current directory).
Options:
  --remote     Pull the latest themes from the identity repo over the network.
  -h, --help   Show this help.
EOF
}

main() {
  local target="$(pwd)"
  local remote=0

  while [[ $# -gt 0 ]]; do
    case "${1}" in
      --remote) remote=1; shift ;;
      -h|--help) usage; exit 0 ;;
      -*) echo "Unknown option: ${1}" >&2; usage; exit 1 ;;
      *) target="${1}"; shift ;;
    esac
  done

  # Resolve the destination: allow passing either a project root or a themes dir.
  local dest
  case "${target}" in
    */themes|*/themes/) dest="${target%/}" ;;
    *) dest="${target%/}/_spec/themes" ;;
  esac
  mkdir -p "${dest}"

  for f in "${THEME_FILES[@]}"; do
    if [[ "${remote}" -eq 1 ]]; then
      echo "Fetching ${f} from identity -> ${dest}/${f}"
      curl -fsSL "${IDENTITY_BASE}/${f}" -o "${dest}/${f}"
    else
      if [[ ! -f "${ASSETS_DIR}/${f}" ]]; then
        echo "Error: bundled theme '${ASSETS_DIR}/${f}' not found; try --remote." >&2
        exit 1
      fi
      echo "Copying bundled ${f} -> ${dest}/${f}"
      cp "${ASSETS_DIR}/${f}" "${dest}/${f}"
    fi
  done

  echo "Done. PlantUML uses a remote !include and needs no local theme file."
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
