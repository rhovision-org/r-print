#!/usr/bin/env python3
"""Commission dispute suite: freeze, platform arbitration split, timeout and cancel."""

from __future__ import annotations

import corpus
from assertions import expect, expect_ok, expect_refusal, one
from commission_fixture import (accept, cancel, dispute, editor_publication,
                                fund, propose, submit)
from helpers import (admin_payload, block_height, call_uri,
                     resolve_component, sign_payload)
from preflight import require_devnet

import actors
import deploy as node


def main() -> int:
    print("unit-commission-dispute")
    if not require_devnet("unit-commission-dispute"):
        return 2
    keys = node.load_keys()
    for name in ("reporter1", "reporter3"):
        actors.ensure_vault(name)
    codec = resolve_component("component:codec")

    pub = editor_publication("dispute")
    proposal = propose(pub)
    accept(proposal)
    escrow = fund(proposal, funder="sponsor")
    uri = escrow["escrow_uri"]
    pid = proposal["proposal_id"]

    dispute(escrow)
    expect("disputed status", one(call_uri(uri, "status"))[1], "disputed")
    expect_refusal("release freezes",
                   one(call_uri(uri, "release", '*dId, "frozen-release", "m1"'),
                       key="reporter1"),
                   "status")
    submit_reply = one(call_uri(uri, "submit", '*dId, "frozen-submit", "m1", "e"'),
                       key="reporter3")
    expect_refusal("submit freezes", submit_reply, "status")

    writer_before = actors.balance("reporter3")
    funder_before = actors.balance("sponsor")
    bps = 5000
    args = f'["{pid}", {bps}]'
    payload = admin_payload(codec, "commission:" + pid, 1, "split", args)
    sigs = sign_payload(keys, ["admin1", "admin2"], payload)
    arbitrated = one(call_uri(uri, "arbitrate", f'1, {bps}, {sigs}, "arb1"'))
    expect_ok("arbitrate", arbitrated)
    info = one(call_uri(uri, "info"))[1]
    expect("arbitrated status", info.get("status"), "arbitrated")
    expect("writer share", info.get("paidWriter"), 500)
    expect("funder share", info.get("refundedFunder"), 500)
    expect("writer delta", actors.balance("reporter3") - writer_before, 500)
    expect("funder delta", actors.balance("sponsor") - funder_before, 500)
    expect("empty purse", one(call_uri(uri, "balance"))[1], 0)
    second = one(call_uri(uri, "arbitrate", f'2, {bps}, {sigs}, "arb2"'))
    expect_refusal("second arbitrate", second, "status")
    corpus.assert_row("ESC-arbitrate-replay", second)

    # Timeout path: a zero dispute window resolves immediately and refunds the funder.
    timeout_proposal = propose(editor_publication("timeout"), dispute_window=0)
    accept(timeout_proposal)
    timeout_escrow = fund(timeout_proposal, funder="sponsor")
    dispute(timeout_escrow)
    resolved = one(call_uri(timeout_escrow["escrow_uri"], "resolveDispute", '"resolve-timeout"'))
    expect_ok("resolve timeout", resolved)
    expect("timeout status",
           one(call_uri(timeout_escrow["escrow_uri"], "status"))[1], "expired")
    expect("timeout purse",
           one(call_uri(timeout_escrow["escrow_uri"], "balance"))[1], 0)

    # Cancel path: an active escrow refunds the remaining balance.
    cancel_proposal = propose(editor_publication("cancel"))
    accept(cancel_proposal)
    cancel_escrow = fund(cancel_proposal, funder="sponsor")
    cancel(cancel_escrow, actor="sponsor")
    expect("cancelled status",
           one(call_uri(cancel_escrow["escrow_uri"], "status"))[1], "cancelled")
    expect("cancel purse",
           one(call_uri(cancel_escrow["escrow_uri"], "balance"))[1], 0)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
