#!/usr/bin/env python3
"""r-sure cover suite: strict binding against a real policy and refusal branches."""

from __future__ import annotations

import actors
import corpus
from assertions import expect, expect_ok, expect_refusal, one
from commission_fixture import accept, fund, propose
from helpers import call_uri
from preflight import require_devnet
from publication_fixture import create_publication, quoted

import sibling_fixture

import deploy as node


def policy_stub(status: str, insured: str, asset_id: str) -> str:
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
        raise AssertionError(f"policy stub: {reply!r}")
    return reply


def cover_publication(label: str, treasury: str | None = None) -> dict:
    return create_publication(
        label,
        publisher="deployer",
        members=[("deployer", "publisher"), ("reporter1", "editor"),
                 ("reporter3", "writer")],
        admins=["deployer"], threshold=1, treasury=treasury)


def attach(proposal: dict, uri: str, op: str = "cover-1"):
    return one(call_uri(proposal["uri"], "attachCover",
                        f'*dId, "{op}", "{uri}"'), key="reporter1")


def main() -> int:
    print("unit-cover")
    if not require_devnet("unit-cover"):
        return 2
    fixture = sibling_fixture.load()
    if not fixture or not fixture.get("rsure"):
        print("unit-cover: not_run (no sibling fixture; run make sibling-fixture)")
        return 2
    rsure = fixture["rsure"]
    if rsure.get("status") != "active":
        raise AssertionError(f"fixture policy is not active: {rsure!r}")

    pub = cover_publication("cover", treasury=rsure["insured"])
    proposal = propose(pub)
    accept(proposal)

    expect_ok("real cover", attach(proposal, rsure["policyUri"]))
    info = one(call_uri(proposal["uri"], "coverInfo"))[1]
    expect("cover uri", info.get("coverUri"), rsure["policyUri"])
    expect("cover status", info.get("coverStatus"), "active")
    expect("cover insured", info.get("coverInsured"), rsure["insured"])
    expect("cover asset", info.get("coverAssetId"), rsure["assetId"])
    expect("cover per claim", info.get("coverPerClaimLimit"), rsure["perClaimLimit"])
    expect("cover remaining", info.get("coverAggregateRemaining"),
           rsure["aggregateRemaining"])
    expect("proposal status", one(call_uri(proposal["uri"], "status"))[1], "accepted")

    expect_ok("cover replay", attach(proposal, rsure["policyUri"]))
    other = policy_stub("active", rsure["insured"], rsure["assetId"])
    expect_refusal("cover overwrite", attach(proposal, other, "cover-2"), "cover")

    expired = propose(pub, proposal_id=f"cover-expired:{node.height()}")
    accept(expired)
    inactive = attach(expired, rsure["expiredPolicyUri"])
    expect_refusal("inactive policy", inactive, "policy status")
    corpus.assert_row("COV-attach-inactive", inactive)

    wrong_insured_pub = cover_publication(
        "cover-wrong-insured", treasury=actors.address("recipient"))
    wrong_insured = propose(wrong_insured_pub,
                            proposal_id=f"cover-insured:{node.height()}")
    accept(wrong_insured)
    expect_refusal("wrong insured", attach(wrong_insured, rsure["policyUri"]),
                   "insured")

    wrong_asset = propose(pub, proposal_id=f"cover-asset:{node.height()}")
    accept(wrong_asset)
    expect_refusal(
        "wrong asset",
        attach(wrong_asset, policy_stub("active", rsure["insured"], "USD")),
        "asset")

    escrow = fund(proposal)
    expect("escrow cover",
           one(call_uri(escrow["escrow_uri"], "cover"))[1], rsure["policyUri"])
    escrow_info = one(call_uri(escrow["escrow_uri"], "info"))[1]
    expect("escrow total", escrow_info.get("total"), proposal["total"])
    expect("escrow status", escrow_info.get("status"), "active")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
