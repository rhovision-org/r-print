#!/usr/bin/env python3
"""Shared suite helpers: block height, URI calls, component resolution and admin signing."""

from __future__ import annotations

import hashlib

from assertions import one, root_uri


def call_uri(uri: str, binding: str, args: str | None = None) -> str:
    head = f'"{binding}"' + (f", {args}" if args else "")
    return f"""
new rl(`rho:registry:lookup`), ch, ret,
    dId(`rho:rchain:deployerId`), deployId(`rho:rchain:deployId`) in {{
  rl!(`{uri}`, *ch) |
  for (C <- ch) {{
    C!({head}, *ret) |
    for (@r <- ret) {{ deployId!(r) }}
  }}
}}
"""


def block_height() -> int:
    term = """
new bd(`rho:block:data`), ch, deployId(`rho:rchain:deployId`) in {
  bd!(*ch) |
  for (@n, @sender, @timestamp <- ch) { deployId!(n) }
}
"""
    height = one(term)
    if not isinstance(height, int):
        raise AssertionError(f"block height: {height!r}")
    return height


def resolve_component(key: str) -> str:
    reply = one(call_uri(root_uri(), "resolve", f'"{key}", 1'))
    if not (isinstance(reply, tuple) and reply[0] is True):
        raise AssertionError(f"resolve {key}: {reply!r}")
    return reply[1]


def admin_literal(keys: dict, names: list[str]) -> str:
    return "[" + ", ".join(
        f'"{keys[name]["public"]}".hexToBytes()' for name in names) + "]"


def sign_payload(keys: dict, names: list[str], payload: str) -> str:
    from coincurve import PrivateKey

    digest = hashlib.blake2b(payload.encode(), digest_size=32).digest()
    sigs = []
    for name in names:
        key = PrivateKey(bytes.fromhex(keys[name]["secret"]))
        sigs.append(f'"{key.sign(digest, hasher=None).hex()}".hexToBytes()')
    return "[" + ", ".join(sigs) + "]"


def admin_payload(codec: str, domain: str, nonce: int, action: str,
                  args_literal: str) -> str:
    reply = one(call_uri(
        codec, "adminPayload",
        f'"{domain}", {nonce}, "{action}", {args_literal}'))
    if not isinstance(reply, str):
        raise AssertionError(f"admin payload: {reply!r}")
    return reply


def sign_digest(keys: dict, name: str, digest: bytes) -> str:
    from coincurve import PrivateKey

    key = PrivateKey(bytes.fromhex(keys[name]["secret"]))
    return f'"{key.sign(digest, hasher=None).hex()}".hexToBytes()'
