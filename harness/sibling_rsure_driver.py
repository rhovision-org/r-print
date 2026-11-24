#!/usr/bin/env python3
"""Create real r-sure policies for the sibling fixture.

Run from the r-sure checkout with its harness on `sys.path`. Prints one
`SIBLING_RESULT <json>` line. The r-print orchestrator runs this in a subprocess so
the two harnesses never share module names.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
SIBLINGS = Path(os.environ.get("RPRINT_SIBLINGS_DIR", HERE.parents[2]))
RSure = SIBLINGS / "RSure"
sys.path.insert(0, str(RSure / "harness"))

import actors  # noqa: E402
from placement_fixture import bound  # noqa: E402


def main() -> int:
    active = bound("rprint-cover", insured="business", syndicate_owner="deployer")
    info = active.policy_info()
    expired = bound("rprint-expired", insured="business", syndicate_owner="deployer",
                    period_blocks=10, run_off_blocks=0)
    actors.wait_height(expired.end + 2)
    actors.invoke(expired.policy_uri, "expire")
    expired_info = expired.policy_info()
    if expired_info.get("status") != "expired":
        raise SystemExit(f"sibling_rsure: policy did not expire: {expired_info!r}")
    result = {
        "policyUri": active.policy_uri,
        "insured": info.get("insured"),
        "assetId": info.get("assetId"),
        "status": info.get("status"),
        "perClaimLimit": info.get("perClaimLimit"),
        "aggregateRemaining": info.get("aggregateRemaining"),
        "expiredPolicyUri": expired.policy_uri,
        "expiredStatus": expired_info.get("status"),
    }
    print("SIBLING_RESULT " + json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
