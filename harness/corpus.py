"""Load `spec/vectors/core.tsv` and tie suite outcomes to emitted rows.

The corpus is a finite tie: a `proved-conformance` claim is made only for a row
that is emitted by Lean and asserted by a suite. The expected vocabulary is
small:

* `some` — a `(true, ...)` reply
* `none` / `reject` / `not-wf` — a refused call or a non-`(true, ...)` reply
* any other value — an equality check on the reply's second element
"""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CORPUS = ROOT / "spec" / "vectors" / "core.tsv"


def rows(cell: str | None = None) -> dict[str, dict[str, str]]:
    with CORPUS.open(newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        data = {row["case_id"]: row for row in reader}
    if cell is None:
        return data
    return {key: row for key, row in data.items() if row["cell"] == cell}


def is_ok(actual) -> bool:
    return isinstance(actual, tuple) and bool(actual) and actual[0] is True


def matches(expected: str, actual) -> bool:
    if expected in {"none", "reject", "not-wf"}:
        return not is_ok(actual)
    if expected == "some":
        return is_ok(actual)
    if is_ok(actual) and len(actual) > 1:
        return actual[1] == expected
    return False


def assert_row(case_id: str, actual, cell: str | None = None) -> None:
    table = rows(cell)
    if case_id not in table:
        raise AssertionError(f"corpus: no row {case_id}")
    expected = table[case_id]["expected"]
    if not matches(expected, actual):
        raise AssertionError(
            f"corpus {case_id}: expected {expected!r}, got {actual!r} "
            f"({table[case_id]['lean_decl']})")
    print(f"  ok corpus {case_id}")


def row_count(cell: str | None = None) -> int:
    return len(rows(cell))
