#!/usr/bin/env python3
"""Check the rigor ledger against the Lean model, the boundary and the docs.

The ledger is only useful if it cannot silently drift. This gate checks:

* all 26 invariants have exactly one coverage row;
* every `Invariants.lean` alias points at a theorem and appears once;
* every boundary field has exactly one assumption row, and vice versa;
* every material divergence names a roadmap closure;
* every claim names an existing source and a theorem, or an explicit
  mechanism/assumption/design/scope status.

It is a traceability gate, not a refinement proof.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
RIGOR = ROOT / "spec" / "proofs" / "rigor.yaml"
SYSTEM = ROOT / "spec" / "lean" / "RPrint" / "Model" / "System.lean"
INVARIANTS = ROOT / "spec" / "lean" / "RPrint" / "Invariants.lean"
LEAN = ROOT / "spec" / "lean"
FLOWS = ROOT / "spec" / "flows" / "core.yaml"
VECTORS = ROOT / "spec" / "vectors" / "lean.json"

COVERAGE = {"proved", "proved-but-narrower", "partial", "mechanism", "assumption",
            "design", "scope"}
VERDICTS = {"proved", "proved-but-narrower", "partial", "mechanism", "assumption",
            "measured", "recorded", "design", "scope"}
DIRECTIONS = {"model-permissive", "model-stricter", "effect-omitting",
              "shape-different", "mixed"}
DIV_STATUS = {"resolved", "justified", "material"}
PRIORITIES = {"P0", "P1", "P2"}
ROADMAP_STATUS = {"done", "proposed", "accepted", "fixed", "rejected", "risk-accepted"}
ALIAS_RE = re.compile(r'^\s*def\s+(I\d+_[A-Za-z0-9_]+)\s*:=\s*@([A-Za-z0-9_.]+)', re.M)
DECL_RE = re.compile(r'^\s*(?:theorem|lemma)\s+([A-Za-z0-9_\']+)', re.M)
ALL_DECL_RE = re.compile(r'^\s*(?:theorem|lemma|def|structure|inductive)\s+([A-Za-z0-9_\']+)', re.M)


def lean_theorems() -> set[str]:
    names: set[str] = set()
    for path in LEAN.rglob("*.lean"):
        if ".lake" in path.parts:
            continue
        names.update(DECL_RE.findall(path.read_text()))
    return names


def lean_declarations() -> set[str]:
    names: set[str] = set()
    for path in LEAN.rglob("*.lean"):
        if ".lake" in path.parts:
            continue
        names.update(ALL_DECL_RE.findall(path.read_text()))
    return names


def boundary_fields() -> set[str]:
    text = SYSTEM.read_text()
    match = re.search(r'structure Boundary where(.*?)deriving', text, re.S)
    if not match:
        return set()
    return set(re.findall(r'^\s+([A-Za-z0-9_]+)\s*:\s*Bool', match.group(1), re.M))


def norm(text: str) -> str:
    return " ".join(text.split())


def main() -> int:
    data = yaml.safe_load(RIGOR.read_text()) or {}
    errors: list[str] = []
    if data.get("schema_version") != "rprint.rigor/v1":
        errors.append("bad schema_version")
    theorems = lean_theorems()
    declarations = lean_declarations()
    boundary = boundary_fields()
    aliases = dict(ALIAS_RE.findall(INVARIANTS.read_text()))

    coverage = data.get("coverage") or []
    seen_invariants: dict[str, int] = {}
    alias_uses: dict[str, int] = {}
    for row in coverage:
        iid = str(row.get("invariant", ""))
        seen_invariants[iid] = seen_invariants.get(iid, 0) + 1
        status = row.get("status")
        if status not in COVERAGE:
            errors.append(f"{row.get('id')}: bad status {status!r}")
        for theorem in row.get("theorems") or []:
            if theorem.rsplit(".", 1)[-1] not in theorems:
                errors.append(f"{row.get('id')}: theorem {theorem} not found")
        for alias in row.get("aliases") or []:
            alias_uses[alias] = alias_uses.get(alias, 0) + 1
            if alias not in aliases:
                errors.append(f"{row.get('id')}: alias {alias} not in Invariants.lean")
        for evidence in row.get("evidence") or []:
            if not (ROOT / evidence).exists():
                errors.append(f"{row.get('id')}: missing evidence {evidence}")
    for number in range(1, 27):
        key = f"I{number}"
        if seen_invariants.get(key, 0) != 1:
            errors.append(f"{key}: {seen_invariants.get(key, 0)} coverage rows")
    for alias, target in aliases.items():
        if target.rsplit(".", 1)[-1] not in theorems:
            errors.append(f"alias {alias}: target {target} is not a theorem")
        if alias_uses.get(alias, 0) != 1:
            errors.append(f"alias {alias}: used {alias_uses.get(alias, 0)} times")
    for alias in alias_uses:
        if alias not in aliases:
            errors.append(f"coverage alias {alias} is not in Invariants.lean")

    assumptions = data.get("assumptions") or []
    seen_boundary: dict[str, int] = {}
    for row in assumptions:
        aid = str(row.get("id", ""))
        boundary_name = str(row.get("boundary", ""))
        if boundary_name in boundary:
            seen_boundary[boundary_name] = seen_boundary.get(boundary_name, 0) + 1
        elif boundary_name != "client":
            errors.append(f"{aid}: boundary {boundary_name!r} is not a Boundary field")
        if not row.get("statement"):
            errors.append(f"{aid}: missing statement")
        for evidence in row.get("evidence") or []:
            if not (ROOT / evidence).exists():
                errors.append(f"{aid}: missing evidence {evidence}")
    for field in sorted(boundary):
        if seen_boundary.get(field, 0) != 1:
            errors.append(f"boundary {field}: {seen_boundary.get(field, 0)} assumption rows")
    if sum(1 for row in assumptions if row.get("boundary") == "client") != 3:
        errors.append("client assumptions: expected exactly 3")

    roadmap = data.get("roadmap") or []
    roadmap_ids = {str(row.get("id")) for row in roadmap}
    for row in roadmap:
        if row.get("priority") not in PRIORITIES:
            errors.append(f"{row.get('id')}: bad priority")
        if row.get("status") not in ROADMAP_STATUS:
            errors.append(f"{row.get('id')}: bad status")

    divergences = data.get("divergences") or []
    div_ids: set[str] = set()
    for row in divergences:
        did = str(row.get("id", ""))
        div_ids.add(did)
        if row.get("status") not in DIV_STATUS:
            errors.append(f"{did}: bad status")
        if row.get("direction") not in DIRECTIONS:
            errors.append(f"{did}: bad direction")
        if not row.get("justification"):
            errors.append(f"{did}: missing justification")
        model_decl = str(row.get("model_decl", "")).rsplit(".", 1)[-1]
        if model_decl not in declarations:
            errors.append(f"{did}: model decl {row.get('model_decl')} not found")
        deployed = str(row.get("deployed", ""))
        path = deployed.rsplit(":", 1)[0] if ":" in deployed else deployed
        if not (ROOT / path).is_file():
            errors.append(f"{did}: missing deployed source {path}")
        if row.get("status") == "material" and row.get("closure") not in roadmap_ids:
            errors.append(f"{did}: material divergence has no roadmap closure")
    for row in roadmap:
        for finding in row.get("findings") or []:
            if finding not in div_ids:
                errors.append(f"{row.get('id')}: unknown divergence {finding}")

    claims = data.get("claims") or []
    seen_claims: set[str] = set()
    for row in claims:
        cid = str(row.get("id", ""))
        if cid in seen_claims:
            errors.append(f"{cid}: duplicate claim")
        seen_claims.add(cid)
        source = ROOT / str(row.get("source", ""))
        if not source.is_file():
            errors.append(f"{cid}: missing source {row.get('source')}")
        elif norm(str(row.get("claim", ""))) not in norm(source.read_text()):
            errors.append(f"{cid}: claim text not found in {row.get('source')}")
        verdict = row.get("verdict")
        if verdict not in VERDICTS:
            errors.append(f"{cid}: bad verdict {verdict!r}")
            continue
        theorem_list = row.get("theorems") or []
        for theorem in theorem_list:
            if theorem.rsplit(".", 1)[-1] not in theorems:
                errors.append(f"{cid}: theorem {theorem} not found")
        if verdict == "proved" and (not theorem_list or row.get("gap")):
            errors.append(f"{cid}: proved needs theorems and no gap")
        if verdict in {"proved-but-narrower", "partial"} and (
                not theorem_list or not row.get("gap")):
            errors.append(f"{cid}: {verdict} needs a theorem and a gap")
        if verdict in {"mechanism", "assumption", "design"} and not (
                row.get("evidence") and row.get("note")):
            errors.append(f"{cid}: {verdict} needs evidence and a note")
        if verdict in {"scope", "recorded"} and not row.get("evidence"):
            errors.append(f"{cid}: {verdict} needs evidence")
        if verdict == "measured" and not row.get("counts"):
            errors.append(f"{cid}: measured needs counts")

    if errors:
        for error in errors:
            print(f"check_rigor: {error}", file=sys.stderr)
        print(f"check_rigor: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"check_rigor: {len(coverage)} coverage row(s), "
          f"{len(claims)} claim(s), {len(assumptions)} assumption(s), "
          f"{len(divergences)} divergence(s), {len(roadmap)} roadmap item(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
