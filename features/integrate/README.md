# Integration inbox

Place new scripts, documents, prompts, specifications, assets, and feature packages here before they are merged into the application.

## Structure

```text
features/integrate/
├── incoming/
│   ├── scripts/
│   ├── documents/
│   ├── prompts/
│   └── assets/
├── review/
├── processed/
├── rejected/
├── INTEGRATION_TEMPLATE.md
└── manifest.example.json
```

## Workflow

1. Put untouched source material in the correct `incoming/` folder.
2. Create one integration record from `INTEGRATION_TEMPLATE.md`.
3. An agent inspects the files and maps them to one or more feature folders.
4. Proposed modifications are prepared in `review/` or in a focused Git branch.
5. Run typecheck/build/tests before merging.
6. Move the source package to `processed/` after successful integration, or `rejected/` with a documented reason.

## Rules

- Do not execute unknown scripts directly from `incoming/`.
- Do not overwrite implementation files without a review record.
- Never include credentials, OAuth tokens, private keys, or API keys.
- Preserve original files until integration has been verified.
- Record source, purpose, target feature, dependencies, risks, and final commit.
- Large binary documents may remain in Google Drive; store references and provenance here rather than duplicating them unnecessarily.

## Agent instruction

```text
Inspect features/integrate/incoming without executing untrusted code. Classify each item, create an integration record, map it to the relevant feature folder, identify conflicts and dependencies, implement changes in focused commits, run validation, and record the resulting commit before moving the package to processed.
```
