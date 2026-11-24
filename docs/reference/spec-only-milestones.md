# Spec-only milestones

> **Status:** Design. These are named edges, not deployed contracts.

| Edge | Attachment point | Why deferred |
|---|---|---|
| `entitles: subscription → article` | `article.access`, publication treasury | Reader billing and entitlement are a business model, not a primitive |
| `splitsRevenue: publication → member` | `charter.revenueSplit` bps | Needs a revenue ledger and a payment source |
| `licenses: syndication → kasset` | KAsset URI and split | Needs a rights model and a buyer |
| `coordinates: publication → room` | coordination record | quantum-os is POC-stage |
| `recordsOutcome: coordination_record → room` | room/poll hashes | Same |
| `claimsLoss: policy → sure_claim` | r-sure `Policy("openClaim")` | Needs the policy token holder and a breach definition |
| `settles: line → account` | r-sure `Line("pay")`/`Policy("settleClaim")` | Needs an agreed cover claim |
| `anchorsDID: member → did` | member row | BYOID verification is off-chain |

## Attachment rule

A spec-only feature must attach to an existing field or arm without changing v0.1 cell
semantics. For example, a subscription cell reads `article.access` and the publication
treasury; it does not add a mutable counter to `publicationState`. A revenue ledger reads
`charter.revenueSplit`; it does not change the charter's validation.

## Escrow and insurance

The baseline escrow is not deprecated by these milestones. The r-sure surface is the
scaling path: `covers` records a policy, `claimsLoss` opens a claim, and `settles` pays an
agreed claim. Each is a separate edge with its own token holder and authority. A publication
can use escrow alone, cover alone, or both.

## K-Assets

K-Assets are optional. `Article.attachKnowledge` is implemented and verifies the reciprocal
Claim ↔ KAsset references, the bound Provenance and the article content hash, the author and an
optional credential; `requireKAsset` is an opt-in gate. A future edition policy could require a
KAsset for inclusion, but it must be a policy flag, not a change to the article lifecycle.

## Coordination

The coordination record is design. When implemented, it should anchor a room id hash, a poll
id hash, an outcome hash and a signer set, and verify each signer's signature over the
canonical text. It must remain provenance, not authority.
