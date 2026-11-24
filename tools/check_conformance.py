#!/usr/bin/env python3
"""Check the `proved-conformance` evidence bundle.

`proved-conformance` is not a refinement claim. It means:

* the arm has a theorem named in the flow manifest;
* that arm has an emitted row in `spec/vectors/core.tsv`; and
* a deployed harness suite asserts the same case id.

The gate rejects any partial bundle and any corpus row that is not emitted by
the Lean corpus or does not name an existing theorem.
"""

from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "harness"))

import run_suites  # noqa: E402

CORE = ROOT / "spec" / "flows" / "core.yaml"
CORPUS = ROOT / "spec" / "vectors" / "core.tsv"
LEAN = ROOT / "spec" / "lean"
ARM_RE = re.compile(r'^(?P<contract>[A-Za-z0-9_]+)@"(?P<arm>[^"]+)"$')
DECL_RE = re.compile(
    r"^[ \t]*(?:@\[[^\]]*\][ \t]*)*(theorem|lemma|def|inductive|structure)[ \t]+"
    r"([A-Za-z0-9_]+)",
    re.M,
)


def lean_kinds() -> dict[str, str]:
    kinds: dict[str, str] = {}
    for path in LEAN.rglob("*.lean"):
        if ".lake" in path.parts:
            continue
        for kind, name in DECL_RE.findall(path.read_text()):
            if kind in {"theorem", "lemma"}:
                kinds[name] = "theorem"
            else:
                kinds.setdefault(name, kind)
    return kinds


def corpus_rows() -> dict[str, dict[str, str]]:
    if not CORPUS.is_file():
        return {}
    with CORPUS.open(newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        return {row["case_id"]: row for row in reader}


def main() -> int:
    doc = yaml.safe_load(CORE.read_text()) or {}
    rules = doc.get("rules", [])
    rows = corpus_rows()
    kinds = lean_kinds()
    mapped_suites = {f"harness/{script}" for script in run_suites.SUITES.values()}
    errors: list[str] = []
    promoted = 0

    for rule in rules:
        if rule.get("lean_status") != "proved-conformance":
            continue
        promoted += 1
        rule_id = rule.get("id", "<unnamed>")
        lean = str(rule.get("lean", ""))
        case = str(rule.get("corpus", ""))
        suite = str(rule.get("suite", ""))
        if not lean:
            errors.append(f"{rule_id}: no Lean target")
        elif kinds.get(lean.rsplit(".", 1)[-1]) != "theorem":
            errors.append(f"{rule_id}: {lean} is not a theorem")
        if not case:
            errors.append(f"{rule_id}: no corpus case")
            continue
        if case not in rows:
            errors.append(f"{rule_id}: corpus has no case {case}")
            continue
        row = rows[case]
        decl = row.get("lean_decl", "")
        if kinds.get(decl.rsplit(".", 1)[-1]) != "theorem":
            errors.append(f"{case}: lean_decl {decl} is not a theorem")
        match = ARM_RE.match(str(rule.get("arm", "")))
        if not match:
            errors.append(f"{rule_id}: bad arm {rule.get('arm')!r}")
        else:
            if row.get("cell") != rule.get("cell"):
                errors.append(f"{case}: cell {row.get('cell')!r} != {rule.get('cell')!r}")
            if row.get("arm") != match.group("arm"):
                errors.append(f"{case}: arm {row.get('arm')!r} != {match.group('arm')!r}")
        if not suite:
            errors.append(f"{rule_id}: no suite path")
        elif suite not in mapped_suites:
            errors.append(f"{rule_id}: suite {suite} is not mapped in run_suites")
        elif not (ROOT / suite).is_file():
            errors.append(f"{rule_id}: missing suite {suite}")
        elif case not in (ROOT / suite).read_text():
            errors.append(f"{rule_id}: suite {suite} does not mention case {case}")

    if not rows:
        errors.append("corpus is empty or missing")
    for case, row in rows.items():
        if set(row) != {"case_id", "cell", "arm", "input", "expected", "lean_decl"}:
            errors.append(f"{case}: bad columns {sorted(row)}")
        if row.get("expected") not in {"some", "none", "reject", "not-wf"}:
            errors.append(f"{case}: bad expected {row.get('expected')!r}")
        decl = row.get("lean_decl", "")
        if kinds.get(decl.rsplit(".", 1)[-1]) != "theorem":
            errors.append(f"{case}: lean_decl {decl} is not a theorem")

    if errors:
        for error in errors:
            print(f"check_conformance: {error}", file=sys.stderr)
        print(f"check_conformance: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"check_conformance: {promoted} promoted arm(s), "
          f"{len(rows)} emitted row(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
