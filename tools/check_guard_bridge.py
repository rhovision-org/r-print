#!/usr/bin/env python3
"""Check the decision-table bridge for the cornerstone mutating arms.

For every deployed mutating arm in the seven cornerstone deploy terms plus the
r-sure/r-gen adapters:

* the arm is declared in `spec/guards/arms.yaml`;
* every source atom in the row appears in the deployed Rholang;
* every refusal atom in the source is mapped by a row or a shared atom;
* `modeled_atoms` and `unmodelled_atoms` partition `atoms`;
* `proved` rows have no unmodelled atom, `partial` rows carry a note, and
  `owed` rows carry a note and `guard_eq: owed`;
* a non-owed `guard_eq` names a theorem in `ArmGuards.lean`;
* the flow manifest carries the same `cell` and `guard_eq`.

This is a drift check, not a semantics-preserving extraction. The guard
theorems are about the shallow Lean model, not the deployed Rholang.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
GUARDS = ROOT / "spec" / "guards" / "arms.yaml"
CORE = ROOT / "spec" / "flows" / "core.yaml"
ARM_GUARDS = ROOT / "spec" / "lean" / "RPrint" / "ArmGuards.lean"

SOURCE_GLOBS = [
    "contracts/src/deploy/10_publication.rho",
    "contracts/src/deploy/11_publication_cell.rho",
    "contracts/src/deploy/20_commission.rho",
    "contracts/src/deploy/21_commission_escrow.rho",
    "contracts/src/deploy/30_article.rho",
    "contracts/src/deploy/31_edition.rho",
    "contracts/src/deploy/05_rgen.rho",
    "contracts/src/deploy/06_rsure.rho",
]
HELPERS = {"AdminGuard", "Codec", "Clock", "Terms", "Verifier", "PurseKeeper"}
STATUSES = {"proved", "partial", "owed"}
ARM_RE = re.compile(
    r'contract\s+([A-Za-z0-9_]+)\s*\(\s*@"([^"]+)"([^=]*?)\)\s*=', re.S)
REFUSAL_RE = re.compile(r'\(false,\s*"([^"]+)"')
MUTATING_RE = re.compile(r'\b(dId\d*|opId\d*|nonce\d*|sigs\d*|expectedVersion)\b')
THEOREM_RE = re.compile(r'^\s*theorem\s+([A-Za-z0-9_]+)', re.M)


def norm(text: str) -> str:
    return " ".join(text.split())


def source_text(rel: str) -> str:
    return (ROOT / rel).read_text()


def deployed() -> dict[str, tuple[str, str, str]]:
    arms: dict[str, tuple[str, str, str]] = {}
    for rel in SOURCE_GLOBS:
        text = source_text(rel)
        for match in ARM_RE.finditer(text):
            contract, arm, signature = match.groups()
            if contract in HELPERS:
                continue
            if contract == "PublicationCellFactory" and arm == "spawn":
                continue
            if not MUTATING_RE.search(signature):
                continue
            arms[f'{contract}@"{arm}"'] = (rel, contract, arm)
    return arms


def flow_rules() -> dict[str, dict]:
    doc = yaml.safe_load(CORE.read_text()) or {}
    return {rule["arm"]: rule for rule in doc.get("rules", []) if rule.get("arm")}


def main() -> int:
    if not GUARDS.is_file():
        print(f"check-guard-bridge: missing {GUARDS.relative_to(ROOT)}", file=sys.stderr)
        return 1
    config = yaml.safe_load(GUARDS.read_text()) or {}
    if config.get("schema") != "rprint.guards/v1":
        print("check-guard-bridge: wrong schema", file=sys.stderr)
        return 1

    entries = config.get("arms") or []
    shared = config.get("shared_atoms") or {}
    deployed_arms = deployed()
    rules = flow_rules()
    lean_text = ARM_GUARDS.read_text() if ARM_GUARDS.is_file() else ""
    theorems = set(THEOREM_RE.findall(lean_text))

    errors: list[str] = []
    warnings: list[str] = []
    seen: set[str] = set()
    entry_by_source: dict[str, list[dict]] = {}
    counts = {status: 0 for status in STATUSES}

    for entry in entries:
        arm_id = entry.get("id", "<unnamed>")
        contract = entry.get("contract", "")
        arm = entry.get("arm", "")
        key = f'{contract}@"{arm}"'
        for field in ("id", "source", "contract", "arm", "cell", "status",
                      "guard_eq", "atoms", "modeled_atoms", "unmodelled_atoms"):
            if field not in entry:
                errors.append(f"{arm_id}: missing {field}")
        if key in seen:
            errors.append(f"{arm_id}: duplicate arm {key}")
        seen.add(key)
        source = str(entry.get("source", ""))
        if source not in SOURCE_GLOBS:
            errors.append(f"{arm_id}: source outside the cornerstone scope: {source!r}")
            continue
        if not (ROOT / source).is_file():
            errors.append(f"{arm_id}: missing source {source}")
            continue
        if key not in deployed_arms:
            errors.append(f"{arm_id}: {key} is not a deployed mutating arm")
            continue
        if deployed_arms[key][0] != source:
            errors.append(
                f"{arm_id}: {key} is deployed in {deployed_arms[key][0]}, not {source}")
        entry_by_source.setdefault(source, []).append(entry)

        status = entry.get("status")
        if status not in STATUSES:
            errors.append(f"{arm_id}: bad status {status!r}")
            continue
        counts[status] += 1
        atoms = list(entry.get("atoms") or [])
        modeled = list(entry.get("modeled_atoms") or [])
        unmodelled = list(entry.get("unmodelled_atoms") or [])
        text = norm(source_text(source))
        for atom in atoms:
            if norm(str(atom)) not in text:
                errors.append(f"{arm_id}: atom not found in {source}: {atom!r}")
        if set(modeled) | set(unmodelled) != set(atoms):
            errors.append(f"{arm_id}: modeled/unmodelled atoms do not partition atoms")
        if set(modeled) & set(unmodelled):
            errors.append(f"{arm_id}: atom is both modeled and unmodelled")
        if status == "proved" and unmodelled:
            errors.append(f"{arm_id}: proved row has unmodelled atoms")
        if status == "partial" and not (modeled and unmodelled):
            errors.append(f"{arm_id}: partial row needs modeled and unmodelled atoms")
        if status in {"partial", "owed"} and not entry.get("note"):
            errors.append(f"{arm_id}: {status} row needs a note")
        guard_eq = str(entry.get("guard_eq", "owed"))
        if status == "owed" and guard_eq != "owed":
            errors.append(f"{arm_id}: owed row must use guard_eq: owed")
        if status != "owed":
            if guard_eq == "owed":
                errors.append(f"{arm_id}: {status} row has no guard_eq")
            elif guard_eq.rsplit(".", 1)[-1] not in theorems:
                errors.append(f"{arm_id}: guard_eq {guard_eq} not found in ArmGuards.lean")

        rule = rules.get(key)
        if rule is None:
            errors.append(f"{arm_id}: no flow rule for {key}")
        else:
            if rule.get("guard_eq") != guard_eq:
                errors.append(
                    f"{arm_id}: flow guard_eq {rule.get('guard_eq')!r} != {guard_eq!r}")
            if rule.get("cell") != entry.get("cell"):
                errors.append(
                    f"{arm_id}: flow cell {rule.get('cell')!r} != {entry.get('cell')!r}")

    for key in sorted(set(deployed_arms) - seen):
        errors.append(f"deployed mutating arm missing from guards: {key}")

    for rel in SOURCE_GLOBS:
        text = source_text(rel)
        mapped = set(shared.get(rel) or [])
        for entry in entry_by_source.get(rel, []):
            mapped |= set(entry.get("atoms") or [])
        for atom in sorted(set(REFUSAL_RE.findall(text)) - mapped):
            errors.append(f"{rel}: refusal atom not mapped: {atom!r}")
        for atom in shared.get(rel) or []:
            if norm(str(atom)) not in norm(text):
                errors.append(f"{rel}: shared atom not found: {atom!r}")

    for error in errors:
        print(f"check-guard-bridge: {error}", file=sys.stderr)
    if errors:
        print(f"check-guard-bridge: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"check-guard-bridge: {len(entries)} arm(s) "
          f"(proved {counts['proved']}, partial {counts['partial']}, "
          f"owed {counts['owed']}), {len(deployed_arms)} mutating arms derived")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
