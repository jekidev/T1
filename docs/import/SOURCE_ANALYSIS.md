# Samlet analyse og anbefalet arkitektur

Dato: 14. juli 2026

## 1. Kontrol af materialet

Jeg har behandlet alle tre vedhæftninger:

| Materiale | SHA-256 | Resultat |
|---|---|---|
| `personal-memory-framework.zip` | `b243d14c96cd42442dea488f11b04bbc00f9ea62dc58e48820c67be71c535446` | 115 filer udpakket og læst |
| `CaseCraft-Studio-Devin-Ready.zip` | `d7c79baf1ac4d999b297d2855b057e5859a88adbc22f62afa56a29ef9b932f7e` | 71 filer udpakket og læst |
| `Byg Python web-app til at skrive krimi-noveller med AI.pdf` | `bac0ee4ae60034460dd1f1f6ec877b6dd13a5633ef9873e48ab2dceb5b5123c9` | PDF-metadata, tekst og links læst |

Kontrollen viste:

- 186 af 186 arkivfiler blev ekstraheret.
- Ingen manglende eller ekstra filer efter udpakning.
- Ingen absolutte stier, `../`-traversal, symlinks eller dublerede ZIP-poster.
- Ingen tomme filer.
- Alle tekstfiler kunne læses som UTF-8.
- Alle JSON- og source-map-filer kunne parses.
- Production-source-mappet i CaseCraft blev også åbnet og dets 73 indlejrede kildefiler registreret.
- Der blev ikke fundet indlejrede virkelige API-nøgler eller private keys. Søgetræffene var eksempler/placeholders.

Den komplette inventarliste og filchecksums ligger i de vedlagte auditfiler.

## 2. Hvad materialet reelt indeholder

### CaseCraft Studio

Dette er det mest færdige produktfundament:

- React/Vite-baseret mobilvenlig skriveapp.
- Dashboard, projekter, templates, scener og kapitler.
- Case board, tidslinje, skrivecoach og AI-preview-rapporter.
- Global TTS-afspiller med kø, IndexedDB-cache, Media Session og browser-fallback.
- Express-backend med OpenRouter, OpenAI, Anthropic, Gemini, Groq, Mistral, ElevenLabs og custom provider.
- Krypteret lokal secret-fil og UI til provider-nøgler.
- Ét GitHub-token kan testes mod ét repository.
- Windows-launchers og et færdigbygget `dist/`.

Vigtige begrænsninger:

- Manuskripter er kun i browserens `localStorage`; der er ingen login eller synkronisering.
- Det er ikke en komplet PWA: manifestet har ingen ikoner, og der findes ingen service worker.
- GitHub-funktionen søger ikke på tværs af konti og henter ikke repository-træer.
- AI-analyse sender hele manuskriptet i ét prompt i stedet for en robust map/reduce-pipeline.
- Appen har kun én lille storage-test.
- `src/lib/storage.js`, `.d.ts` og `src/types.js/.d.ts` ligger ved siden af TypeScript-kilden. Production-sourcemappet viser, at buildet faktisk valgte `storage.js`; disse artefakter kan derfor skygge for nyere TypeScript-kode.
- `dist/` er ignoreret i `.gitignore`, men er alligevel med i ZIP-filen og indeholder et stort production-source-map.

### Personal Memory Framework

Dette er primært en spec-first arkitektur og et monorepo-skelet:

- Next.js/TypeScript/pnpm-workspace.
- Velbeskrevet Supabase-, Storage-, pgvector-, RAG- og transskriptionsretning.
- Domænepakker til database, storage, chunking, embeddings og OpenAI speech-to-text.
- Dokumenteret datamodel, API-kontrakter, sikkerhed og fire aktive specs.

Det er ikke et færdigt produkt:

- De fleste sider er TODO-skærme.
- De fleste API-routes svarer `501 NOT_IMPLEMENTED`.
- Der er ingen SQL-schemaer eller migrationsfiler.
- Migrations- og seed-scripts er placeholders.
- Der er ingen `pnpm-lock.yaml`, men alle workflows bruger `pnpm install --frozen-lockfile`; CI kan derfor ikke installere som skrevet.
- RAG-pakken kan chunke og kalde embeddings, men lagrer, søger og citerer endnu ikke data.
- Transskriptionspakken kan kalde OpenAI, men upload-, job- og persistence-flowet findes ikke.
- Der er ingen MCP- eller GitHub multi-account-pakke.

### PDF'en

PDF'en dokumenterer en tidligere opgave med følgende retning:

- Python og FastAPI.
- Uvicorn.
- Mobilresponsiv webapp til krimi-/novelleskrivning.
- AI-provider-abstraktion, OpenRouter og modelvalg.
- Pytest og Python best practices.
- Et muligt `sync_to_gdrive.py`.
- Repository-navnet `JK111admin/Personal_Framework`.

