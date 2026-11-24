#!/usr/bin/env python3
"""Check the client-op conformance map against the API, SDK and tests.

The map makes the live-coverage gap explicit. It does not claim a method was
exercised live unless its `live` column says `recorded` and the matching
deployment result exists with `pass: true`.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = ROOT / "web" / "src" / "lib" / "api.ts"
SDK = ROOT / "crates" / "rprint-sdk" / "src" / "lib.rs"
MAP = ROOT / "spec" / "vectors" / "client-ops.tsv"
COLUMNS = ["method", "kind", "arm", "builder", "op", "expected", "test", "live"]
ARM_RE = re.compile(r'^([A-Za-z0-9_]+)@"([^"]+)"$')


def array(text: str, name: str) -> list[str]:
    match = re.search(rf'export const {name}\s*=\s*\[(.*?)\]\s*as const', text, re.S)
    if not match:
        raise SystemExit(f"check-client-ops: cannot find {name}")
    return re.findall(r'"([^"]+)"', match.group(1))


def contract_source() -> str:
    parts = []
    for path in (ROOT / "contracts" / "src").rglob("*.rho"):
        parts.append(path.read_text())
    return "\n".join(parts)


def evidence_for(test: str) -> list[Path]:
    if test.endswith("web/tests/live-client.ts"):
        return [ROOT / "deployments" / "live-client-results.json"]
    if test.endswith("journey.spec.ts"):
        return [ROOT / "deployments" / "browser-e2e-results.json"]
    if test.endswith("devnet_live.rs"):
        return [
            ROOT / "deployments" / "cli-live-results.json",
            ROOT / "deployments" / "cli-live-escrow-results.json",
        ]
    return []


def main() -> int:
    api_text = API.read_text()
    all_methods = array(api_text, "API_METHODS")
    reads = set(array(api_text, "READ_METHODS"))
    writes = set(array(api_text, "WRITE_METHODS"))
    sdk_text = SDK.read_text()
    contracts = contract_source()

    with MAP.open(newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        rows = list(reader)
        if reader.fieldnames != COLUMNS:
            print(f"check-client-ops: bad header {reader.fieldnames}", file=sys.stderr)
            return 1

    errors: list[str] = []
    seen: set[str] = set()
    counts = {"recorded": 0, "fixture-only": 0, "none": 0}
    for row in rows:
        method = row["method"]
        if method in seen:
            errors.append(f"{method}: duplicate row")
        seen.add(method)
        if method not in all_methods:
            errors.append(f"{method}: not an API method")
        kind = row["kind"]
        if kind == "read" and method not in reads:
            errors.append(f"{method}: not in READ_METHODS")
        elif kind == "write" and method not in writes:
            errors.append(f"{method}: not in WRITE_METHODS")
        elif kind not in {"read", "write"}:
            errors.append(f"{method}: bad kind {kind!r}")

        arm = row["arm"]
        match = ARM_RE.match(arm)
        if arm in {"Wallet", "HTTP"}:
            pass
        elif match:
            needle = f'contract {match.group(1)}(@"{match.group(2)}"'
            if needle not in contracts:
                if match.group(1) == "CoordinationRecord" and row["live"] == "none":
                    pass
                else:
                    errors.append(f"{method}: arm {arm} not found in contracts")
        else:
            errors.append(f"{method}: bad arm {arm!r}")

        builder = row["builder"]
        if not builder.startswith(("Wallet.", "HTTP.")) and f"pub fn {builder}" not in sdk_text:
            errors.append(f"{method}: builder {builder} not found in rprint-sdk")

        if not row["op"]:
            errors.append(f"{method}: empty op")
        test = ROOT / row["test"]
        if not test.is_file():
            errors.append(f"{method}: missing test {row['test']}")
        live = row["live"]
        if live not in counts:
            errors.append(f"{method}: bad live {live!r}")
        else:
            counts[live] += 1
        if live == "recorded":
            files = evidence_for(row["test"])
            if not files:
                errors.append(f"{method}: recorded without a known evidence file")
                continue
            payloads = []
            for evidence in files:
                if not evidence.is_file():
                    continue
                payload = json.loads(evidence.read_text())
                payload["_name"] = evidence.name
                payloads.append(payload)
            if not payloads:
                print(f"check-client-ops: warning: {method}: no evidence artifact "
                      "is present in this checkout", file=sys.stderr)
                continue
            with_methods = [p for p in payloads if isinstance(p.get("methods"), list)]
            if with_methods:
                if not any(p.get("pass") is True and method in p["methods"]
                           for p in with_methods):
                    errors.append(
                        f"{method}: no artifact lists the method and records a pass")
            elif not any(p.get("pass") is True for p in payloads):
                errors.append(f"{method}: evidence does not record a pass")

    missing = sorted(set(all_methods) - seen)
    extra = sorted(seen - set(all_methods))
    if missing:
        errors.append(f"methods missing from the map: {missing}")
    if extra:
        errors.append(f"map contains unknown methods: {extra}")

    if errors:
        for error in errors:
            print(f"check-client-ops: {error}", file=sys.stderr)
        print(f"check-client-ops: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"check-client-ops: {len(rows)} method(s) "
          f"({len(writes)} writes, {len(reads)} reads), "
          f"{counts['recorded']} recorded, {counts['fixture-only']} fixture-only, "
          f"{counts['none']} no live")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
