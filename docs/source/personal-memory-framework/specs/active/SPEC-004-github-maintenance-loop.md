# SPEC-004: GitHub Maintenance Loop

- **Spec ID**: SPEC-004
- **Status**: Draft

## Problem Statement
The repo will be handed between multiple AI coding tools (Replit, Devin,
Windsurf, Cursor). Without process, docs and the index will drift from
reality.

## Goals
- CI enforces lint/typecheck/test/build on every push and PR.
- `project.index.json` stays in sync via a documented, enforced habit.

## Non-goals
- Fully automated doc generation (out of scope for MVP).

## Functional Requirements
- GitHub Actions: lint, test, typecheck, build, security-scan, db-migrations.
- PR template requires confirming docs + `project.index.json` updates.
- Issue templates require a linked Spec ID.

## Non-functional Requirements
- CI must run in under ~5 minutes for fast iteration.

## User Stories
- As a maintainer (human or AI), I can trust that anything merged to `main`
  passed lint/typecheck/test/build.

## Technical Design
- See `.github/workflows/*.yml` and `.github/PULL_REQUEST_TEMPLATE.md`.

## Database Changes
- None directly; `db-migrations.yml` validates migration scripts run cleanly.

## API Changes
- None.

## Security & Privacy Review
- `security-scan.yml` runs dependency audit on every push/PR.

## Testing Strategy
- CI itself is the test: a deliberately broken PR should fail the relevant job.

## Rollback Plan
- Revert the workflow file change; branch protection can be temporarily
  relaxed by a repo admin if CI is broken by infra issues.

## Acceptance Criteria
- [ ] All six workflows run on push to `main` and on PRs.
- [ ] PR template blocks merge review until checklist is filled in.
- [ ] Issue templates require a Spec ID field.

## Future Improvements
- Auto-generate `project.index.json` diffs as a CI comment.
