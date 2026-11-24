#!/usr/bin/env python3
"""r-gen knowledge suite: strict chain binding against real sibling artifacts."""

from __future__ import annotations

import corpus
from article_fixture import (approve, create_article, editorial_publication,
                             publish, submit)
from assertions import expect, expect_ok, expect_refusal, one
from helpers import call_uri
from preflight import require_devnet

import sibling_fixture

import deploy as node


def attach(article: dict, kasset: str, claim: str, provenance: str,
           credential: str = "", op: str = "knowledge-1"):
    return one(call_uri(
        article["uri"], "attachKnowledge",
        f'*dId, "{op}:{article["article_id"]}", "{kasset}", "{claim}", '
        f'"{provenance}", "{credential}"'), key="reporter1")


def main() -> int:
    print("unit-knowledge")
    if not require_devnet("unit-knowledge"):
        return 2
    fixture = sibling_fixture.load()
    if not fixture or not fixture.get("rgen"):
        print("unit-knowledge: not_run (no sibling fixture; run make sibling-fixture)")
        return 2
    rgen = fixture["rgen"]
    kasset = rgen["kassetUri"]
    claim = rgen["claimUri"]
    provenance = rgen["provenanceUri"]
    credential = rgen["credentialUri"]
    content_hash = rgen["contentHash"]

    pub = editorial_publication("knowledge")
    article = create_article(pub, content_hash)
    submit(article)

    expect_refusal("empty kasset", attach(article, "", claim, provenance), "kasset")
    expect_refusal("empty claim", attach(article, kasset, "", provenance), "claim")
    expect_refusal("empty provenance", attach(article, kasset, claim, ""), "provenance")
    expect_refusal("kasset claim mismatch",
                   attach(article, kasset, rgen["secondClaimUri"], provenance),
                   "kasset claim")
    expect_refusal("claim kasset mismatch",
                   attach(article, rgen["claimKassetMismatchKassetUri"],
                          rgen["claimKassetMismatchClaimUri"], provenance),
                   "claim kasset")
    claim_status = attach(article, rgen["rejectedKassetUri"],
                          rgen["rejectedClaimUri"], provenance)
    expect_refusal("claim status", claim_status, "claim status")
    corpus.assert_row("KNO-attach-claim-status", claim_status)
    expect_refusal("provenance asset",
                   attach(article, kasset, claim, rgen["wrongAssetProvenanceUri"]),
                   "provenance asset")
    expect_refusal("provenance claim",
                   attach(article, kasset, claim, rgen["provenanceClaimMismatchUri"]),
                   "provenance claim")
    expect_refusal("provenance hash",
                   attach(article, kasset, claim, rgen["hashMismatchProvenanceUri"]),
                   "provenance hash")
    expect_refusal("author",
                   attach(article, rgen["nonAuthorKassetUri"],
                          rgen["nonAuthorClaimUri"], rgen["nonAuthorProvenanceUri"]),
                   "author")
    for label, uri in (
        ("revoked credential", rgen["revokedCredentialUri"]),
        ("expired credential", rgen["expiredCredentialUri"]),
        ("wrong subject credential", rgen["otherSubjectCredentialUri"]),
    ):
        expect_refusal(label,
                       attach(article, kasset, claim, provenance, uri),
                       "credential")

    attached = attach(article, kasset, claim, provenance, credential)
    expect_ok("knowledge attach", attached)
    knowledge = one(call_uri(article["uri"], "knowledge"))[1]
    expect("kasset link", knowledge.get("kassetUri"), kasset)
    expect("claim link", knowledge.get("claimUri"), claim)
    expect("provenance link", knowledge.get("provenanceUri"), provenance)
    expect("credential link", knowledge.get("credentialUri"), credential)
    expect("knowledge height", knowledge.get("atHeight") > 0, True)
    info = one(call_uri(article["uri"], "info"))[1]
    expect("hash unchanged", info.get("contentHash"), content_hash)
    expect("status unchanged", info.get("status"), "submitted")

    expect_ok("knowledge replay",
              attach(article, kasset, claim, provenance, credential))
    expect_refusal("knowledge overwrite",
                   attach(article, rgen["secondKassetUri"], rgen["secondClaimUri"],
                          rgen["wrongAssetProvenanceUri"], op="knowledge-2"),
                   "knowledge")

    draft = create_article(pub, content_hash, label="draft")
    expect_refusal("draft article", attach(draft, kasset, claim, provenance, credential),
                   "status")

    published = create_article(pub, content_hash, label="published")
    submit(published)
    approve(published)
    publish(published)
    expect_refusal("published article",
                   attach(published, kasset, claim, provenance, credential),
                   "status")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
