#!/usr/bin/env python3
"""Article and mock knowledge-asset fixtures for the editorial suites."""

from __future__ import annotations

import json

import actors
import corpus
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


def _mock_entity(verify: bool) -> str:
    """One state cell with `get`/`config` and, for provenance, a `verify` arm."""
    verify_arm = (
        '  contract E(@"verify", @hash, ret) = { ret!((true, true)) } |\n'
        if verify else "")
    reply = one(f"""
new E, st, rs(`rho:registry:insertArbitrary`), ch, deployId(`rho:rchain:deployId`) in {{
  st!({{}}) |
  contract E(@"get", ret) = {{ for (@s <<- st) {{ ret!((true, s)) }} }} |
  contract E(@"config", @v, ret) = {{ for (@_ <- st) {{ st!(v) | ret!((true, Nil)) }} }} |
{verify_arm}  rs!(bundle+{{*E}}, *ch) |
  for (@u <- ch) {{ deployId!(u) }}
}}
""")
    if not isinstance(reply, str):
        raise AssertionError(f"mock entity: {reply!r}")
    return reply


def mock_knowledge(author: str = "reporter1") -> tuple[str, str, str]:
    """A configured Claim, KAsset and Provenance stand-in with reciprocal references."""
    claim = _mock_entity(False)
    kasset = _mock_entity(False)
    provenance = _mock_entity(True)
    address = actors.address(author)
    states = [
        (claim, {"status": "validated", "claimant": address,
                 "kassetRef": {"uri": kasset}}),
        (kasset, {"status": "validated", "claimRef": {"uri": claim}}),
        (provenance, {"assetRef": {"uri": kasset, "claimRef": {"uri": claim}},
                      "writers": [address]}),
    ]
    for uri, payload in states:
        configured = one(call_uri(uri, "config", json.dumps(payload)))
        if not (isinstance(configured, tuple) and configured and configured[0] is True):
            raise AssertionError(f"mock knowledge config {uri}: {configured!r}")
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


def attest(article: dict, kind: str = "factcheck",
           case: str | None = None):
    reply = one(call_uri(article["uri"], "attest",
                         f'*dId, "attest:{article["article_id"]}", "fact-1", "{kind}", "evidence"'),
                key="reporter2")
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"attest: {reply!r}")
    if case:
        corpus.assert_row(case, reply)
    return reply


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
