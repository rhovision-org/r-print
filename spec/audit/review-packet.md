# Independent review packet

> **Status:** Prepared, not reviewed. The review is outstanding; this document does
> not claim an independent audit.

## Independence

RPrint's audit ledger records an internal maintainer review by Patrick Mockridge.
No second party has reviewed the escrow, authority or adapter paths. A reviewer must
have no write access to this repository and must sign the report described below.

## Scope

In scope:

- escrow money and authority: fund, submit, release, cancel, dispute,
  resolveDispute, arbitrate and expire;
- publication authority: roster, roles, admin sets, last-publisher guard;
- sibling adapter membership: r-sure policy book, r-gen claim and credential
  factories, KAsset binding, and the provenance residual;
- coordination record authority: publication-bound create, the ordered signer set,
  address-bound signatures and the first-outcome terminal rule;
- live-coverage honesty: the client-op map and its evidence artifacts;
- the schema source of truth and the arm inventory.

Out of scope:

- a Rholang refinement of the Lean model;
- ERTP, phlo, cryptography, node scheduler and deploy atomicity;
- a public testnet or multi-validator campaign;
- M15 surfaces (coordination record, subscriptions, revenue splits, syndication).

## Evidence bundle

| Item | Where |
|---|---|
| Commit and branch | the commit that adds this packet |
| Static and formal gates | `make check` output |
| Lean model | `spec/lean/RPrint/`, `spec/vectors/lean.json` (90 vectors) |
| Guard bridge | `spec/guards/arms.yaml` (33 proved, 0 partial, 0 owed) |
| Race matrix | `spec/flows/races.yaml` (29 proved) |
| Invariants and assumptions | `spec/invariants.md`, `spec/proofs/rigor.yaml` (26 invariants, 25 assumptions) |
| Red-team results | `spec/audit/redteam.yaml` (14 probes: 13 fixed, 1 accepted) |
| Sibling campaign | `spec/acceptance.yaml`, `deployments/sibling-suite-results.json` |
| Live escrow journey | `deployments/cli-live-escrow-results.json` |
| Client-op map | `spec/vectors/client-ops.tsv` (29 recorded, 5 fixture-only, 11 no live) |
| Audit ledgers | `spec/audit/findings.yaml`, `closeout.yaml`, `improvement-plan.yaml`, `hazop/worksheet.yaml` |
| Known risks | RPA-001 (provenance residual), RPA-008 (8 no-live writes), RPA-009 (this review) |

## Reproduction

Offline:

```sh
make venv
make check
```

Devnet (single-validator local network):

```sh
make devnet-up rcash-keys rcash-bootstrap keys
make siblings-venv siblings-install install-with-siblings
make sibling-fixture
make unit-all
make sibling-suites-strict
make redteam
make cli-live RPRINT_SIBLINGS=1
make web-e2e-live
```

## Reviewer questions

1. Are the 26 invariants the right obligations for the v0.1 escrow and authority
   paths, and is any P0 path unstated?
2. Are the guard_eq theorems non-vacuous, and do the Bool atoms overclaim what the
   deployed Rholang checks?
3. Is the composite `articleAttachKnowledgeChain` guard an honest bridge, or does it
   hide a chain check?
4. Is the provenance membership residual acceptable for a devnet-only release, given
   the claim and KAsset are verified?
5. Do the live-coverage rows match the recorded artifacts, including the methods
   arrays in `deployments/cli-live-*.json`?
6. Are the 24 boundary assumptions complete for the claimed scope?
7. Is the disabled-sibling-root fail-open path (`(true, Nil)`) acceptable and clearly
   documented?
8. Does the escrow model's effect-omitting completion field affect any conservation
   or authority claim?
9. Do the schema gate and arm inventory enforce real drift, or are they ceremony?
10. Is the single-validator devnet campaign sufficient for the claims made, and what
    must a multi-validator campaign add?
11. Is the coordination record's signer binding sound — `rev:fromPublicKey` equality
    before `Verifier("sigOk")` — and does the terminal first-outcome rule leave any
    authority or replay gap?

## Required deliverable

A signed report that names the commit reviewed, lists findings with severity,
likelihood, risk and finding IDs, and either assigns a disposition or states
"no material findings" with the evidence reviewed. Until then RPA-009 remains
risk-accepted and the project must not describe itself as independently audited.
