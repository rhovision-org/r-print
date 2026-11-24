#!/usr/bin/env python3
"""Check the core arm-pair race matrix against the Lean sources.

Every row declares a cell, two arms, a class and either a theorem or `owed`.
The gate checks the class vocabulary, pair coverage (all combinations with
replacement for each cell), uniqueness, and that a named theorem exists. It is
a tie, not a refinement: pair obligations over the shallow model, not
scheduler-level race freedom.
"""

from __future__ import annotations

import itertools
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
MATRIX = ROOT / "spec" / "flows" / "races.yaml"
LEAN = ROOT / "spec" / "lean"
CLASSES = {"exclusive", "ordered", "independent"}
DECL_RE = re.compile(r'^\s*(?:theorem|lemma)\s+([A-Za-z0-9_\']+)', re.M)


def declarations() -> set[str]:
    names: set[str] = set()
    for path in LEAN.rglob("*.lean"):
        if ".lake" in path.parts:
            continue
        names.update(DECL_RE.findall(path.read_text()))
    return names


def main() -> int:
    if not MATRIX.is_file():
        print(f"check-race-matrix: missing {MATRIX.relative_to(ROOT)}", file=sys.stderr)
        return 1
    doc = yaml.safe_load(MATRIX.read_text()) or {}
    if doc.get("schema") != "rprint.races/v1":
        print("check-race-matrix: wrong schema", file=sys.stderr)
        return 1
    scope = doc.get("scope") or {}
    if scope.get("refinement") is not False:
        print("check-race-matrix: scope.refinement must be false", file=sys.stderr)
        return 1

    cells = doc.get("cells") or {}
    rows = doc.get("pairs") or []
    decls = declarations()
    errors: list[str] = []
    seen: set[tuple[str, str, str, str]] = set()
    counts = {cls: 0 for cls in CLASSES}
    owed = 0

    by_pair: dict[tuple[str, str, str], list[dict]] = {}
    for row in rows:
        cell = row.get("cell", "")
        a, b = row.get("a", ""), row.get("b", "")
        case = row.get("case", "")
        cls = row.get("class", "")
        theorem = str(row.get("theorem", ""))
        if cell not in cells:
            errors.append(f"{cell}:{a}/{b}: unknown cell")
            continue
        arms = cells[cell]
        if a not in arms or b not in arms:
            errors.append(f"{cell}:{a}/{b}: arm not declared on the cell")
        if cls not in CLASSES:
            errors.append(f"{cell}:{a}/{b}: bad class {cls!r}")
        else:
            counts[cls] += 1
        key = (cell, a, b, case)
        if key in seen:
            errors.append(f"duplicate pair {key}")
        seen.add(key)
        unordered = (cell, min(a, b), max(a, b))
        by_pair.setdefault(unordered, []).append(row)
        if theorem == "owed":
            owed += 1
            if not row.get("note"):
                errors.append(f"{cell}:{a}/{b}: owed without a note")
        elif theorem.rsplit(".", 1)[-1] not in decls:
            errors.append(f"{cell}:{a}/{b}: theorem {theorem} not found")

    expected = set()
    for cell, arms in cells.items():
        for a, b in itertools.combinations_with_replacement(arms, 2):
            expected.add((cell, min(a, b), max(a, b)))
    for key in sorted(expected - set(by_pair)):
        errors.append(f"missing pair {key}")
    for key, group in by_pair.items():
        if len(group) > 1 and not all(row.get("case") for row in group):
            errors.append(f"{key}: multiple rows need distinct case labels")

    if errors:
        for error in errors:
            print(f"check-race-matrix: {error}", file=sys.stderr)
        print(f"check-race-matrix: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"check-race-matrix: {len(rows)} pair(s) "
          f"({counts['exclusive']} exclusive, {counts['ordered']} ordered, "
          f"{counts['independent']} independent, {owed} owed)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
