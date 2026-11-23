#!/usr/bin/env python3
"""Commission refusal suite: writer/editor roles, ordering, replay and funded state."""

from __future__ import annotations

import actors
from assertions import expect, expect_refusal, one
from commission_fixture import (accept, editor_publication, fund, propose,
                                release, submit)
from helpers import call_uri
from preflight import require_devnet


def main() -> int:
    print("unit-commission-refusals")
    if not require_devnet("unit-commission-refusals"):
        return 2
    for name in ("reporter1", "reporter3"):
        actors.ensure_vault(name)

    pub = editor_publication("refusals")
    proposal = propose(pub)
    accept(proposal)
    escrow = fund(proposal)
    uri = escrow["escrow_uri"]

    expect_refusal("editor cannot submit",
                   one(call_uri(uri, "submit", '*dId, "bad-submit", "m1", "e"'),
                       key="reporter1"),
                   "not writer")
    expect_refusal("release before submit",
                   one(call_uri(uri, "release", '*dId, "early-release", "m1"'),
                       key="reporter1"),
                   "not submitted")
    expect_refusal("writer cannot release",
                   one(call_uri(uri, "release", '*dId, "writer-release", "m1"'),
                       key="reporter3"),
                   "role")

    submit(escrow, "m2")
    expect_refusal("out-of-order release",
                   one(call_uri(uri, "release", '*dId, "order-release", "m2"'),
                       key="reporter1"),
                   "milestone")

    submit(escrow, "m1")
    release(escrow, "m1")
    expect_refusal("double release",
                   one(call_uri(uri, "release", '*dId, "double-release", "m1"'),
                       key="reporter1"),
                   "not submitted")

    expect_refusal("duplicate fund",
                   one(call_uri(proposal["uri"], "fund", '*dId, "double-fund"'),
                       key="deployer"),
                   "status")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
