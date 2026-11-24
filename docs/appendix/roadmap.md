# Roadmap and acceptance milestones

> **Status:** The measured v0.1 foundation is complete; the rest is planned or design.

## Recorded milestones

| Milestone | Scope | Status |
|---|---|---|
| M0 | Scaffold and static gates | Passing |
| M1 | Root, admin, payments | Passing |
| M2 | Publication and membership | Passing |
| M3 | Commission proposal and escrow | Passing |
| M4 | Articles, corrections, editions, interfaces | Passing |
| M5 | Pause scope | Passing |
| M6 | Golden small-newsroom transcript | Passing |
| M7 | Rust client and live web client | Passing |
| M8 | Docs, CI and recorded verification | Passing (dispatch run 45250733118) |
| M9 | Horizontal live client layer | Passing on the recorded local and CI devnets |
| M10 | Browser end-to-end layer | Passing: 27 fixture tests and a 13-step live browser journey (CI dispatch 45270193372) |
| M11 | Lean 4 formal model | Passing; M13 extends the model to 188 theorems, 62 vectors, 43 flow rules and 19 `proved-conformance` rules |
| M12 | Sibling surfaces | Passing locally (2026-11-24): 18/18 suites, 2/2 real-sibling suites (43 assertions), CLI cover + knowledge, 12-step web live smoke; CI dispatch pending because the commits are unpushed |
| M13 | Rigor ledger, conformance and audit | Partial (2026-11-24): 26 invariants, 31 guard arms, 28 race pairs (15 proved, 13 owed), 19 conformance arms, 10 findings, 11 red-team probes, 32 HAZOP rows; the owed race pairs and factory guards close in M14 |

The acceptance map is `spec/acceptance.yaml`; the recorded contract campaign is 18/18 suites
on the local 50403 devnet with rholo node build `8fe0136`. A fresh 2026-11-24 local 40403
devnet with the pinned r-sure and r-gen roots then recorded 18/18 suites (232 assertions),
2/2 sibling suites (43 assertions), the CLI cover + knowledge journey and a 12-step web smoke.
The live client smoke recorded 11 finalized steps on the same devnet with node build
`5b9685e`. The CI devnet dispatch run
recorded 18/18 suites and 11/11 finalized live steps on the pinned node build `e2d073d`.
The browser layer records 27 fixture tests over two projects and a 13-step live Chromium
journey with 10 finalized writes and 1 refusal, locally on node build `5b9685e` and in CI
dispatch 45270193372 on the pinned node build `e2d073d` (18/18 suites and 11/11 live-client
steps in the same job).

## Next

1. Dispatch the M12 CI devnet job after the commits are pushed and record the run id and
   counts.
2. M14: close the material gaps — milestone binding and the 13 owed race pairs, shallow
   factory models, schemas, the live escrow journey, the adapter membership decision and an
   independent technical review.
3. M15: the completeness surfaces — coordination record, subscriptions, revenue splits,
   syndication, multi-validator and testnet campaigns.

## Explicitly deferred

Subscriptions, revenue splits, investigation crowdfunding, tips, syndication, a public
testnet deployment, a Tron/EVM rail, a production relayer, an indexer, and a Rholang
refinement theorem for the Lean model. See
[spec-only milestones](../reference/spec-only-milestones.md).

## What would make this a product

A hosted archive, a reader identity and entitlement service, a publication catalogue, a
fiat on-ramp and a legal entity. r-print deliberately stops before those; a fork owns them.
