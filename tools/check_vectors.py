#!/usr/bin/env python3
"""Validate the committed canonical-payload vectors against a Python reference."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VECTORS = ROOT / "spec" / "vectors" / "core.json"


def admin_payload(domain: str, nonce: int, action: str, args: list[str]) -> str:
    return f"rprint:admin:v1|{domain}|{nonce}|{action}|{','.join(args)}"


def canonical(schema: str, items: list[str]) -> str:
    return schema if not items else schema + "|" + "|".join(items)


def main() -> int:
    if not VECTORS.is_file():
        print(f"check-vectors: missing {VECTORS}", file=sys.stderr)
        return 1
    doc = json.loads(VECTORS.read_text())
    problems = []
    for vector in doc.get("vectors", []):
        kind = vector.get("kind")
        if kind == "admin":
            actual = admin_payload(
                vector["domain"], int(vector["nonce"]), vector["action"],
                [str(item) for item in vector.get("args", [])])
            expected = vector["payload"]
        elif kind == "canonical":
            actual = canonical(vector["schema"], [str(item) for item in vector["items"]])
            expected = vector["canonical"]
        else:
            problems.append(f"{vector.get('id')}: unknown kind {kind!r}")
            continue
        if actual != expected:
            problems.append(f"{vector.get('id')}: expected {expected!r}, got {actual!r}")
    for problem in problems:
        print(f"check-vectors: {problem}", file=sys.stderr)
    if problems:
        return 1
    print(f"check-vectors: {len(doc.get('vectors', []))} vectors")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
