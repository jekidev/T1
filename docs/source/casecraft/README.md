# CaseCraft Studio

CaseCraft Studio er en mobil-first webapp/PWA til at skrive krimier, noveller og kriminologisk fiktion. Projektet er samlet i én repository-root og er gjort klar til videre arbejde i Devin, Windsurf eller Cursor.

## Funktioner

- Dashboard, projekter og ordmål
- Ti genre-templates
- Kapitel-/sceneeditor med lokal autosave
- AI-chat og hel-manuskriptanalyse
- Case board, beviser, relationer og teorilag
- Tidslinje med enkel konfliktdetektion
- AI Preview snapshots
- Settings til OpenRouter, OpenAI, Anthropic, Gemini, Groq, Mistral, ElevenLabs, GitHub og custom endpoints
- Krypteret server-side secret store
- Text-to-speech med OpenAI, ElevenLabs, custom TTS eller browser fallback
- Global audio-player med Media Session, IndexedDB-kø, offline cache og gendannelse
- JSON-backup og GitHub-statuskontrol
- Windows BAT launchers samt PowerShell/shell scripts

## Hurtig start på Windows

1. Installér Node.js 20 LTS eller nyere.
2. Pak ZIP-filen ud.
3. Dobbeltklik `INSTALL_CASECRAFT.bat`.
4. Dobbeltklik `START_CASECRAFT.bat`.
5. Åbn `http://localhost:5173`.

`START_CASECRAFT.bat` installerer også dependencies automatisk, hvis `node_modules` mangler.

## Manuel start

```bash
cp .env.example .env
npm install
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:8787`

## Secrets

Indsæt nøgler i **Settings → AI Providers**. De sendes til backend og gemmes krypteret i `.casecraft/secrets.enc`. Backend returnerer kun status og de sidste fire tegn. Nøglerne lægges ikke i `localStorage`, frontend-bundlen eller logs.

Ved lokal udvikling genereres `.casecraft/local.key`. I produktion skal `CASECRAFT_SECRET_KEY` sættes til en lang tilfældig værdi.

## OpenRouter

1. Start appen.
2. Åbn Settings → AI Providers.
3. Gem OpenRouter-nøglen.
4. Åbn Model Routing og vælg modeller.
5. Gratis-filteret bruger `:free` eller pris 0 fra OpenRouter-kataloget.

## Text to Speech

- **OpenAI:** gem OpenAI-nøglen og vælg OpenAI TTS.
- **ElevenLabs:** gem ElevenLabs-nøglen, vælg provider og indsæt voice ID.
- **Custom:** gem Custom-nøglen og angiv OpenAI-kompatibel Base URL.
- **Browser fallback:** kræver ingen nøgle, men kan stoppe, når Firefox/Android suspenderer fanen.

Genereret lyd afspilles i et globalt `HTMLAudioElement`. Kø, position og cache gemmes i IndexedDB. Media Session gør afspilningen kontrollerbar fra Androids mediepanel. Android kan stadig tvangslukke fanen under aggressiv batteri-/RAM-styring; appen tilbyder derefter “genoptag” fra den gemte position.

## GitHub workflow

GitHub er source of truth. Se `DEVELOP_WITH_DEVIN.md`.

```bash
git init
git add .
git commit -m "Initial CaseCraft Studio import"
git branch -M main
git remote add origin https://github.com/OWNER/REPO.git
git push -u origin main
```

Gem aldrig `.env`, `.casecraft/`, API-nøgler eller maskinspecifikke paths i Git.

## Validering

```bash
npm run validate
```

Kører TypeScript, tests og production build.

## Produktion

```bash
npm run build
NODE_ENV=production npm start
```

Express-serveren serverer `dist/` i production mode.

## Mappeoversigt

- `src/` — React-klient
- `server/` — Express API, providers og krypteret secret store
- `scripts/` — installation, udvikling og validering
- `specs/` — feature-specifikationer
- `docs/` — arkitektur og drift
- `tests/` — automatiske tests

## Begrænsninger

- Projekter gemmes lokalt i browseren i den nuværende MVP. Flyt dem til Postgres/Supabase før multi-device sync.
- GitHub-integrationen tester token/repository, men foretager ikke automatisk commits eller push fra browseren.
- Browserens autoplay-regler kræver en brugerhandling, før lyd kan starte.
