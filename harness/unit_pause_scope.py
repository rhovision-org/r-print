#!/usr/bin/env python3
"""Pause scope suite: publication pause blocks new work, never existing escrow release."""

from __future__ import annotations

import actors
from assertions import expect_ok, expect_refusal, one
from commission_fixture import (accept, commission_data, editor_publication,
                                fund, propose, release, submit)
from helpers import block_height, call_uri, resolve_component
from publication_fixture import quoted
from preflight import require_devnet
from article_fixture import article_data, editorial_publication

import deploy as node


def main() -> int:
    print("unit-pause-scope")
    if not require_devnet("unit-pause-scope"):
        return 2
    for name in ("reporter1", "reporter3"):
        actors.ensure_vault(name)

    pub = editor_publication("pause")
    proposal = propose(pub)
    accept(proposal)
    escrow = fund(proposal)
    submit(escrow, "m1")
    expect_ok("pause", one(call_uri(pub["uri"], "pause", '*dId, "pause-1", true'),
                           key="deployer"))

    commission_factory = resolve_component("component:commission-factory")
    paused_pid = f"pause-proposal:{block_height()}"
    paused = one(call_uri(
        commission_factory, "propose",
        f'*dId, "pause-propose", {quoted(paused_pid)}, '
        + commission_data(pub, "reporter3")), key="reporter3")
    expect_refusal("commission paused", paused, "paused")

    article_factory = resolve_component("component:article-factory")
    paused_article = one(call_uri(
        article_factory, "create",
        f'*dId, "pause-article", "pause-article-id", '
        + article_data(pub, "content:paused")), key="reporter1")
    expect_refusal("article paused", paused_article, "paused")

    release(escrow, "m1")
    expect_ok("release while paused",
              one(call_uri(escrow["escrow_uri"], "status")))
    expect_ok("resume", one(call_uri(pub["uri"], "pause", '*dId, "resume-1", false'),
                            key="deployer"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
