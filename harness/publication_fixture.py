#!/usr/bin/env python3
"""Build and create publications for the membership suites."""

from __future__ import annotations

import json

import actors
from assertions import one
from helpers import block_height, call_uri, resolve_component

import deploy as node


def quoted(value: str) -> str:
    return json.dumps(value)


def charter_literal(keys: dict, admins: list[str], threshold: int,
                    treasury: str | None = None,
                    arbitrators: list[str] | None = None,
                    arbitration_threshold: int = 0,
                    revenue_split: list[tuple[str, int]] | None = None,
                    max_members: int = 32) -> str:
    admin_hex = ", ".join(f'"{keys[name]["public"]}".hexToBytes()' for name in admins)
    arb_names = arbitrators or []
    arb_hex = ", ".join(f'"{keys[name]["public"]}".hexToBytes()' for name in arb_names)
    split = revenue_split or []
    split_lit = ", ".join(
        '{"memberId": ' + quoted(member) + ', "bps": ' + str(bps) + "}"
        for member, bps in split)
    return (
        '{'
        + '"nameHash": "name:fixture", "mastheadHash": "mast:fixture", '
        + '"taglineHash": "tagline:fixture", '
        + '"treasuryAccountId": ' + quoted(treasury or actors.address("business")) + ', '
        + '"assetId": "REV", '
        + '"admins": [' + admin_hex + '], "threshold": ' + str(threshold) + ', '
        + '"arbitrators": [' + arb_hex + '], '
        + '"arbitrationThreshold": ' + str(arbitration_threshold) + ', '
        + '"revenueSplit": [' + split_lit + '], '
        + '"governance": {"maxMembers": ' + str(max_members)
        + ', "requireFactCheck": false, "disputeWindowBlocks": 10, '
        + '"commissionGraceBlocks": 5}'
        + '}'
    )


def member_literal(name: str, role: str, did: str | None = None) -> str:
    return (
        '{"memberId": ' + quoted(actors.address(name))
        + ', "role": ' + quoted(role)
        + ', "did": ' + quoted(did or f"did:byoid:{name}")
        + ', "attestationHash": ' + quoted(f"att:{name}") + '}'
    )


def members_literal(entries: list[tuple[str, str]]) -> str:
    return "[" + ", ".join(member_literal(name, role) for name, role in entries) + "]"


def create_publication(label: str = "suite", publisher: str = "deployer",
                       members: list[tuple[str, str]] | None = None,
                       admins: list[str] | None = None,
                       threshold: int | None = None,
                       arbitrators: list[str] | None = None,
                       arbitration_threshold: int = 0,
                       treasury: str | None = None,
                       max_members: int = 32) -> dict:
    keys = node.load_keys()
    if publisher != "deployer":
        actors.ensure_vault(publisher)
    pub_id = f"pub:{label}:{block_height()}"
    if members is None:
        members = [(publisher, "publisher"), ("reporter1", "writer"),
                   ("reporter2", "factchecker")]
    if admins is None:
        admins = [publisher]
    if threshold is None:
        threshold = 1 if len(admins) == 1 else 2
    charter = charter_literal(keys, admins, threshold, treasury=treasury,
                              arbitrators=arbitrators,
                              arbitration_threshold=arbitration_threshold,
                              max_members=max_members)
    factory = resolve_component("component:publication-factory")
    op = f"create:{pub_id}"
    reply = one(call_uri(
        factory, "create",
        f'*dId, {quoted(op)}, {quoted(pub_id)}, {charter}, {members_literal(members)}'),
        key=publisher)
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"create publication {pub_id}: {reply!r}")
    return {"publication_id": pub_id, "uri": reply[1], "members": members,
            "admins": admins, "threshold": threshold,
            "treasury": treasury or actors.address("business"), "asset_id": "REV"}
