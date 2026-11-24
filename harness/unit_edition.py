#!/usr/bin/env python3
"""Edition suite: ordered manifest, duplicate/draft refusals and editor-signed seal."""

from __future__ import annotations

import actors
import corpus
from article_fixture import (approve, create_article, edition_data,
                             editorial_publication, publish, submit)
from assertions import expect, expect_ok, expect_refusal, one
from helpers import block_height, call_uri, resolve_component, sign_digest
from publication_fixture import quoted
from preflight import require_devnet

import deploy as node


def main() -> int:
    print("unit-edition")
    if not require_devnet("unit-edition"):
        return 2
    keys = node.load_keys()
    for name in ("reporter1",):
        actors.ensure_vault(name)

    pub = editorial_publication("edition")
    first = create_article(pub, "content:e1", label="e1")
    second = create_article(pub, "content:e2", label="e2")
    draft = create_article(pub, "content:e3", label="e3")
    for article in (first, second):
        submit(article)
        approve(article)
        publish(article)

    factory = resolve_component("component:edition-factory")
    edition_id = f"edition:{block_height()}"
    number = 1
    title = "issue-title"
    cover = "issue-cover"
    created = one(call_uri(
        factory, "create",
        f'*dId, "create:{edition_id}", {quoted(edition_id)}, '
        + edition_data(pub, number, title, cover)), key="deployer")
    expect_ok("create edition", created)
    uri = created[1]

    expect_ok("append first",
              one(call_uri(uri, "append", f'*dId, "append-1", "{first["uri"]}"'), key="deployer"))
    expect_ok("append second",
              one(call_uri(uri, "append", f'*dId, "append-2", "{second["uri"]}"'), key="deployer"))
    expect("manifest length", len(one(call_uri(uri, "manifest"))[1]), 2)
    duplicate = one(call_uri(uri, "append", f'*dId, "append-dup", "{first["uri"]}"'),
                    key="deployer")
    expect_refusal("duplicate article", duplicate, "duplicate")
    corpus.assert_row("ED-append-duplicate", duplicate)
    expect_refusal("draft article",
                   one(call_uri(uri, "append", f'*dId, "append-draft", "{draft["uri"]}"'),
                       key="deployer"),
                   "article")

    codec = resolve_component("component:codec")
    items = (f'["{edition_id}", "{pub["publication_id"]}", {number}, '
             f'"{title}", "{cover}", "content:e1", "content:e2"]')
    digest_reply = one(call_uri(codec, "hash", f'"rprint:edition:v1", {items}'))
    if not (isinstance(digest_reply, tuple) and len(digest_reply) == 2 and isinstance(digest_reply[1], bytes)):
        raise AssertionError(f"edition digest: {digest_reply!r}")
    digest = digest_reply[1]
    if not isinstance(digest, bytes):
        raise AssertionError(f"edition digest: {digest!r}")
    sig = sign_digest(keys, "deployer", digest)
    sealed = one(call_uri(uri, "seal", f'*dId, "seal-1", {sig}'), key="deployer")
    expect_ok("seal", sealed)
    corpus.assert_row("ED-seal-ok", sealed)
    status = one(call_uri(uri, "status"))
    expect("sealed status", status[1], "sealed")
    manifest = one(call_uri(uri, "manifest"))
    expect("manifest count", len(manifest[1]), 2)
    expect_refusal("append after seal",
                   one(call_uri(uri, "append", f'*dId, "append-sealed", "{first["uri"]}"'),
                       key="deployer"),
                   "status")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
