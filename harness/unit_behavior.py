#!/usr/bin/env python3
"""Golden small-newsroom transcript: publication -> commission -> article -> edition."""

from __future__ import annotations

import json
from pathlib import Path

import actors
from article_fixture import (approve, article_data, create_article,
                             publish, submit, attest)
from assertions import expect, expect_ok, one
from commission_fixture import (accept, editor_publication, fund, propose,
                                release, submit as csubmit)
from helpers import block_height, call_uri, resolve_component, sign_digest
from preflight import require_devnet
from publication_fixture import quoted

import deploy as node

GOLDEN = Path(__file__).resolve().parent / "scenarios" / "golden" / "newsroom.json"


def main() -> int:
    print("unit-behavior")
    if not require_devnet("unit-behavior"):
        return 2
    keys = node.load_keys()
    for name in ("reporter1", "reporter2", "reporter3"):
        actors.ensure_vault(name)

    pub = editor_publication("behavior")
    proposal = propose(pub)
    accept(proposal)
    escrow = fund(proposal)
    csubmit(escrow, "m1")
    release(escrow, "m1")
    csubmit(escrow, "m2")
    release(escrow, "m2")
    escrow_status = one(call_uri(escrow["escrow_uri"], "status"))[1]

    article = create_article(pub, "content:golden", label="golden")
    submit(article)
    attest(article)
    approve(article)
    publish(article)
    article_status = one(call_uri(article["uri"], "status"))[1]

    factory = resolve_component("component:edition-factory")
    edition_id = f"edition:golden:{block_height()}"
    title, cover, number = "golden-title", "golden-cover", 1
    created = one(call_uri(
        factory, "create",
        f'*dId, "golden-edition", {quoted(edition_id)}, '
        + json.dumps({
            "publicationId": pub["publication_id"],
            "publicationUri": pub["uri"],
            "number": number,
            "titleHash": title,
            "coverHash": cover,
        })), key="deployer")
    expect_ok("edition create", created)
    edition_uri = created[1]
    expect_ok("edition append",
              one(call_uri(edition_uri, "append", f'*dId, "golden-append", "{article["uri"]}"'),
                  key="deployer"))
    codec = resolve_component("component:codec")
    items = (f'["{edition_id}", "{pub["publication_id"]}", {number}, '
             f'"{title}", "{cover}", "content:golden"]')
    digest = one(call_uri(codec, "hash", f'"rprint:edition:v1", {items}'))[1]
    sig = sign_digest(keys, "deployer", digest)
    expect_ok("edition seal",
              one(call_uri(edition_uri, "seal", f'*dId, "golden-seal", {sig}'),
                  key="deployer"))
    edition_status = one(call_uri(edition_uri, "status"))[1]

    expect_ok("correction",
              one(call_uri(article["uri"], "correct",
                           '*dId, "golden-corr", "c1", "correction", "body", "reason"'),
                  key="deployer"))
    corrections = len(one(call_uri(article["uri"], "corrections"))[1])

    transcript = {
        "publication": one(call_uri(pub["uri"], "status"))[1],
        "proposal": one(call_uri(proposal["uri"], "status"))[1],
        "escrow": escrow_status,
        "article": article_status,
        "edition": edition_status,
        "corrections": corrections,
    }
    expected = json.loads(GOLDEN.read_text())
    for key, value in expected.items():
        expect(f"golden {key}", transcript.get(key), value)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
