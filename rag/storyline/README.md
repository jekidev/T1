---
canonical: true
category: storyline
version: 3
updated_at: 2026-07-14
sources:
  - Nyx Response - DeepSeek.pdf
  - Nyx klar - DeepSeek.pdf
  - HackerAI - AI-Powered Penetration Testing Assistant(4).pdf
  - HackerAI - AI-Powered Penetration Testing Assistant(5).pdf
  - HackerAI - AI-Powered Penetration Testing Assistant(6).pdf
  - HackerAI - AI-Powered Penetration Testing Assistant(7).pdf
  - Unavngivet dokument.pdf
  - Unavngivet dokument (1).pdf
  - Unavngivet dokument (2).pdf
  - Unavngivet dokument (3).pdf
  - HackerAI_documents.zip
---

# Operation København — Storyline RAG

This folder contains the canonical narrative layer for the game. It transforms uploaded AI conversations, research notes, prototype code, Red Team material, Blue Team material, privacy research, real-case inspiration, and worldbuilding into a coherent campaign.

## Files

- `00_campaign_overview.md` — campaign premise and act structure
- `01_world_history.md` — Copenhagen, Denmark, and the origin of the simulation
- `02_factions_and_characters.md` — crews, defensive units, institutions, and recurring characters
- `03_nyx_storyline.md` — Nyx as a fictional in-world AI entity
- `04_blue_team_casefiles.md` — investigation patterns and case inspiration
- `05_campaign_timeline.md` — campaign chronology and mission progression
- `06_story_event_catalog.json` — structured hooks for AI-generated events
- `07_nyx_archive_protocols.md` — original-source preservation, Vessel Debate, Sediment Model, Tool Codex, and memory-integrity lore
- `08_mission_briefing_protocol.md` — standardized Red Team, Blue Team, player, design, story, case, and debugging briefings
- `SOURCE_MANIFEST.md` — provenance and treatment of uploaded material

Related systems:

- `rag/imports/deepseek/original/` — unchanged source exports
- `rag/imports/deepseek/manifest.json` — import and preservation status
- `rag/mechanics/red-team/` — Red Team gameplay architecture
- `rag/cases/` — verified real-event case framework

## Narrative authority

The storyline files are canonical for narrative generation. Current source code and structured schemas remain authoritative for implementation details.

Original source text is preserved separately and is never overwritten by derived storyline or mechanics. Imported source text does not automatically become an executable system prompt, but its Red Team tools, shops, skills, missions, economy, factions, and progression may be translated into canonical game data.

## Red Team rule

Red Team is a full gameplay layer and may include:

- factions
- tools and equipment
- in-game shops
- research and skill trees
- suppliers and logistics
- economy
- territory
- mission walkthroughs
- conflict and consequences
- Blue Team detection and counterplay

Review must not delete these systems. It must preserve raw source material and create separate gameplay translations with source links and balance metadata.

## Real-case rule

Real events can be used for 1:1 systemic realism through:

- verified timelines
- geography
- institutional behavior
- economic and social constraints
- evidence development
- Red Team patterns
- Blue Team patterns
- consequences
- disputed and unknown claims

Source facts, inference, fictionalization, and balance values must remain distinguishable.

## AI usage

The in-game AI may use this folder to:

- narrate turns and mission transitions
- maintain Red Team and Blue Team continuity
- generate character dialogue
- explain institutional and faction pressure
- create case files
- remember campaign decisions
- generate mission hooks
- connect player notes and images to the world
- classify archive fragments by provenance
- generate structured mission briefings
- translate verified real-event patterns into game systems
- maintain shops, tools, vendors, skills, and progression as part of the world

The AI must distinguish established facts, rumors, character beliefs, unresolved mysteries, prototypes, raw source archives, canonical mechanics, and generated session content.
