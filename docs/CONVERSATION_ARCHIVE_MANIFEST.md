# Conversation and project archive manifest

Created: 2026-07-14

This file records the major decisions and implementation requests from the visible development conversation for `jekidev/T1`. It is a curated project history, not a verbatim export of hidden reasoning, unavailable messages, account data, or content outside the visible conversation.

## Product direction

- Build an AI-first urban strategy simulator.
- The game must be playable with AI.
- The same AI should help design, debug, balance, document, and extend the game.
- Denmark and Copenhagen are the default world setting.
- The center of the GUI should be a playable geographic map.

## Repository architecture added

- Feature ownership folders
- Integration intake folders
- AI Workspace templates
- Plugin registry
- Analytics and map integration catalog
- MCP server registry
- Free LLM provider catalog with bring-your-own-key policy

## AI and LLM work

- OpenRouter integration
- Multi-key rotation
- Model rotation
- Static mode
- Off mode with deterministic fallback
- Default rotation models:
  - `nvidia/nemotron-nano-9b-v2:free`
  - `google/gemma-4-26b-a4b-it:free`
  - `mistralai/mistral-nemo`
- Retry and cooldown handling
- LLM health endpoint
- AI Workspace profiles with prompts, rules, skills, memories, and MCP definitions

## Developer AI and observability

- Browser and game telemetry
- Console warnings and errors
- Unhandled rejection reporting
- Network telemetry
- Server request telemetry
- Server-Sent Events stream
- Developer AI panel
- DOM snapshots
- Runtime analysis
- Review-package export
- One-click source-code debugging using available free OpenRouter coding models

## RAG and memory

- Google Drive-oriented RAG workflow
- Persistent startup ingestion of new `rag/` files
- SHA-256 deduplication
- Persistent RAG context supplied to advisor requests
- Text note creation
- Image note creation with companion Markdown descriptions
- Denmark world knowledge document

## World and map systems

- World configuration model
- Denmark defaults
- City presets for Copenhagen, Aarhus, Odense, Aalborg, and Esbjerg
- Work-area radius
- Supplier country
- Language, currency, and timezone
- Google Maps-first underlay
- OpenStreetMap fallback

## Analytics and simulation extensions

- Realtime analytics route and dashboard
- Event distribution
- Network latency
- LLM success metrics
- Error and warning counts
- Live event timeline
- A* path planning
- Dijkstra path planning
- Path-planning telemetry

## MCP and external integrations

Registered or implemented:

- Memory MCP-style API
- Allowlisted filesystem API
- GitHub MCP
- Hugging Face Hub MCP
- Google Maps adapter
- Playwright MCP
- Telegram Auth API proxy
- Telegram MCP with read and modify capabilities behind approval
- RSSHub

Vendor setup command:

```bash
pnpm setup:mcp
```

## Controlled self-improvement

Implemented an evolution workflow:

```text
observe
→ diagnose
→ propose
→ approve/reject
→ implement separately
→ validate
```

No unreviewed autonomous patching is intended.

## Canonical documentation

- `docs/README_BEFORE_ANY_CHANGES.md`
- `docs/MASTER_PROMPT_OPERATION_KOBENHAVN.md`
- `integrations/mcp/README.md`
- `ai-workspace/README.md`
- `plugins/README.md`

## Archive limitations

A literal full transcript of every message is not automatically available through the GitHub repository. This manifest captures the visible project decisions and implementation history relevant to continued development. The repository itself remains the canonical record of actual code changes.
