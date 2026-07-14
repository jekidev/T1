# AI Workspace

The AI Workspace defines reusable chatbot profiles for playing and developing the game with AI.

Each profile may contain:

- system prompt
- rules
- skills
- long-term memory entries
- MCP server definitions
- LLM routing mode and static model preference

Templates are stored under `ai-workspace/templates/`. The browser UI may also create multiple local profiles and export/import them as JSON.

MCP definitions are declarative. The browser must never execute arbitrary MCP commands. Actual MCP connections require an approved server-side adapter and credentials stored in the hosting platform secret store.
