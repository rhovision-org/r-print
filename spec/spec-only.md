# Spec-only surfaces

These edges are named in the integration graph. The coordination edges are implemented; the
revenue, subscription, syndication, cover-claim and DID edges are design-only in v0.1.

| Edge | Status | Attachment point |
|---|---|---|
| `entitles: subscription -> article` | design | A future subscription cell reads `article.access` and the publication treasury. |
| `licenses: syndication -> kasset` | design | A future licence cell references a KAsset URI and a revenue split. |
| `coordinates: publication -> room` | implemented | `CoordinationFactory.create` binds a publication, subject and room hash. |
| `records-outcome: coordination_record -> room` | implemented | `CoordinationRecord.record` anchors `roomIdHash`, `pollIdHash`, `outcomeHash` and the ordered signer set. The record is provenance, not authority. |
| `claims-loss: policy -> sure_claim` | design | Drive `Policy("openClaim")` from an escrow breach; requires the policy token holder. |
| `settles-cover: line -> account` | design | Drive `Line("pay")`/`Policy("settleClaim")` from an agreed cover claim. |
| `anchors-did: member -> did` | design | Store a BYOID anchor string; verification stays off-chain. |

The escrow baseline in `21_commission_escrow.rho` remains the default. The r-sure
Slip/Distribution/Policy/Line edges are the scaling surface for proper insurance; escrow
becomes dead money at scale, so a publication can attach an r-sure policy through
`CommissionProposal("attachCover")` without changing the baseline escrow semantics.

K-Assets are optional on articles. `Article("attachKnowledge")` links an r-gen Claim, KAsset
and Provenance record and verifies the reciprocal references, the bound content hash, the
author and an optional credential; `requireKAsset` is a publication/commission opt-in, never a
default gate.
