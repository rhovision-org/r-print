# Web surface

> **Status:** Implemented. Live mode is opt-in; fixture mode is the default. Browser fixture
> and live Playwright suites are recorded.

## Routes

| Route | Screen | Reads and writes |
|---|---|---|
| `/` | Home and local catalogue | publication/article/edition/commission links; create publication, commission, article |
| `/publication/:uri` | Publication | info, charter, roster, arbitration; pause, admin multisig, create edition |
| `/publication/:uri/members` | Member editor | roster; add, remove, set role, attest self |
| `/commission/:uri` | Commission | proposal, milestones, cover; accept, fund, cancel, attach cover |
| `/escrow/:uri` | Commission escrow | accounting, milestones, dispute; submit, release, cancel, dispute, arbitrate, resolve, expire |
| `/article/:uri` | Article | content hash, bylines, attestations, corrections, knowledge links; submit, attach knowledge, attest, approve, publish, correct, retract |
| `/edition/:uri` | Edition | ordered manifest and seal; create, append, seal |
| `/coordination/:uri` | Coordination record | info, status, signers, signatures; record the signed outcome |
| `/keystore` | Keystore | create, import, unlock, lock, export |
| `/network` | Network settings | mode, node, root, phlo, status, component resolution, faucet, catalogue |
| `/deploy` | Deploy history | local deploy status, block, reply/refusal/error |

## API

`RprintApi` has 45 methods: 11 reads and 34 writes. `READ_METHODS` and `WRITE_METHODS` are
exported; the tests assert they partition `API_METHODS` exactly. Every write method has a
typed form (simple specs or bespoke components) and the form-coverage test enforces it.

Live reads use `explore_call_term`; live writes use the signed-deploy `call_term`. A
`(false, reason)` reply is rendered as a refusal. Processed-with-error and finality timeouts
are errors.

## Status banner

- Fixture: "Reference client. Fixture mode: reads are fixture-backed. Switch to live in
  Network settings."
- Live locked: node, wallet locked, writes require unlock.
- Live unlocked: node, height/address, writes require finality.

## Tests

147 vitest tests cover fixture reads, fake-bridge live reads and writes, node transport
behaviour, refusals, finality, keystore storage, settings, deploy history, surface coverage
and form coverage. The WASM smoke and the devnet live script run outside the default vitest
suite.

Playwright covers the browser: 27 fixture tests in Chromium and a Pixel 7 project (all 12
routes, all 32 write methods, settings, catalogue, keystore, deploy history), plus one live
Chromium journey with 13 steps, 10 finalized writes and 1 refusal; CI dispatch 45270193372
recorded both on the pinned node `e2d073d`. The fixture suite blocks `/api` and `/wasm`; the
live suite runs against a devnet.

## What is not built

No hosted backend, indexer, search, content host, fiat ramp or account system. No public
testnet run, no audit and no multi-validator finality campaign. Commission funding assumes an
r-cash-funded account. The live browser journey is representative, not all 34 writes.
