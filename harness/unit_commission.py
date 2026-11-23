#!/usr/bin/env python3
"""Commission suite: propose, accept, fund, milestone submit and release."""

from __future__ import annotations

import actors
from assertions import expect, expect_ok, one
from commission_fixture import (accept, editor_publication, fund, propose,
                                release, submit)
from helpers import call_uri
from preflight import require_devnet

import deploy as node


def main() -> int:
    print("unit-commission")
    if not require_devnet("unit-commission"):
        return 2
    keys = node.load_keys()
    for name in ("reporter1", "reporter3"):
        actors.ensure_vault(name)

    pub = editor_publication("commission")
    proposal = propose(pub)
    expect("proposed status",
           one(call_uri(proposal["uri"], "status"))[1], "proposed")
    accept(proposal)
    expect("accepted status",
           one(call_uri(proposal["uri"], "status"))[1], "accepted")

    # Optional r-sure surface: attach a policy reference (mock policy in this suite).
    mock = one("""
new P, rs(`rho:registry:insertArbitrary`), ch, deployId(`rho:rchain:deployId`) in {
  contract P(@"info", ret) = { ret!((true, {"status": "active"})) } |
  rs!(bundle+{*P}, *ch) |
  for (@u <- ch) { deployId!(u) }
}
""")
    if not isinstance(mock, str):
        raise AssertionError(f"mock policy: {mock!r}")
    attached = one(call_uri(proposal["uri"], "attachCover",
                            f'*dId, "cover-1", "{mock}"'), key="reporter1")
    expect_ok("attach cover", attached)
    cover = one(call_uri(proposal["uri"], "cover"))
    expect("cover uri", cover[1], mock)
    expect("cover status", cover[2], "active")

    escrow = fund(proposal)
    info = one(call_uri(escrow["escrow_uri"], "info"))
    expect_ok("escrow info", info)
    expect("escrow total", info[1].get("total"), 1000)
    expect("escrow status", info[1].get("status"), "active")
    expect("escrow paid", info[1].get("paidWriter"), 0)
    balance = one(call_uri(escrow["escrow_uri"], "balance"))
    expect("escrow balance", balance[1], 1000)
    expect("escrow cover", one(call_uri(escrow["escrow_uri"], "cover"))[1], mock)

    writer_before = actors.balance(proposal["writer"])
    submit(escrow, "m1")
    expect("milestone submitted",
           one(call_uri(escrow["escrow_uri"], "milestones"))[1][0].get("status"),
           "submitted")
    release(escrow, "m1")
    writer_after = actors.balance(proposal["writer"])
    expect("milestone paid", writer_after - writer_before, 400)
    info = one(call_uri(escrow["escrow_uri"], "info"))[1]
    expect("paid writer", info.get("paidWriter"), 400)
    expect("remaining purse",
           one(call_uri(escrow["escrow_uri"], "balance"))[1], 600)

    submit(escrow, "m2")
    release(escrow, "m2")
    info = one(call_uri(escrow["escrow_uri"], "info"))[1]
    expect("completed status", info.get("status"), "completed")
    expect("all paid", info.get("paidWriter"), 1000)
    expect("empty purse",
           one(call_uri(escrow["escrow_uri"], "balance"))[1], 0)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
