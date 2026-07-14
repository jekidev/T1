# Security

- API-nøgler modtages kun af Express-backenden.
- Secrets krypteres med AES-256-GCM.
- Krypteringsnøglen kommer fra `CASECRAFT_SECRET_KEY` eller en lokal fil med restriktive rettigheder.
- Frontend modtager kun `configured` og `last4`.
- `.env` og `.casecraft/` er ignoreret af Git.
- Custom Base URLs valideres til HTTP/HTTPS. I produktion bør der tilføjes en allowlist for at reducere SSRF-risiko.
- Sæt rate limiting, CSRF-beskyttelse, auth og audit logs før offentlig multi-user deployment.
- Manuskripttekst sendes kun til en AI/TTS-provider efter en eksplicit brugerhandling.
