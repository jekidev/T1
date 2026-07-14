# Plugin registry

Plugins extend the game without replacing core code.

Recommended plugin categories:

```text
plugins/
├── agents/
├── maps/
├── dashboards/
├── analytics/
├── missions/
├── worlds/
├── economy/
├── skills/
├── rules/
├── prompts/
├── memory/
└── integrations/
```

Each plugin should include a `plugin.json` manifest with:

- id, name, version
- category
- entry points
- permissions
- required environment variables
- compatible game version
- feature dependencies
- validation commands
- approval requirements

Plugins may register UI panels, analytics widgets, map layers, AI skills, prompts, rules, missions, world presets, or server adapters. Browser plugins must never execute arbitrary shell commands. Server-side capabilities require explicit allowlisting and secret-store configuration.
