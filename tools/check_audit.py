#!/usr/bin/env python3
"""Check the findings ledger and the improvement plan against each other.

The review is an internal maintainer review, not an independent audit. This
gate rejects a finding without evidence, a risk that does not equal severity ×
likelihood, an action or finding reference that does not resolve, and an
improvement item whose files do not exist.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
FINDINGS = ROOT / "spec" / "audit" / "findings.yaml"
IMPROVEMENTS = ROOT / "spec" / "audit" / "improvement-plan.yaml"

SEVERITY = {"S1": 4, "S2": 3, "S3": 2, "S4": 1}
LIKELIHOOD = {"A": 4, "B": 3, "C": 2, "D": 1}
PRIORITIES = {"P0", "P1", "P2"}
VERDICTS = {"proved", "proved-but-narrower", "unproved", "overclaim", "false", "fixed"}
DISPOSITIONS = {"open", "accepted", "fixed", "accept-risk", "rejected"}
STATUSES = {"proposed", "accepted", "partial", "fixed", "rejected", "accept-risk"}
RPA = re.compile(r'^RPA-\d{3}$')
IMP = re.compile(r'^IMP-\d{3}$')


def ref_path(ref: str) -> Path:
    if ":" in ref and ref.rsplit(":", 1)[1].isdigit():
        ref = ref.rsplit(":", 1)[0]
    return ROOT / ref


def main() -> int:
    findings = yaml.safe_load(FINDINGS.read_text()) or {}
    improvements = yaml.safe_load(IMPROVEMENTS.read_text()) or {}
    errors: list[str] = []

    if findings.get("schema_version") != "rprint.audit/v1":
        errors.append("findings: bad schema_version")
    review = findings.get("review") or {}
    for field in ("status", "date", "reviewers", "independence", "scope"):
        if not review.get(field):
            errors.append(f"findings.review: missing {field}")
    if "independent" in str(review.get("independence", "")).lower() and "not" not in str(
            review.get("independence", "")).lower() and "outstanding" not in str(
            review.get("independence", "")).lower():
        errors.append("findings.review: independence must state that independent review is outstanding")

    if improvements.get("schema_version") != "rprint.improvements/v1":
        errors.append("improvements: bad schema_version")
    items = improvements.get("items") or []
    imp_ids: set[str] = set()
    for item in items:
        iid = str(item.get("id", ""))
        if not IMP.match(iid):
            errors.append(f"improvements: bad id {iid!r}")
        if iid in imp_ids:
            errors.append(f"improvements: duplicate {iid}")
        imp_ids.add(iid)
        if item.get("priority") not in PRIORITIES:
            errors.append(f"{iid}: bad priority")
        if item.get("status") not in STATUSES:
            errors.append(f"{iid}: bad status")
        for field in ("title", "compatibility", "tests", "action"):
            if not item.get(field):
                errors.append(f"{iid}: missing {field}")
        for entry in item.get("files") or []:
            path = entry.get("path", "")
            if not (ROOT / path).is_file():
                errors.append(f"{iid}: missing file {path}")
            for field in ("function", "lines"):
                if not entry.get(field):
                    errors.append(f"{iid}: {path} missing {field}")

    rows = findings.get("findings") or []
    seen: set[str] = set()
    finding_ids: set[str] = set()
    for row in rows:
        fid = str(row.get("id", ""))
        if not RPA.match(fid):
            errors.append(f"findings: bad id {fid!r}")
        if fid in seen:
            errors.append(f"findings: duplicate {fid}")
        seen.add(fid)
        finding_ids.add(fid)
        for field in ("title", "severity", "likelihood", "risk", "priority",
                      "category", "evidence", "claim", "verdict", "arms",
                      "actions", "disposition", "note"):
            if field not in row:
                errors.append(f"{fid}: missing {field}")
        if row.get("severity") not in SEVERITY:
            errors.append(f"{fid}: bad severity")
        if row.get("likelihood") not in LIKELIHOOD:
            errors.append(f"{fid}: bad likelihood")
        expected = SEVERITY.get(row.get("severity"), 0) * LIKELIHOOD.get(row.get("likelihood"), 0)
        if row.get("risk") != expected:
            errors.append(f"{fid}: risk {row.get('risk')} != {expected}")
        if row.get("priority") not in PRIORITIES:
            errors.append(f"{fid}: bad priority")
        if row.get("verdict") not in VERDICTS:
            errors.append(f"{fid}: bad verdict")
        if row.get("disposition") not in DISPOSITIONS:
            errors.append(f"{fid}: bad disposition")
        if not row.get("evidence"):
            errors.append(f"{fid}: no evidence")
        for evidence in row.get("evidence") or []:
            if not ref_path(str(evidence)).exists():
                errors.append(f"{fid}: evidence does not exist: {evidence}")
        for action in row.get("actions") or []:
            if action not in {"-", "accept-risk"} and action not in imp_ids:
                errors.append(f"{fid}: unknown action {action!r}")

    for item in items:
        finding = item.get("finding", "-")
        if finding not in {"-"} and finding not in finding_ids:
            errors.append(f"{item.get('id')}: unknown finding {finding}")
    for fid in finding_ids:
        row = next(item for item in rows if item.get("id") == fid)
        actions = [action for action in row.get("actions") or [] if action.startswith("IMP-")]
        if actions and not any(item.get("finding") == fid for item in items):
            errors.append(f"{fid}: action names an improvement item but none points back")

    if errors:
        for error in errors:
            print(f"check_audit: {error}", file=sys.stderr)
        print(f"check_audit: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"check_audit: {len(rows)} finding(s), {len(items)} improvement item(s), "
          f"review {review.get('status')!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
