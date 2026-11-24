#!/usr/bin/env python3
"""Check the red-team result ledger against the recorded harness output.

The ledger and the result JSON must name the same probe ids, with the same
classification. A finding reference must resolve. `not_run` is not a pass.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "spec" / "audit" / "redteam.yaml"
RESULTS = ROOT / "deployments" / "redteam-results.json"
FINDINGS = ROOT / "spec" / "audit" / "findings.yaml"
CLASSES = {"fixed", "open", "accepted", "not_reproduced", "not_run"}
RPA = re.compile(r'^RPA-\d{3}$')


def main() -> int:
    ledger = yaml.safe_load(LEDGER.read_text()) or {}
    errors: list[str] = []
    if ledger.get("schema") != "rprint.redteam/v1":
        errors.append("bad schema")
    if not RESULTS.is_file():
        errors.append(f"missing {RESULTS.relative_to(ROOT)}; run make redteam")
        payload = {}
    else:
        payload = json.loads(RESULTS.read_text())
    findings = {row["id"] for row in
                (yaml.safe_load(FINDINGS.read_text()) or {}).get("findings", [])}
    ledger_rows = {row.get("id"): row for row in ledger.get("results") or []}
    result_rows = {row.get("id"): row for row in payload.get("results") or []}
    for pid in sorted(set(ledger_rows) - set(result_rows)):
        errors.append(f"{pid}: in the ledger but not in the results")
    for pid in sorted(set(result_rows) - set(ledger_rows)):
        errors.append(f"{pid}: in the results but not in the ledger")
    counts = {cls: 0 for cls in CLASSES}
    for pid, row in ledger_rows.items():
        classification = row.get("classification")
        if classification not in CLASSES:
            errors.append(f"{pid}: bad classification {classification!r}")
        else:
            counts[classification] += 1
        finding = row.get("finding", "-")
        if finding != "-" and finding not in findings:
            errors.append(f"{pid}: unknown finding {finding}")
        result = result_rows.get(pid)
        if result and result.get("classification") != classification:
            errors.append(f"{pid}: ledger {classification!r} != result "
                          f"{result.get('classification')!r}")
    if payload and payload.get("pass") is not True:
        errors.append("the recorded red-team run did not pass")

    if errors:
        for error in errors:
            print(f"check-redteam-results: {error}", file=sys.stderr)
        print(f"check-redteam-results: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"check-redteam-results: {len(ledger_rows)} probe(s) "
          f"({counts['fixed']} fixed, {counts['accepted']} accepted, "
          f"{counts['open']} open, {counts['not_run']} not run)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
