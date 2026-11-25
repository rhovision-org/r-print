# Web client spec

> **Status:** Implemented, live in opt-in live mode. Fixture mode remains the default.
> The local live smoke and the browser fixture/live campaigns are recorded; there is no
> public testnet run.

The web client is a working client over a running node, and a fixture-backed reference client
when no node is configured. The source is under `web/`.

## Modes

| Mode | Reads | Writes | Used by |
|---|---|---|---|
| Fixture (default) | `web/src/fixtures/*.json` | Typed forms, disabled | Tests, CI, the book |
| Live (opt-in) | explore-deploy on the node | Signed deploys through WASM | A local devnet |

Live is selected by `VITE_RPRINT_MODE=live` or the Network settings screen. A live build loads
`public/wasm/rprint_wasm.js` at runtime; fixture builds and typechecks do not require Rust.

## The API interface

`web/src/lib/api.ts` declares one `RprintApi` interface with 45 methods (11 reads, 34
writes). Every method maps to a public arm:

| Group | Methods |
|---|---|
| Publication | create, info, charter, members, arbitration, addMember, removeMember, setRole, attestSelf, pause, admin |
| Commission | propose, info, accept, fund, cancel, attachCover |
| Escrow | info, submit, release, cancel, dispute, arbitrate, resolveDispute, expire |
| Article | create, info, submit, attachKnowledge, attest, approve, publish, correct, retract |
| Edition | create, info, append, seal |
| Coordination | create, info, record |
| Keystore | create, unlock |
| Network | status, component resolve |

Reads are explore-deploys; writes are signed deploys. `coordinationInfo` reads the record and
`createCoordination`/`recordCoordination` build the signed writes; all three are exercised by
the devnet live client.

## The implementations

- `live-api.ts` is the live `RprintApi`. It builds a term through `rprint-wasm`, signs at the
  current tip, submits, polls `/api/v1/deploy-status/{id}`, waits for
  `/api/is-finalized/{blockHash}`, and decodes the reply. A processed deploy is not success
  until its block is final.
- `node-client.ts` is the HTTP boundary. It is framework-free and injectable, so the same
  transport runs under React, vitest and the Node live script.
- `wasm-bridge.ts` loads the generated module and exposes wallet, signing, `build_term` and
  `decode_reply`. The key never leaves WASM. `signWithKeystore` uses a temporary wallet for
  multisig and drops it immediately.
- `fixture-api.ts` serves the read methods from `web/src/fixtures/*.json`.
- `stub-api.ts` rejects writes with `NotImplementedError`; it is the fixture write surface.
- `wasm-api.ts` re-exports `LiveApi` under the historical name.

## Typed forms and multisig

Every write method has a typed form: scalar forms come from `components/forms/specs.ts`, and
nested or multisig writes have bespoke components (`createPublication`, `proposeCommission`,
`createArticle`, `sealEdition`, `publicationAdmin`, `arbitrateEscrow`). The form registry test
fails if a write method has no form.

`MultisigPanel` fetches the canonical payload from the deployed `Codec("adminPayload")`,
collects one signature per keystore (unlocking one at a time), checks the key is in the
relevant authority set, and submits. Publication admin authority is the publication admin set;
arbitration authority comes from `Publication("arbitration")`, including the platform fallback.

## Keystore

Create, import, unlock, lock and export happen inside `rprint-wasm`. The browser stores only
the encrypted Web3 v3 document (IndexedDB, with a localStorage fallback). No password or
plaintext secret is stored in React state or on the wire.

## Discovery

No indexer, no search and no backend. The catalogue is a local list of links; the Network
screen edits it and takes a `root_uri` from `deployments/devnet.json`. Publications, articles,
editions and commissions are reached by URI.

## Tests

- 159 vitest tests: fixture reads, every live write through a fake bridge/transport, every
  read's mapping, refusals vs errors, finality timeouts, keystore storage, settings, deploy
  history, surface and form coverage.
- `web/tests/wasm-smoke.mjs`: the WASM boundary; no network.
- `web/tests/live-client.ts`: the real WASM + HTTP stack against a devnet; exercises every
  client write and the publication charter/arbitration reads, including membership changes,
  pause, proposal cancel, article attest/correct/retract and coordination create/record, and
  writes a `methods` list that `make check-client-ops` enforces.
- Playwright fixture: 28 tests across Chromium and a Pixel 7 project; every route and every
  write form; `/api` and `/wasm` are blocked to prove isolation.
- Playwright live: one Chromium journey, 18 steps, 14 finalized deploys and 1 refusal; two
  keystores, a 2-of-2 publication, article lifecycle, edition seal, a writer proposal, a
  native-vault r-cash deposit, the publisher's accept and fund, an escrow read, admin
  multisig pause and a deliberate `paused` refusal, then a reload and read-back. Its artifact
  lists `publicationAdmin` and `escrowInfo`; the earlier 13-step version was recorded in CI
  dispatch 45270193372 on the pinned node `e2d073d`.

## Browser end-to-end

```sh
make web-e2e-install
make web-e2e-fixture
make web-e2e-live NODE=http://127.0.0.1:40403
```

The suite runs against a production Vite build served by `vite preview`, not the dev server,
so the file-watcher limit cannot make CI flaky. The live test changes the hash to navigate:
a document load reinitializes the WASM wallet and locks it. It uses fresh browser contexts,
unique entity ids per run, and state waits rather than sleeps. Fixture mode is the push/PR
gate; live mode runs in the devnet job and writes
`deployments/browser-e2e-results.json`.

## Limits

Live mode is devnet-only. Reads are at the node's tip and are not finality-checked. Writes
require a funded native REV vault; commission funding needs the funder's r-cash account,
which the Network action tops up from that vault. The deposit is value-moving and has no
contract op id: after a timeout, check the deploy id rather than resubmitting. The client
does not fetch or host content. The live browser journey is a representative path, but every
one of the 34 writes has a live path through `web/tests/live-client.ts` or the CLI live
tests. The browser does not attach the r-sure cover or the r-gen knowledge chain. No public
testnet run and no audit.