PDF'en viser også en tidligere PR-reference, men det linkede Devin-session/repository kan ikke verificeres fra den nuværende organisationsadgang. Ingen repository med navnet `Personal_Framework` eller `CaseCraft` findes blandt de 94 repositories, som denne session aktuelt kan se.

### Python MCP-kravet

Den beskrevne MCP-server findes ikke i ZIP-filerne. Den skal bygges.

Kravene er:

- Flere GitHub-identiteter/tokens.
- Egne, organisatoriske og starred repositories.
- Søgning på tværs af konti.
- Repository-metadata og filtræer.
- Filindhold til senere analyse, indeksering og fusion.
- Python MCP SDK.
- Lokal `stdio` og senere remote transport.

## 3. Hvad der bør genbruges

### Genbrug fra CaseCraft

- Den eksisterende informationsarkitektur og mobil-UX.
- Templates, projekt/scenestruktur, case board, tidslinje og coach.
- TTS-køens produktadfærd og Media Session-integration.
- Providerindstillinger og model-routing som produktkoncept.
- Reglen om, at AI foreslår tekst, men ikke overskriver brugerens manuskript automatisk.
- Etikreglerne for kriminalitetsindhold.

### Genbrug fra Personal Memory Framework

- Specs og dokumentationsdisciplin.
- Supabase Auth, Postgres, Storage, RLS og pgvector som datalag.
- Datamodellerne for recordings, imports, documents, chunks, jobs og audit logs.
- RAG-flowet med normalisering, chunking, embeddings, søgning og citations.
- Transskriptions- og storage-wrappers efter færdiggørelse.

### Skriv fra bunden

- Python FastAPI-backend og MCP-server.
- Multi-account GitHub credential- og discovery-lag.
- Authenticated sync mellem Android/browser og Windows.
- SQL-migrations, RLS-politikker og jobafvikling.
- Sikker upload/import af ZIP, dokumenter, lyd og AI-samtaler.
- Repository-ingestion, provenance og citations.
- Service worker, offline-outbox og installérbar PWA.

## 4. Anbefalet samlet produkt

“Ét tool” bør betyde ét produkt og ét repository, ikke nødvendigvis én proces.

```text
Android/Windows PWA
        |
        v
FastAPI API + Auth-gateway
        |
        +-- MCP endpoint (/mcp, Streamable HTTP)
        +-- MCP stdio entrypoint til lokal Devin-brug
        +-- GitHub multi-account service
        +-- AI/provider routing
        +-- upload/import API
        |
        v
Postgres/Supabase + pgvector + Object Storage
        |
        v
Job worker: transcription, ingestion, embeddings, previews og TTS
```

Anbefalet monorepo:

```text
apps/web/                 React PWA baseret på CaseCraft
services/backend/         Python FastAPI
services/backend/mcp/     MCP tools/resources/prompts
services/backend/github/  GitHub accounts, discovery og trees
services/backend/rag/     ingestion, embeddings, search og citations
services/worker/          baggrundsjobs
infra/supabase/           migrations, RLS og storage policies
specs/                    aktive specs og acceptance criteria
legacy/                   uændrede importer/manifester fra ZIP-materialet
```

Den officielle Python MCP SDK understøtter både lokal `stdio` og remote Streamable HTTP. FastAPI og MCP kan dele samme Python-kodebase og deployment, mens job-workeren kan skaleres separat.

Kilde: https://github.com/modelcontextprotocol/python-sdk

## 5. GitHub multi-account-design

Første version bør være read-only. Det dækker det aktuelle krav og reducerer risikoen væsentligt.

Credential-model:

- En bruger kan tilknytte flere navngivne GitHub-konti.
- GitHub App/OAuth foretrækkes, fordi installationer kan begrænses til bestemte repositories og kortlivede tokens.
- Fine-grained PATs kan understøttes som fallback.
- Tokens lagres krypteret server-side; aldrig i frontend, logs, browser-state eller embeddings.
- Hver konto får scopes/permissions, valideringsstatus og seneste sync-tid.

Foreslåede MCP-tools:

- `github_accounts_list`
- `github_repositories_search`
- `github_starred_list`
- `github_organizations_list`
- `github_repository_tree`
- `github_file_read`
- `github_repository_ingest`
- `memory_search`
- `memory_source_read`
- `writing_project_context`

Alle svar skal indeholde provenance: konto, repository, branch/ref, path, SHA og hentningstidspunkt.

GitHub App-dokumentation:
https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app

## 6. Fælles datamodel

Minimumstabeller:

- `users`
- `projects`, `chapters`, `scenes`
- `characters`, `evidence`, `relationships`, `timeline_events`
- `recordings`, `imports`, `documents`, `chunks`
- `github_accounts`, `github_repositories`, `github_sync_runs`
- `ai_conversations`, `preview_reports`
- `jobs`, `audit_logs`

Krav:

