# Web surface

> **Status:** Sketch/spec. The v0.1 browser is not a wallet or a write client.

## Routes

| Route | Screen | Reads |
|---|---|---|
| `/` | Home and local catalogue | publication/article/edition URIs |
| `/publication/:uri` | Publication | charter, roster, treasury, admins, arbitration |
| `/publication/:uri/members` | Member editor | roster rows and roles |
| `/commission/:uri` | Commission | proposal, milestones, escrow, cover |
| `/article/:uri` | Article | content hash, bylines, attestations, corrections, knowledge links |
| `/edition/:uri` | Edition | ordered manifest and seal |
| `/coordination/:uri` | Coordination record | room/poll/outcome hashes (design) |
| `/keystore` | Keystore/unlock | create or unlock a Web3 v3 document (stub) |
| `/settings` | Network settings | node, component keys |
| `/deploy` | Deploy result/history | local results |

## API

`RprintApi` maps every public arm. Read methods have fixture implementations; write methods
throw `NotImplementedError` with a documented message. The API is the contract for the later
implementation; it is not a second specification of the Rholang arms.

## Status banner

> Reference client. Devnet only. v0.1 sketch: reads are fixture-backed; writes and wallet
> are specified but not implemented. No indexer.

## Tests

Fixture read rendering, stub error messages, route coverage and a surface-coverage test that
asserts every `RprintApi` method has a documented UI entry. No wallet, signing, Playwright or
network dependency in CI.

## What to build next

Implement `WasmApi` over the deployed contracts, keep the keystore in WASM, require finality
before success, and add share-link/catalogue discovery. Do not add a backend indexer or a
fake search. The web surface is a reference, not a hosted product.
