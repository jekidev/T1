# Operation København / Urban Strategy Simulator

## Read before any changes

This repository is an AI-first urban strategy simulator and development workspace. The game is designed to be played with AI and developed with AI through a controlled workflow.

## Core rules

1. Inspect actual source files before proposing or implementing changes.
2. Treat `rag/` and persistent RAG memory as canonical project context.
3. Preserve secrets: never commit API keys, Telegram sessions, tokens, passwords, or private credentials.
4. MCP writes and external modifications require explicit approval.
5. Unknown scripts in `features/integrate/` or imported packages must not execute automatically.
6. Use feature ownership and plugin adapters instead of copying large third-party repositories into core.
7. Separate observation, diagnosis, proposal, implementation, and validation.
8. Never claim a build, deployment, tool call, or code change succeeded without evidence.

## Main systems

- React/Vite command simulator frontend
- Express/TypeScript API server
- AI Workspace profiles
- OpenRouter model rotation, static mode, and local fallback
- Developer AI observability panel
- Browser, server, network, game, and LLM telemetry
- One-click source-code debugger
- Text and image notes stored in RAG
- Startup RAG ingestion into persistent memory
- Denmark world profile and configurable world setup
- Google Maps-first board underlay with OpenStreetMap fallback
- Realtime analytics dashboard
- Memory and allowlisted filesystem APIs
- MCP registry
- Telegram Auth API and Telegram MCP configuration
- A* and Dijkstra path-planning APIs
- Controlled evolution proposals
- Plugin and integration registries

## Important folders

```text
ai-workspace/        Reusable AI profile templates
artifacts/           Frontend and backend workspaces
docs/                Master prompt and project guidance
features/            Feature ownership and integration intake
integrations/        MCP, providers, analytics and external adapters
plugins/             Plugin manifests and extension architecture
rag/                 World knowledge, notes, documents and imported context
scripts/             Setup, deployment and synchronization commands
```

## Validation

Preferred validation commands:

```bash
pnpm typecheck
pnpm build
```

If CI has not run or returned a result, state that clearly.

## Canonical development prompt

Read:

```text
docs/MASTER_PROMPT_OPERATION_KOBENHAVN.md
```

before using a new AI agent to modify the project.
