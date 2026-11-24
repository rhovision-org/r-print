#!/usr/bin/env python3
"""Check the declared state schemas against the docs and the deployed source.

This is a top-level map-shape gate, not a validator of caps or cross-field
invariants. For each state in `spec/schemas/states.yaml`:

* every required field is declared and the property partition is complete;
* the fenced block under the matching heading in `docs/reference/data-schemas.md`
  has the same top-level field set;
* every required field appears in the deployed initializer map or in a later
  `.set("field", ...)` call;
* the committed example validates against the declared top-level types.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
SCHEMAS = ROOT / "spec" / "schemas" / "states.yaml"
EXAMPLES = ROOT / "spec" / "schemas" / "examples"
DOCS = ROOT / "docs" / "reference" / "data-schemas.md"

TYPES = {"string", "int", "bool", "list", "map"}
ENTRY_RE = re.compile(r'^\s*"([^"]+)"\s*:')
BARE_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)\s*(?:\[\]|:|$)")


def top_level_keys(body: str) -> list[str]:
    """Return the keys of a Rholang-ish map body, ignoring nested maps."""
    start = body.find("{")
    if start < 0:
        return []
    depth = 0
    end = -1
    for index in range(start, len(body)):
        char = body[index]
        if char in "{[":
            depth += 1
        elif char in "}]":
            depth -= 1
            if depth == 0:
                end = index
                break
    if end < 0:
        return []
    inner = body[start + 1:end]
    entries: list[str] = []
    depth = 0
    mark = 0
    for index, char in enumerate(inner):
        if char in "{[":
            depth += 1
        elif char in "}]":
            depth -= 1
        elif char == "," and depth == 0:
            entries.append(inner[mark:index])
            mark = index + 1
    entries.append(inner[mark:])
    keys: list[str] = []
    for entry in entries:
        entry = entry.strip()
        if not entry:
            continue
        match = ENTRY_RE.match(entry) or BARE_RE.match(entry)
        if match:
            keys.append(match.group(1))
    return keys


def fenced_block(heading: str) -> str | None:
    text = DOCS.read_text()
    match = re.search(r"^##\s+" + re.escape(heading) + r"\s*$", text, re.M)
    if not match:
        return None
    fenced = re.search(r"```[^\n]*\n(.*?)```", text[match.end():], re.S)
    return fenced.group(1) if fenced else None


def initializer_keys(source: Path, anchor: str) -> set[str]:
    text = source.read_text()
    keys: set[str] = set()
    start = 0
    while True:
        index = text.find(anchor, start)
        if index < 0:
            return keys
        keys.update(top_level_keys(text[index + len(anchor):]))
        start = index + 1


def setter_keys(source: Path) -> set[str]:
    return set(re.findall(r'\.set\("([^"]+)"', source.read_text()))


def type_ok(value, expected: str) -> bool:
    if expected == "string":
        return isinstance(value, str)
    if expected == "int":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "bool":
        return isinstance(value, bool)
    if expected == "list":
        return isinstance(value, list)
    if expected == "map":
        return isinstance(value, dict)
    return False


def main() -> int:
    if not SCHEMAS.is_file():
        print(f"check-schemas: missing {SCHEMAS.relative_to(ROOT)}", file=sys.stderr)
        return 1
    config = yaml.safe_load(SCHEMAS.read_text()) or {}
    errors: list[str] = []
    if config.get("schema") != "rprint.schemas/v1":
        errors.append("bad schema")
    states = config.get("states") or {}
    if not states:
        errors.append("no states declared")

    examples = sorted(EXAMPLES.glob("*.json"))
    example_names = {path.stem for path in examples}
    expected_examples = set(states)
    for missing in sorted(expected_examples - example_names):
        errors.append(f"{missing}: missing example")
    for extra in sorted(example_names - expected_examples):
        errors.append(f"{extra}: example has no schema")

    for name, state in states.items():
        source = ROOT / str(state.get("source", ""))
        if not source.is_file():
            errors.append(f"{name}: missing source {state.get('source')}")
            continue
        required = list(state.get("required") or [])
        optional = list(state.get("optional") or [])
        properties = state.get("properties") or {}
        if not required:
            errors.append(f"{name}: no required fields")
        for field in required:
            if field not in properties:
                errors.append(f"{name}: required field {field} has no property")
        for field in properties:
            if field not in required and field not in optional:
                errors.append(f"{name}: property {field} is neither required nor optional")
        declared = set(required) | set(optional)
        if declared != set(properties):
            errors.append(f"{name}: required/optional does not partition properties")
        for field, spec in properties.items():
            if spec.get("type") not in TYPES:
                errors.append(f"{name}.{field}: bad type {spec.get('type')!r}")

        block = fenced_block(str(state.get("doc_heading", name)))
        if block is None:
            errors.append(f"{name}: no fenced doc block under {state.get('doc_heading')}")
        else:
            doc_keys = set(top_level_keys(block))
            if doc_keys != declared:
                errors.append(
                    f"{name}: doc keys {sorted(doc_keys)} != schema keys {sorted(declared)}")

        anchor = str(state.get("anchor", ""))
        if not anchor:
            errors.append(f"{name}: no initializer anchor")
            continue
        found = initializer_keys(source, anchor) | setter_keys(source)
        for field in required:
            if field not in found:
                errors.append(f"{name}: required field {field} not in {source.name}")

        example_path = EXAMPLES / f"{name}.json"
        if example_path.is_file():
            example = json.loads(example_path.read_text())
            for field in required:
                if field not in example:
                    errors.append(f"{name}: example missing {field}")
            for field, value in example.items():
                spec = properties.get(field)
                if spec is None:
                    errors.append(f"{name}: example has unknown field {field}")
                elif not type_ok(value, spec.get("type", "")):
                    errors.append(
                        f"{name}: example field {field} is not {spec.get('type')}")

    if errors:
        for error in errors:
            print(f"check-schemas: {error}", file=sys.stderr)
        print(f"check-schemas: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"check-schemas: {len(states)} state(s), {len(examples)} example(s), "
          "doc and source field sets agree")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
