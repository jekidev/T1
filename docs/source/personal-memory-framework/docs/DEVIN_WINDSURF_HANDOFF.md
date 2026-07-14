# Devin / Windsurf Handoff

1. Clone the repo and read `AI_CONTEXT.md`, then `project.index.json`.
2. Check `specs/active/` for in-progress work before starting anything new.
3. Follow the Spec Kit workflow (`docs/spec-kit/SPEC_GUIDE.md`) — write or
   update a spec before writing code.
4. Ask the human operator for real Supabase/OpenAI credentials; never invent
   or hardcode them.
5. After implementing, run `pnpm lint && pnpm typecheck && pnpm test`, update
   docs + `project.index.json`, and open a PR referencing the Spec ID.
