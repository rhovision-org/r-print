#!/usr/bin/env python3
"""Commission conservation gate: closed funder/writer/escrow balance set."""

from __future__ import annotations

from assertions import expect, one
from commission_fixture import (accept, cancel, editor_publication, expire,
                                fund, propose, release, submit)
from helpers import block_height, call_uri
from preflight import require_devnet

import actors


def escrow_balance(uri: str) -> int:
    return one(call_uri(uri, "balance"))[1]


def closed_set(uri: str) -> dict:
    return {
        "funder": actors.balance("sponsor"),
        "writer": actors.balance("reporter3"),
        "escrow": escrow_balance(uri),
    }


def total(values: dict) -> int:
    return sum(values.values())


def main() -> int:
    print("unit-conservation")
    if not require_devnet("unit-conservation"):
        return 2
    for name in ("reporter1", "reporter3"):
        actors.ensure_vault(name)

    pub = editor_publication("conservation")
    proposal = propose(pub)
    accept(proposal)
    escrow = fund(proposal, funder="sponsor")
    uri = escrow["escrow_uri"]
    before = closed_set(uri)
    expect("funded escrow", before["escrow"], 1000)
    baseline = total(before)

    submit(escrow, "m1")
    release(escrow, "m1")
    after_release = closed_set(uri)
    expect("set constant after release", total(after_release), baseline)
    expect("writer paid", after_release["writer"] - before["writer"], 400)
    expect("escrow reduced", before["escrow"] - after_release["escrow"], 400)

    cancel(escrow, actor="sponsor")
    after_cancel = closed_set(uri)
    expect("set constant after cancel", total(after_cancel), baseline)
    expect("escrow closed", after_cancel["escrow"], 0)
    expect("funder refunded", after_cancel["funder"] - before["funder"], 600)

    now = block_height()
    expired_proposal = propose(
        editor_publication("expire"),
        milestones=[("m1", 1000, now - 1)], grace=0)
    accept(expired_proposal)
    expired_escrow = fund(expired_proposal, funder="sponsor")
    expired_before = closed_set(expired_escrow["escrow_uri"])
    expire(expired_escrow)
    expired_after = closed_set(expired_escrow["escrow_uri"])
    expect("expired set constant", total(expired_after), total(expired_before))
    expect("expired escrow", expired_after["escrow"], 0)
    expect("expired refund", expired_after["funder"] - expired_before["funder"], 1000)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
