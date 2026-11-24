#!/usr/bin/env python3
"""Check that every deployed public arm is inventoried.

The gate derives every `contract X(@"arm"` from the deploy terms and requires
each one to appear in exactly one of:

* `spec/guards/arms.yaml` (the mutating cornerstone arms);
* `spec/flows/core.yaml` (the flow manifest);
* `spec/inventory/read-only.yaml` (read, operator and helper arms).

It also rejects an adapter arm that is still marked `owed`, because the sibling
read paths now have positive fixtures.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DEPLOY = ROOT / "contracts" / "src" / "deploy"
GUARDS = ROOT / "spec" / "guards" / "arms.yaml"
CORE = ROOT / "spec" / "flows" / "core.yaml"
INVENTORY = ROOT / "spec" / "inventory" / "read-only.yaml"
ARM_RE = re.compile(r'contract\s+([A-Za-z0-9_]+)\s*\(\s*@"([^"]+)"')


def deployed() -> dict[str, str]:
    arms: dict[str, str] = {}
    for path in sorted(DEPLOY.glob("*.rho")):
        text = path.read_text()
        for contract, arm in ARM_RE.findall(text):
            arms[f'{contract}@"{arm}"'] = path.relative_to(ROOT).as_posix()
    return arms


def main() -> int:
    arms = deployed()
    if not arms:
        print("check-arm-inventory: no deployed arms found", file=sys.stderr)
        return 1

    errors: list[str] = []
    guards = yaml.safe_load(GUARDS.read_text()) or {}
    guard_arms = {
        f'{row.get("contract")}@"{row.get("arm")}"'
        for row in guards.get("arms") or []
    }
    core = yaml.safe_load(CORE.read_text()) or {}
    core_arms = {
        row.get("arm")
        for row in core.get("rules") or []
        if row.get("arm") and row.get("status") != "design"
    }
    for row in core.get("rules") or []:
        if str(row.get("arm", "")).split("@")[0] in {"RgenAdapter", "RsureAdapter"}:
            if row.get("lean_status") == "owed":
                errors.append(f"{row.get('id')}: adapter arm is still owed")

    if not INVENTORY.is_file():
        errors.append(f"missing {INVENTORY.relative_to(ROOT)}")
        inventory_arms: set[str] = set()
    else:
        doc = yaml.safe_load(INVENTORY.read_text()) or {}
        if doc.get("schema") != "rprint.arm-inventory/v1":
            errors.append("inventory: bad schema")
        inventory_arms = {row.get("arm") for row in doc.get("rows") or [] if row.get("arm")}

    covered = guard_arms | core_arms | inventory_arms
    for key in sorted(set(arms) - covered):
        errors.append(f"{key}: deployed but not inventoried ({arms[key]})")
    for key in sorted(guard_arms - set(arms)):
        errors.append(f"{key}: guard row has no deployed arm")
    for key in sorted(core_arms - set(arms)):
        errors.append(f"{key}: flow row has no deployed arm")
    for key in sorted(inventory_arms - set(arms)):
        errors.append(f"{key}: inventory row has no deployed arm")
    for key in sorted(inventory_arms & (guard_arms | core_arms)):
        errors.append(f"{key}: inventory duplicates a guard or flow row")

    if errors:
        for error in errors:
            print(f"check-arm-inventory: {error}", file=sys.stderr)
        print(f"check-arm-inventory: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"check-arm-inventory: {len(arms)} deployed arm(s), "
          f"{len(guard_arms)} guard, {len(core_arms)} flow, "
          f"{len(inventory_arms)} inventory")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
