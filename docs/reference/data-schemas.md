# Data schemas

> **Status:** Implemented shapes as deployed in v0.1. Fields marked optional are `Nil` or
> empty when absent. The top-level shapes are machine-checked by `spec/schemas/states.yaml`
> and `make check-schemas`; the gate does not check caps or cross-field invariants.

## publicationState

```
{ publicationId, charterHash, status, admins[], threshold, nonce, schemaVersion,
  charter: { nameHash, mastheadHash, taglineHash, foundedAtHeight,
             treasuryAccountId, assetId, revenueSplit[], governance{...} },
  members: { memberId -> { role, did, attestationHash, status, sinceHeight } },
  ops: { callerId:opId -> reply } }
```

`governance` carries `disputeWindowBlocks`, `commissionGraceBlocks`, `requireFactCheck`,
`maxMembers`, `arbitrators[]`, `arbitrationThreshold`.

## commissionProposalState

```
{ proposalId, publicationId, publicationUri, writerId, writerDid, editorId,
  titleHash, briefHash, total, milestones[],
  graceBlocks, disputeWindowBlocks, requireFactCheck,
  coverUri, coverStatus, coverAssetId, coverPerClaimLimit, coverAggregateRemaining,
  coverInsured, status, escrowUri, createdAtHeight, ops, schemaVersion }
```

`coverUri` starts empty; `attachCover` fills it and the five sibling fields after verification.
Milestone: `{ id, kind, amount, deadlineHeight }`.

## commissionEscrowState

```
{ escrowId, proposalId, publicationId, publicationUri, writerId, writerDid,
  editorId, funderId, assetId, purseUri, total, milestones[],
  graceBlocks, disputeWindowBlocks, hardDeadlineHeight,
  paidWriter, refundedFunder, fee, status,
  dispute: { by, reasonHash, atHeight }, nonce, ops, schemaVersion }
```

Escrow milestone: `{ id, kind, amount, deadlineHeight, status, evidenceHash,
submittedAtHeight, releasedAtHeight }`.

## articleState

```
{ articleId, publicationId, publicationUri,
  authors: [{ memberId, did, bylineHash }],
  contentHash, license, customLicenseHash, access, sectionHash,
  requireFactCheck, requireKAsset,
  kassetUri, claimUri, provenanceUri, credentialUri, knowledgeAtHeight,
  status, publishHeight, retractHeight,
  attestations: [{ id, kind, by, evidenceHash }],
  corrections: [{ id, kind, bodyHash, reasonHash, articleHash, by }],
  createdAtHeight, ops, schemaVersion }
```

`attachKnowledge` is accepted only while the article is `submitted` or `approved`; it verifies
the reciprocal Claim ↔ KAsset references, the provenance binding and content hash, the author
and an optional credential, and fills the four URI fields and `knowledgeAtHeight`.

## editionState

```
{ editionId, publicationId, publicationUri, number, titleHash, coverHash,
  articles: [{ articleId, articleUri, contentHash, kassetUri }],
  status, seal: { manifestHash, editorId, editorSig, sealedAtHeight },
  createdAtHeight, ops, schemaVersion }
```

## factoryState

```
{ ids: { entityId -> uri }, ops: { callerId:opId -> reply }, schemaVersion }
```

`ops` is optional: the publication, commission, article and edition factories carry it; the
escrow factory records `ids` and `schemaVersion`. The commission, article and edition
factories also have a `proposal`/`article`/`edition` state cell per entity.

## Caps

| Item | Cap |
|---|---|
| Publication members | 32 active (`maxMembers`) |
| Publication admins | 5 keys |
| Arbitrators | 5 keys, threshold at least 2 |
| Commission milestones | 8 |
| Commission total | 1e12 minor units |
| Article authors | 16 |
| Article attestations | 16 |
| Article corrections | 32 |
| Edition articles | 64 |
| Ops per cell | 128 (convention; the state map is bounded by use) |

## Client encoding

The client does not invent a second schema. `rprint-sdk::build_term` takes one JSON
`TermRequest`; `{"$bytes": hex}` becomes `"hex".hexToBytes()`, which is how admin,
arbitrator and signature lists cross into Rholang. Reads are explore-deploys whose term
replies on its first private name; writes are signed deploys whose reply is read from
`deployResult`. The node omits `Nil` map fields, so readers default missing fields rather
than treating them as errors.
