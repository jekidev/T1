#!/usr/bin/env python3
"""Validate that the safe RAG index covers the source basis declared in the feature catalog.

This is a quality check, not a content transformation. It reads public metadata only
(source names, tags, risk tiers, feature cards) and reports which features are backed
by chunks in safe-index.jsonl and which appear orphaned.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FEATURE_CATALOG = ROOT / 'knowledge' / 'features' / 'feature-catalog.json'
SAFE_INDEX = ROOT / 'knowledge' / 'rag' / 'safe-index.jsonl'
SOURCE_MANIFEST = ROOT / 'knowledge' / 'rag' / 'source-manifest.json'


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


def normalize(text: str) -> str:
    return re.sub(r'[^a-z0-9]', '', text.lower())


def feature_keywords(feature: dict) -> set[str]:
    keywords: set[str] = set()
    keywords.add(normalize(feature['id']))
    keywords.add(normalize(feature.get('module', '')))
    for word in re.findall(r'[A-Za-z0-9]+', feature['name']):
        if len(word) > 2:
            keywords.add(normalize(word))
    for basis in feature.get('source_basis', []):
        for word in re.findall(r'[A-Za-z0-9]+', basis):
            if len(word) > 2:
                keywords.add(normalize(word))
    for word in re.findall(r'[A-Za-z0-9]+', feature.get('description', '')):
        if len(word) > 3:
            keywords.add(normalize(word))
    return {k for k in keywords if k}


def chunk_texts(chunk: dict) -> list[str]:
    texts = [chunk.get('source_name', ''), chunk.get('text', '')]
    texts.extend(chunk.get('tags', []) or [])
    return [normalize(t) for t in texts if isinstance(t, str)]


def main() -> int:
    catalog = json.loads(FEATURE_CATALOG.read_text(encoding='utf-8'))
    chunks = load_jsonl(SAFE_INDEX)
    manifest = json.loads(SOURCE_MANIFEST.read_text(encoding='utf-8')) if SOURCE_MANIFEST.exists() else None

    chunk_keyword_index: set[str] = set()
    for chunk in chunks:
        for text in chunk_texts(chunk):
            chunk_keyword_index.update(text[i:i+4] for i in range(len(text) - 3))
            # also store whole normalized words for exact matching
            chunk_keyword_index.update(text.split())

    source_names_in_index: Counter[str] = Counter()
    for chunk in chunks:
        source_names_in_index[chunk.get('source_name', '')] += 1

    uncovered: list[dict] = []
    covered: list[dict] = []
    for feature in catalog.get('features', []):
        keywords = feature_keywords(feature)
        matched = False
        for keyword in keywords:
            if keyword in chunk_keyword_index:
                matched = True
                break
        if matched:
            covered.append(feature)
        else:
            uncovered.append(feature)

    manifest_sources = {doc['source_name'] for doc in manifest.get('documents', [])} if manifest else set()
    missing_from_index = sorted(manifest_sources - set(source_names_in_index.keys()))

    summary = {
        'timestamp': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
        'total_features': len(catalog.get('features', [])),
        'covered_features': len(covered),
        'uncovered_features': len(uncovered),
        'uncovered_feature_ids': [f['id'] for f in uncovered],
        'manifest_documents': len(manifest_sources),
        'sources_without_safe_chunks': missing_from_index,
        'safe_index_chunks': len(chunks),
    }

    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
