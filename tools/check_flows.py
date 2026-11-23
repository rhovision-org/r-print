#!/usr/bin/env python3
"""Check the r-print flow manifest against source arms, the graph vocabulary and
the Lean model.

The behavioural `status` (implemented/surface/design/owed) is unchanged. The
Lean fields are separate: `lean` names a declaration and `lean_status` says
whether the arm is proved-model, modeled, an assumption or owed. `--strict`
turns a `proved-model` target that is not a theorem into a failure.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
FLOWS = ROOT / "spec" / "flows"
LEAN = ROOT / "spec" / "lean"
STATUSES = {"implemented", "surface", "design", "owed"}
LEAN_STATUSES = {"proved-model", "proved-model-bounded", "modeled", "assumption",
                 "proved-tied", "owed"}
ARM_RE = re.compile(r"^(?P<contract>[A-Za-z0-9_]+)@\"(?P<arm>[^\"]+)\"$")
DECL_RE = re.compile(
    r"^[ \t]*(?:@\[[^\]]*\][ \t]*)*(theorem|lemma|def|inductive|structure)[ \t]+"
    r"([A-Za-z0-9_]+)",
    re.M,
)


def lean_declarations() -> tuple[set[str], dict[str, str]]:
    names: set[str] = set()
    kinds: dict[str, str] = {}
    for path in LEAN.rglob("*.lean"):
        if ".lake" in path.parts:
            continue
        text = path.read_text()
        for kind, name in DECL_RE.findall(text):
            names.add(name)
            if kind in {"theorem", "lemma"}:
                kinds[name] = "theorem"
            else:
                kinds.setdefault(name, kind)
        for match in re.finditer(r"^\s*\|\s*([A-Za-z0-9_]+)\s*:", text, re.M):
            names.add(match.group(1))
            kinds.setdefault(match.group(1), "constructor")
    return names, kinds


def check_lean_ref(where: str, node: dict, names: set[str], kinds: dict[str, str],
                   warnings: list[str], problems: list[str], strict: bool) -> None:
    status = node.get("lean_status", "owed")
    if status not in LEAN_STATUSES:
        problems.append(f"{where}: unknown lean_status {status}")
        return
    lean = node.get("lean")
    if status in {"proved-model", "proved-model-bounded"} and not lean:
        problems.append(f"{where}: {status} needs a lean target")
        return
    if status == "proved-tied" and not node.get("corpus"):
        problems.append(f"{where}: proved-tied needs a corpus")
    if not lean:
        return
    short = lean.rsplit(".", 1)[-1]
    if short not in names:
        problems.append(f"{where}: Lean name {lean} not found")
        return
    if status == "proved-model" and kinds.get(short) != "theorem":
        message = (f"{where}: proved-model target {lean} is a "
                   f"{kinds.get(short, 'declaration')}, not a theorem")
        warnings.append(message)
        if strict:
            problems.append(message)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true",
                    help="treat proved-model targets that are not theorems as failures")
    args = ap.parse_args(argv)

    problems: list[str] = []
    warnings: list[str] = []
    names, kinds = lean_declarations()
    rules: list[dict] = []
    for path in sorted(FLOWS.glob("*.yaml")):
        doc = yaml.safe_load(path.read_text())
        for glob in doc.get("source_globs", []):
            if not (ROOT / glob).exists():
                problems.append(f"{path.name}: missing source_glob {glob}")
        for key, value in (doc.get("invariants") or {}).items():
            if value.get("statement") and not value.get("lean_status"):
                problems.append(f"{path.name}: invariant {key} has no lean_status")
            check_lean_ref(f"{path.name}: invariant {key}", value, names, kinds,
                           warnings, problems, args.strict)
        rules.extend(doc.get("rules", []))

    arms: set[str] = set()
    for rule in rules:
        rule_id = rule.get("id")
        status = rule.get("status", "owed")
        if status not in STATUSES:
            problems.append(f"{rule_id}: unknown status {status}")
        check_lean_ref(f"{rule_id}", rule, names, kinds, warnings, problems, args.strict)
        arm = rule.get("arm")
        if not arm:
            continue
        match = ARM_RE.match(arm)
        if not match:
            problems.append(f"{rule_id}: bad arm {arm!r}")
            continue
        arms.add(arm)
        source = ROOT / str(rule.get("source", ""))
        if not source.is_file():
            problems.append(f"{rule_id}: missing source {rule.get('source')}")
            continue
        if status == "implemented":
            needle = f'contract {match.group("contract")}(@"{match.group("arm")}"'
            if needle not in source.read_text():
                problems.append(f"{rule_id}: arm {arm} not found in {source.name}")

    core: set[str] = set()
    for path in sorted(FLOWS.glob("*.yaml")):
        core.update(yaml.safe_load(path.read_text()).get("core_arms", []))
    for arm in core:
        if arm not in arms:
            problems.append(f"core arm missing from flows: {arm}")
        else:
            rule = next(r for r in rules if r.get("arm") == arm)
            if rule.get("lean_status") != "proved-model":
                problems.append(f"core arm not proved-model: {arm}")

    for warning in warnings:
        print(f"check-flows: warning: {warning}", file=sys.stderr)
    for problem in problems:
        print(f"check-flows: {problem}", file=sys.stderr)
    if problems:
        return 1
    counts = {status: sum(1 for r in rules if r.get("status", "owed") == status)
              for status in STATUSES}
    proved = sum(1 for r in rules if r.get("lean_status") == "proved-model")
    print(f"check-flows: {len(rules)} rules "
          f"(implemented {counts['implemented']}, surface {counts['surface']}, "
          f"design {counts['design']}, owed {counts['owed']}), "
          f"{len(arms)} arms, {len(core)} core arms proved-model, "
          f"{proved} proved-model rules, {len(warnings)} proof-quality warnings")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
