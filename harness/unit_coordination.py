#!/usr/bin/env python3
"""Coordination suite: publication binding, ordered signers and the golden outcome.

The record is provenance, not authority: the suite asserts the publication state is
byte-identical before and after a record. No money moves, so there is no conservation
assertion.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import actors
import corpus
from assertions import expect, expect_ok, expect_refusal, one
from helpers import block_height, call_uri, resolve_component, sign_digest
from publication_fixture import create_publication, quoted
from preflight import require_devnet

import deploy as node

GOLDEN = Path(__file__).resolve().parent / "scenarios" / "golden" / "coordination-outcome.json"


def signer_set(*names: str) -> list[str]:
    return [actors.address(name) for name in names]


def coordination_data(pub: dict, signers: list[str], room: str = "room:golden") -> str:
    ids = ", ".join(quoted(s) for s in signers)
    return (
        '{"publicationId": ' + quoted(pub["publication_id"])
        + ', "publicationUri": ' + quoted(pub["uri"])
        + ', "subjectRef": {"kind": "publication", "id": '
        + quoted(pub["publication_id"]) + ', "uri": ' + quoted(pub["uri"]) + '}'
        + ', "roomIdHash": ' + quoted(room)
        + ', "signerIds": [' + ids + ']}'
    )


def signature_literal(keys: dict, names: list[str], digest: bytes) -> str:
    entries = []
    for name in names:
        entries.append(
            '{"memberId": ' + quoted(actors.address(name))
            + ', "pubKey": "' + actors.public(name) + '".hexToBytes()'
            + ', "sig": ' + sign_digest(keys, name, digest) + '}')
    return "[" + ", ".join(entries) + "]"


def digest_for(codec: str, coordination_id: str, poll: str, outcome: str) -> bytes:
    reply = one(call_uri(
        codec, "hash",
        f'"rprint:coord:v1", [{quoted(coordination_id)}, {quoted(poll)}, {quoted(outcome)}]'))
    if not (isinstance(reply, tuple) and reply and reply[0] is True and isinstance(reply[1], bytes)):
        raise AssertionError(f"coordination digest: {reply!r}")
    return reply[1]


def create_record(factory: str, pub: dict, coordination_id: str,
                  signers: list[str], op: str | None = None):
    op_id = op or f"create:{coordination_id}"
    return one(call_uri(
        factory, "create",
        f'*dId, {quoted(op_id)}, {quoted(coordination_id)}, '
        + coordination_data(pub, signers)))


def record_uri(codec: str, uri: str, coordination_id: str, poll: str, outcome: str,
               keys: dict, names: list[str], op: str):
    digest = digest_for(codec, coordination_id, poll, outcome)
    sigs = signature_literal(keys, names, digest)
    return one(call_uri(
        uri, "record",
        f'*dId, {quoted(op)}, {quoted(coordination_id)}, {quoted(poll)}, '
        f'{quoted(outcome)}, {sigs}'))


def preflight(keys: dict) -> None:
    for name in ("deployer", "reporter1", "reporter2"):
        reply = one(f"""
