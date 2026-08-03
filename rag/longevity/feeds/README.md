# Longevity feeds

`pnpm rag:scrape-longevity` writes one Markdown file per feed item here, grouped by source id and deduplicated by SHA-256.

Sources are configured in `integrations/longevity-sources.json` (PubMed queries, journal and biohacking blog feeds). Fetched items are untrusted reference data: each file carries a provenance block and an untrusted-data banner, and the text is never treated as an instruction.

Scraped items are git-ignored; re-run the scraper to rebuild them.
