# Coding-agent worker

External execution service for `@workspace/coding-agent`.

It supports:

- OpenHands SDK for multi-step repository tasks
- Aider for focused patches
- disposable Git worktrees
- hard path allowlists
- command/runtime limits
- deterministic diff collection
- test execution before publication
- independent patch review
- draft pull-request publication
- stop/cancellation
- Ask First, Offline and explicitly confirmed Ultra network modes

The worker has no merge endpoint.

## Network topology

Use the included `docker-compose.yml`.

- `coding-agent-worker` is connected only to `agent-internal`, which is declared `internal: true`.
- `network-gate` connects to `agent-internal` and `egress`.
- The worker cannot reach the public internet directly.
- Model calls, terminal HTTP clients and Git use authenticated proxy credentials.
- Runtimes without proxy credentials fail closed.

Do not attach `coding-agent-worker` directly to a normal egress-enabled network.

## Required environment

```dotenv
CODING_AGENT_WORKER_TOKEN=minimum-24-character-random-secret
NETWORK_GATE_INFRA_TOKEN=another-minimum-24-character-secret
CODING_AGENT_REPOSITORY_URL=https://github.com/owner/repository.git
CODING_AGENT_GITHUB_REPOSITORY=owner/repository
CODING_AGENT_GITHUB_TOKEN=token-with-repository-content-and-pull-request-write-but-no-admin-or-merge-automation
OPENROUTER_API_KEY=...
CODING_AGENT_OPENHANDS_MODEL=openrouter/openai/gpt-5-mini
CODING_AGENT_AIDER_MODEL=openrouter/openai/gpt-5-mini
```

Model identifiers depend on the installed provider versions. Override both model variables with verified identifiers for your deployment.

The API server needs matching configuration:

```dotenv
CODING_AGENT_WORKER_URL=https://worker.internal.example/
CODING_AGENT_WORKER_TOKEN=minimum-24-character-random-secret
CODING_AGENT_BASE_COMMIT=<exact deployed git sha>
CODING_AGENT_ADMIN_TOKEN=<separate UI/API administration secret>
```

## Start

```bash
docker compose up --build
```

The worker binds to localhost by default:

```text
127.0.0.1:8787
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

## Network modes

### Ask First

Default. Model API domains are available, while browsing is denied unless the run contains an explicit `network-domain:example.com` approval label. Denied domains are written to the shared policy volume for inspection.

### Offline

Agent browsing is disabled. The provider bridge can still reach its configured model endpoint.

### Ultra

Requires `network-ultra-confirmed`. Public web access is permitted for that isolated run. Private, local, link-local and metadata addresses remain blocked.

## GitHub token scope

Use a dedicated token or GitHub App installation with only the permissions required to:

- clone/fetch the selected repository
- push `agent/*` branches
- create draft pull requests

Do not give it repository administration, Actions-secret, branch-protection or merge-bypass permissions.

## Validation boundary

`execute` may modify only the disposable worktree. It cannot push.

`publish` is called only after:

1. deterministic path/policy validation
2. all reported tests pass
3. independent review accepts the patch
4. the current diff still matches the validated digest

The worker then creates a commit, pushes the isolated branch and opens a draft PR. Human review and CI remain mandatory.
