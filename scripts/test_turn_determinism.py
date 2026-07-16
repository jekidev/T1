#!/usr/bin/env python3
"""Verify that two resolve-turn calls from the same board state produce identical deterministic output.

This script creates two temporary scenarios with the same board, resolves both with the same
action, and compares deterministic fields. Non-deterministic fields (nanoid IDs, timestamps)
are ignored.
"""
from __future__ import annotations

import json
import time
import urllib.request
from copy import deepcopy
from typing import Any

BASE_URL = "http://localhost:8080/api"


def fetch_json(url: str) -> Any:
    with urllib.request.urlopen(url) as res:
        return json.loads(res.read().decode())


def post_json(url: str, body: dict) -> Any:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())


def delete_json(url: str) -> Any:
    req = urllib.request.Request(url, method="DELETE")
    with urllib.request.urlopen(req) as res:
        return res.read().decode()


def strip_nondeterministic(obj: Any) -> Any:
    """Remove nanoid-style ids and ISO timestamps from nested dicts/lists."""
    if isinstance(obj, dict):
        result: dict[str, Any] = {}
        for k, v in obj.items():
            if k in {"id", "createdAt", "updatedAt", "narrativePatternId", "canonical_chunk_id", "chunk_id", "name", "description", "mapTemplateId"}:
                continue
            result[k] = strip_nondeterministic(v)
        return result
    if isinstance(obj, list):
        return [strip_nondeterministic(item) for item in obj]
    return obj


def main() -> int:
    scenarios = fetch_json(f"{BASE_URL}/scenarios")
    if not scenarios:
        print("No scenarios available for determinism test")
        return 1

    template = None
    for s in scenarios:
        temp = fetch_json(f"{BASE_URL}/scenarios/{s['id']}")
        if temp.get("board", {}).get("simulation"):
            template = temp
            break

    if not template:
        print("No scenario with a simulation state found")
        return 1

    action = {"type": "invest", "amount": 5}
    original_board = deepcopy(template["board"])
    base = {
        "name": "det-test",
        "description": "Temporary determinism test scenario",
        "mapTemplateId": template.get("mapTemplateId", "norrebro"),
        "board": original_board,
    }

    timestamp = int(time.time())
    first_scenario = post_json(f"{BASE_URL}/scenarios", {**base, "name": f"det-test-a-{timestamp}"})
    second_scenario = post_json(f"{BASE_URL}/scenarios", {**base, "name": f"det-test-b-{timestamp}"})

    try:
        first = post_json(f"{BASE_URL}/scenarios/{first_scenario['id']}/resolve", action)
        second = post_json(f"{BASE_URL}/scenarios/{second_scenario['id']}/resolve", action)

        clean_first = strip_nondeterministic(first)
        clean_second = strip_nondeterministic(second)

        ok = clean_first == clean_second

        summary = {
            "template_scenario_id": template["id"],
            "action": action,
            "deterministic": ok,
            "first_turn": first["scenario"]["board"]["simulation"]["turn"],
            "second_turn": second["scenario"]["board"]["simulation"]["turn"],
            "first_summary": first["summary"],
            "second_summary": second["summary"],
        }
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return 0 if ok else 1
    finally:
        try:
            delete_json(f"{BASE_URL}/scenarios/{first_scenario['id']}")
            delete_json(f"{BASE_URL}/scenarios/{second_scenario['id']}")
        except Exception as e:
            print(f"Cleanup warning: {e}")


if __name__ == "__main__":
    raise SystemExit(main())
