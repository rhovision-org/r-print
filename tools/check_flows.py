#!/usr/bin/env python3
"""Check the r-print flow manifest against source arms and the graph vocabulary."""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
FLOWS = ROOT / "spec" / "flows"
STATUSES = {"implemented", "surface", "design", "owed"}


def main() -> int:
    problems: list[str] = []
    rules: list[dict] = []
    for path in sorted(FLOWS.glob("*.yaml")):
        doc = yaml.safe_load(path.read_text())
        for glob in doc.get("source_globs", []):
            if not (ROOT / glob).exists():
                problems.append(f"{path.name}: missing source_glob {glob}")
        rules.extend(doc.get("rules", []))
    for rule in rules:
        status = rule.get("status", "owed")
        if status not in STATUSES:
            problems.append(f"{rule.get('id')}: unknown status {status}")
        source = ROOT / str(rule.get("source", ""))
        if not source.is_file():
            problems.append(f"{rule.get('id')}: missing source {rule.get('source')}")
            continue
        arm = rule.get("arm")
        if arm and status == "implemented":
            contract, _, name = arm.partition("@")
            name = name.strip('"')
            needle = f'contract {contract}(@"{name}"'
            if needle not in source.read_text():
                problems.append(f"{rule.get('id')}: arm {arm} not found in {source.name}")
    for problem in problems:
        print(f"check-flows: {problem}", file=sys.stderr)
    if problems:
        return 1
    counts = {status: sum(1 for r in rules if r.get("status", "owed") == status)
              for status in STATUSES}
    print(f"check-flows: {len(rules)} rules "
          f"(implemented {counts['implemented']}, surface {counts['surface']}, "
          f"design {counts['design']}, owed {counts['owed']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
