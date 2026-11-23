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
`e2d073d`. All are local or CI Docker results, not a public testnet or mainnet claim.

## Labels

| Label | Meaning |
|---|---|
| **Implemented** | Source exists; `spec-check` and `parse-check` pass; named suites are intended and recorded when run. |
| **Implemented, not exercised** | Source and static gates pass; no healthy-devnet suite run is recorded. |
| **Surface** | An optional adapter or arm exists; sibling roots are disabled by default and must be configured. |
| **Design** | A named edge or feature with no deployed contract. |
| **Out of scope** | Deliberately not in this repository. |

Never read "implemented" as "audited", "production-ready" or "safe for real value".

## What is implemented

| Area | Evidence |
|---|---|
| 13 deploy terms build, measure and parse | `make spec-check`, `make parse-check` |
| Publication, roster, roles, solo mode, arbitration | `publication`, `membership_auth`, `admin_keys` |
| Commission proposal, escrow, milestones, cancel, expire, dispute | `commission`, `commission_refusals`, `commission_dispute`, `conservation` |
| Article lifecycle, reviews, corrections, retraction | `article`, `article_refusals`, `corrections` |
| Edition manifest and editor signature | `edition`, `behavior` |
| Optional r-sure cover surface | `CommissionProposal.attachCover`, `interfaces`, `commission` |
| Optional r-gen Claim/KAsset/Provenance surface | `Article.attachKnowledge`, `interfaces`, `article` |
| Pause scope | `pause_scope` |
| Named integration graph | `make check-graph` |
| Live client layer | `make client-check`; `make client-live`; `make cli-live`; recorded `deployments/live-client-results.json` |
| Browser e2e layer | `make web-e2e-fixture`; `make web-e2e-live`; recorded `deployments/browser-e2e-results.json` |

## What is surface

The r-sure adapter (`configs/rsure.json`) and r-gen adapter (`configs/rgen.json`) are
`enabled: false` by default. `health` returns `(false, "disabled")`. `attachCover` and
`attachKnowledge` still verify the URI they are given by calling the entity contract, which
lets a publication attach a policy or a K-Asset without a configured sibling root. The full
broker/underwriting/claim flow is not enabled.

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
make client-check
make unit-all
make client-live
make cli-live
make web-e2e-install
make web-e2e-fixture
make web-e2e-live NODE=http://127.0.0.1:40403
```

A suite that cannot reach a healthy devnet reports `not_run`, never a pass. A live-client
claim needs `deployments/live-client-results.json` with `pass: true`; a fixture or unit test
is not a live run.
