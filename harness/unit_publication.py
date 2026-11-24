#!/usr/bin/env python3
"""Publication suite: charter, roster, roles, solo arbitration and admin actions."""

from __future__ import annotations

import actors
import corpus
from assertions import expect, expect_ok, expect_refusal, one
from helpers import admin_payload, call_uri, resolve_component, sign_payload
from preflight import require_devnet
from publication_fixture import create_publication, member_literal, quoted

import deploy as node


def main() -> int:
    print("unit-publication")
    if not require_devnet("unit-publication"):
        return 2
    keys = node.load_keys()
    for name in ("reporter1", "reporter2", "reporter3"):
        actors.ensure_vault(name)
    publisher = "deployer"
    pub = create_publication("publication")
    uri = pub["uri"]
    pub_id = pub["publication_id"]

    info = one(call_uri(uri, "info"))
    expect_ok("publication info", info)
    expect("status", info[1].get("status"), "active")
    expect("publication id", info[1].get("publicationId"), pub_id)
    charter_hash = info[1].get("charterHash")
    if not isinstance(charter_hash, (str, bytes)) or len(charter_hash) < 16:
        raise AssertionError(f"charter hash: {charter_hash!r}")

    members = one(call_uri(uri, "members"))
    expect_ok("members", members)
    expect("member count", len(members[1]), 3)
    role = one(call_uri(uri, "roleOf", quoted(actors.address("reporter1"))))
    expect("writer role", role[1], "writer")
    expect_refusal("unknown role",
                   one(call_uri(uri, "roleOf", quoted("1111unknown"))), "not member")

    added = one(call_uri(
        uri, "addMember",
        f'*dId, "add-reporter3", {quoted(actors.address("reporter3"))}, '
        f'"factchecker", "did:byoid:reporter3", "att:reporter3"'),
        key=publisher)
    expect_ok("add member", added)
    expect("added role",
           one(call_uri(uri, "roleOf", quoted(actors.address("reporter3"))))[1],
           "factchecker")

    rotated = one(call_uri(
        uri, "setRole",
        f'*dId, "role-reporter2", {quoted(actors.address("reporter2"))}, "contributor"'),
        key=publisher)
    expect_ok("set role", rotated)
    expect("rotated role",
           one(call_uri(uri, "roleOf", quoted(actors.address("reporter2"))))[1],
           "contributor")

    attested = one(call_uri(
        uri, "attestSelf", f'*dId, "attest-reporter1", "did:byoid:reporter1:v2", "att:v2"'),
        key="reporter1")
    expect_ok("attest self", attested)
    member = one(call_uri(uri, "member", quoted(actors.address("reporter1"))))
    expect("self attestation", member[1].get("did"), "did:byoid:reporter1:v2")

    removed = one(call_uri(
        uri, "removeMember", f'*dId, "remove-reporter3", {quoted(actors.address("reporter3"))}'),
        key=publisher)
    expect_ok("remove member", removed)
    expect_refusal("removed role",
                   one(call_uri(uri, "roleOf", quoted(actors.address("reporter3")))),
                   "not member")

    paused = one(call_uri(uri, "pause", '*dId, "pause-1", true'), key=publisher)
    expect_ok("pause", paused)
    intruder = one(call_uri(uri, "pause", '*dId, "pause-intruder", true'),
                   key="reporter1")
    expect_refusal("non-publisher pause", intruder, "role")
    corpus.assert_row("PUB-pause-nonpublisher", intruder)
    expect_refusal("paused write",
                   one(call_uri(uri, "addMember",
                                f'*dId, "add-while-paused", {quoted(actors.address("sender"))}, '
                                f'"writer", "did:byoid:sender", "att:sender"'),
                                key=publisher),
                   "paused")
    expect("reads while paused", one(call_uri(uri, "status"))[1], "paused")
    expect_ok("resume", one(call_uri(uri, "pause", '*dId, "resume-1", false'), key=publisher))

    arb = one(call_uri(uri, "arbitration"))
    expect_ok("arbitration", arb)
    expect("solo arbitration kind", arb[1], "platform")
    if len(arb[2]) < 2 or arb[3] < 2:
        raise AssertionError(f"platform quorum: {arb!r}")

    codec = resolve_component("component:codec")
    nonce = 1
    new_treasury = actors.address("recipient")
    args = f'[{quoted(new_treasury)}]'
    payload = admin_payload(codec, "publication:" + pub_id, nonce, "setTreasury", args)
    sigs = sign_payload(keys, [publisher], payload)
    admin = one(call_uri(uri, "admin",
                         f'{nonce}, "setTreasury", {args}, {sigs}'))
    expect_ok("set treasury", admin)
    expect("treasury updated",
           one(call_uri(uri, "treasury"))[1], new_treasury)
    replay = one(call_uri(uri, "admin", f'{nonce}, "setTreasury", {args}, {sigs}'))
    expect_refusal("admin replay", replay, "replay")
    corpus.assert_row("PUB-admin-replay", replay)

    multi = create_publication(
        "multi", publisher="deployer",
        members=[("deployer", "publisher"), ("reporter1", "writer")],
        admins=["deployer", "admin1"], threshold=2)
    multi_arb = one(call_uri(multi["uri"], "arbitration"))
    expect_ok("multi arbitration", multi_arb)
    expect("multi arbitration kind", multi_arb[1], "publication")
    expect("multi arbitration threshold", multi_arb[3], 2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
