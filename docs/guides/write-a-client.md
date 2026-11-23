# Write a client

> **Status:** Implemented term builders and keystore; signing and submission stay with
> r-cash's signed-deploy client. The web client is a sketch, not a hosted product.

## The stack

| Crate | Role |
|---|---|
| `rprint-core` | Pure types, role/status enums, charter/milestone validation, canonical payloads |
| `rprint-keystore` | Web3 Secret Storage v3 encryption/decryption |
| `rprint-sdk` | JSON → Rholang literals and call-term builders for the public arms |
| `rprint-cli` | `rprint` binary; prints canonical terms |
| `rprint-wasm` | Browser facade for the same builders and the keystore |

The client does not sign by hand and does not invent a second signer. Use the r-cash
signed-deploy client for key handling, deploy signing, finality and replay. The r-print
crates give you the canonical term and the typed shapes.

## Read path

Resolve a component through `PrintRoot("resolve", key, 1)`; call the contract; wait for
finalized + processedWithSuccess + `(true, …)`. Never treat a processed deploy as success
before finality.

```text
Root("resolve", "component:publication-factory", 1)
  -> (true, uri, version)
rl!(uri) -> for (Factory <- ch) { Factory!("issued", publicationId, ret) }
```

## Write path

1. Build the term with `rprint-sdk` (or the CLI `rprint …` command).
2. Sign and submit it with r-cash.
3. Require finalized + processedWithSuccess + `(true, …)`.
4. On a replay, return the stored reply; never retry a value-moving deploy with a new op id
   unless you proved the first had no effect.

## Keystore

`rprint-keystore` encrypts a 32-byte secret into a Web3 v3 document (scrypt, AES-128-CTR,
Keccak MAC). `rprint-wasm` exposes `keystore_encrypt`/`keystore_decrypt`; the browser stores
only the encrypted document. No plaintext key crosses into JavaScript.

## Discovery

There is no indexer. A client uses a curated catalogue, a publication link, or a URI a
reader shared. The publication factory's `issued` arm is a canonical lookup, not an
enumeration API. Do not build a fake search.

## Honest limits

The v0.1 client surface is a term builder plus keystore. It does not submit directly, run a
wallet UI, or provide a hosted signer. The React reference under `web/` is a typed sketch
with fixture reads and documented stubs; see [the web surface](../reference/web-surface.md).
