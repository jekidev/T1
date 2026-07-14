# Controlled coding agent and self-improvement

## Principle

The project is self-editing through Git, not self-overwriting in the active runtime.

```text
concrete improvement signal
→ repository map
→ deterministic task policy
→ agent/{adapter}/{task-id} branch
→ isolated worktree or container
→ patch
→ secret and policy validation
→ tests and build
→ before/after evaluation
→ pull request
→ human review
→ merge or reject
```

The API server cannot execute local shell commands for coding-agent tasks and has no endpoint that merges a pull request. OpenHands and Aider run behind a separately deployed authenticated sandbox bridge.

## Current OpenHands integration model

The current `OpenHands/OpenHands` repository is the Agent Canvas control center. Its README states that the agent and agent-server source moved to `OpenHands/software-agent-sdk`, while Agent Canvas moved to `OpenHands/agent-canvas`.

The project therefore does not hard-code an obsolete OpenHands CLI. `OpenHandsAdapter` targets a project-owned bridge that can connect to:

- an OpenHands Agent Server
- an ACP-compatible OpenHands backend
- an isolated OpenHands container or VM

The bridge must convert the common project contract into the version-specific OpenHands API.

## Aider integration model

`AiderAdapter` uses the same bridge contract. The external bridge may run Aider inside an isolated worktree/container for focused edits, tests and Git commits.

Aider does not receive a different permission model. It uses the same:

- protected paths
- task allowlist
- patch limits
- secret scanner
- test requirements
- human review requirement
- branch convention

## Domain package

`lib/coding-agent` contains the provider-independent layer:

```text
src/
├── types.ts
├── policy.ts
├── repositoryMap.ts
├── patchValidator.ts
├── adapters.ts
└── runManager.ts
```

It implements:

- `CodingAgentAdapter`
- OpenHands and Aider adapters
- task/run schemas
- repository maps
- branch naming
- protected-path policy
- self-modification policy
- patch and secret validation
- execution limits
- tests/build result validation
- before/after evaluation records
- audit events
- stop/cancel handling

## Repository map

The API creates a bounded metadata map from the current checkout.

It includes:

- paths
- file sizes
- language classification
- module boundaries
- package manifests and dependency names
- entry points
- test/build commands
- protected paths
- CODEOWNERS rules

It does not send the entire repository source to a model. Source content is fetched by the external worker only for task-relevant allowlisted files.

The scanner skips:

- `.git`
- `node_modules`
- generated build output
- runtime data
- virtual environments
- cached RAG inboxes
- symlinks

Protected file contents are not included in the map.

## Protected paths

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

A task that requests a protected path is rejected before agent execution.

Coding-agent self-modification paths require:

- `self-modification` label
- external reviewer
- human review
- no automatic merge

The policy validator cannot be modified in the same patch as unrelated functional code.

## Patch validation

The deterministic validator rejects or escalates:

- paths outside the task allowlist
- protected paths
- base-commit mismatch
- excessive file or line counts
- binary patches
- private keys
- JWT-like credentials
- GitHub tokens
- API keys
- generic hard-coded secrets
- new `eval()` or `new Function()` usage
- remote download-to-shell commands
- security bypasses
- disabled tests
- removal of tests without replacements
- removal of audit or observability code
- mixed policy and functional changes

A remote reviewer cannot override a deterministic rejection.

## Run lifecycle

```text
created
→ analyzing
→ planned
→ executing
→ validating
→ awaiting_review | rejected | failed | cancelled
```

A patch can reach `awaiting_review` only when:

- deterministic policy accepts it
- adapter review accepts it
- at least one test result is present
- every supplied test passed with exit code 0
- before/after evaluation did not reject it

`awaiting_review` is intentionally terminal for the application. Merge happens outside the game through GitHub review.

## Persistent audit records

The API persists:

- task
- exact base commit
- isolated branch name
- plan
- patch metadata and diff
- command results
- test results
- evaluation
- policy decisions
- PR URL
- audit events
- failure or cancellation reason

If the API server restarts while a run is active, the stored run becomes `failed` with `agent.server_restarted`. It is never silently resumed against a potentially different checkout.

## API authentication

All coding-agent routes require a separate administrator token:

```http
Authorization: Bearer <CODING_AGENT_ADMIN_TOKEN>
```

or:

```http
X-Coding-Agent-Admin-Token: <CODING_AGENT_ADMIN_TOKEN>
```

The token must contain at least 24 characters and must never use a `VITE_*` variable.

Routes:

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

## External bridge contract

The project adapters call fixed HTTPS endpoints:

```text
POST /v1/adapters/openhands/analyze
POST /v1/adapters/openhands/plan
POST /v1/adapters/openhands/execute
POST /v1/adapters/openhands/review
POST /v1/adapters/openhands/stop

POST /v1/adapters/aider/analyze
POST /v1/adapters/aider/plan
POST /v1/adapters/aider/execute
POST /v1/adapters/aider/review
POST /v1/adapters/aider/stop
```

Authentication:

```http
Authorization: Bearer <worker-token>
```

Redirects are rejected. HTTPS is required except for localhost development.

The execute response must contain:

```ts
interface CodingTaskResult {
  patch: AgentPatch
  commands: CommandResult[]
  tests: TestResult[]
  evaluation?: ChangeEvaluation
  pullRequestUrl?: string
}
```

The bridge is responsible for proving that it:

1. checked out the exact `baseCommit`
2. created the supplied `branchName`
3. created an isolated worktree/container
4. mounted only the temporary worktree writable
5. did not mount production data
6. applied CPU, memory, runtime and network limits
7. executed commands without interpolating untrusted shell text
8. produced a unified diff
9. ran the requested validation
10. pushed only the agent branch
11. opened a PR without merging it

## OpenTelemetry

The API records spans/events including:

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

Span attributes contain identifiers, counts, branch names, status and risk level. Tokens, credentials, command output and source diffs are not attached to telemetry spans.

## Deployment

See `deployment/asset-pipeline.env.example` for:

- persistent storage path
- exact base commit
- admin token
- shared or per-adapter bridge URLs/tokens
- worker timeout
- concurrency setting

The coding-agent system remains disabled until:

- an exact base commit is configured
- an external adapter bridge is configured
- a valid admin token is configured

## Validation commands

```bash
pnpm test:coding-agent
pnpm typecheck
pnpm test:integration
pnpm build
```

Passing local domain tests does not prove the external bridge sandbox is secure. The bridge deployment requires a separate infrastructure review and an end-to-end test using a disposable repository.
