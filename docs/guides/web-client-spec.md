# Web client spec

> **Status:** Sketch/spec. The v0.1 web app is a typed, documented surface with fixture
> reads and stubs; it is not a working wallet or write client.

The web client is specified so a later implementer (human or AI) can finish it without
re-deriving the contracts. The source is under `web/`.

## The API interface

`web/src/lib/api.ts` declares one `RprintApi` interface. Every method maps to a public arm:

| Group | Methods |
|---|---|
| Publication | create, info, charter, members, addMember, removeMember, setRole, attestSelf, pause, admin |
| Commission | propose, accept, fund, submit, release, cancel, dispute, arbitrate, expire, attachCover |
| Article | create, submit, rehash, attest, approve, publish, correct, retract, attachKnowledge |
| Edition | create, append, seal |
| Interfaces | resolve, policy, claim, kasset, provenance, identity, credential |
| Keystore | create, unlock |
| Network | status, catalogue |

Every method has a JSDoc block naming the contract, the inputs, the reply shape, the refusal
reasons and whether it is read-only or value-moving.

## The implementations

- `stub-api.ts` throws a documented `NotImplementedError` with a "v0.1 sketch" message.
- `fixture-api.ts` serves the read methods from `web/src/fixtures/*.json`.
- `wasm-api.ts` is the future live-read adapter; it is documented and stubbed.

## The screens

Home/catalogue, Publication (charter, roster, treasury, admins/arbitration), Member editor,
Commission proposal, Commission escrow (milestone timeline and actions), Article (provenance,
attestations, corrections, knowledge links), Edition (ordered manifest and seal),
Coordination record, Keystore/unlock, Network settings, Deploy result/history, NotFound.

Action panels are rendered and documented but call the stub API and show "Not implemented in
v0.1". The status banner reads:

> Reference client. Devnet only. v0.1 sketch: reads are fixture-backed; writes and wallet are
> specified but not implemented. No indexer.

## What is deliberately absent

No wallet, no signing UI, no indexer, no search, no hosted backend and no Playwright e2e in
v0.1. The Rust SDK/CLI/WASM are the working client surface; the browser is a specification
of the screens and the method contract.

## Finishing it

Implement `WasmApi` against the deployed components, keep the keystore in WASM, and require
finality before showing success. Add a catalogue or share-link discovery path; do not add a
fake search. Surface the optional r-sure policy and r-gen knowledge links as optional panels,
not gates.
