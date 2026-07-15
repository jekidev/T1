# Authenticated workspace and LLM game builder

This document describes the implemented user flow for creating, extending and operating a game from inside the browser application.

## 1. Entry and mandatory preflight

The public application surface contains only:

- the saved-game/New Game screen
- `/workspace`, where connections are configured and tested

The following routes are protected by `PreflightGate`:

- game boards
- analytics
- Asset Lab
- external asset browser
- Geo Lab
- coding-agent inspector

The server reports `ready: true` only when all six checks pass:

1. GitHub OAuth and API identity test
2. Google OAuth with Gmail read test
3. Google Drive read test
4. Google Maps API-key test
5. OpenRouter API-key/model test
6. outbound proxy/egress test

GitHub and Google credentials remain in the server-side, HTTP-only workspace session. Maps and OpenRouter keys are stored in the same temporary server session. They are not written to browser local storage or game saves.

The proxy check verifies server egress. A successful result does not prove a specific Mullvad multihop route unless the deployment routes the API server through that tunnel; the reported public egress address remains visible in preflight.

## 2. New Game guarantees

Every new player starts with:

```text
role: boss
members: 1
starting capital: 0
syndicate capital: 0
```

The compiler enforces these constraints across:

- `playerWorkspace`
- the first player-controlled faction
- the first player-controlled syndicate
- the boss entity profile and wallet

New Game is built on a real geographic coordinate system. The tactical board keeps Google Maps as the authenticated base-map option while OpenStreetMap/Overpass remains the editable world-data pipeline.

Before generation the user selects:

- city/region and radius
- map template
- player side
- player moral starting position, from 1 to 100
- LLM narrative moral stance, from 1 to 100
- campaign name, description and design brief

The player moral value initializes deterministic gameplay state and subsequently moves through actions, risk, karma and outcomes. The LLM moral value controls fictional tone, priorities and dialogue only. It cannot bypass commands, schemas, permissions, network approval or simulation rules.

## 3. Talk, Plan and Build

The right-side LLM workspace has three explicit modes.

### Talk

- develops ideas with the user
- asks focused questions
- may discuss the board and storyline
- cannot produce an authoritative state mutation

### Plan

- produces assumptions, dependencies and affected modules
- includes risks, validation steps and acceptance criteria
- stops before implementation
- cannot claim that state changed

### Build

- may return one additive JSON proposal
- may add entities, phases and timeline events
- may update the boss profile
- may bind an existing validated user asset by exact ID
- cannot delete existing board or RAG content
- remains non-authoritative until the user presses **Apply**

Unknown asset IDs are ignored. Arbitrary local paths are not accepted. Existing ChatGPT, Grok or uploaded assets are exposed to the model as bounded metadata containing an ID, source ID, MIME type and origin.

## 4. Default workflows

### Create Storyline

```text
Talk: story discovery
→ Plan: five-act architecture
→ Build: validated phases, missions, factions, assets and events
```

### Build Board From Scratch

```text
Talk: city, radius, visual direction, moral stance and first decision
→ Plan: map anchors, layers, zones, NPC roles, assets and acceptance criteria
→ Build: minimum playable board on the real map
→ Talk: playtest review and next build slice
```

### Build Player

```text
Talk: boss identity and personality
→ Plan: profile and missing information
→ Build: name, biography, personality, traits and optional profile asset
```

### Integrate GitHub Repo

```text
Plan: license, architecture and adapter strategy
→ Integrate repository metadata
→ Build: additive adapter through existing project boundaries
```

Users can combine copied steps from multiple workflows and save the result as a new workflow. Workflow execution still follows the active Talk/Plan/Build authority mode.

## 5. GitHub workspace

After GitHub preflight, users can:

- browse repositories they own
- browse starred repositories
- create a private initialized repository
- attach a repository to the integration workflow composer
- open the repository in GitHub

