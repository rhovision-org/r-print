#!/usr/bin/env python3
"""Membership authority suite: creator, publisher-only roster writes and impersonation."""

from __future__ import annotations

import actors
import corpus
from assertions import expect, expect_ok, expect_refusal, one
from helpers import block_height, call_uri, resolve_component
from preflight import require_devnet
from publication_fixture import (charter_literal, create_publication,
                                 members_literal, quoted)

import deploy as node


def main() -> int:
    print("unit-membership-auth")
    if not require_devnet("unit-membership-auth"):
        return 2
    keys = node.load_keys()
    for name in ("reporter1", "reporter2", "reporter3", "sender"):
        actors.ensure_vault(name)
    factory = resolve_component("component:publication-factory")

    # A creator who is not in the member list is refused even when another publisher exists.
    charter = charter_literal(keys, ["reporter1"], 1)
    members = members_literal([("reporter1", "publisher")])
    pub_id = f"pub:no-creator:{block_height()}"
    no_creator = one(call_uri(
        factory, "create",
        f'*dId, "no-creator", {quoted(pub_id)}, {charter}, {members}',
        ),
        key="sender")
    expect_refusal("creator not a member", no_creator, "member")

    pub = create_publication("auth")
    uri = pub["uri"]

    writer_add = one(call_uri(
        uri, "addMember",
        f'*dId, "writer-add", {quoted(actors.address("reporter3"))}, '
        f'"writer", "did:byoid:reporter3", "att:reporter3"',
        ),
        key="reporter1")
    expect_refusal("writer cannot add", writer_add, "role")
    corpus.assert_row("PUB-add-nonpublisher", writer_add)

    duplicate = one(call_uri(
        uri, "addMember",
        f'*dId, "dup-member", {quoted(actors.address("reporter1"))}, '
        f'"writer", "did:byoid:reporter1", "att:reporter1"',
        ),
        key="deployer")
    expect_refusal("duplicate member", duplicate, "duplicate")

    bad_role = one(call_uri(
        uri, "addMember",
        f'*dId, "bad-role", {quoted(actors.address("reporter3"))}, '
        f'"king", "did:byoid:reporter3", "att:reporter3"',
        ),
        key="deployer")
    expect_refusal("bad role", bad_role, "role")

    impersonate = one(call_uri(
        uri, "attestSelf",
        '*dId, "impersonate", "did:byoid:reporter1", "att:forged"',
        ),
        key="sender")
    expect_refusal("non-member self attest", impersonate, "not member")
    expect("reporter1 did unchanged",
           one(call_uri(uri, "member", quoted(actors.address("reporter1"))))[1].get("did"),
           "did:byoid:reporter1")

    solo = create_publication(
        "solo", publisher="deployer",
        members=[("deployer", "publisher")])
    last_remove = one(call_uri(
        solo["uri"], "removeMember",
        f'*dId, "remove-last", {quoted(actors.address("deployer"))}',
        ),
        key="deployer")
    expect_refusal("last publisher remove", last_remove, "last publisher")
    corpus.assert_row("PUB-remove-last", last_remove)
    last_demote = one(call_uri(
        solo["uri"], "setRole",
        f'*dId, "demote-last", {quoted(actors.address("deployer"))}, "writer"',
        ),
        key="deployer")
    expect_refusal("last publisher demote", last_demote, "last publisher")

    capped = create_publication(
        "cap", publisher="deployer",
        members=[("deployer", "publisher"), ("reporter1", "writer")],
        max_members=2)
    full = one(call_uri(
        capped["uri"], "addMember",
        f'*dId, "member-cap", {quoted(actors.address("reporter3"))}, '
        f'"writer", "did:byoid:reporter3", "att:reporter3"',
        ),
        key="deployer")
    expect_refusal("member cap", full, "members")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
