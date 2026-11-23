#!/usr/bin/env python3
"""Validate the named integration graph.

Every vertex has an owner and a kind. Every edge names a verb, endpoints and the arms it
crosses. Implemented and surface edges must point at a file in this repository; design
edges may point at a spec-only page.
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
GRAPH = ROOT / "spec" / "graph"
OWNERS = {"r-print", "r-cash", "r-gen", "r-sure", "byoid", "quantum-os"}
KINDS = {"cell", "record", "capability", "anchor", "offchain", "design"}
STATUSES = {"implemented", "surface", "design"}


def load(name: str) -> dict:
    path = GRAPH / name
    if not path.is_file():
        raise SystemExit(f"check-graph: missing {path}")
    return yaml.safe_load(path.read_text())


def main() -> int:
    vertices = load("vertices.yaml").get("vertices", {})
    edges = load("edges.yaml").get("edges", [])
    problems: list[str] = []

    for name, vertex in vertices.items():
        if vertex.get("owner") not in OWNERS:
            problems.append(f"vertex {name}: unknown owner {vertex.get('owner')!r}")
        if vertex.get("kind") not in KINDS:
            problems.append(f"vertex {name}: unknown kind {vertex.get('kind')!r}")
        if not vertex.get("description"):
            problems.append(f"vertex {name}: no description")

    seen: set[str] = set()
    counts = {status: 0 for status in STATUSES}
    for edge in edges:
        eid = edge.get("id")
        if not eid:
            problems.append("edge without id")
            continue
        if eid in seen:
            problems.append(f"duplicate edge id {eid}")
        seen.add(eid)
        if edge.get("from") not in vertices:
            problems.append(f"{eid}: unknown from {edge.get('from')!r}")
        if edge.get("to") not in vertices:
            problems.append(f"{eid}: unknown to {edge.get('to')!r}")
        status = edge.get("status")
        if status not in STATUSES:
            problems.append(f"{eid}: unknown status {status!r}")
        else:
            counts[status] += 1
        if not edge.get("verb"):
            problems.append(f"{eid}: no verb")
        source = ROOT / str(edge.get("source", ""))
        if status in {"implemented", "surface"}:
            if not source.is_file():
                problems.append(f"{eid}: missing source {edge.get('source')}")
                continue
            if edge["from"] == "article" or edge["to"] == "article" or str(source).endswith(".rho"):
                text = source.read_text() if source.suffix == ".rho" else ""
                for arm in edge.get("arms", []):
                    parts = arm.split(".")
                    if len(parts) == 2 and text:
                        contract, name = parts
                        if f"contract {contract}(" not in text:
                            continue  # external adapter or sibling arm; not defined here
                        needle = f'contract {contract}(@"{name}"'
                        if needle not in text:
                            problems.append(f"{eid}: arm {arm} not found in {source.name}")

    for problem in problems:
        print(f"check-graph: {problem}", file=sys.stderr)
    if problems:
        return 1
    print(f"check-graph: {len(vertices)} vertices, {len(edges)} edges "
          f"(implemented {counts['implemented']}, surface {counts['surface']}, "
          f"design {counts['design']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
