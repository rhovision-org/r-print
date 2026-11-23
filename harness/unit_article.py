#!/usr/bin/env python3
"""Article suite: lifecycle, attestation, optional K-Asset links and corrections."""

from __future__ import annotations

import actors
from article_fixture import (approve, article_data, attach_knowledge,
                             create_article, editorial_publication,
                             mock_knowledge, publish, submit, attest)
from assertions import expect, expect_ok, expect_refusal, one
from helpers import call_uri
from preflight import require_devnet

import deploy as node


def main() -> int:
    print("unit-article")
    if not require_devnet("unit-article"):
        return 2
    for name in ("reporter1", "reporter2"):
        actors.ensure_vault(name)

    pub = editorial_publication("article")
    article = create_article(pub, "content:1")
    expect("draft status", one(call_uri(article["uri"], "status"))[1], "draft")
    submit(article)
    expect("submitted status", one(call_uri(article["uri"], "status"))[1], "submitted")
    attest(article)
    atts = one(call_uri(article["uri"], "attestations"))[1]
    expect("attestation count", len(atts), 1)

    kasset, claim, provenance = mock_knowledge()
    attach_knowledge(article, kasset, claim, provenance)
    knowledge = one(call_uri(article["uri"], "knowledge"))[1]
    expect("kasset link", knowledge.get("kassetUri"), kasset)
    expect("claim link", knowledge.get("claimUri"), claim)
    expect("provenance link", knowledge.get("provenanceUri"), provenance)

    approve(article)
    expect("approved status", one(call_uri(article["uri"], "status"))[1], "approved")
    publish(article)
    info = one(call_uri(article["uri"], "info"))[1]
    expect("published status", info.get("status"), "published")
    if not isinstance(info.get("publishHeight"), int) or info["publishHeight"] <= 0:
        raise AssertionError(f"publish height: {info.get('publishHeight')!r}")

    corrected = one(call_uri(article["uri"], "correct",
                             '*dId, "corr-op", "corr-1", "correction", "body", "reason"'),
                    key="deployer")
    expect_ok("correct", corrected)
    corrections = one(call_uri(article["uri"], "corrections"))[1]
    expect("correction count", len(corrections), 1)
    expect("correction hash", corrections[0].get("articleHash"), "content:1")

    retracted = one(call_uri(article["uri"], "retract", '*dId, "retract-1", "reason"'),
                    key="deployer")
    expect_ok("retract", retracted)
    expect("retracted status", one(call_uri(article["uri"], "status"))[1], "retracted")
    expect("retraction record",
           len(one(call_uri(article["uri"], "corrections"))[1]), 2)

    gated = create_article(pub, "content:gated", require_kasset=True, label="gated")
    submit(gated)
    expect_refusal("kasset gate",
                   one(call_uri(gated["uri"], "approve", '*dId, "gate-approve"'),
                       key="deployer"),
                   "kasset")
    attach_knowledge(gated, kasset, claim, provenance)
    approve(gated)
    expect("gated approved", one(call_uri(gated["uri"], "status"))[1], "approved")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
