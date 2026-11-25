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
| M11 | Lean 4 formal model | Passing; M15 extends the model to 239 theorems, 90 vectors, 46 flow rules and 20 `proved-conformance` rules |
| M12 | Sibling surfaces | Passing locally (2026-11-24): 18/18 suites, 2/2 real-sibling suites (45 assertions), 3 CLI live tests, 12-step web live smoke; a fresh CI devnet dispatch is pending owner approval (scheduled run 45405719109 failed for environmental reasons) |
| M13 | Rigor ledger, conformance and audit | Passing (2026-11-24): 26 invariants, 31 guard arms (all proved), 28 race pairs (all proved), 19 conformance arms, 10 findings, 12 red-team probes, 32 HAZOP rows |
| M14 | Close the material gaps | Partial (2026-11-24): adapter policy/claim/credential membership, 31/31 guard arms, six state schemas, live escrow journey, arm inventory; provenance membership and the independent review remain |
| M15 | Completeness surfaces | Partial (2026-11-25): coordination record implemented (19/19 suites, 259 assertions, 14 red-team probes, 47 HAZOP rows); the client-op map is 45 recorded / 0 fixture-only / 0 no live, and the browser deposits native REV and funds a commission; subscriptions, revenue splits and syndication remain design; multi-validator and testnet campaigns outstanding |

The acceptance map is `spec/acceptance.yaml`; the recorded contract campaign is 18/18 suites
on the local 50403 devnet with rholo node build `8fe0136`. A fresh 2026-11-24 local 40403
devnet with the pinned r-sure and r-gen roots then recorded 19/19 suites (259 assertions),
2/2 sibling suites (45 assertions), the CLI cover + knowledge journey and a 12-step web smoke.
The live client smoke recorded 11 finalized steps on the same devnet with node build
`5b9685e`; the 2026-11-25 extended client journey then recorded 24 finalized deploys and 34
credited methods, covering every client write and the last fixture-only reads. The CI devnet
dispatch run recorded 18/18 suites and 11/11 finalized live steps on the pinned node build
`e2d073d`. The browser layer records 28 fixture tests over two projects and an 18-step live
Chromium journey with 14 finalized writes and 1 refusal, locally on node build `5b9685e`;
the earlier 13-step version was recorded in CI dispatch 45270193372 on the pinned node build
`e2d073d` (18/18 suites and 11/11 live-client steps in the same job).

## Next

1. Re-dispatch the M12 CI devnet job from `main` and record the run id and counts.
   Scheduled run 45405719109 failed for environmental reasons (faucet finalized-fringe
   errors and a missing PyYAML step); dispatch is an owner action.
2. M14: finish the remaining gaps — the provenance membership residual (needs an r-gen
   query) and the independent technical review.
3. M15: the remaining completeness surfaces — subscriptions, revenue splits, syndication,
   multi-validator and testnet campaigns. The coordination record is implemented; its room
   and poll facts remain off-chain and it is provenance, not authority.

## Explicitly deferred

Subscriptions, revenue splits, investigation crowdfunding, tips, syndication, a public
testnet deployment, a Tron/EVM rail, a production relayer, an indexer, and a Rholang
refinement theorem for the Lean model. See
[spec-only milestones](../reference/spec-only-milestones.md).

## What would make this a product

A hosted archive, a reader identity and entitlement service, a publication catalogue, a
fiat on-ramp and a legal entity. r-print deliberately stops before those; a fork owns them.
