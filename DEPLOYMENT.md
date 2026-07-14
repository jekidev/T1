# Deployment guide

This repository supports three deployment modes.

## Recommended: Replit full application

Use Replit when the frontend, Express API, LLM routing, and future RAG ingestion must run together.

1. Import `https://github.com/jekidev/T1` into Replit.
2. Use pnpm when Replit asks for the package manager.
3. Add required API keys through Replit Secrets. Never commit keys to GitHub.
4. Build command:

   ```bash
   pnpm install --frozen-lockfile && pnpm build
   ```

5. Production run command:

   ```bash
   NODE_ENV=production pnpm start
   ```

The API server serves the compiled frontend in production, so one Replit deployment can host the entire application.

## Cloudflare static frontend

Use Cloudflare when only the browser frontend and static RAG source documents need hosting.

Build command:

```bash
pnpm install --frozen-lockfile && BASE_PATH=/ pnpm build:frontend
```

Deploy command:

```bash
npx wrangler deploy
```

The included `wrangler.jsonc` publishes `artifacts/command-sim/dist/public` and enables single-page application fallback routing.

Cloudflare static assets do not run the existing Express API. Live LLM and server-side RAG functions must point to an external HTTPS API or later be ported to Cloudflare Workers.

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` publishes the frontend and static HackerAI documents to GitHub Pages.

Expected URL:

```text
https://jekidev.github.io/T1/
```

GitHub Pages does not execute the Express API.

## RAG documents

Source documents are stored in:

```text
rag/HackerAI_documents/
```

Treat the PDFs as source material. A backend ingestion process must extract, chunk, embed, and index them before semantic retrieval is available.

## Environment variables

At minimum, configure platform secrets for any enabled LLM provider. Common examples:

```text
OPENROUTER_API_KEY
DATABASE_URL
```

Only add variables actually used by the selected integration. Keep all credentials in the hosting platform's secret manager.
