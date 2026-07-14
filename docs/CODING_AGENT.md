# Controlled coding agent and self-improvement

## Principle

The project is self-editing through Git, not self-overwriting in the active runtime.

```text
concrete improvement signal
→ repository map
→ deterministic task policy
→ agent/{adapter}/{task-id}
→ isolated worktree or container
→ patch and test results
→ deterministic validation
→ independent adapter review
→ publish agent branch and pull request
→ human review
→ merge or reject
```

The API server cannot run coding-agent shell commands locally, write to the default branch or merge a pull request. OpenHands and Aider run behind separately deployed authenticated sandbox bridges.

## OpenHands and Aider roles

The current `OpenHands/OpenHands` repository is the Agent Canvas control center. The agent/server implementation has moved to `OpenHands/software-agent-sdk`. `OpenHandsAdapter` therefore targets a project-owned Agent Server or ACP bridge rather than hard-coding an obsolete CLI.

`AiderAdapter` targets an isolated Aider CLI bridge for focused Git edits. Both adapters use the same task, branch, policy, test and review contracts.

## Project modules

```text
lib/coding-agent/
├── src/types.ts
├── src/policy.ts
├── src/repositoryMap.ts
├── src/patchValidator.ts
├── src/adapters.ts
└── src/runManager.ts

artifacts/api-server/src/
├── lib/coding-agent-repository.ts
├── lib/coding-agent-storage.ts
├── lib/coding-agent-service.ts
└── routes/coding-agent.ts

artifacts/command-sim/src/pages/coding-agent/
└── index.tsx
```

The domain package implements:

- provider-independent `CodingAgentAdapter`
- OpenHands and Aider adapters
- task, plan, patch, command, test and evaluation schemas
- repository maps
- isolated branch naming
- protected paths and self-modification policy
- patch and secret validation
- run limits and lifecycle
- independent reviewer decisions
- delayed PR publication
- audit events and cancellation

## Repository map

The API builds a bounded metadata map from the current checkout. It includes paths, sizes, languages, modules, package manifests, dependency names, entry points, test/build commands, protected paths and CODEOWNERS rules.

It does not send the entire repository source to a model. The scanner skips `.git`, dependencies, build output, runtime data, virtual environments, symlinks and cached RAG inboxes. DeepSeek/RAG content is not read into the repository map.

The external worker may fetch source content only for task-relevant files inside `allowedPaths`.

## Protected areas

Default protected areas include:

```text
.env
.env.*
secrets/
credentials/
authentication/
authorization/
billing/
payment/
deployment/
infrastructure/
.github/workflows/
.github/CODEOWNERS
migrations/production/
sandbox/security/
agent-policies/
audit/
```

Self-modification under `lib/coding-agent/` requires a `self-modification` label, external reviewer and human review. The policy validator cannot be changed in the same patch as unrelated functionality.

## Patch validation

The deterministic validator rejects or escalates:

- files outside the task allowlist
- protected paths
- base-commit mismatch
- excessive files or lines
- binary patches
- private keys, JWTs, tokens and hard-coded credentials
- `eval()` and `new Function()` additions
- remote download-to-shell commands
- security bypasses
- disabled tests
- removed tests without replacements
- removed audit/observability code
- mixed policy and functional changes

The remote reviewer can reject an otherwise valid patch. It cannot override a deterministic rejection.

## Run lifecycle

```text
created
→ analyzing
→ planned
→ executing
→ validating
→ publishing
→ awaiting_review
```

Alternative terminal states are:

```text
rejected | failed | cancelled | completed
```

A patch reaches `publishing` only when:

- deterministic policy accepted it
- the independent adapter review accepted it
- at least one test result exists
- all reported tests passed with exit code 0
- the before/after evaluation did not reject it
- the task requested pull-request creation

`awaiting_review` is terminal for the application. GitHub review controls merge.

## Strict sandbox protocol

The bridge API is staged deliberately.

