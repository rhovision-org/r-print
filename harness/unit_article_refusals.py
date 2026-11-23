#!/usr/bin/env python3
"""Article refusal suite: author/editor roles, state gates and optional knowledge role."""

from __future__ import annotations

import actors
from article_fixture import (approve, attach_knowledge, create_article,
                             editorial_publication, mock_knowledge, publish,
                             submit)
from assertions import expect_refusal, one
from helpers import call_uri
from preflight import require_devnet


def main() -> int:
    print("unit-article-refusals")
    if not require_devnet("unit-article-refusals"):
        return 2
    for name in ("reporter1", "reporter2"):
        actors.ensure_vault(name)

    pub = editorial_publication("article-refusals")
    article = create_article(pub, "content:r1")
    expect_refusal("non-author submit",
                   one(call_uri(article["uri"], "submit",
                                '*dId, "bad-submit", "content:r1"'), key="reporter2"),
                   "not author")
    submit(article)
    expect_refusal("writer cannot approve",
                   one(call_uri(article["uri"], "approve", '*dId, "writer-approve"'),
                       key="reporter1"),
                   "role")
    expect_refusal("publish from submitted",
                   one(call_uri(article["uri"], "publish", '*dId, "early-publish"'),
                       key="deployer"),
                   "status")

    kasset, claim, provenance = mock_knowledge()
    expect_refusal("factchecker cannot attach knowledge",
                   one(call_uri(article["uri"], "attachKnowledge",
                                f'*dId, "bad-know", "{kasset}", "{claim}", "{provenance}", ""'),
                       key="reporter2"),
                   "role")

    approve(article)
    publish(article)
    expect_refusal("writer cannot correct",
                   one(call_uri(article["uri"], "correct",
                                '*dId, "bad-correct", "c1", "correction", "body", "reason"'),
                       key="reporter1"),
                   "role")

    draft = create_article(pub, "content:draft", label="draft")
    expect_refusal("retract from draft",
                   one(call_uri(draft["uri"], "retract", '*dId, "draft-retract", "reason"'),
                       key="deployer"),
                   "status")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
