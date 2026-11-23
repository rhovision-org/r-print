#!/usr/bin/env python3
"""Corrections suite: append-only order, hash binding and correction after retraction."""

from __future__ import annotations

import actors
from article_fixture import (approve, create_article, editorial_publication,
                             publish, submit)
from assertions import expect, expect_ok, one
from helpers import call_uri
from preflight import require_devnet


def main() -> int:
    print("unit-corrections")
    if not require_devnet("unit-corrections"):
        return 2
    actors.ensure_vault("reporter1")
    pub = editorial_publication("corrections")
    article = create_article(pub, "content:corrections")
    submit(article)
    approve(article)
    publish(article)
    uri = article["uri"]

    expect_ok("correction",
              one(call_uri(uri, "correct",
                           '*dId, "op-c1", "c1", "correction", "body:1", "reason:1"'), key="deployer"))
    expect_ok("clarification",
              one(call_uri(uri, "correct",
                           '*dId, "op-c2", "c2", "clarification", "body:2", "reason:2"'), key="deployer"))
    corrections = one(call_uri(uri, "corrections"))[1]
    expect("correction count", len(corrections), 2)
    expect("first kind", corrections[0].get("kind"), "correction")
    expect("second kind", corrections[1].get("kind"), "clarification")
    for entry in corrections:
        expect("hash bound", entry.get("articleHash"), "content:corrections")

    expect_ok("retract", one(call_uri(uri, "retract", '*dId, "retract-op", "reason"'),
                             key="deployer"))
    corrections = one(call_uri(uri, "corrections"))[1]
    expect("retraction appended", len(corrections), 3)
    expect("retraction kind", corrections[2].get("kind"), "retraction")

    expect_ok("correction after retraction",
              one(call_uri(uri, "correct",
                           '*dId, "op-c3", "c3", "correction", "body:3", "reason:3"'), key="deployer"))
    expect("final correction count", len(one(call_uri(uri, "corrections"))[1]), 4)
    expect("content hash immutable",
           one(call_uri(uri, "info"))[1].get("contentHash"), "content:corrections")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
