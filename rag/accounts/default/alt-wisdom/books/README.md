# Account wisdom books

This directory is additive. Existing RAG, DeepSeek scripts and conversations are immutable and are not moved, renamed, rewritten or deleted by this feature.

## The Art of War

The application contains an **Ask First** importer for the public-domain Project Gutenberg edition:

- Title: *The Art of War*
- Author: Sunzi
- English translator: Lionel Giles
- Project Gutenberg ebook: 132
- Runtime destination: `rag/accounts/<account>/alt-wisdom/books/the-art-of-war-lionel-giles-project-gutenberg.txt`
- Provenance sidecar: `the-art-of-war-lionel-giles-project-gutenberg.source.json`

Open **Developer AI → Network + RAG**, keep **Ask First** selected, press **Import Art of War**, approve the exact Gutenberg path once, and then press **Update the world**. The complete downloaded text is retained in the selected account folder and indexed as data; it is never executed.

Ultra mode may be selected only through the explicit confirmation control. It bypasses individual network prompts for that temporary session but does not bypass source, license or review records.
