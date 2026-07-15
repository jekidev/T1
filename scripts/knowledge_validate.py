#!/usr/bin/env python3
"""Validate T1 knowledge package integrity and JSONL structure."""
from __future__ import annotations
import hashlib, json, sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest_path = root / 'knowledge/rag/source-manifest.json'
errors = []
if not manifest_path.exists():
    errors.append('missing source-manifest.json')
else:
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    for doc in manifest.get('documents', []):
        path = root / doc['stored_path']
        if not path.exists():
            errors.append(f'missing source: {path}')
        else:
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
            if actual != doc['sha256']:
                errors.append(f'hash mismatch: {path}')
for rel in ['knowledge/rag/all-chunks.jsonl', 'knowledge/rag/safe-index.jsonl', 'knowledge/rag/quarantine-index.jsonl']:
    path = root / rel
    if not path.exists():
        errors.append(f'missing index: {rel}')
        continue
    ids = set()
    for n, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        try:
            row = json.loads(line)
        except Exception as exc:
            errors.append(f'{rel}:{n}: invalid JSON: {exc}')
            continue
        for key in ['chunk_id', 'source_name', 'page', 'risk_tier', 'text']:
            if key not in row:
                errors.append(f'{rel}:{n}: missing {key}')
        if row.get('chunk_id') in ids:
            errors.append(f'{rel}:{n}: duplicate chunk_id')
        ids.add(row.get('chunk_id'))
if errors:
    print('\n'.join(f'ERROR: {e}' for e in errors))
    sys.exit(1)
print('Knowledge package validation passed.')
