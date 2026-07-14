# Personal Framework

Et privat, mobil-først værktøj, der samler:

- CaseCrafts krimi- og manuskriptværksted
- personlige imports, lydnoter og søgbar memory
- Python MCP til flere GitHub-konti
- Android PWA nu og installerbar Windows-app senere

## Status

Den første integrerede MVP bygges i `SPEC-005`. CaseCraft-frontendens fungerende
dele er importeret som udgangspunkt. Backend, persistence og MCP flyttes til
Python/FastAPI.

## Struktur

```text
apps/web/                 React/Vite PWA
services/backend/         FastAPI, persistence, providers, GitHub og MCP
specs/active/             aktive produktspecifikationer
docs/source/              relevant dokumentation fra begge kildeprojekter
docs/import/              komplet filinventar, checksums og analyse
```

## Lokal udvikling

Krav:

- Python 3.10+
- Node.js 20.19+
- `uv`

```bash
cp .env.example .env
uv sync
npm --prefix apps/web ci
./scripts/dev.sh
```

Webappen åbnes på `http://localhost:5173`. FastAPI kører på
`http://localhost:8000`.

Standardtokenet i `.env.example` er kun til lokal udvikling. Produktion nægter
at starte med dette token.

## Validering

```bash
./scripts/validate.sh
```

## Importens sporbarhed

Alle 186 filer i de to leverede ZIP-arkiver blev læst og registreret:

- `docs/import/FILE_INVENTORY.tsv`
- `docs/import/EXTRACTED_SHA256SUMS.txt`
- `docs/import/SOURCE_ANALYSIS.md`