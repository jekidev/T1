# T1 — Urban Strategy Simulator

Repository target for the Urban Strategy Simulator and HackerAI RAG documents.

## Expected project archive

Upload the integrated project archive at:

`uploads/Urban-Strategy-Simulator-integrated.zip`

The archive already contains the HackerAI documents under:

`rag/HackerAI_documents/`

## GitHub Pages

A Pages workflow is configured in `.github/workflows/deploy-pages.yml`.

When the integrated archive exists on `main`, the workflow will:

1. Extract the project.
2. Install dependencies with pnpm.
3. Build `@workspace/command-sim` with base path `/T1/`.
4. Copy HackerAI RAG documents into the published Pages artifact.
5. Deploy to `https://jekidev.github.io/T1/`.

## Hosting limitation

GitHub Pages hosts static frontend files only. The API server and live LLM advisor require a separate backend host; they cannot execute inside GitHub Pages.