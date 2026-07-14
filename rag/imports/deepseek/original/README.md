# Original DeepSeek imports

This directory is reserved for **unaltered source exports** from DeepSeek conversations used during development of Operation København.

## Preservation rule

- Original files must be stored byte-for-byte unchanged.
- Original files must never be overwritten by canonical lore, summaries, safety notes, or gameplay translations.
- Review, extraction, tagging, and gameplay conversion must happen in separate sibling directories.
- The source file hash must be recorded before and after import.
- Removal requires an explicit repository decision and a replacement archive.

## Expected layout

```text
rag/imports/deepseek/
├── original/
│   ├── Nyx Response - DeepSeek.pdf
│   ├── Nyx klar - DeepSeek.pdf
│   └── additional original exports
├── extracted/
├── reviewed/
└── manifest.json
```

## Important distinction

Original source material is preserved for provenance and design history. It is not automatically an executable system prompt. Canonical storyline, mechanics, data models, and runtime behavior are maintained separately.

## Upload status

The repository currently contains the preservation structure and manifest. Any original PDFs that are not already present must be uploaded to this folder unchanged from the source files.
