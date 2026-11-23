#!/usr/bin/env python3
"""Optional sibling surfaces: r-gen and r-sure adapters and their disabled defaults."""

from __future__ import annotations

from article_fixture import mock_knowledge
from assertions import expect, expect_ok, expect_refusal, one
from helpers import call_uri, resolve_component
from preflight import require_devnet


def main() -> int:
    print("unit-interfaces")
    if not require_devnet("unit-interfaces"):
        return 2
    rgen = resolve_component("component:rgen-adapter")
    rsure = resolve_component("component:rsure-adapter")

    expect_refusal("rgen health disabled", one(call_uri(rgen, "health")), "disabled")
    expect_refusal("rsure health disabled", one(call_uri(rsure, "health")), "disabled")
    expect_refusal("identity disabled",
                   one(call_uri(rgen, "identity", '"1111address"')), "disabled")
    expect_refusal("credential disabled",
                   one(call_uri(rgen, "credential", '"rho:id:credential"')), "disabled")

    kasset, claim, provenance = mock_knowledge()
    expect_ok("claim read", one(call_uri(rgen, "claim", f'"{claim}"')))
    expect_ok("kasset read", one(call_uri(rgen, "kasset", f'"{kasset}"')))
    expect_ok("provenance verify",
              one(call_uri(rgen, "provenance", f'"{provenance}", "hash"')))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
