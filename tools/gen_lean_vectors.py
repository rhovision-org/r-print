#!/usr/bin/env python3
"""Emit or check the Lean conformance vectors.

`spec/lean/RPrint/Emit.lean` prints `name|input|output` lines. The committed
`spec/vectors/lean.json` is compared exactly; it is generated, never hand-edited.
Canonical payload vectors stay in `core.json` and `client.json`.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEAN = ROOT / "spec" / "lean"
OUT = ROOT / "spec" / "vectors" / "lean.json"
SCHEMA = "rprint.lean-vectors/v1"
EMITTER = "RPrint/Emit.lean"


def emit() -> dict:
    proc = subprocess.run(
        ["lake", "env", "lean", EMITTER],
        cwd=LEAN, text=True, capture_output=True,
    )
    if proc.returncode != 0:
        sys.stderr.write(proc.stdout)
        sys.stderr.write(proc.stderr)
        raise SystemExit("lean-vectors: Lean emitter failed")
    vectors: dict[str, dict[str, str]] = {}
    for line in proc.stdout.splitlines():
        parts = line.strip().split("|")
        if len(parts) != 3:
            continue
        name, inputs, output = parts
        vectors[name] = {"input": inputs, "output": output}
    if not vectors:
        raise SystemExit("lean-vectors: emitter produced no vectors")
    return {
        "schema": SCHEMA,
        "generated_by": f"spec/lean/{EMITTER}",
        "vectors": dict(sorted(vectors.items())),
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args(argv)

    payload = emit()
    text = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    if args.write:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(text)
        print(f"lean-vectors: wrote {OUT.relative_to(ROOT)} "
              f"({len(payload['vectors'])} vectors)")
        return 0
    if not OUT.is_file() or OUT.read_text() != text:
        print(f"lean-vectors: {OUT.relative_to(ROOT)} is stale; run --write",
              file=sys.stderr)
        return 1
    print(f"lean-vectors: {len(payload['vectors'])} vectors current")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
