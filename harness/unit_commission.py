#!/usr/bin/env python3
"""Commission suite: propose, accept, fund, milestone submit and release."""

from __future__ import annotations

import actors
from assertions import expect, expect_ok, expect_refusal, one
from commission_fixture import (accept, editor_publication, fund, propose,
                                release, submit)
from helpers import call_uri
from preflight import require_devnet
from publication_fixture import quoted

import deploy as node


def policy_mock(status: str, insured: str, asset_id: str) -> str:
    reply = one(f"""
new P, rs(`rho:registry:insertArbitrary`), ch, deployId(`rho:rchain:deployId`) in {{
  contract P(@"info", ret) = {{
    ret!((true, {{"status": {quoted(status)}, "insured": {quoted(insured)},
                   "assetId": {quoted(asset_id)}, "perClaimLimit": 1000,
                   "aggregateRemaining": 5000}}))
  }} |
  rs!(bundle+{{*P}}, *ch) |
  for (@u <- ch) {{ deployId!(u) }}
}}
""")
    if not isinstance(reply, str):
        raise AssertionError(f"mock policy: {reply!r}")
    return reply


def main() -> int:
    print("unit-commission")
    if not require_devnet("unit-commission"):
        return 2
    keys = node.load_keys()
    for name in ("reporter1", "reporter3"):
        actors.ensure_vault(name)

    pub = editor_publication("commission")
    proposal = propose(pub, case="COM-propose-ok")
    expect("proposed status",
           one(call_uri(proposal["uri"], "status"))[1], "proposed")
    accept(proposal, case="COM-accept-ok")
    expect("accepted status",
           one(call_uri(proposal["uri"], "status"))[1], "accepted")

    # Optional r-sure surface: attach a real-shaped policy reference.
    mock = policy_mock("active", pub["treasury"], pub["asset_id"])
    attached = one(call_uri(proposal["uri"], "attachCover",
                            f'*dId, "cover-1", "{mock}"'), key="reporter1")
    expect_ok("attach cover", attached)
    cover = one(call_uri(proposal["uri"], "cover"))
    expect("cover uri", cover[1], mock)
    expect("cover status", cover[2], "active")
    cover_info = one(call_uri(proposal["uri"], "coverInfo"))
    expect("cover asset", cover_info[1].get("coverAssetId"), pub["asset_id"])
    expect("cover insured", cover_info[1].get("coverInsured"), pub["treasury"])

    replay = one(call_uri(proposal["uri"], "attachCover",
                          f'*dId, "cover-1", "{mock}"'), key="reporter1")
    expect_ok("cover replay", replay)

    other = policy_mock("active", pub["treasury"], pub["asset_id"])
    expect_refusal(
        "cover overwrite",
        one(call_uri(proposal["uri"], "attachCover",
                     f'*dId, "cover-2", "{other}"'), key="reporter1"),
        "cover")

    inactive = propose(pub, proposal_id=f"cover-inactive:{node.height()}")
    accept(inactive)
    expect_refusal(
        "inactive policy",
        one(call_uri(inactive["uri"], "attachCover",
                     f'*dId, "cover-1", "{policy_mock("inactive", pub["treasury"], pub["asset_id"])}"'),
            key="reporter1"),
        "policy status")

    wrong_insured = propose(pub, proposal_id=f"cover-insured:{node.height()}")
    accept(wrong_insured)
    expect_refusal(
        "wrong insured",
        one(call_uri(wrong_insured["uri"], "attachCover",
                     f'*dId, "cover-1", "{policy_mock("active", actors.address("recipient"), pub["asset_id"])}"'),
            key="reporter1"),
        "insured")

    wrong_asset = propose(pub, proposal_id=f"cover-asset:{node.height()}")
    accept(wrong_asset)
    expect_refusal(
        "wrong asset",
        one(call_uri(wrong_asset["uri"], "attachCover",
                     f'*dId, "cover-1", "{policy_mock("active", pub["treasury"], "USD")}"'),
            key="reporter1"),
        "asset")

    escrow = fund(proposal, case="COM-fund-ok")
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
