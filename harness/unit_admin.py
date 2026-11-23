#!/usr/bin/env python3
"""Platform admin suite: installed set, threshold, pause and replay refusals.

Payloads are produced by the on-chain Codec("adminPayload") arm, never reconstructed in
Python, then signed off-chain over the blake2b-256 digest.
"""

from __future__ import annotations

import actors
from assertions import expect, expect_ok, expect_refusal, one
from helpers import admin_payload, call_uri, resolve_component, sign_payload
from preflight import require_devnet

import deploy as node


def main() -> int:
    print("unit-admin")
    if not require_devnet("unit-admin"):
        return 2

    keys = node.load_keys()
    admin = resolve_component("component:admin")
    codec = resolve_component("component:codec")

    keys_reply = one(call_uri(admin, "keys"))
    expect("admin keys", keys_reply[0], True)
    if len(keys_reply[1]) != 3 or keys_reply[2] != 2:
        raise AssertionError(f"admin set: {keys_reply!r}")

    nonce = actors.admin_nonce_read() + 1
    payload = admin_payload(codec, "admin", nonce, "pauseAll", "[]")
    below = one(call_uri(admin, "admin",
                         f'{nonce}, "pauseAll", [], '
                         + sign_payload(keys, ["admin1"], payload)))
    expect_refusal("below threshold", below, "below threshold")

    replay = one(call_uri(admin, "admin", '0, "pauseAll", [], []'))
    expect_refusal("replay", replay, "replay")

    paused = one(call_uri(admin, "admin",
                          f'{nonce}, "pauseAll", [], '
                          + sign_payload(keys, ["admin1", "admin2"], payload)))
    expect_ok("pauseAll", paused)
    is_paused = one(call_uri(admin, "isPaused"))
    expect("paused flag", is_paused[1], True)

    resume_nonce = nonce + 1
    resume_payload = admin_payload(codec, "admin", resume_nonce, "resumeAll", "[]")
    resumed = one(call_uri(admin, "admin",
                           f'{resume_nonce}, "resumeAll", [], '
                           + sign_payload(keys, ["admin1", "admin2"], resume_payload)))
    expect_ok("resumeAll", resumed)
    expect("resumed flag", one(call_uri(admin, "isPaused"))[1], False)

    bad_nonce = resume_nonce + 1
    bad_payload = admin_payload(codec, "admin", bad_nonce, "setAdmins",
                                '["02' + "11" * 32 + '", 1]')
    bad = one(call_uri(admin, "admin",
                       f'{bad_nonce}, "setAdmins", ["02' + "11" * 32 + '", 1], '
                       + sign_payload(keys, ["admin1", "admin2"], bad_payload)))
    expect_refusal("threshold below two", bad, "threshold")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
