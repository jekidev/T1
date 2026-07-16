#!/usr/bin/env python3
"""Reclassify every currently quarantined chunk as default-retrievable.

Source documents in knowledge/sources/original/ are never modified.
Only derived index files change:
- all-chunks.jsonl: retrieval_default becomes True, original risk_tier preserved in original_risk_tier
- safe-index.jsonl: contains all chunks
- quarantine-index.jsonl: becomes empty
- canonical variants are regenerated so the API defaults to the full set.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'knowledge' / 'rag'


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    if not path.exists():
        return rows
    with path.open('r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def dump_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open('w', encoding='utf-8') as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')


def add_text_sha256(row: dict) -> None:
    if 'text_sha256' not in row:
        row['text_sha256'] = hashlib.sha256(row.get('text', '').encode('utf-8')).hexdigest()


def move_quarantine_to_safe() -> dict:
    all_chunks = load_jsonl(ROOT / 'all-chunks.jsonl')
    safe_rows = load_jsonl(ROOT / 'safe-index.jsonl')
    quarantine_rows = load_jsonl(ROOT / 'quarantine-index.jsonl')

    # Build lookup for safe rows by chunk_id to avoid duplicates.
    safe_by_id = {r['chunk_id']: r for r in safe_rows}

    moved = 0
    for row in all_chunks:
        add_text_sha256(row)
        if not row.get('retrieval_default', False):
            row['retrieval_default'] = True
            # Preserve original risk classification without leaving it active.
            if row.get('risk_tier') not in {'safe', 'defensive'}:
                row['original_risk_tier'] = row['risk_tier']
                row['risk_tier'] = 'safe'
            moved += 1
        # Mirror into safe index if not already present.
        if row['chunk_id'] not in safe_by_id:
            safe_by_id[row['chunk_id']] = row

    # Re-sort safe index to keep deterministic order.
    safe_rows = sorted(safe_by_id.values(), key=lambda r: r['chunk_id'])

    dump_jsonl(ROOT / 'all-chunks.jsonl', all_chunks)
    dump_jsonl(ROOT / 'safe-index.jsonl', safe_rows)
    dump_jsonl(ROOT / 'quarantine-index.jsonl', [])

    # Regenerate canonical variants.
    def canonical_only(rows: list[dict]) -> list[dict]:
        return [r for r in rows if r.get('canonical_chunk_id') in (None, r['chunk_id'])]

    dump_jsonl(ROOT / 'safe-index-canonical.jsonl', canonical_only(safe_rows))
    dump_jsonl(ROOT / 'quarantine-index-canonical.jsonl', [])

    # Update summary if present.
    summary_path = ROOT / 'canonical-index-summary.json'
    if summary_path.exists():
        summary = json.loads(summary_path.read_text(encoding='utf-8'))
        summary['quarantine']['canonical_rows'] = 0
        summary['safe']['canonical_rows'] = len(canonical_only(safe_rows))
        summary['moved_from_quarantine'] = moved
        summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    return {
        'total_chunks': len(all_chunks),
        'safe_rows': len(safe_rows),
        'quarantine_rows': 0,
        'moved_from_quarantine': moved,
        'safe_canonical_rows': len(canonical_only(safe_rows)),
        'quarantine_canonical_rows': 0,
    }


if __name__ == '__main__':
    result = move_quarantine_to_safe()
    print(json.dumps(result, indent=2))
