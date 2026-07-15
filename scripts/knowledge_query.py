#!/usr/bin/env python3
"""Simple provenance-preserving keyword search for T1 knowledge JSONL."""
from __future__ import annotations
import argparse, json, re
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument('query')
ap.add_argument('--top-k', type=int, default=10)
ap.add_argument('--tag')
ap.add_argument('--include-quarantine', action='store_true')
ap.add_argument('--knowledge-root', default='knowledge')
args = ap.parse_args()
root = Path(args.knowledge_root)
indexes = [root / 'rag/safe-index.jsonl']
if args.include_quarantine:
    indexes.append(root / 'rag/quarantine-index.jsonl')
terms = [t.lower() for t in re.findall(r'[\wæøå-]+', args.query) if len(t) > 1]
rows = []
for idx in indexes:
    if not idx.exists():
        continue
    for line in idx.read_text(encoding='utf-8').splitlines():
        row = json.loads(line)
        if args.tag and args.tag not in row.get('tags', []):
            continue
        hay = (row.get('source_name', '') + ' ' + row.get('text', '') + ' ' + ' '.join(row.get('tags', []))).lower()
        score = sum(hay.count(t) * (3 if t in row.get('source_name', '').lower() else 1) for t in terms)
        if score:
            rows.append((score, row))
for score, row in sorted(rows, key=lambda x: (-x[0], x[1].get('source_name', ''), x[1].get('page', 0)))[:args.top_k]:
    print(f"\n[{score}] {row['source_name']} p.{row.get('page')} | {row['chunk_id']} | {row['risk_tier']}")
    print(row.get('text', '')[:700].replace('\n', ' '))
