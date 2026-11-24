# Integration graph

> **Status:** Implemented for the r-print-owned edges and the r-sure/r-gen links, recorded
> locally on 2026-11-24 (2/2 sibling suites, 45 assertions; the roots remain disabled by
> default); design for the cover-claim and coordination edges. `make check-graph` validates
> every vertex and edge in `spec/graph/`.

r-print is not a new island. It is an extension of one graph. Escrow is the baseline
settlement rail; r-sure is the surface that lets a publication buy proper insurance when
escrow becomes dead money at scale. A K-Asset is optional credibility, not a gate: a writer
can publish with a content hash alone, and a publication can opt into the r-gen Claim →
KAsset → Provenance chain when it wants stronger provenance.

## Vertices

| Vertex | Owner | What it is | Interface |
|---|---|---|---|
| `publication` | r-print | Masthead, charter, roster, roles | `component:publication-cell-factory` |
| `member` | r-print | Roster row keyed by REV address | `Publication("roleOf")` |
| `commission` | r-print | Accepted pitch, editor and milestones | `component:commission-factory` |
| `escrow` | r-print | Baseline purse, release, refund, dispute | `component:commission-escrow-factory` |
| `article` | r-print | Editorial wrapper over a content hash | `component:article-factory` |
| `edition` | r-print | Ordered, editor-sealed manifest | `component:edition-factory` |
| `correction` | r-print | Append-only correction/retraction record | `Article("correct")` |
| `review` | r-print | Fact-check/editorial/legal attestation | `Article("attest")` |
| `coordination_record` | r-print | Quantum-os room/poll anchor | `component:coordination-factory` (design) |
| `slip` | r-sure | Funded premium held until bind or expire | `component:slip-factory` |
| `distribution` | r-sure | Staged payout plan over a purse | `component:distribution-factory` |
| `policy` | r-sure | Bound cover, limits, claims | `component:policy-factory` |
| `line` | r-sure | Risk tranche | `component:line-factory` |
| `sure_claim` | r-sure | Loss/adjudication lifecycle | `component:claim-factory` |
| `rgen_claim` | r-gen | Knowledge claim; validation mints a KAsset | `component:claim-factory` |
| `kasset` | r-gen | K-Asset minted only by `Claim.validate` | `KAsset("get")` |
| `provenance` | r-gen | Hash-linked anchors bound to a KAsset | `component:provenance-factory` |
| `identity` | r-gen | Identity keyed by REV address | `component:identity-directory` |
| `credential` | r-gen | Scoped, revocable qualification | `component:credential-factory` |
| `account` | r-cash | Settlement account | `component:account-factory` |
| `purse` | r-cash | ERTP purse | `component:asset-resolver` |
| `did` | BYOID | DID/anchor string, verified off-chain | interface only |
| `room` | quantum-os | Off-chain room/poll | interface only |
| `subscription` | r-print | Reader entitlement | design |
| `syndication` | r-print | Re-publication licence | design |

## Edges

The full machine-readable list is `spec/graph/edges.yaml`. These are the named edges, not
a prose sketch.

### Organisation and editorial

| Verb | From → To | Arms | Status |
|---|---|---|---|
| `bindsRole` | publication → member | `Publication.addMember/setRole/roleOf` | implemented |
| `commissions` | publication → commission | `CommissionFactory.propose`, `CommissionProposal.accept` | implemented |
| `obligates` | commission → member | `CommissionProposal.info.writerId` | implemented |
| `byline` | article → member | `Article.info.authors` | implemented |
| `publishedIn` | article → edition | `Edition.append`, `Article.info` | implemented |
| `annotates` | correction → article | `Article.correct/retract` | implemented |
| `attests` | review → article | `Article.attest/attestations` | implemented |

### Baseline escrow

| Verb | From → To | Arms | Status |
|---|---|---|---|
| `funds` | account → escrow | `CommissionEscrowFactory.createFunded` | implemented |
| `escrows` | escrow → purse | `CommissionEscrow.balance/release` | implemented |
| `releasesMilestone` | escrow → account | `CommissionEscrow.release` | implemented |
| `refunds` | escrow → account | `CommissionEscrow.cancel/expire/resolveDispute` | implemented |

### r-sure scaling surface

| Verb | From → To | Arms | Status |
|---|---|---|---|
| `covers` | policy → commission | `CommissionProposal.attachCover`, `RsureAdapter.policy` | implemented |
| `funds` | account → slip | `Slip.fundPremium` | surface |
| `escrows` | slip → purse | `Slip.premium` | surface |
| `refunds` | slip → account | `Slip.expire` | surface |
| `binds` | slip → policy | `Slip.bind` | surface |
| `distributes` | distribution → account | `Distribution.run` | surface |
| `paysMilestone` | distribution → member | `Distribution.run` plan | surface |
| `claimsLoss` | policy → sure_claim | `Policy.openClaim` | design |
| `settles` | line → account | `Line.pay`, `Policy.settleClaim` | design |

### r-gen knowledge surface

| Verb | From → To | Arms | Status |
|---|---|---|---|
| `identifiedBy` | member → identity | `RgenAdapter.identity`, `IdentityDirectory.lookup` | surface |
| `credentialedBy` | member → credential | `RgenAdapter.credential`, `CredentialFactory.verify` | implemented |
| `validatesClaim` | credential → rgen_claim | `Claim.validate`, `Credential.prove` | surface |
| `mintsKAsset` | rgen_claim → kasset | `Claim.validate → makeKAsset` | surface |
| `asserts` | kasset → rgen_claim | `KAsset.get.claimRef`, `RgenAdapter.kasset` | implemented |
| `provenanceOf` | provenance → kasset | `ProvenanceFactory.createBound` | surface |
| `anchorsHash` | provenance → article | `Provenance.anchor`, `RgenAdapter.provenance` | implemented |
| `wraps` | article → kasset | `Article.attachKnowledge`, `RgenAdapter.kasset` | implemented (optional) |
| `wrapsClaim` | article → rgen_claim | `Article.attachKnowledge`, `RgenAdapter.claim` | implemented (optional) |
| `wrapsProvenance` | article → provenance | `Article.attachKnowledge`, `RgenAdapter.provenance` | implemented (optional) |

### Coordination and design-only

| Verb | From → To | Status |
|---|---|---|
| `coordinates` | publication → room | design |
| `recordsOutcome` | coordination_record → room | design |
| `splitsRevenue` | publication → member | design |
| `entitles` | subscription → article | design |
| `licenses` | syndication → kasset | design |

## Boundary rules

- r-print reads r-gen and r-sure facts by `rho:id:` URI. r-gen and r-sure never call back
  into r-print.
- The r-sure adapters are disabled unless `configs/rsure.json`/`rgen.json` set
  `enabled: true` and a root manifest is present. A disabled adapter returns
  `(false, "disabled")`.
- The baseline escrow is the default. Attaching an r-sure policy is optional and does not
  change escrow semantics.
- `requireKAsset` is an opt-in publication/commission policy. The default article path
  works with a content hash alone.
- r-sure `Claim` and r-gen `Claim` are distinct vertices; never conflate their lives.
