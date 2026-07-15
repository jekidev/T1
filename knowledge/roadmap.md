# Knowledge Integration Roadmap

**Phase 1 – Scaffolding (done)**
- Added `knowledge/` directory scaffold on branch `knowledge-integration`.

**Phase 2 – Ingestion & Chunking (automated job)**
- Ingest uploaded PDFs and other docs
- Chunk into ≤1 kB segments
- Embed via sentence‑transformer and push vectors to `embeddings/`.

**Phase 3 – Tagging & Cross‑References**
- Auto‑tag each chunk (domain, topic, persona, etc.)
- Generate `metadata/index.json`

**Phase 4 – Playbook Extraction**
- Parse imperative paragraphs → step lists in `playbooks/`

**Phase 5 – Feature & TODO Extraction**
- Mine for phrases like “KRITISK / MANGEL” → `features/feature_index.json`, `issues/`

**Phase 6 – Search Index**
- Build `search_index/` for instant retrieval

**Phase 7 – CI Pipeline**
- GitHub Actions workflow to automate rebuild on new uploads.

---

_This file will be automatically updated by the ingestion workflow._