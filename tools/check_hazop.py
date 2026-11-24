#!/usr/bin/env python3
"""Check the HAZOP worksheet: rows, coverage and cross-references.

Coverage is 8 nodes x 15 guide words. A cell is covered by a row or is `na`
with a reason; a node may supply an `na_default` for cells with no distinct
parameter. A partial or absent safeguard needs an action or finding.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
WORKSHEET = ROOT / "spec" / "hazop" / "worksheet.yaml"
FINDINGS = ROOT / "spec" / "audit" / "findings.yaml"
IMPROVEMENTS = ROOT / "spec" / "audit" / "improvement-plan.yaml"

GUIDE_WORDS = [
    "No/Not", "More", "Less", "As well as", "Part of", "Reverse", "Other than",
    "Late", "Early", "Before", "After", "Duplicate/Replay", "Stale",
    "Substitute/confused-deputy", "Partial commit",
]
SEVERITY = {"S1": 4, "S2": 3, "S3": 2, "S4": 1}
LIKELIHOOD = {"A": 4, "B": 3, "C": 2, "D": 1}
SAFEGUARDS = {"holds", "partial", "none"}
DISPOSITIONS = {"no-finding", "open", "accepted", "fixed"}
HZ = re.compile(r'^HZ-[A-Z]+-\d{3}$')
RPA = re.compile(r'^RPA-\d{3}$')
IMP = re.compile(r'^IMP-\d{3}$')


def main() -> int:
    data = yaml.safe_load(WORKSHEET.read_text()) or {}
    errors: list[str] = []
    if data.get("schema_version") != "rprint.hazop/v1":
        errors.append("bad schema_version")
    if data.get("guide_words") != GUIDE_WORDS:
        errors.append("guide_words do not match the 15-word vocabulary")
    findings = {row["id"] for row in
                (yaml.safe_load(FINDINGS.read_text()) or {}).get("findings", [])}
    improvements = {row["id"] for row in
                    (yaml.safe_load(IMPROVEMENTS.read_text()) or {}).get("items", [])}
    nodes = data.get("nodes") or []
    node_by_id = {node.get("id"): node for node in nodes}
    for node in nodes:
        for field in ("id", "title", "intent", "parameters", "na_default"):
            if not node.get(field):
                errors.append(f"node {node.get('id')}: missing {field}")
    rows = data.get("rows") or []
    row_by_id: dict[str, dict] = {}
    for row in rows:
        rid = str(row.get("id", ""))
        if not HZ.match(rid):
            errors.append(f"bad row id {rid!r}")
        if rid in row_by_id:
            errors.append(f"duplicate row {rid}")
        row_by_id[rid] = row
        node = node_by_id.get(row.get("node"))
        if node is None:
            errors.append(f"{rid}: unknown node {row.get('node')!r}")
        elif row.get("parameter") not in node.get("parameters", []):
            errors.append(f"{rid}: parameter {row.get('parameter')!r} not on node")
        if row.get("guide_word") not in GUIDE_WORDS:
            errors.append(f"{rid}: bad guide word")
        for field in ("deviation", "cause", "consequence", "safeguard", "action"):
            if not row.get(field):
                errors.append(f"{rid}: missing {field}")
        if row.get("safeguard_status") not in SAFEGUARDS:
            errors.append(f"{rid}: bad safeguard status")
        if row.get("severity") not in SEVERITY:
            errors.append(f"{rid}: bad severity")
        if row.get("likelihood") not in LIKELIHOOD:
            errors.append(f"{rid}: bad likelihood")
        expected = SEVERITY.get(row.get("severity"), 0) * LIKELIHOOD.get(row.get("likelihood"), 0)
        if row.get("risk") != expected:
            errors.append(f"{rid}: risk {row.get('risk')} != {expected}")
        action = str(row.get("action", ""))
        if action not in {"none", "accept-risk"} and not IMP.match(action):
            errors.append(f"{rid}: bad action {action!r}")
        if IMP.match(action) and action not in improvements:
            errors.append(f"{rid}: unknown improvement {action}")
        finding = str(row.get("finding", "-"))
        if finding != "-" and finding not in findings:
            errors.append(f"{rid}: unknown finding {finding}")
        if row.get("safeguard_status") in {"partial", "none"} and action == "none":
            errors.append(f"{rid}: partial/no safeguard without an action")
        if row.get("negative"):
            if row.get("safeguard_status") != "holds":
                errors.append(f"{rid}: negative row without a holding safeguard")
            if row.get("disposition") != "no-finding":
                errors.append(f"{rid}: negative row disposition is not no-finding")
        elif row.get("disposition") == "no-finding":
            errors.append(f"{rid}: positive row marked no-finding")
        if row.get("disposition") not in DISPOSITIONS:
            errors.append(f"{rid}: bad disposition")

    coverage = data.get("coverage") or []
    cells: dict[tuple[str, str], dict] = {}
    referenced: set[str] = set()
    for cell in coverage:
        key = (cell.get("node"), cell.get("guide_word"))
        if key in cells:
            errors.append(f"coverage duplicate {key}")
        cells[key] = cell
        if key[0] not in node_by_id or key[1] not in GUIDE_WORDS:
            errors.append(f"coverage unknown cell {key}")
        status = cell.get("status")
        if status == "na":
            if not (cell.get("reason") or node_by_id.get(key[0], {}).get("na_default")):
                errors.append(f"coverage {key}: na without a reason")
        elif status == "covered":
            refs = cell.get("refs") or []
            if not refs:
                errors.append(f"coverage {key}: covered without refs")
            for ref in refs:
                referenced.add(ref)
                row = row_by_id.get(ref)
                if row is None:
                    errors.append(f"coverage {key}: unknown row {ref}")
                elif (row.get("node"), row.get("guide_word")) != key:
                    errors.append(f"coverage {key}: row {ref} is "
                                  f"{row.get('node')}/{row.get('guide_word')}")
        else:
            errors.append(f"coverage {key}: bad status {status!r}")
    for node_id, node in node_by_id.items():
        for word in GUIDE_WORDS:
            if (node_id, word) not in cells and not node.get("na_default"):
                errors.append(f"coverage missing {node_id}/{word}")
    for rid in row_by_id:
        if rid not in referenced:
            errors.append(f"row {rid} is not referenced by coverage")
    if sum(1 for row in rows if row.get("negative")) < 12:
        errors.append("fewer than 12 negative rows")

    if errors:
        for error in errors:
            print(f"check_hazop: {error}", file=sys.stderr)
        print(f"check_hazop: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"check_hazop: {len(nodes)} node(s), {len(rows)} row(s), "
          f"{sum(1 for row in rows if row.get('negative'))} negative, "
          f"{len(cells)} explicit coverage cell(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
