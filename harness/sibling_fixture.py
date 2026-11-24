#!/usr/bin/env python3
"""Create and cache the real sibling artifacts used by the cover and knowledge suites.

The r-sure and r-gen harnesses define modules with the same names as r-print's
(`actors`, `deploy`, `preflight`, ...), so each driver runs in a subprocess with its
own checkout as the working directory. The result is written once to
`deployments/sibling-fixture.json`; the suites read it through
`RPRINT_SIBLING_FIXTURE`.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "harness"))

import sibling_paths  # noqa: E402

RESULTS = ROOT / "deployments" / "sibling-fixture.json"
MARKER = "SIBLING_RESULT "


def environment() -> dict[str, str]:
    env = dict(os.environ)
    keys = Path(os.environ.get("RPRINT_KEYS", ROOT / ".devnet" / "keys.json")).resolve()
    node = os.environ.get("RPRINT_NODE", "http://localhost:40403")
    rcash = Path(os.environ.get("RCASH_DIR", ROOT.parent / "Rholphin")).resolve()
    env.update({
        "RPRINT_SIBLINGS_DIR": str(sibling_paths.siblings_root()),
        "RSHARE_KEYS": str(keys),
        "RSURE_KEYS": str(keys),
        "RSHARE_NODE": node,
        "RSURE_NODE": node,
        "RCASH_DIR": str(rcash),
        "RGEN_KEYS": str(keys),
        "RGEN_NODE": node,
    })
    return env


def run_driver(name: str, repo: str) -> dict:
    directory = sibling_paths.repo(repo)
    driver = ROOT / "harness" / f"sibling_{repo.lower()}_driver.py"
    if not driver.is_file():
        raise SystemExit(f"sibling_fixture: missing {driver}")
    if not directory.is_dir():
        raise SystemExit(
            f"sibling_fixture: missing {directory}; set RPRINT_SIBLINGS_DIR")
    proc = subprocess.run(
        [sys.executable, str(driver)],
        cwd=directory,
        env=environment(),
        text=True,
        capture_output=True,
    )
    output = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode != 0:
        raise SystemExit(f"sibling_fixture: {name} failed:\n{output[-4000:]}")
    for line in output.splitlines():
        if line.startswith(MARKER):
            return json.loads(line[len(MARKER):])
    raise SystemExit(f"sibling_fixture: {name} printed no result:\n{output[-4000:]}")


def build() -> dict:
    keys = Path(os.environ.get("RPRINT_KEYS", ROOT / ".devnet" / "keys.json"))
    if not keys.is_file():
        raise SystemExit(f"sibling_fixture: missing {keys}; run `make keys`")
    result = {
        "rsure": run_driver("r-sure", "RSure"),
        "rgen": None,
    }
    rgen = ROOT / "harness" / "sibling_rgen_driver.py"
    if rgen.is_file() and sibling_paths.repo("RGen").is_dir():
        result["rgen"] = run_driver("r-gen", "RGen")
    RESULTS.parent.mkdir(parents=True, exist_ok=True)
    RESULTS.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    return result


def load() -> dict | None:
    path = Path(os.environ.get("RPRINT_SIBLING_FIXTURE", RESULTS))
    if not path.is_file():
        return None
    return json.loads(path.read_text())


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="create the fixture file")
    args = ap.parse_args(argv)
    if not args.write:
        fixture = load()
        if fixture is None:
            print("sibling-fixture: no fixture; run with --write")
            return 2
        print(f"sibling-fixture: {RESULTS}")
        return 0
    fixture = build()
    print(f"sibling-fixture: wrote {RESULTS} (rsure={bool(fixture['rsure'])}, "
          f"rgen={bool(fixture['rgen'])})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
