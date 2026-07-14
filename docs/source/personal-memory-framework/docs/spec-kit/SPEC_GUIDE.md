# Spec Guide

Every feature, bug fix, refactor, or migration starts as a spec in
`specs/active/`, using a template from `specs/templates/`.

## Workflow
Idea → Specification → Architecture Review → Task Breakdown →
Implementation → Testing → Documentation Update → Pull Request → Merge →
Archive Spec.

## Lifecycle
- Draft the spec in `specs/active/SPEC-XXX-short-name.md`.
- Get it reviewed (architecture review = a second pass checking data model,
  security/privacy, and API impact).
- Break the spec into tasks, reference the Spec ID in the GitHub issue(s).
- Implement, referencing the Spec ID in the branch and PR.
- On merge, move the file to `specs/completed/`. If a spec is abandoned,
  move it to `specs/archive/` with a note why.

## Numbering
Specs are numbered sequentially: SPEC-001, SPEC-002, ... Use
`pnpm spec:new` (see `scripts/`) to scaffold the next one.
