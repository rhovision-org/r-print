#!/usr/bin/env python3
"""Check the close-out ledger against the findings ledger.

A P0/P1 finding is closed only when the close-out ledger carries exactly one
terminal decision for it. A fixed row must name evidence that exists; a
risk-accepted row must carry a rationale, an owner and a future expiry.
"""

from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
FINDINGS = ROOT / "spec" / "audit" / "findings.yaml"
CLOSEOUT = ROOT / "spec" / "audit" / "closeout.yaml"
TERMINAL = {"fixed", "risk-accepted", "narrowed-claim"}
FINDING_DECISION = {"fixed": "fixed", "accept-risk": "risk-accepted"}


def ref_path(ref: str) -> Path:
    if ":" in ref and ref.rsplit(":", 1)[1].isdigit():
        ref = ref.rsplit(":", 1)[0]
    return ROOT / ref


def main() -> int:
    findings = {row["id"]: row for row in
                (yaml.safe_load(FINDINGS.read_text()) or {}).get("findings", [])}
    closeout = yaml.safe_load(CLOSEOUT.read_text()) or {}
    errors: list[str] = []
    if closeout.get("schema_version") != "rprint.closeout/v1":
        errors.append("closeout: bad schema_version")
    seen: set[str] = set()
    for row in closeout.get("items") or []:
        rid = row.get("id")
        if not rid:
            errors.append("closeout: row without id")
            continue
        if rid in seen:
            errors.append(f"{rid}: duplicate row")
        seen.add(rid)
        finding = findings.get(rid)
        if finding is None:
            errors.append(f"{rid}: no such finding")
            continue
        decision = row.get("decision")
        if decision not in TERMINAL:
            errors.append(f"{rid}: non-terminal decision {decision!r}")
            continue
        expected = FINDING_DECISION.get(finding.get("disposition"))
        if expected and decision != expected:
            errors.append(f"{rid}: decision {decision!r} disagrees with disposition "
                          f"{finding.get('disposition')!r}")
        evidence = row.get("evidence") or []
        if not evidence:
            errors.append(f"{rid}: no evidence")
        kinds = set()
        for item in evidence:
            ref = item.get("ref")
            if not ref:
                errors.append(f"{rid}: evidence without ref")
                continue
            kinds.add(item.get("kind", "code"))
            if not ref_path(str(ref)).exists():
                errors.append(f"{rid}: evidence does not exist: {ref}")
        if decision == "fixed" and not (kinds & {"test", "theorem", "gate", "doc"}):
            errors.append(f"{rid}: fixed row has no test/theorem/gate/doc evidence")
        if decision == "risk-accepted":
            for field in ("rationale", "owner", "expiry"):
                if not row.get(field):
                    errors.append(f"{rid}: risk-accepted row lacks {field}")
            expiry = row.get("expiry")
            if expiry:
                try:
                    when = dt.date.fromisoformat(str(expiry))
                except ValueError:
                    errors.append(f"{rid}: bad expiry {expiry!r}")
                else:
                    if when <= dt.date.today():
                        errors.append(f"{rid}: risk acceptance expired on {when}")
        if decision == "narrowed-claim" and not row.get("rationale"):
            errors.append(f"{rid}: narrowed-claim row lacks rationale")

    for fid, finding in findings.items():
        if finding.get("priority") in {"P0", "P1"} and fid not in seen:
            errors.append(f"{fid}: P0/P1 finding has no close-out row")

    if errors:
        for error in errors:
            print(f"check_closeout: {error}", file=sys.stderr)
        print(f"check_closeout: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"check_closeout: {len(seen)} row(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
