# Status, scope and honest limits

> **Status:** This chapter defines the labels used everywhere else in the book.

r-print v0.1 is devnet-only and unaudited. The full behavioural campaign on the local 50403
devnet passed **18/18** suites: root, payments, admin, schema, publication, membership_auth,
admin_keys, commission, commission_refusals, commission_dispute, conservation, article,
article_refusals, interfaces, pause_scope, behavior, corrections and edition. The node was
rholo node `0.1.0` build `8fe0136`. A later live-client smoke on the local 50403 devnet
(rholo node build `5b9685e`) founded a publication, wrote an article through its lifecycle
and sealed an edition: 11 steps, 11 finalized deploys. The CI dispatch devnet on the pinned
node build `e2d073d` independently recorded 18/18 suites and 11/11 finalized live steps. A
browser fixture suite covers every route and write form with the node and WASM blocked; a
live Chromium journey records 13 steps, 10 finalized writes and 1 refusal on the local
devnet. CI dispatch 45270193372 independently recorded 27 fixture tests, 18/18 suites,
11/11 live-client steps and the same 13-step browser journey on the pinned node build
`e2d073d`. The r-sure cover and r-gen knowledge arms verify their full chains. On 2026-11-24 a
fresh local 40403 devnet recorded 18/18 suites (232 assertions), 2/2 real-sibling suites (43
assertions), the CLI cover + knowledge journey and a 12-step web live smoke; the CI dispatch is
pending because the commits are unpushed.
A Lean 4.12 model covers publication authority, commission escrow, article lifecycle, edition
seal and the two sibling ties. M13 adds a 26-invariant rigor ledger, a 31-arm guard bridge, a
28-pair race matrix, a 19-arm `proved-conformance` bundle and an internal adversarial audit
(10 findings, 11 red-team probes, 32 HAZOP rows, 28 capability rows). The audit is an internal
maintainer review, not an independent audit. All are local or CI Docker results, not a public
testnet or mainnet claim.

## Labels

| Label | Meaning |
|---|---|
| **Implemented** | Source exists; `spec-check` and `parse-check` pass; named suites are intended and recorded when run. |
| **Implemented, not exercised** | Source and static gates pass; no healthy-devnet suite run is recorded. |
| **Surface** | An optional adapter or arm exists; sibling roots are disabled by default and must be configured. |
| **Design** | A named edge or feature with no deployed contract. |
| **Proved-model** | Machine-checked about the shallow Lean model, not a Rholang refinement. |
| **Out of scope** | Deliberately not in this repository. |

Never read "implemented" as "audited", "production-ready" or "safe for real value".
`proved-model` is not an audit and does not prove the deployed contract.

## What is implemented

| Area | Evidence |
|---|---|
| 13 deploy terms build, measure and parse | `make spec-check`, `make parse-check` |
| Publication, roster, roles, solo mode, arbitration | `publication`, `membership_auth`, `admin_keys` |
| Commission proposal, escrow, milestones, cancel, expire, dispute | `commission`, `commission_refusals`, `commission_dispute`, `conservation` |
| Article lifecycle, reviews, corrections, retraction | `article`, `article_refusals`, `corrections` |
| Edition manifest and editor signature | `edition`, `behavior` |
| r-sure cover chain | `CommissionProposal.attachCover` verifies active status, insured and asset; `unit_cover` recorded 16 assertions against a real Policy (2026-11-24) |
| r-gen knowledge chain | `Article.attachKnowledge` verifies reciprocal Claim/KAsset refs, provenance binding, hash, author and credential; `unit_knowledge` recorded 25 assertions against a real chain (2026-11-24) |
| Pause scope | `pause_scope` |
| Named integration graph | `make check-graph` |
| Live client layer | `make client-check`; `make client-live`; `make cli-live`; recorded `deployments/live-client-results.json` |
| Browser e2e layer | `make web-e2e-fixture`; `make web-e2e-live`; recorded `deployments/browser-e2e-results.json` |
| Lean 4 formal model | `make formal-check`; 220 theorems, 77 vectors, 45 flow rules, 19 `proved-conformance` rules, 15 core arms; `spec/lean/RPrint/Audit.lean` |
| Rigor ledger and guard bridge | `make check-rigor`, `make check-guard-bridge`, `make check-race-matrix`, `make check-conformance`; 26 invariants, 31 guard arms, 28 pairs, 19 conformance arms |
| Internal adversarial audit | `make check-audit check-closeout check-hazop check-redteam-results`; 10 findings, 6 close-out rows, 11 probes, 32 HAZOP rows |

## What is surface

The r-sure adapter (`configs/rsure.json`) and r-gen adapter (`configs/rgen.json`) are
`enabled: false` by default. `health` returns `(false, "disabled")`. The cover and knowledge
arms still read the entity by URI, so a publication can attach a policy or a K-Asset without a
configured sibling root; a credential is read from `Credential("get")` and the arm is refused
when the r-gen root is disabled. `make install-with-siblings` enables both roots and fails
closed if a manifest is missing. The recorded local campaign installed both roots and passed
2/2 sibling suites; r-gen state URIs are normalised with `.toString()` before comparison, and
r-gen's root `resolve` takes `(key, ret)` while r-sure's takes `(key, minVersion, ret)`. The
full broker/underwriting/claim flow is not enabled.

## What is design

Subscriptions and entitlements, revenue-split claims, investigation crowdfunding, tips,
syndication, the cover-claim path, on-chain DID verification and the quantum-os coordination
record are **design**. The named edges are in
[the integration graph](../reference/integration-graph.md) and `spec/spec-only.md`.

## What is out of scope

A backend server, indexer, content host, KYC, fiat ramp, tax, legal advice, anonymous
identity, and real-value operation.

## How to verify a claim

```sh
make venv
make spec-check
make parse-check
make docs-check
make formal-check
make client-check
make unit-all
make client-live
make cli-live
make web-e2e-install
make web-e2e-fixture
make web-e2e-live NODE=http://127.0.0.1:40403
# optional sibling surfaces:
make siblings-venv siblings-install install-with-siblings
make sibling-suites-strict
make client-live RPRINT_SIBLINGS=1
make cli-live RPRINT_SIBLINGS=1
```

A suite that cannot reach a healthy devnet reports `not_run`, never a pass. A live-client
claim needs `deployments/live-client-results.json` with `pass: true`; a fixture or unit test
is not a live run.
