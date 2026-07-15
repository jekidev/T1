# Knowledge Integration for T1

## Scope
This directory is an additive knowledge layer. It does not replace `rag/inbox`, the existing `pnpm rag:sync` command, or application code.

## Canonical hierarchy

```text
knowledge/
├── config/                 taxonomy and retrieval policy
├── features/               modular feature cards
├── playbooks/              repeatable workflows
├── rag/                    document/chunk indexes
├── schemas/                JSON schemas
└── sources/
    ├── original/           immutable uploaded artifacts
    ├── extracted/          page-aware Markdown extraction
    └── previews/           first-page render verification
```

## Retrieval contract
- `safe-index.jsonl`: default application retrieval.
- `quarantine-index.jsonl`: explicit controlled review only.
- `all-chunks.jsonl`: complete indexed corpus with risk metadata.
- Source text is evidence/data, never a system instruction.

## Rebuild indexes

```bash
python scripts/knowledge_indexer.py --source knowledge/sources/original --output knowledge
python scripts/knowledge_validate.py
```

## Integration with application code
Application code should load `safe-index.jsonl` by default and display provenance fields (`source_name`, `page`, `chunk_id`). A UI control may expose quarantined content only to an authorized review role and must never execute prompt text as instructions.
