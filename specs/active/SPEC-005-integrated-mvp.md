# SPEC-005 — Integrated Personal Framework MVP

Status: Active

## Problem

De leverede projekter er adskilte: CaseCraft har den bedste brugerflade, mens
Personal Memory Framework beskriver cloud data og RAG. Ingen af dem har den
ønskede Python MCP med flere GitHub-konti.

## Mål

1. Én mobil-først webapp med CaseCrafts skriveflows.
2. Python/FastAPI som sikker backend og system of record.
3. Reelle imports og retrieval med kildehenvisninger.
4. Flere read-only GitHub-konti og repository-træer via API og MCP.
5. Installérbar Android PWA og samme app på Windows.
6. Lokal single-user drift først; cloud/Supabase kan tilføjes uden at ændre
   frontendens domænekontrakter.

## Ikke-mål i første MVP

- Automatisk commit/push til eksterne repositories.
- Multi-user collaboration.
- Operationelle instruktioner til virkelig kriminalitet.
- Falske AI-, embedding- eller transskriptionsresultater.
- Native Android- eller Windows-pakke.

## Acceptance criteria

- Login kræves til private API-routes.
- App-state synkroniseres til backend med revisionskontrol.
- ZIP-import afviser traversal, symlinks og for store filer.
- Memory search returnerer citations til konkret kilde og chunk.
- Mindst to navngivne GitHub-konti kan gemmes krypteret og søges samlet.
- MCP tilbyder account-, repository-, tree-, file- og memory-tools.
- Provider-secrets returneres aldrig til klienten.
- PWA har service worker og 192/512 px ikoner.
- UI virker ved 360 px.
- Backend-tests, frontend-tests, lint, typecheck og builds passerer.

## Sikkerhed

- Same-origin som standard; eksplicit origin-allowlist.
- Session-cookie er HttpOnly og SameSite Strict.
- Produktion nægter udviklingscredentials.
- GitHub- og provider-tokens krypteres med en separat master key.
- Remote MCP må ikke publiceres uden auth-gateway.
- Imports behandles som utroværdigt indhold.
