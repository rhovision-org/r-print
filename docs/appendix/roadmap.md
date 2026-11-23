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
| M10 | Browser end-to-end layer | Passing: 27 fixture tests and a 13-step live browser journey |

The acceptance map is `spec/acceptance.yaml`; the recorded contract campaign is 18/18 suites
on the local 50403 devnet with rholo node build `8fe0136`. The live client smoke recorded 11
finalized steps on the same devnet with node build `5b9685e`. The CI devnet dispatch run
recorded 18/18 suites and 11/11 finalized live steps on the pinned node build `e2d073d`.
The browser layer records 27 fixture tests over two projects and a 13-step live Chromium
journey with 10 finalized writes and 1 refusal on the local 40403 devnet (node build
`5b9685e`).

## Next

1. Enable an r-sure root on a devnet and exercise `attachCover` against a real Policy.
2. Enable an r-gen root and exercise `attachKnowledge` against a validated Claim/KAsset and
   a bound Provenance record.
3. Implement the coordination record (design edge) and a golden quantum-os outcome.
4. Add a Lean model for the escrow milestone/release/refund obligations; mark it
   `proved-model`, not a Rholang refinement.
5. Audit the escrow and the publication authority paths.

## Explicitly deferred

Subscriptions, revenue splits, investigation crowdfunding, tips, syndication, a public
testnet deployment, a Tron/EVM rail, a production relayer, and an indexer. See
[spec-only milestones](../reference/spec-only-milestones.md).

## What would make this a product

A hosted archive, a reader identity and entitlement service, a publication catalogue, a
fiat on-ramp and a legal entity. r-print deliberately stops before those; a fork owns them.
