#!/usr/bin/env python3
"""Run behavioural suites and record an honest pass / fail / not-run result.

Exit codes: 0 all pass, 1 any failure, 2 any not-run and no failure. The result file is
`deployments/suite-results.json` (gitignored) and is uploaded by CI.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "deployments" / "suite-results.json"

SUITES: dict[str, str] = {
    "root": "unit_root.py",
    "payments": "unit_payments.py",
    "admin": "unit_admin.py",
    "schema": "unit_schema.py",
    "publication": "unit_publication.py",
    "membership_auth": "unit_membership_auth.py",
    "admin_keys": "unit_admin_keys.py",
    "commission": "unit_commission.py",
    "commission_refusals": "unit_commission_refusals.py",
    "commission_dispute": "unit_commission_dispute.py",
    "conservation": "unit_conservation.py",
    "article": "unit_article.py",
    "interfaces": "unit_interfaces.py",
    "pause_scope": "unit_pause_scope.py",
    "behavior": "unit_behavior.py",
    "article_refusals": "unit_article_refusals.py",
    "edition": "unit_edition.py",
    "corrections": "unit_corrections.py",
    "cover": "unit_cover.py",
    "knowledge": "unit_knowledge.py",
}
EXPERIMENTAL: set[str] = set()
SAFE_ONLY: set[str] = set()
AUDIT: set[str] = set()
SIBLING: set[str] = {"cover", "knowledge"}
SAFE_CORE = sorted(set(SUITES) - EXPERIMENTAL - SAFE_ONLY - AUDIT - SIBLING)
DEFAULT = SAFE_CORE + sorted(SAFE_ONLY)


def run(name: str) -> dict:
    script = ROOT / "harness" / SUITES[name]
    started = time.time()
    proc = subprocess.run(
        [sys.executable, str(script)],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    output = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode == 0:
        status = "pass"
    elif proc.returncode == 2:
        status = "not_run"
    else:
        status = "fail"
    print(f"--- {name}: {status} ({proc.returncode}) ---")
    print(output.rstrip())
    return {
        "suite": name,
        "script": SUITES[name],
        "status": status,
        "returncode": proc.returncode,
        "seconds": round(time.time() - started, 3),
        "output": output[-4000:],
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--suites", default=None,
                    help="comma-separated suite names (default: profile suites)")
    ap.add_argument("--results", default=str(RESULTS),
                    help="result file (default: deployments/suite-results.json)")
    ap.add_argument("--optional", action="store_true",
                    help="a not-run suite is not a failure")
    ap.add_argument("--require-run", action="store_true",
                    help="a not-run suite is a failure")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args(argv)

    if args.optional and args.require_run:
        print("run_suites: --optional and --require-run are mutually exclusive",
              file=sys.stderr)
        return 1

    if args.list:
        for name, script in SUITES.items():
            print(f"{name:20} {script}")
        return 0

    selected = args.suites if args.suites is not None else ",".join(DEFAULT)
    names = [name.strip() for name in selected.split(",") if name.strip()]
    unknown = [name for name in names if name not in SUITES]
    if unknown:
        print(f"run_suites: unknown suites {unknown}", file=sys.stderr)
        return 1

    results = [run(name) for name in names]
    payload = {
        "node": os.environ.get("RPRINT_NODE", "http://localhost:40403"),
        "profile": "safe",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "results": results,
    }
    results_path = Path(args.results)
    results_path.parent.mkdir(parents=True, exist_ok=True)
    results_path.write_text(json.dumps(payload, indent=2) + "\n")
    if any(item["status"] == "fail" for item in results):
        return 1
    if any(item["status"] == "not_run" for item in results):
        return 1 if args.require_run else 0 if args.optional else 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
