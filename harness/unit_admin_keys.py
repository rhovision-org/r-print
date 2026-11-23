#!/usr/bin/env python3
"""Admin-key suite: platform 2-of-N, publication 1-of-1 solo and arbitrator rules."""

from __future__ import annotations

from assertions import expect, expect_ok, expect_refusal, one
from helpers import call_uri, resolve_component
from preflight import require_devnet

import deploy as node


def main() -> int:
    print("unit-admin-keys")
    if not require_devnet("unit-admin-keys"):
        return 2
    keys = node.load_keys()
    terms = resolve_component("component:terms")
    admin = resolve_component("component:admin")

    installed = one(call_uri(admin, "keys"))
    expect("platform admin count", len(installed[1]), 3)
    expect("platform threshold", installed[2], 2)

    key1 = f'"{keys["deployer"]["public"]}".hexToBytes()'
    key2 = f'"{keys["admin1"]["public"]}".hexToBytes()'
    key3 = f'"{keys["admin2"]["public"]}".hexToBytes()'

    expect_ok("publication solo", one(call_uri(terms, "admins", f'[{key1}], 1')))
    expect_refusal("publication threshold zero",
                   one(call_uri(terms, "admins", f'[{key1}], 0')), "threshold")
    expect_refusal("publication threshold too high",
                   one(call_uri(terms, "admins", f'[{key1}, {key2}], 3')), "threshold")
    expect_refusal("publication duplicate",
                   one(call_uri(terms, "admins", f'[{key1}, {key1}], 1')), "duplicate key")
    expect_refusal("publication too many",
                   one(call_uri(terms, "admins",
                                f'[{key1}, {key2}, {key3}, {key1}, {key2}, {key3}], 1')),
                   "admins")

    expect_ok("arbitrator quorum",
              one(call_uri(terms, "arbitrators", f'[{key1}, {key2}, {key3}], 2')))
    expect_refusal("arbitrator singleton",
                   one(call_uri(terms, "arbitrators", f'[{key1}], 1')), "arbitrators")
    expect_refusal("arbitrator duplicate",
                   one(call_uri(terms, "arbitrators", f'[{key1}, {key1}], 2')),
                   "duplicate key")
    expect_refusal("arbitrator threshold one",
                   one(call_uri(terms, "arbitrators", f'[{key1}, {key2}], 1')), "threshold")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
