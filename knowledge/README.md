# Knowledge Base

This directory will host the structured knowledge extracted from uploaded documents.

```
knowledge/
├── rag/              # Chunked, tagged RAG source data
├── playbooks/        # Actionable step‑by‑step guides
├── features/         # Feature definitions & dependency maps
├── prompts/          # Reusable prompt templates
├── metadata/         # Cross‑references & tagging info
└── roadmap.md        # Integration tasks and status
```

All original PDFs / notes remain untouched in `source_material/` (to be added automatically).  
This scaffold was generated automatically – populate by running the `scripts/build_knowledge_index.py` task.
