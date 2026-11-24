#!/usr/bin/env python3
"""Check the capability register against the deployed source.

This is a source-to-register drift gate, not a Rholang semantics proof. It
checks every published bundle has exactly one row, every row names an authority
check, every atom appears in the source, and no capability is sent into a state
cell.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
REGISTER = ROOT / "spec" / "audit" / "capabilities.yaml"
SOURCE = ROOT / "contracts" / "src"

KINDS = {"published-contract", "private-name", "proof", "issuer", "factory",
         "registry-entry", "deployer-id", "ambient-system", "data-reference",
         "capability"}
EXPOSURES = {"registry-uri", "caller-channel", "closure-only", "reply-value",
             "system-channel"}
AUTHORITY = {"caller-subject", "credential-proof", "party", "installer", "runtime",
             "case-id", "writer", "any-subject", "admin-multisig", "role", "mixed",
             "none"}
DISPOSITIONS = {"holds", "accepted", "finding"}
BUNDLE = re.compile(r'bundle\+\{\*([A-Za-z0-9_]+)\}')
STATE_SEND = re.compile(r'\b[A-Za-z0-9_]*[Ss]tate!\(([^)]*)\)')


def source_text() -> str:
    return "\n".join(path.read_text() for path in sorted(SOURCE.rglob("*.rho")))


def bundle_sites() -> dict[str, list[str]]:
    sites: dict[str, list[str]] = {}
    for path in sorted(SOURCE.rglob("*.rho")):
        for number, line in enumerate(path.read_text().splitlines(), 1):
            for name in BUNDLE.findall(line):
                rel = path.relative_to(ROOT).as_posix()
                sites.setdefault(name, []).append(f"{rel}:{number}")
    return sites


def main() -> int:
    data = yaml.safe_load(REGISTER.read_text()) or {}
    errors: list[str] = []
    if data.get("schema") != "rprint.capabilities/v1":
        errors.append("bad schema")
    rows = data.get("capabilities") or []
    sites = bundle_sites()
    covered: dict[str, int] = {}
    text = source_text()
    for row in rows:
        cid = str(row.get("id", ""))
        for field in ("name", "kind", "source", "source_atom", "creator", "holders",
                      "exposure", "attenuation", "authority_check", "arms",
                      "delegation", "revocation", "forge_path", "hazard",
                      "disposition", "evidence"):
            if field not in row:
                errors.append(f"{cid}: missing {field}")
        if row.get("kind") not in KINDS:
            errors.append(f"{cid}: bad kind {row.get('kind')!r}")
        if row.get("exposure") not in EXPOSURES:
            errors.append(f"{cid}: bad exposure {row.get('exposure')!r}")
        if row.get("authority_check") not in AUTHORITY:
            errors.append(f"{cid}: bad authority_check {row.get('authority_check')!r}")
        if row.get("disposition") not in DISPOSITIONS:
            errors.append(f"{cid}: bad disposition {row.get('disposition')!r}")
        source = str(row.get("source", ""))
        if source.startswith("system:"):
            pass
        elif ":" in source:
            source_path, line = source.rsplit(":", 1)
            if not (ROOT / source_path).is_file():
                errors.append(f"{cid}: missing source {source_path}")
            if not line.isdigit():
                errors.append(f"{cid}: source line is not numeric")
        else:
            errors.append(f"{cid}: source is not file:line or system:")
        atom = str(row.get("source_atom", ""))
        if atom:
            match = BUNDLE.fullmatch(atom)
            if not match:
                errors.append(f"{cid}: bad source_atom {atom!r}")
            else:
                name = match.group(1)
                covered[name] = covered.get(name, 0) + 1
                if name not in sites:
                    errors.append(f"{cid}: bundle {name} is not published")
                elif atom not in (ROOT / source.rsplit(":", 1)[0]).read_text():
                    errors.append(f"{cid}: atom {atom} not in {source}")
        for arm in row.get("arms") or []:
            if arm == "*":
                continue
            if (f'@"{arm}"' not in text and f'"{arm}"' not in text
                    and f"contract {arm}(" not in text):
                errors.append(f"{cid}: arm {arm!r} not found in contracts")
        evidence = str(row.get("evidence", ""))
        evidence_path = evidence
        if ":" in evidence and evidence.rsplit(":", 1)[1].isdigit():
            evidence_path = evidence.rsplit(":", 1)[0]
        if not (ROOT / evidence_path).exists():
            errors.append(f"{cid}: missing evidence {evidence}")

    for name, found in sorted(sites.items()):
        if covered.get(name, 0) != 1:
            errors.append(f"bundle {name}: {covered.get(name, 0)} register rows")
    for name in covered:
        if name not in sites:
            errors.append(f"register covers unpublished bundle {name}")
    for match in STATE_SEND.finditer(text):
        if "*" in match.group(1):
            errors.append(f"capability in a state send: {match.group(0)!r}")

    if errors:
        for error in errors:
            print(f"check-capabilities: {error}", file=sys.stderr)
        print(f"check-capabilities: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"check-capabilities: {len(rows)} capability row(s), "
          f"{len(sites)} published bundle(s), {sum(1 for r in rows if r.get('disposition') == 'finding')} finding(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
