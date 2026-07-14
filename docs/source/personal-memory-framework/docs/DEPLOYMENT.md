# Deployment

## Replit (development)
- `pnpm install`
- Set Replit Secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`.
- Run `pnpm --filter web dev`, binding to `process.env.PORT`.

## Production
- Recommended: deploy `apps/web` to Vercel or any Node host that supports
  Next.js. Set the same environment variables in the host's secret manager.
- Run the Supabase schema migration (`docs/DATABASE.md`) against the
  production Supabase project before first deploy.
- Ensure Storage buckets `audio` and `imports` exist in production Supabase.

## CI/CD
See `.github/workflows/` — lint, typecheck, test, build, security-scan, and
db-migrations run on push/PR to `main`.