```text
POST /v1/adapters/{openhands|aider}/analyze
POST /v1/adapters/{openhands|aider}/plan
POST /v1/adapters/{openhands|aider}/execute
POST /v1/adapters/{openhands|aider}/review
POST /v1/adapters/{openhands|aider}/publish
POST /v1/adapters/{openhands|aider}/stop
```

All calls use:

```http
Authorization: Bearer <worker-token>
```

HTTPS is required except for localhost development. Redirects are rejected.

### Execute phase

`execute` works in an isolated worktree/container and returns only:

```ts
interface CodingTaskResult {
  patch: AgentPatch
  commands: CommandResult[]
  tests: TestResult[]
  evaluation?: ChangeEvaluation
}
```

It must not push a branch or open a PR. A response containing `pullRequestUrl` or `branchPublished: true` is rejected as a protocol violation.

### Review phase

`review` must return a schema-valid independent decision:

```ts
interface PatchReviewResult {
  decision: PolicyDecision
  notes: string[]
}
```

The writing model must not be the only reviewer for high-risk changes.

### Publish phase

`publish` is called only after validation. It must:

1. verify the same base commit, run, plan and patch
2. apply the validated patch in the isolated worktree
3. commit logical changes
4. push only `agent/{adapter}/{task-id}`
5. open a pull request
6. return the exact branch name and PR URL
7. never merge

An unexpected branch name is rejected.

## Sandbox requirements

The bridge must prove that it:

- checked out the exact `baseCommit`
- created the supplied branch and isolated worktree/container
- mounted only the temporary worktree writable
- did not mount production data, RAG secrets or credentials
- enforced CPU, memory, runtime, command, file, patch, token and cost limits
- enforced a network policy
- did not interpolate untrusted task text into shell commands
- produced a unified diff
- ran the requested tests/builds
- can stop and clean up the run

## Persistent audit records

The API stores task, base commit, branch, plan, patch, commands, tests, evaluation, policy decisions, PR URL, audit events and failure/cancellation reason under `CODING_AGENT_STORAGE_ROOT` using owner-only file permissions.

If the API restarts during an active run, the record becomes `failed` with `agent.server_restarted`. It is not silently resumed.

Duplicate task IDs are rejected. Concurrent execution is limited by `CODING_AGENT_MAX_CONCURRENT_RUNS`.

## Protected administration API

All routes require `CODING_AGENT_ADMIN_TOKEN` via Bearer auth or `X-Coding-Agent-Admin-Token`:

```text
GET  /api/coding-agent/capabilities
POST /api/coding-agent/repository-map
POST /api/coding-agent/runs
GET  /api/coding-agent/runs
GET  /api/coding-agent/runs/:id
POST /api/coding-agent/runs/:id/execute
POST /api/coding-agent/runs/:id/stop
```

There is no merge endpoint.

The `/coding-agent` inspector keeps the admin token only in component memory. It shows capabilities, repository-map status, task plan, diff, tests, policy, audit, stop control and PR link. Patch content is blocked from session replay.

## OpenTelemetry

The run manager emits:

```text
agent.task.created
agent.repository.analyzed
agent.plan.created
agent.command.started
agent.command.completed
agent.patch.created
agent.patch.rejected
agent.test.started
agent.test.completed
agent.evaluation.completed
agent.pull_request.created
agent.run.failed
agent.run.completed
agent.run.cancelled
```

Telemetry contains IDs, counts, branch, status and risk. Tokens, credentials, raw command output and diffs are not attached to spans.

## Deployment and validation

Configuration is documented in `deployment/asset-pipeline.env.example`.

The system remains disabled until an exact commit SHA, admin token and at least one external adapter bridge are configured.

```bash
pnpm test:coding-agent
pnpm typecheck
pnpm test:integration
pnpm build
```

Local domain tests do not prove the external sandbox deployment is secure. The bridge requires an infrastructure review and an end-to-end test against a disposable repository before production use.
