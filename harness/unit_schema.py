#!/usr/bin/env python3
"""Terms suite: role, DID, charter, commission, article and edition validation."""

from __future__ import annotations

from assertions import expect, expect_ok, expect_refusal, one
from helpers import call_uri, resolve_component
from preflight import require_devnet
from publication_fixture import charter_literal, members_literal, quoted

import deploy as node


def main() -> int:
    print("unit-schema")
    if not require_devnet("unit-schema"):
        return 2
    keys = node.load_keys()
    terms = resolve_component("component:terms")

    expect_ok("valid role", one(call_uri(terms, "role", '"writer"')))
    expect_refusal("bad role", one(call_uri(terms, "role", '"king"')), "role")
    for did in ("did:byoid:abc", "byoid:rev:1111abc"):
        expect_ok(f"valid did {did}", one(call_uri(terms, "did", quoted(did))))
    expect_refusal("bad did", one(call_uri(terms, "did", '"plain"')), "did")
    expect_refusal("empty did", one(call_uri(terms, "did", '""')), "did")

    key1 = f'"{keys["deployer"]["public"]}".hexToBytes()'
    key2 = f'"{keys["admin1"]["public"]}".hexToBytes()'
    expect_ok("solo admins", one(call_uri(terms, "admins", f'[{key1}], 1')))
    expect_refusal("empty admins", one(call_uri(terms, "admins", "[], 1")), "admins")
    expect_refusal("duplicate admins",
                   one(call_uri(terms, "admins", f'[{key1}, {key1}], 1')),
                   "duplicate key")
    expect_refusal("admin threshold",
                   one(call_uri(terms, "admins", f'[{key1}, {key2}], 3')),
                   "threshold")
    expect_refusal("single arbitrator",
                   one(call_uri(terms, "arbitrators", f'[{key1}], 1')),
                   "arbitrators")
    expect_ok("two arbitrators",
              one(call_uri(terms, "arbitrators", f'[{key1}, {key2}], 2')))

    members = members_literal([("deployer", "publisher"), ("reporter1", "writer")])
    charter = charter_literal(keys, ["deployer"], 1)
    expect_ok("valid charter", one(call_uri(terms, "charter", f'{charter}, {members}')))
    bad_asset = charter.replace('"assetId": "REV"', '"assetId": "NOPE"')
    expect_refusal("bad asset", one(call_uri(terms, "charter", f'{bad_asset}, {members}')),
                   "asset")
    bad_split = charter.replace('"revenueSplit": []',
                                '"revenueSplit": [{"memberId": "m", "bps": 9000}]')
    expect_refusal("bad split", one(call_uri(terms, "charter", f'{bad_split}, {members}')),
                   "split")
    no_publisher = members_literal([("reporter1", "writer")])
    expect_refusal("no publisher", one(call_uri(terms, "charter", f'{charter}, {no_publisher}')),
                   "member")

    milestones = ('[{"id": "m1", "kind": "stipend", "amount": 40, "deadlineHeight": 100},'
                  ' {"id": "m2", "kind": "final", "amount": 60, "deadlineHeight": 200}]')
    commission = f'{{"total": 100, "milestones": {milestones}}}'
    expect_ok("valid commission", one(call_uri(terms, "commission", commission)))
    bad_total = f'{{"total": 99, "milestones": {milestones}}}'
    expect_refusal("commission sum", one(call_uri(terms, "commission", bad_total)), "total")
    bad_kind = milestones.replace('"stipend"', '"sausage"')
    expect_refusal("milestone kind",
                   one(call_uri(terms, "commission", f'{{"total": 100, "milestones": {bad_kind}}}')),
                   "milestone")

    authors = ('[{"memberId": "1111a", "did": "did:byoid:a", "bylineHash": "b"}]')
    article = ('{"contentHash": "c", "license": "cc-by-4.0", "customLicenseHash": "", '
               '"access": "open", "authors": ' + authors + '}')
    expect_ok("valid article", one(call_uri(terms, "article", article)))
    expect_refusal("bad license",
                   one(call_uri(terms, "article",
                                article.replace('"cc-by-4.0"', '"sausage"'))),
                   "license")
    expect_refusal("bad access",
                   one(call_uri(terms, "article", article.replace('"open"', '"secret"'))),
                   "access")

    expect_ok("valid edition",
              one(call_uri(terms, "edition", '{"number": 1, "titleHash": "t"}')))
    expect_refusal("bad edition",
                   one(call_uri(terms, "edition", '{"number": 0, "titleHash": "t"}')),
                   "edition")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
