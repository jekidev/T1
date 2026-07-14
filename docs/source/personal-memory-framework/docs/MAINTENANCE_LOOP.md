# Maintenance Loop

Recurring upkeep to keep the repo healthy for both humans and AI agents:

- Weekly: review `specs/active/` for staleness; archive or update.
- On every merged PR: confirm `project.index.json` reflects new/changed
  routes, tables, packages, and specs.
- Monthly: run `pnpm audit` / review `security-scan.yml` results.
- Monthly: review `docs/ROADMAP.md` against `project.index.json.next_actions`.
- After any Supabase schema change: update `docs/DATABASE.md` and add a
  migration file (see `db:migrate` script).
