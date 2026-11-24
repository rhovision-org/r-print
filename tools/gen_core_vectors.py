#!/usr/bin/env python3
"""Emit or check the arm-level conformance corpus.

`spec/lean/RPrint/EmitCorpus.lean` prints the TSV table. The committed
`spec/vectors/core.tsv` must be byte-identical to that emission. The table is
the Lean source of truth for the finite conformance bundle; it is not a
refinement of the deployed Rholang.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEAN = ROOT / "spec" / "lean"
OUT = ROOT / "spec" / "vectors" / "core.tsv"
EMITTER = "RPrint/EmitCorpus.lean"
HEADER = "case_id\tcell\tarm\tinput\texpected\tlean_decl"


def emit() -> str:
    proc = subprocess.run(
        ["lake", "env", "lean", EMITTER],
        cwd=LEAN, text=True, capture_output=True,
    )
    if proc.returncode != 0:
        sys.stderr.write(proc.stdout)
        sys.stderr.write(proc.stderr)
        raise SystemExit("core-vectors: Lean emitter failed")
    text = proc.stdout
    if not text.endswith("\n"):
        text += "\n"
    lines = text.splitlines()
    if not lines or lines[0] != HEADER:
        raise SystemExit(f"core-vectors: bad header {lines[0] if lines else '<empty>'!r}")
    if len(lines) < 2:
        raise SystemExit("core-vectors: emitter produced no rows")
    return text


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args(argv)

    text = emit()
    if args.write:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(text)
        print(f"core-vectors: wrote {OUT.relative_to(ROOT)} "
              f"({len(text.strip().splitlines()) - 1} rows)")
        return 0
    if not OUT.is_file() or OUT.read_text() != text:
        print(f"core-vectors: {OUT.relative_to(ROOT)} is stale; run --write",
              file=sys.stderr)
        return 1
    print(f"core-vectors: {len(text.strip().splitlines()) - 1} rows current")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
