#!/usr/bin/env python3
"""Optional sibling surfaces: r-gen and r-sure adapters and their disabled defaults."""

from __future__ import annotations

from article_fixture import mock_knowledge
from assertions import expect, expect_ok, expect_refusal, one
from helpers import call_uri, resolve_component
from preflight import require_devnet

import sibling_fixture


def main() -> int:
    print("unit-interfaces")
    if not require_devnet("unit-interfaces"):
        return 2
    rgen = resolve_component("component:rgen-adapter")
    rsure = resolve_component("component:rsure-adapter")

    rgen_health = one(call_uri(rgen, "health"))
    rsure_health = one(call_uri(rsure, "health"))
    if rgen_health == (False, "disabled"):
        expect_refusal("rgen health disabled", rgen_health, "disabled")
        expect_refusal("identity disabled",
                       one(call_uri(rgen, "identity", '"1111address"')), "disabled")
        expect_refusal("credential disabled",
                       one(call_uri(rgen, "credential", '"rho:id:credential"')), "disabled")
    else:
        expect_ok("rgen health enabled", rgen_health)
    if rsure_health == (False, "disabled"):
        expect_refusal("rsure health disabled", rsure_health, "disabled")
    else:
        expect_ok("rsure health enabled", rsure_health)

    claim, kasset, provenance = mock_knowledge()
    expect_ok("claim read", one(call_uri(rgen, "claim", f'"{claim}"')))
    expect_ok("kasset read", one(call_uri(rgen, "kasset", f'"{kasset}"')))
    expect_ok("provenance verify",
              one(call_uri(rgen, "provenance", f'"{provenance}", "hash"')))
    info = one(call_uri(rgen, "provenanceInfo", f'"{provenance}"'))
    expect_ok("provenance info", info)
    expect("provenance asset", info[1].get("assetRef").get("uri"), kasset)
    expect_refusal("provenance info empty uri",
                   one(call_uri(rgen, "provenanceInfo", '""')), "uri")

    slip = one("""
new S, rs(`rho:registry:insertArbitrary`), ch, deployId(`rho:rchain:deployId`) in {
  contract S(@"info", ret) = {
    ret!((true, {"status": "active", "premium": 500}))
  } |
  rs!(bundle+{*S}, *ch) |
  for (@u <- ch) { deployId!(u) }
}
""")
    if not isinstance(slip, str):
        raise AssertionError(f"slip mock: {slip!r}")
    slip_info = one(call_uri(rsure, "slip", f'"{slip}"'))
    expect("slip status", slip_info[1].get("status"), "active")
    expect("slip premium", slip_info[1].get("premium"), 500)

    fixture = sibling_fixture.load()
    if fixture and fixture.get("rgen", {}).get("identityAddress"):
        identity = one(call_uri(rgen, "identity",
                                f'"{fixture["rgen"]["identityAddress"]}"'))
        expect_ok("rgen identity", identity)
    if fixture and fixture.get("rsure", {}).get("slipUri"):
        real_slip = one(call_uri(rsure, "slip", f'"{fixture["rsure"]["slipUri"]}"'))
        expect_ok("rsure slip", real_slip)
        expect("real slip status", real_slip[1].get("status"),
               fixture["rsure"].get("slipStatus"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
