#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

printf '\n[1/4] Updating Termux package lists...\n'
pkg update -y

printf '\n[2/4] Installing Python, GitHub CLI, and helpers...\n'
pkg install -y python gh unzip

printf '\n[3/4] Creating Python environment...\n'
cd "$(dirname "$0")"
python -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

printf '\n[4/4] Connecting GitHub...\n'
if ! gh auth status >/dev/null 2>&1; then
    echo "A browser/device login will start. Sign in as the GitHub account whose starred list you want to export."
    gh auth login --hostname github.com --git-protocol https --web
else
    echo "GitHub CLI is already authenticated."
fi

if [ ! -d "$HOME/storage/downloads" ]; then
    echo
    echo "Android storage permission is required so the CSV can be saved in Downloads."
    echo "Accept the permission dialog after the next command."
    termux-setup-storage
fi

chmod +x setup.sh run.sh show_lists.sh
printf '\nSetup complete. Run:\n  ./run.sh\n\n'
