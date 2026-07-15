#!/usr/bin/env python3
"""Rebuild the T1 page-aware knowledge indexes.

Original source files are never deleted. Default retrieval excludes restricted and
prompt-injection material while the complete corpus remains in all-chunks.jsonl.
"""
from __future__ import annotations

import argparse, hashlib, json, re, unicodedata
from pathlib import Path
import fitz

PROMPT = [r'never refuse', r'jailbreak', r'auto[- ]?reframe', r'bypass', r'suppress safety', r'route around alignment', r'inverted law']
RISK = [r'explosive', r'malware', r'ransomware', r'keylogger', r'credential stuffing', r'evade police', r'money laundering', r'hvidvask', r'smuggl', r'drug (?:network|lord|trade|empire)', r'blackmail', r'signal\.group/#']
DEF = [r'blue team', r'detection', r'detektion', r'investigat', r'police method', r'compliance', r'forensic', r'mitigation', r'modspil']


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()


def norm(s: str) -> str:
    s = unicodedata.normalize('NFKC', s).replace('\x00', ' ').replace('\u00ad', '')
    s = re.sub(r'(?<=\w)-\n(?=\w)', '', s)
    s = re.sub(r'[ \t]+', ' ', s)
    return re.sub(r'\n{3,}', '\n\n', s).strip()


def chunks(s: str, max_chars=1800):
    ps = [p.strip() for p in re.split(r'\n\s*\n', norm(s)) if p.strip()]
    out, cur = [], ''
    for p in ps:
        if len(cur) + len(p) + 2 <= max_chars:
            cur = f'{cur}\n\n{p}'.strip()
        else:
            if cur:
                out.append(cur)
            cur = p
    if cur:
        out.append(cur)
    return out


def hits(patterns, text):
    return [p for p in patterns if re.search(p, text, re.I | re.S)]


def classify(text):
    if hits(PROMPT, text):
        return 'prompt_injection'
    if hits(RISK, text):
        return 'restricted_defensive' if len(hits(DEF, text)) >= 2 else 'restricted'
    if hits(DEF, text):
        return 'defensive'
    return 'safe'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', default='knowledge/sources/original')
    ap.add_argument('--output', default='knowledge')
    args = ap.parse_args()
    src, out = Path(args.source), Path(args.output)
    (out / 'rag').mkdir(parents=True, exist_ok=True)
    (out / 'sources/extracted').mkdir(parents=True, exist_ok=True)
    docs, all_rows = [], []
    for path in sorted(src.iterdir()):
        if not path.is_file() or path.read_bytes()[:5] != b'%PDF-':
            continue
        digest = sha(path)
        instance = hashlib.sha256(f'{digest}|{path.name}'.encode('utf-8')).hexdigest()[:16]
        pdf = fitz.open(path)
        pages = []
        before = len(all_rows)
        for n, page in enumerate(pdf, 1):
            text = norm(page.get_text('text'))
            pages.append(text)
            for i, body in enumerate(chunks(text), 1):
                tier = classify(body)
                all_rows.append({
                    'chunk_id': f'{instance}-p{n:04d}-c{i:03d}',
                    'document_sha256': digest,
                    'source_name': path.name,
                    'page': n,
                    'risk_tier': tier,
                    'retrieval_default': tier in {'safe', 'defensive'},
                    'text': body,
                })
        (out / 'sources/extracted' / f'{path.name}.md').write_text(
            '\n\n'.join(f'# Page {i}\n\n{t}' for i, t in enumerate(pages, 1)),
            encoding='utf-8',
        )
        docs.append({'name': path.name, 'sha256': digest, 'pages': pdf.page_count, 'chunks': len(all_rows) - before})

    def dump(name, rows):
        with (out / 'rag' / name).open('w', encoding='utf-8') as f:
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + '\n')

    dump('all-chunks.jsonl', all_rows)
    dump('safe-index.jsonl', [r for r in all_rows if r['retrieval_default']])
    dump('quarantine-index.jsonl', [r for r in all_rows if not r['retrieval_default']])
    generated_at = __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
    (out / 'rag/document-index.json').write_text(
        json.dumps({'generated_at': generated_at, 'documents': docs}, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )
    print(f'Indexed {len(docs)} documents / {len(all_rows)} chunks')


if __name__ == '__main__':
    main()
