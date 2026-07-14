# Manus handoff prompt

Use the following instruction when importing this repository into Manus:

```text
Use https://github.com/jekidev/T1 as the canonical repository.

First inspect README.md, DEPLOYMENT.md, and deployment/README.md. Then run `pnpm deployment:start`.

Preserve the existing pnpm workspace, Express API, command-sim frontend, and Google Drive-only RAG architecture. Use the Google Drive connection authorized in Manus as the only external RAG source. Complete all installation and environment checks automatically. When OAuth consent is required, present the Google Drive connection step clearly and continue automatically after authorization.

Keep OAuth tokens, refresh tokens, OpenRouter keys, database credentials, and other secrets in Manus Connections or its secret store. Never commit secrets to GitHub.

Make changes in focused commits and keep the project directly importable into Replit and runnable locally.
```
