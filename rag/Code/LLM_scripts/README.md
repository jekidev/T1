# LLM-generated potential PR scripts

Uber mode writes review-only development proposals here, grouped by the OpenRouter model that produced them:

```text
rag/Code/LLM_scripts/<model-slug>/<timestamp>-potential-pr.md
```

Each proposal must contain:

- observed evidence
- affected repository paths
- a patch sketch in code fences
- validation commands
- rollback guidance
- state-migration or game-continuation notes

## Safety and execution contract

These files are **not executed automatically**, are **not committed automatically**, and are **not pull requests**. They are candidate implementation plans for a human or development agent to inspect, test, and convert into a normal branch and PR.

The folder is synchronized into persistent RAG memory so later LLM sessions can continue from reviewed proposals without losing context.
