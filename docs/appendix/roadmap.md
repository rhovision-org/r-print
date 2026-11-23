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
| M7 | Rust client and web sketch | In progress |
| M8 | Docs, CI and recorded verification | In progress |

The acceptance map is `spec/acceptance.yaml`; the recorded campaign is 18/18 suites on the
local 50403 devnet with rholo node build `8fe0136`.

## Next

1. Finish the Rust client gates and the web sketch's live-read adapter.
2. Enable an r-sure root on a devnet and exercise `attachCover` against a real Policy.
3. Enable an r-gen root and exercise `attachKnowledge` against a validated Claim/KAsset and
   a bound Provenance record.
4. Implement the coordination record (design edge) and a golden quantum-os outcome.
5. Add a Lean model for the escrow milestone/release/refund obligations; mark it
   `proved-model`, not a Rholang refinement.
6. Audit the escrow and the publication authority paths.

## Explicitly deferred

Subscriptions, revenue splits, investigation crowdfunding, tips, syndication, a public
testnet deployment, a Tron/EVM rail, a production relayer, and an indexer. See
[spec-only milestones](../reference/spec-only-milestones.md).

## What would make this a product

A hosted archive, a reader identity and entitlement service, a publication catalogue, a
fiat on-ramp and a legal entity. r-print deliberately stops before those; a fork owns them.
