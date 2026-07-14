# Deployment and RAG guide

This repository is designed to run from the same GitHub source in Replit, Manus-assisted workflows, Android/Termux, ordinary local Linux/macOS/Windows environments, Docker hosts, and GitHub Pages for a static frontend.

## Recommended: Replit full application

Use Replit when frontend, Express API, LLM routing, and RAG processing should run together.

1. Import `https://github.com/jekidev/T1` into Replit.
2. Select pnpm as package manager.
3. Add credentials through Replit Secrets. Never commit API keys.
4. Build command:

   ```bash
   pnpm install --frozen-lockfile && pnpm rag:sync && pnpm build
   ```

5. Production run command:

   ```bash
   NODE_ENV=production pnpm start
   ```

The Express server serves the compiled frontend in production, so one deployment can host the complete application.

## Manus

Give Manus the repository URL and instruct it to work against the existing project rather than generating an unrelated replacement:

```text
Use https://github.com/jekidev/T1 as the canonical repository. Preserve its pnpm workspace, Express API, command-sim frontend, rag folder conventions, Dockerfile, and deployment documentation. Commit changes in focused branches and keep all credentials out of source control.
```

Manus access and deployment capabilities depend on the integrations enabled in the Manus account. GitHub remains the canonical source of truth.

## RAG folders: Google Drive and Proton Drive

The application uses local filesystem folders as provider-neutral RAG inputs. Cloud services sync or export files into those folders; the project then copies supported files into `rag/inbox`, removes duplicates by SHA-256, and writes `rag/inbox/manifest.json`.

Supported source formats:

```text
.pdf .txt .md .docx .json .csv
```

Run ingestion preparation:

```bash
pnpm rag:sync
```

Set one or more source folders through `RAG_SOURCE_PATHS`. Paths are separated by `:` on Linux, Android, and macOS, and by `;` on Windows.

Example on Android/Termux:

```bash
export RAG_SOURCE_PATHS="$HOME/storage/shared/GoogleDriveRAG:$HOME/storage/shared/ProtonDriveRAG"
pnpm rag:sync
```

Google Drive can be downloaded or synchronized into the GoogleDriveRAG folder. Proton Drive files can be exported/downloaded from the Android app into ProtonDriveRAG. The project does not require provider credentials and does not attempt to bypass Proton Drive encryption.

Default built-in sources are:

```text
rag/HackerAI_documents
rag/external/google-drive
rag/external/proton-drive
```

## Android / Termux

```bash
pkg update
pkg install git nodejs
corepack enable
corepack prepare pnpm@10.13.1 --activate
termux-setup-storage

git clone https://github.com/jekidev/T1.git
cd T1
cp .env.example .env
pnpm local:setup
pnpm dev
```

For a production-style local run:

```bash
pnpm local:run
```

Android may suspend Termux processes. Use Replit or another server host for a continuously available public deployment.

## Local computer

Requirements: Git, Node.js 22+, and Corepack/pnpm.

```bash
git clone https://github.com/jekidev/T1.git
cd T1
corepack enable
corepack prepare pnpm@10.13.1 --activate
cp .env.example .env
pnpm local:setup
pnpm dev
```

## Docker and generic hosts

The included Dockerfile allows deployment to any service that accepts a Docker image.

```bash
docker build -t urban-strategy-simulator .
docker run --rm -p 8080:8080 --env-file .env urban-strategy-simulator
```

For persistent RAG documents, mount a host folder:

```bash
docker run --rm -p 8080:8080 --env-file .env \
  -v /path/to/rag:/app/rag/external \
  urban-strategy-simulator
```

This makes the project portable to VPS providers, container platforms, local Docker, and future hosting services without changing the application layout.

## GitHub Pages

GitHub Pages can publish only the static frontend and static RAG files. It cannot execute the Express API, LLM requests, or indexing process.

Expected URL:

```text
https://jekidev.github.io/T1/
```

## Environment variables

Start from `.env.example`. Typical values include:

```text
PORT=8080
BASE_PATH=/
OPENROUTER_API_KEY=
DATABASE_URL=
RAG_SOURCE_PATHS=
RAG_INBOX_DIR=rag/inbox
```

Keep credentials in Replit Secrets, local `.env` files excluded from Git, Docker secrets, or the target host's secret manager.