new rev(`rho:rev:address`), ch, deployId(`rho:rchain:deployId`) in {{
  rev!("fromPublicKey", "{actors.public(name)}".hexToBytes(), *ch) |
  for (@a <- ch) {{ deployId!(a) }}
}}
""")
        expect(f"address derives {name}", reply, actors.address(name))


def main() -> int:
    print("unit-coordination")
    if not require_devnet("unit-coordination"):
        return 2
    try:
        factory = resolve_component("component:coordination-factory")
        codec = resolve_component("component:codec")
    except Exception as exc:  # noqa: BLE001 - not installed is a not-run, not a pass
        print(f"unit-coordination: not installed: {exc}; not run", file=sys.stderr)
        return 2

    keys = node.load_keys()
    for name in ("reporter1", "reporter2", "reporter3"):
        actors.ensure_vault(name)

    preflight(keys)

    pub = create_publication(
        "coordination",
        members=[("deployer", "publisher"), ("reporter1", "editor"),
                 ("reporter2", "factchecker")],
        admins=["deployer"], threshold=1)
    signers = signer_set("deployer", "reporter1")
    coordination_id = f"coord:{block_height()}"
    poll = "poll:golden-water"
    outcome = "outcome:golden-approved"

    created = create_record(factory, pub, coordination_id, signers)
    expect_ok("create coordination", created)
    uri = created[1]

    info = one(call_uri(uri, "info"))[1]
    expect("open status", info.get("status"), "open")
    expect("signer count", len(info.get("signers")), 2)
    expect("empty poll", info.get("pollIdHash"), "")
    expect("empty signatures", len(info.get("signatures")), 0)
    expect("subject kind", info.get("subjectRef").get("kind"), "publication")

    publication_before = one(call_uri(pub["uri"], "info"))
    recorded = record_uri(codec, uri, coordination_id, poll, outcome, keys,
                          ["deployer", "reporter1"], "record:1")
    expect_ok("record outcome", recorded)
    publication_after = one(call_uri(pub["uri"], "info"))
    expect("publication unchanged", publication_after, publication_before)

    info = one(call_uri(uri, "info"))[1]
    expect("recorded status", info.get("status"), "recorded")
    expect("poll bound", info.get("pollIdHash"), poll)
    expect("outcome bound", info.get("outcomeHash"), outcome)
    expect("signature count", len(info.get("signatures")), 2)
    expect("recorded height", info.get("recordedAtHeight") > 0, True)

    golden = json.loads(GOLDEN.read_text())
    publication_status = one(call_uri(pub["uri"], "status"))[1]
    transcript = {
        "status": info.get("status"),
        "signerCount": len(info.get("signers")),
        "signatureCount": len(info.get("signatures")),
        "pollIdHash": info.get("pollIdHash"),
        "outcomeHash": info.get("outcomeHash"),
        "publicationStatus": publication_status,
    }
    expect("golden outcome", transcript, golden)

    expect_ok("same op replay", record_uri(
        codec, uri, coordination_id, poll, outcome, keys,
        ["deployer", "reporter1"], "record:1"))
    expect_ok("same outcome new op", record_uri(
        codec, uri, coordination_id, poll, outcome, keys,
        ["deployer", "reporter1"], "record:2"))
    expect("replay keeps signatures", len(one(call_uri(uri, "info"))[1].get("signatures")), 2)

    conflict = record_uri(codec, uri, coordination_id, poll, "outcome:other", keys,
                          ["deployer", "reporter1"], "record:3")
    expect_refusal("different outcome", conflict, "recorded")
    corpus.assert_row("COORD-record-conflict", conflict)

    second_id = f"coord:bad-sig:{block_height()}"
    second = create_record(factory, pub, second_id, signers)
    expect_ok("create second record", second)
    wrong_digest = digest_for(codec, second_id, poll, "outcome:wrong")
    wrong_sig = signature_literal(keys, ["deployer", "reporter1"], wrong_digest)
    bad = one(call_uri(
        second[1], "record",
        f'*dId, "record:bad", {quoted(second_id)}, {quoted(poll)}, '
        f'{quoted(outcome)}, {wrong_sig}'))
    expect_refusal("bad signature", bad, "signature")

    reversed_sigs = signature_literal(keys, ["reporter1", "deployer"],
                                      digest_for(codec, second_id, poll, outcome))
    wrong_order = one(call_uri(
        second[1], "record",
        f'*dId, "record:order", {quoted(second_id)}, {quoted(poll)}, '
        f'{quoted(outcome)}, {reversed_sigs}'))
    expect_refusal("wrong signer order", wrong_order, "not signer")

    outsider = create_record(factory, pub, f"coord:outsider:{block_height()}",
                             signer_set("deployer", "reporter3"))
    expect_refusal("non-member signer", outsider, "signers")

    fake = one(call_uri(
        factory, "create",
        f'*dId, "create:fake", "coord:fake", '
        + coordination_data({"publication_id": "pub:fake", "uri": "rho:id:fake"},
                            signers)))
    expect_refusal("fabricated publication", fake, "publication")

    duplicate = create_record(factory, pub, coordination_id, signers,
                              op=f"create:again:{block_height()}")
    expect_refusal("duplicate id", duplicate, "duplicate")

    writer_pub = create_publication(
        "coordination-writer",
        members=[("deployer", "publisher"), ("reporter1", "writer")],
        admins=["deployer"], threshold=1)
    writer_create = one(call_uri(
        factory, "create",
        f'*dId, "create:writer", {quoted("coord:writer")}, '
        + coordination_data(writer_pub, signer_set("deployer", "reporter1"))),
        key="reporter1")
    expect_refusal("writer cannot create", writer_create, "role")

    paused = create_publication(
        "coordination-paused",
        members=[("deployer", "publisher"), ("reporter1", "editor")],
        admins=["deployer"], threshold=1)
    expect_ok("pause", one(call_uri(paused["uri"], "pause", '*dId, "pause-1", true')))
    paused_create = create_record(factory, paused, f"coord:paused:{block_height()}",
                                  signer_set("deployer", "reporter1"))
    expect_refusal("paused publication", paused_create, "paused")
    expect_ok("resume", one(call_uri(paused["uri"], "pause", '*dId, "pause-2", false')))

    print("unit-coordination: pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
