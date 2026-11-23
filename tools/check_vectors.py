#!/usr/bin/env python3
"""Validate the committed canonical-payload vectors against a Python reference."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VECTOR_DIR = ROOT / "spec" / "vectors"


def admin_payload(domain: str, nonce: int, action: str, args: list[str]) -> str:
    return f"rprint:admin:v1|{domain}|{nonce}|{action}|{','.join(args)}"


def canonical(schema: str, items: list[str]) -> str:
    return schema if not items else schema + "|" + "|".join(items)


def blake2b256(text: str) -> str:
    return hashlib.blake2b(text.encode(), digest_size=32).hexdigest()


def main() -> int:
    files = sorted(VECTOR_DIR.glob("*.json"))
    if not files:
        print(f"check-vectors: no vectors in {VECTOR_DIR}", file=sys.stderr)
        return 1
    problems = []
    total = 0
    for path in files:
        doc = json.loads(path.read_text())
        if doc.get("schema") == "rprint.lean-vectors/v1":
            continue
        for vector in doc.get("vectors", []):
            total += 1
            kind = vector.get("kind")
            if kind == "admin":
                actual = admin_payload(
                    vector["domain"], int(vector["nonce"]), vector["action"],
                    [str(item) for item in vector.get("args", [])])
                expected = vector["payload"]
            elif kind == "canonical":
                actual = canonical(vector["schema"], [str(item) for item in vector["items"]])
                expected = vector["canonical"]
            elif kind == "blake2b":
                actual = blake2b256(vector["text"])
                expected = vector["digest"]
            else:
                problems.append(f"{path.name}:{vector.get('id')}: unknown kind {kind!r}")
                continue
            if actual != expected:
                problems.append(
                    f"{path.name}:{vector.get('id')}: expected {expected!r}, got {actual!r}")
    for problem in problems:
        print(f"check-vectors: {problem}", file=sys.stderr)
    if problems:
        return 1
    print(f"check-vectors: {total} vectors")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
