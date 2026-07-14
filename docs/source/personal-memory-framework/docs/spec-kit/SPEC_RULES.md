# Spec Rules

1. No feature may be implemented without a spec.
2. Every GitHub issue must reference a Spec ID.
3. Every pull request must reference a Spec ID.
4. Every code change must update docs if architecture changes.
5. Every new feature must update `project.index.json`.
6. Specs are immutable once merged — changes go in a new spec that
   supersedes it (link back to the old Spec ID).
7. A spec is not "done" until its Acceptance Criteria are checked off and
   it has been moved to `specs/completed/`.
