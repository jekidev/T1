# AI Workspace

The AI Workspace defines reusable chatbot profiles for researching and developing with AI.

`longevity-research-assistant` is the default profile: it answers from the personal RAG corpus, cites source paths, treats retrieved text as untrusted quoted data and carries a "not medical advice" disclaimer. The earlier `game-co-designer` template is kept for the simulation use case.

Each profile may contain:

- system prompt
- rules
- skills
- long-term memory entries
- MCP server definitions
- LLM routing mode and static model preference

Templates are stored under `ai-workspace/templates/`. The browser UI may also create multiple local profiles and export/import them as JSON.

MCP definitions are declarative. The browser must never execute arbitrary MCP commands. Actual MCP connections require an approved server-side adapter and credentials stored in the hosting platform secret store.
