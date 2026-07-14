# Network access: Ask First and Ultra

## Default

All application-controlled retrieval and coding-agent tool egress defaults to **Ask First**.

Ask First with no explicit hosts and capabilities becomes:

```text
network authorization = deny
```

The normal in-game advisor has no browser, search or arbitrary-fetch tool. A model-provider API request is not browser permission, and the advisor is instructed never to claim live web research.

Coding agents run behind a separate infrastructure egress boundary:

```text
API server
  → authenticated coding-agent worker
       → isolated worktree/container
            → firewall or egress proxy
                 → public internet
```

Prompt text alone is not considered network enforcement.

## Ask First

### RAG and book imports

Each external request exposes:

- capability
- exact origin
- exact path and query
- reason
- expiry

The user approves or denies that matching target. An approval remains valid only for the same exact capability, origin, path and query during the temporary session. A different file, query or redirect destination creates a separate authorization decision and is DNS-validated again.

This session-scoped behavior avoids redirect approval loops without granting origin-wide access.

### Coding-agent runs

Approval is bound to the run before execution:

```ts
interface AgentNetworkPolicy {
  mode: "ask_first"
  approvedHosts: string[]
  approvedCapabilities: AgentNetworkCapability[]
  approvedBy?: string
  approvedAt?: string
}
```

No host/capability pair means deny-all. Adding a host or capability requires a new run and explicit approval. Wildcards are forbidden.

Available capabilities:

```text
web_search
web_fetch
package_registry
source_docs
issue_tracker
```

## Ultra

Ultra is never the default. It requires explicit confirmation, `approvedBy` and `approvedAt` for the temporary session or run.

Ultra permits public HTTPS retrieval without prompting for each origin during that session. It does **not** permit:

- private, local, link-local or multicast networks
- cloud metadata endpoints
- credentials embedded in URLs
- non-HTTPS requests or non-standard ports
- unvalidated redirects
- protected repository paths
- branch-protection bypass
- direct production writes
- secret access or logging
- automatic merge

Ultra coding-agent runs are high risk and require external plus human review.

## Server-side retrieval controls

The RAG importer:

1. accepts only HTTPS on port 443
2. rejects URL credentials
3. rejects localhost, `.local` and metadata hosts
4. resolves every hostname
5. rejects the hostname if any resolved address is private, link-local, multicast or metadata-related
6. pins TLS to one validated address while retaining the original hostname for SNI and certificate verification
7. handles redirects manually
8. repeats authorization and DNS validation for every redirect
9. enforces time and byte limits
10. rejects binary and invalid UTF-8 content

This closes ordinary SSRF and DNS-rebinding paths for the Art of War and Hugging Face importers.

## Coding-agent authorization and audit

The API sends this contract to the worker:

```ts
interface AgentNetworkAuthorization {
  mode: "deny" | "allowlisted" | "ultra"
  allowedHosts: string[]
  allowedCapabilities: AgentNetworkCapability[]
  requireHttps: true
  blockPrivateNetworks: true
  rejectRedirectsUntilRevalidated: true
  auditRequired: true
  expiresAt: string
}
```

`execute` must return a schema-valid `AgentNetworkAudit` containing all attempted tool-egress requests and confirmation that:

- a sandbox firewall enforced the policy
- private networks were blocked
- metadata endpoints were blocked
- redirects were revalidated at the egress boundary

Model-provider transport is isolated from tool-egress authorization and is not treated as browsing permission. Any allowed tool request outside the run authorization rejects the patch before independent review or PR publication.

The API cannot cryptographically prove that an independently operated worker reported truthfully. Production deployment therefore requires the provided internal-only worker network, the dual-homed egress proxy, controlled firewall logs, no production credentials and an end-to-end test against a disposable repository.

## RAG imports

Developer AI exposes:

- Project Gutenberg *The Art of War* importer
- selected Hugging Face text-file importer
- Update the world

Only `.md`, `.txt`, `.json`, `.jsonl`, `.csv`, `.yaml` and `.yml` are accepted from Hugging Face. Model weights, pickle files, binaries and executable artifacts are rejected. Imported content is retrieval data and is never executed.

Source files are append-only. Changed upstream content receives a content-addressed filename and immutable import manifest.

## UI

The Developer AI panel contains Ask First/Ultra, explicit Ultra confirmation, book/import controls and Update the world.

The coding-agent inspector contains approved hosts, capability controls and a firewall-audit view. Network-session and administrator tokens remain in component memory and are blocked from session replay.

## Deployment requirement

The strongest “cannot bypass” property depends on the worker network topology. The worker must have no direct public route outside the controlled firewall/egress proxy. The application contract and audit reject policy violations, but they do not replace infrastructure isolation.
