# Network access: Ask First and Ultra

## Default

All user-triggered public web access defaults to **Ask First**.

The normal in-game LLM chat has no browser/search tool. It can call the configured model provider and use local board/RAG context, but it cannot independently browse websites.

Coding agents run behind a separate infrastructure egress gate:

```text
API server
  -> authenticated coding-agent worker
       -> internal-only Docker network
            -> network-gate proxy
                 -> public internet
```

The worker has no direct route to the internet when deployed with `services/coding-agent-worker/docker-compose.yml`. The proxy is the only dual-homed service.

## Modes

### Ask First

- Model-provider transport is allowed so the model can respond.
- Arbitrary browser, package, curl and HTTP traffic is blocked.
- A user may approve exact domains before a coding-agent run with `network-domain:<domain>` task labels.
- RAG imports create a visible approval request for each exact origin/path, including validated redirect destinations.
- Approved RAG paths remain usable until the temporary session expires, allowing deterministic redirect chains.

### Offline

Coding-agent tools have no arbitrary internet access. Model transport remains isolated from tool browsing.

### Ultra

Ultra is never the default. The UI requires explicit confirmation and records `network-ultra-confirmed` on the run.

Ultra permits public internet traffic from the isolated provider process, but it does **not** permit:

- direct writes to the protected branch
- unreviewed merge
- access to private/local/cloud-metadata addresses
- secret logging
- policy bypass
- changing protected paths

Ultra runs are marked high risk and require human review of sources, licenses and dependency changes.

## RAG imports

Developer AI exposes:

- Project Gutenberg *The Art of War* importer
- selected Hugging Face text-file importer
- Update the world

Only `.md`, `.txt`, `.json`, `.jsonl`, `.csv`, `.yaml` and `.yml` files are accepted from Hugging Face. Model weights, pickle files, binaries and executable artifacts are rejected. Imported content is retrieval data and is never executed.

## SSRF and private-network controls

Server imports and the network gate reject localhost, private ranges, link-local ranges, cloud metadata endpoints, non-HTTPS application imports and credentials embedded in URLs. DNS results are checked before the proxy connects.

## Deployment requirement

The “impossible to bypass” property depends on the network topology. Do not deploy the worker directly on a public/egress-enabled network. Use the provided internal Docker network and make `network-gate` the only service attached to the egress network.
