#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -x .venv/bin/python ]; then
    echo "Not installed yet. Run: ./setup.sh"
    exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
    echo "GitHub login is required."
    gh auth login --hostname github.com --git-protocol https --web
fi

if [ -d "$HOME/storage/downloads" ]; then
    OUTPUT="$HOME/storage/downloads/starred_repos.csv"
else
    mkdir -p output
    OUTPUT="$PWD/output/starred_repos.csv"
fi

. .venv/bin/activate
ARGS=(--output "$OUTPUT")
if [ -n "${GITHUB_USERNAME:-}" ]; then
    ARGS+=(--username "$GITHUB_USERNAME")
fi
python starchive_docs.py "${ARGS[@]}"

echo
echo "CSV saved to: $OUTPUT"
if command -v termux-open >/dev/null 2>&1; then
    printf "Open the CSV now? [y/N] "
    read -r answer || true
    case "$answer" in
        y|Y|yes|YES) termux-open "$OUTPUT" ;;
    esac
fi
