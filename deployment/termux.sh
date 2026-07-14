#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

pkg update -y
pkg install -y git nodejs
termux-setup-storage || true
corepack enable
corepack prepare pnpm@10.13.1 --activate

mkdir -p "$HOME/storage/shared/GoogleDriveRAG"
export GOOGLE_DRIVE_RAG_PATH="${GOOGLE_DRIVE_RAG_PATH:-$HOME/storage/shared/GoogleDriveRAG}"

pnpm setup
pnpm rag:sync
pnpm dev
