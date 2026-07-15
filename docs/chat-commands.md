# T1 chat commands

These commands are instructions for the T1 AI workspace. They are executed
through approved MCP connections; the model must report tool results rather
than claiming an action succeeded without evidence.

## `@t1 export-stars`

Export the authenticated account's starred repositories. Optional arguments:

```text
@t1 export-stars --incremental --language Python --topic machine-learning --min-stars 100
```

The model should translate these arguments to the equivalent
`integrations/starchive-termux/run.sh` environment variables or exporter flags.
An incremental export stores its latest starred timestamp in the configured
state file.

## `@t1 review-pr <number>`

Run this sequence:

1. Read the pull request with the GitHub MCP `pull_request_read` tool.
2. Collect review findings and comments, separating bugs from optional nits.
3. Apply only in-scope, low-risk fixes on the current branch.
4. Run the relevant focused tests and repository validation.
5. Report changed files, validation results, unresolved findings, and the PR
   state.

Never merge, force-push, or modify unrelated files without explicit approval.
Any GitHub write operation requires approval, and any custom MCP endpoint
requires a separate explicit approval before use.