An integrated repository is metadata, not executable code. Plugin registration creates a disabled plugin record and an adapter-planning step. It does not download, import or execute repository code in the production browser.

## 6. Plugin catalog

Default plugins include:

- Storyline Builder
- Family Tree
- GitHub Workspace
- Universal Assets
- Telegram MCP Units, disabled by default
- RAG World Update
- Google Maps World

Repository-backed plugin registration records:

- plugin name and purpose
- category
- source repository
- install timestamp
- enabled/disabled state

The generated workflow requires license, maintenance, browser compatibility, permission, bundle-size and test review before an adapter can be implemented.

## 7. Universal user assets

Supported browser uploads:

- PNG
- JPEG
- WebP
- MP4
- WebM

The source file is validated by the existing asset pipeline. The authenticated account catalog stores metadata only:

- asset ID
- source ID
- display name
- MIME type
- origin: upload, ChatGPT, Grok or other
- creation timestamp

The catalog owner is the authenticated GitHub login. Catalog synchronization begins only after all preflight checks pass.

Assets can be used as:

- person profile images
- boss profile images
- images or videos on any board entity
- references in an approved LLM Build proposal
- future inputs for the external asset-generation pipeline

Direct profile-image uploads are also added to the universal catalog, making them reusable by other people and entities.

Removing catalog metadata does not silently delete board entities or rewrite saves. Existing entity references remain stable until explicitly changed.

## 8. People and Family Tree

Every unit/civilian can have:

- profile image
- personality
- biography
- traits and experience
- role and username
- status and last-seen text
- game wallet metadata
- visual accent

The direct **Family Tree** board tool presents the active fictional syndicate as a ranked hierarchy. The separate **Syndicate** tool exposes the full dashboard for hierarchy, territories, economy, members, relationships, intelligence, businesses, events, reputation and strategy.

The hierarchy is inspired by classic mafia organizational visualization but uses the project’s fictional Danish decentralized council/district-team preset. Character identity or background never automatically determines criminality, loyalty, aggression, competence or risk.

## 9. Telegram MCP people import

Family Tree contains the Telegram flow:

1. inspect connection status
2. start QR/device or optional phone-code login through the configured service
3. verify code and optional 2FA password
4. search the authenticated account
5. explicitly select one result
6. add that person as an unassigned neutral board unit

No account, group or contact list is automatically converted into units. Telegram results are marked unverified and can be fictionalized and edited before receiving a syndicate role.

## 10. Hyperlinks

The workspace contains a categorized quick-launch library. Only valid HTTPS links can be saved. Default links cover GitHub, OpenRouter, Google Maps Platform and Hugging Face.

## 11. Network authority

Internet retrieval remains governed by `docs/NETWORK_ACCESS.md`:

- Ask First is default
- every approval requires `APPROVE NETWORK`
- Ultra requires `ENABLE ULTRA`
- approval and Ultra additionally require the server-side administrator secret
- integrated browsing models are blocked outside the controlled boundary
- private networks and metadata endpoints remain blocked

Plugin registration, repository integration and LLM Build mode do not grant web access by themselves.

## 12. RAG preservation

Existing `rag/**` files, including DeepSeek scripts and conversations, are immutable source material. New imports are append-only and content-addressed. Build proposals cannot delete, move, redact or overwrite these files.

## 13. Validation commands

After regenerating the workspace lockfile, run:

```bash
pnpm install --no-frozen-lockfile
pnpm typecheck
pnpm test:integration
pnpm build
```

The command-sim regression suite includes:

- Talk/Plan/Build authority context
- default workflows and plugins
- 1–100 moral-range enforcement
- New Game boss/alone/zero-capital guarantees
- team-pulse and strategy bridge tests

The branch must remain a draft until CI runs these commands successfully and the deployment-specific OAuth, Maps, OpenRouter, proxy, Telegram and coding-agent integrations are exercised with non-production test accounts.
