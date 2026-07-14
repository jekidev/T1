# GitHub Workflow

## Branching
- `main` — always deployable.
- `feat/SPEC-00X-short-name`, `fix/short-name`, `docs/short-name`.

## Pull requests
- Must reference a Spec ID (see `.github/PULL_REQUEST_TEMPLATE.md`).
- Must pass lint, typecheck, test, and build CI checks.
- Must update docs and `project.index.json` if architecture changed.

## Issues
- Use `.github/ISSUE_TEMPLATE/` forms. Every issue links a Spec ID.

## Merging
- Squash-merge to `main`. On merge, move the referenced spec from
  `specs/active/` to `specs/completed/`.
