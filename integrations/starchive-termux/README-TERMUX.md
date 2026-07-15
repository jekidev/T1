# STARCHIVE for Android Termux

This package exports all repositories starred by the authenticated GitHub
account and saves them as `starred_repos.csv` in Android's Downloads folder.
It first connects to GitHub's current hosted MCP server and uses its
`list_starred_repositories` tool when available. Because the hosted server
may not expose that tool yet, the package includes a safe GitHub REST API
fallback so it remains usable today.

## Install from your phone's Downloads folder

1. Download `STARCHIVE-Termux.zip` from the ChatGPT conversation.
2. Open Termux and run:

```bash
termux-setup-storage
cd ~/storage/downloads
unzip -o STARCHIVE-Termux.zip
cd STARCHIVE-Termux
chmod +x *.sh
./setup.sh
```

3. After GitHub authentication finishes, export the list:

```bash
./run.sh
```

The output is:

```text
Internal storage/Download/starred_repos.csv
```

## Configure the MCP endpoint

The default endpoint is:

```text
https://api.githubcopilot.com/mcp/
```

To use another compatible GitHub MCP endpoint:

```bash
GITHUB_MCP_URL="https://your-mcp-host.example/mcp/" \
STARCHIVE_ALLOW_CUSTOM_MCP=1 \
./run.sh
```

## Use another GitHub account

```bash
GITHUB_USERNAME="another-account" ./run.sh
```

Omit `GITHUB_USERNAME` to fetch stars for the account used during `gh auth
login`. The GitHub token must be available as `GITHUB_TOKEN`, `GH_TOKEN`, or
through the GitHub CLI.

When the MCP server exposes `list_starred_repositories`, it is used
automatically. Otherwise the script prints a notice and uses the REST
fallback.

## Incremental exports and filters

Export only repositories starred since a timestamp:

```bash
STARCHIVE_SINCE="2026-07-01T00:00:00Z" ./run.sh
```

Let the exporter remember the newest starred timestamp between runs:

```bash
STARCHIVE_INCREMENTAL=1 ./run.sh
```

Optional chat-friendly filters are available through environment variables:

```bash
STARCHIVE_INCREMENTAL=1 \
STARCHIVE_LANGUAGE=Python \
STARCHIVE_TOPIC=machine-learning \
STARCHIVE_MIN_STARS=100 \
./run.sh
```

The exporter validates required CSV fields, HTTPS repository URLs, and
non-negative integer star counts before writing the file.

Custom MCP endpoints require explicit approval:

```bash
GITHUB_MCP_URL="https://your-mcp-host.example/mcp/" \
STARCHIVE_ALLOW_CUSTOM_MCP=1 \
./run.sh
```

If you authenticate the wrong GitHub account:

```bash
gh auth logout
gh auth login --hostname github.com --git-protocol https --web
```
