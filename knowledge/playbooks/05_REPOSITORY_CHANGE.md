# Playbook 05 - Repository Change Control

## Before editing
1. Read `README_BEFORE_ANY_CHANGES_KNOWLEDGE.md`.
2. Identify whether the change belongs in source archive, RAG data, feature catalog, playbook, code, or configuration.
3. Confirm originals remain untouched.
4. Create a branch and state the intended files.

## During editing
- Never rewrite source documents in place.
- Keep generated files reproducible.
- Add provenance fields to new knowledge.
- Keep default retrieval safe.

## After editing
1. Run `python scripts/knowledge_validate.py`.
2. Review the diff for leaked credentials, invite links, personal data, or operational harmful detail.
3. Summarize changes and validation in the PR.
