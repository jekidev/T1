# Playbook 07 - Deduplicate Without Deletion

## Principle
Deduplication controls retrieval cost; it does not remove user material.

## Procedure
1. Keep every source file in `knowledge/sources/original/`.
2. Group exact files by SHA-256.
3. Compare normalized extracted text to identify near duplicates.
4. Assign one canonical document/chunk for default retrieval.
5. Record all aliases and duplicate relationships.
6. Keep every source path and hash in the manifest.
