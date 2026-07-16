#!/usr/bin/env python3
"""Generate canonical-only JSONL indexes from safe and quarantine indexes.

No source files or original index files are deleted. New *-canonical.jsonl
files contain one representative (canonical) row per duplicate text group.
The full corpus remains in all-chunks.jsonl and the original indexes.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'knowledge' / 'rag'


def write_canonical(src_name: str, dst_name: str) -> int:
    src = ROOT / src_name
    dst = ROOT / dst_name
    out: list[str] = []
    kept = 0
    with src.open('r', encoding='utf-8') as f:
        for line in f:
            row = json.loads(line)
            if row.get('canonical_chunk_id') in (None, row['chunk_id']):
                out.append(line.rstrip('\n'))
                kept += 1
    dst.write_text('\n'.join(out) + '\n', encoding='utf-8')
    return kept


if __name__ == '__main__':
    safe_kept = write_canonical('safe-index.jsonl', 'safe-index-canonical.jsonl')
    quarantine_kept = write_canonical('quarantine-index.jsonl', 'quarantine-index-canonical.jsonl')
    summary = {
        'generated_at': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
        'purpose': 'canonical-only retrieval indexes; originals preserved',
        'safe': {'source': 'safe-index.jsonl', 'canonical': 'safe-index-canonical.jsonl', 'canonical_rows': safe_kept},
        'quarantine': {'source': 'quarantine-index.jsonl', 'canonical': 'quarantine-index-canonical.jsonl', 'canonical_rows': quarantine_kept},
    }
    (ROOT / 'canonical-index-summary.json').write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )
    print(f'Canonical indexes written: {safe_kept} safe, {quarantine_kept} quarantine rows')