- `user_id` på alle private data.
- RLS på alle brugerdata.
- Versionsnummer/revision til optimistisk sync.
- Soft delete og kontrolleret permanent sletning.
- SHA-256-deduplicering af imports.
- Kildehenvisninger fra hvert chunk tilbage til fil/repository/recording.
- Embedding-model og dimension gemmes eksplicit, så modellen kan migreres senere.

## 7. Android først, Windows senere

### Android MVP

Start som installérbar PWA:

- Virker straks i Chrome/Edge uden Play Store-release.
- Responsiv ved 360 px.
- Web app manifest med rigtige ikoner.
- Service worker til app-shell og kontrolleret offline-cache.
- IndexedDB til drafts og en offline outbox.
- Serveren er fortsat source of truth efter sync.
- Upload, lydoptagelse og TTS genoptages sikkert efter afbrydelse.

Android kan stadig suspendere browseren, så lange transskriptions-, TTS- og RAG-jobs skal køre på serveren.

### Windows

Samme PWA kan installeres i Chrome/Edge på Windows. Hvis der senere kræves dybere filsystem-, tray- eller autostart-integration, kan webappen pakkes i Tauri.

PWA-installation:
https://web.dev/learn/pwa/installation

“Windows 19” kan ikke entydigt kobles til en kendt målversion. Det bør bekræftes, om der menes Windows 11, Windows 10 eller en senere Windows-version.

## 8. Kritiske sikkerhedsfund

CaseCraft må ikke publiceres i sin nuværende backendform:

1. Serveren binder til `0.0.0.0`, accepterer alle CORS-origins og har ingen auth.
2. Secret-endpoints kan overskrive, slette og teste serverens provider-nøgler uden login.
3. AI- og TTS-endpoints kan misbruges til at bruge ejerens betalte nøgler.
4. Custom Base URL tillader vilkårlige HTTP/HTTPS-adresser og mangler SSRF-beskyttelse mod localhost/private netværk.
5. Der mangler rate limiting, quotas, CSRF-beskyttelse og audit logs.
6. Den lokale krypteringsnøgle ligger som fallback på samme host som ciphertext; det er ikke tilstrækkelig cloud secret management.
7. Importeret repository-/dokumenttekst skal behandles som utroværdigt indhold for at reducere prompt-injection.
8. ZIP-upload skal have traversal-kontrol, type-/størrelsesgrænser, deduplicering og malware-scanning.

Yderligere krav:

- Ingen operationelle instruktioner til virkelig kriminalitet.
- Brugeren skal eksplicit acceptere AI-forslag før manuskriptændringer.
- Følsomme lydfiler, manuskripter og memories må ikke bruges til træning eller tredjepartsproviders uden tydeligt samtykke.

## 9. Faseplan

### Fase 0 — beslutning og provenance

- Bekræft at upload-batchen er komplet.
- Vælg eller opret source-of-truth repository.
- Bevar ZIP-checksums og importmanifest.
- Opret samlet product spec og threat model.

### Fase 1 — sikker kerne

- FastAPI-projekt, Supabase Auth, database-migrations og RLS.
- Authenticated API og MCP transport.
- Krypteret secret management.
- Job- og audit-model.

### Fase 2 — CaseCraft på cloud data

- Flyt projekt-, scene-, case board- og tidslinjedata fra `localStorage`.
- Tilføj revisioner, autosave, offline outbox og konfliktvisning.
- Bevar JSON import/eksport.

### Fase 3 — memory/RAG

- Upload/import, lydoptagelse, transskription og jobs.
- Normalisering, chunking, embeddings og pgvector.
- Search/chat med citations.

### Fase 4 — GitHub MCP

- Flere GitHub-konti.
- Repositories, organisationer, starred repos og filtræer.
- Read-only filhentning og selektiv ingestion.
- Rate-limit og provenance.

### Fase 5 — Android PWA

- Manifest, ikoner, service worker og install-flow.
- 360 px-golden paths.
- Offline, recording, TTS og genoptagelse.

### Fase 6 — Windows

- Installérbar desktop-PWA.
- Tauri kun hvis native funktioner er nødvendige.
- Senere write-adgang til GitHub, hvis det godkendes særskilt.

## 10. Anbefalet første leverance

Den første praktiske version bør være:

- Privat single-user PWA.
- CaseCraft editor og case board.
- Supabase-login og sync.
- Dokument/ZIP/lyd-import.
- RAG-search med citations.
- Python MCP med flere read-only GitHub-konti.
- Android-installation.
- Samme app installerbar på Windows.

Commit/push til GitHub, multi-user collaboration, Google Drive-sync og native Android/Windows-pakker bør være efterfølgende valg, ikke blokere MVP'en.

## 11. Beslutninger før implementering

1. Kommer der flere filer i denne upload-runde?
2. Skal der oprettes et nyt repository, eller findes det rigtige repository på en anden GitHub-konto?
3. Betyder “Windows 19” Windows 11?
4. Er første version privat single-user?
5. Skal GitHub være read-only i MVP'en?
6. Skal Google Drive-sync med i MVP'en eller udskydes?
