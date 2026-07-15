# Account wisdom book sources

## The Art of War

- Work: *The Art of War*
- Author: Sunzi
- English translator used by the importer: Lionel Giles
- Project Gutenberg ebook: 132
- Fixed source: `https://www.gutenberg.org/cache/epub/132/pg132.txt`
- Target directory: `rag/accounts/<account-name>/alt-wisdom/books/`
- Import endpoint: `POST /api/rag/import/art-of-war`

The full text is downloaded only after the user creates a network session.

Default mode:

```text
Ask First
```

In Ask First mode, the user sees the capability, origin, path and reason and grants a one-request approval. Ultra is a separately confirmed, temporary session mode for public HTTPS retrieval.

The server:

1. validates the HTTPS URL
2. blocks private, local, metadata and non-standard-port targets
3. resolves every hostname and rejects any private/link-local result
4. pins the HTTPS connection to one validated public address
5. revalidates every redirect
6. enforces a byte limit and UTF-8 decoding
7. rejects binary content
8. stores the text append-only with a SHA-256 source record
9. rebuilds persistent RAG and returns a new revision

Project Gutenberg distribution terms remain inside the downloaded text. Local public-domain and redistribution rules must still be verified before external redistribution.

## Hugging Face text imports

The account RAG importer accepts only explicitly selected files from `owner/repository@revision`.

Allowed extensions:

```text
.md
.txt
.json
.jsonl
.csv
.yaml
.yml
```

It does not download or execute model weights, pickle files, binaries or executable artifacts. Existing RAG source files are never overwritten; changed upstream content receives a content-addressed filename and import manifest.
