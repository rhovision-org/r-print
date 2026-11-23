#!/usr/bin/env python3
"""Article and mock knowledge-asset fixtures for the editorial suites."""

from __future__ import annotations

import json

import actors
from assertions import one
from helpers import block_height, call_uri, resolve_component
from publication_fixture import create_publication, quoted

import deploy as node


def editorial_publication(label: str = "article") -> dict:
    return create_publication(
        label,
        publisher="deployer",
        members=[("deployer", "publisher"), ("reporter1", "writer"),
                 ("reporter2", "factchecker")],
        admins=["deployer"], threshold=1)


def mock_knowledge(author: str = "reporter1") -> tuple[str, str, str]:
    """A configured Claim, KAsset and Provenance stand-in with reciprocal references."""
    reply = one("""
new Claim, KAsset, Provenance, kState, rs(`rho:registry:insertArbitrary`),
    c1, c2, c3, deployId(`rho:rchain:deployId`) in {
  kState!({}) |
  contract Claim(@"get", ret) = {
    for (@s <<- kState) { ret!((true, s.get("claim"))) }
  } |
  contract Claim(@"config", @state, ret) = { kState!(state) | ret!((true, Nil)) } |
  contract KAsset(@"get", ret) = {
    for (@s <<- kState) { ret!((true, s.get("kasset"))) }
  } |
  contract Provenance(@"get", ret) = {
    for (@s <<- kState) { ret!((true, s.get("provenance"))) }
  } |
  contract Provenance(@"verify", @hash, ret) = { ret!((true, true)) } |
  rs!(bundle+{*Claim}, *c1) |
  rs!(bundle+{*KAsset}, *c2) |
  rs!(bundle+{*Provenance}, *c3) |
  for (@a <- c1; @b <- c2; @c <- c3) { deployId!([a, b, c]) }
}
""")
    if not (isinstance(reply, list) and len(reply) == 3):
        raise AssertionError(f"mock knowledge: {reply!r}")
    claim, kasset, provenance = reply
    state = {
        "claim": {"status": "validated", "claimant": actors.address(author),
                  "kassetRef": {"uri": kasset}},
        "kasset": {"status": "validated", "claimRef": {"uri": claim}},
        "provenance": {
            "assetRef": {"uri": kasset, "claimRef": {"uri": claim}},
            "writers": [actors.address(author)],
        },
    }
    configured = one(call_uri(claim, "config", json.dumps(state)))
    if not (isinstance(configured, tuple) and configured and configured[0] is True):
        raise AssertionError(f"mock knowledge config: {configured!r}")
    return claim, kasset, provenance


def article_data(publication: dict, content_hash: str = "content:1",
                 author: str = "reporter1", require_kasset: bool = False) -> str:
    authors = ('[{"memberId": ' + quoted(actors.address(author))
               + ', "did": ' + quoted(f"did:byoid:{author}")
               + ', "bylineHash": "byline"}]')
    return (
        '{"publicationId": ' + quoted(publication["publication_id"])
        + ', "publicationUri": ' + quoted(publication["uri"])
        + ', "authors": ' + authors
        + ', "contentHash": ' + quoted(content_hash)
        + ', "license": "cc-by-4.0", "customLicenseHash": "", '
        + '"access": "open", "sectionHash": "section", '
        + '"requireFactCheck": false, "requireKAsset": '
        + ("true" if require_kasset else "false") + "}"
    )


def create_article(publication: dict, content_hash: str = "content:1",
                   require_kasset: bool = False, label: str = "a") -> dict:
    actors.ensure_vault("reporter1")
    factory = resolve_component("component:article-factory")
    aid = f"article:{label}:{block_height()}:{content_hash}"
    reply = one(call_uri(
        factory, "create",
        f'*dId, {quoted("create:" + aid)}, {quoted(aid)}, '
        + article_data(publication, content_hash, require_kasset=require_kasset)),
        key="reporter1")
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"create article {aid}: {reply!r}")
    return {"article_id": aid, "uri": reply[1], "publication": publication,
            "content_hash": content_hash}


def submit(article: dict, content_hash: str | None = None) -> None:
    reply = one(call_uri(article["uri"], "submit",
                         f'*dId, "submit:{article["article_id"]}", '
                         + quoted(content_hash or article["content_hash"])),
                key="reporter1")
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"submit: {reply!r}")


def attest(article: dict, kind: str = "factcheck") -> None:
    reply = one(call_uri(article["uri"], "attest",
                         f'*dId, "attest:{article["article_id"]}", "fact-1", "{kind}", "evidence"'),
                key="reporter2")
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"attest: {reply!r}")


def approve(article: dict, key: str = "deployer") -> None:
    reply = one(call_uri(article["uri"], "approve",
                         f'*dId, "approve:{article["article_id"]}"'), key=key)
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"approve: {reply!r}")


def publish(article: dict, key: str = "deployer") -> None:
    reply = one(call_uri(article["uri"], "publish",
                         f'*dId, "publish:{article["article_id"]}"'), key=key)
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"publish: {reply!r}")


def attach_knowledge(article: dict, kasset: str, claim: str, provenance: str) -> None:
    reply = one(call_uri(article["uri"], "attachKnowledge",
                         f'*dId, "know:{article["article_id"]}", '
                         f'"{kasset}", "{claim}", "{provenance}", ""'),
                key="reporter1")
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"attach knowledge: {reply!r}")


def edition_data(publication: dict, number: int = 1,
                 title: str = "edition", cover: str = "cover") -> str:
    return (
        '{"publicationId": ' + quoted(publication["publication_id"])
        + ', "publicationUri": ' + quoted(publication["uri"])
        + ', "number": ' + str(number)
        + ', "titleHash": ' + quoted(title)
        + ', "coverHash": ' + quoted(cover) + "}"
    )
