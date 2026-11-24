# Arm reference

> **Status:** Implemented. The arm strings below are the deployed contract arms.

## PrintRoot

`resolve`, `get`, `keys`, `nonce`, `resolveMany`, `register`, `rotate`, `deprecate`,
`freeze`, `admin`.

## PrintAdmin / AdminGuard

`AdminGuard("verify", domain, nonce, action, args, sigs, admins, threshold)`;
`PrintAdmin("keys"|"isPaused"|"nonce"|"admin")`. Admin actions: `pauseAll`, `resumeAll`,
`setAdmins`, `setThreshold`.

## Payments

`health`, `ensureAccount`, `accountOf`, `depositFacet`, `refundPayment`, `issuer`,
`withdrawPayment`, `protocolOwner`, `admin`.

## Terms

`role`, `did`, `admins`, `arbitrators`, `charter`, `commission`, `article`, `edition`, `hash`.

## PublicationCellFactory / Publication

Factory: `spawn(state)`. Publication reads: `info`, `status`, `charter`, `charterHash`,
`members`, `member`, `roleOf`, `treasury`, `admins`, `arbitration`, `nonce`.
Publication writes: `addMember`, `removeMember`, `setRole`, `attestSelf`, `pause`, `admin`.

## CommissionFactory / CommissionProposal

Factory: `propose`, `issued`. Proposal reads: `info`, `status`, `milestones`, `cover`,
`coverInfo`. Proposal writes: `accept`, `fund`, `attachCover`, `cancel`. `attachCover` requires
an active policy insured to the publication treasury and matching the charter asset, and is
single-assignment.

## CommissionEscrowFactory / CommissionEscrow

Factory: `createFunded`, `issued`. Escrow reads: `info`, `status`, `balance`, `milestones`,
`cover`. Escrow writes: `submit`, `release`, `cancel`, `dispute`, `arbitrate`,
`resolveDispute`, `expire`.

## RgenAdapter / RsureAdapter

`RgenAdapter`: `health`, `claim`, `kasset`, `provenance`, `provenanceInfo`, `identity`,
`credential`. `RsureAdapter`: `health`, `policy`, `slip`. `provenanceInfo` refuses an empty URI
with `uri`; the other entity reads resolve by caller-supplied URI.

## ArticleFactory / Article

Factory: `create`, `issued`. Article reads: `info`, `status`, `attestations`, `corrections`,
`knowledge`. Article writes: `submit`, `attachKnowledge`, `attest`, `approve`, `publish`,
`correct`, `retract`. `attachKnowledge` accepts only `submitted`/`approved` articles and
verifies the reciprocal Claim/KAsset chain, provenance binding and hash, author and credential;
it is single-assignment.

## EditionFactory / Edition

Factory: `create`, `issued`. Edition reads: `info`, `status`, `manifest`. Edition writes:
`append`, `seal`.

## Client coverage

| Class | Meaning |
|---|---|
| SDK builder + web method | Every data-argument arm of publication, commission/escrow, article and edition, plus the keystore and network reads. `RprintApi` has 43 methods. |
| SDK/CLI only | Operator and read helpers that the browser does not expose (for example `terms`, raw root `get`/`keys`, adapter health). |
| Print-only | Capability-valued arms: `Payments("accountOf"|"depositFacet"|"refundPayment")` and installer `PrintRoot("register")`. A capability cannot cross a JSON boundary as a standalone client call. |

Reads use `explore_call_term`; writes use the signed-deploy `call_term`. The web client's
forms cover every write method, and `make client-wasm-smoke` pins the WASM boundary.

## Reply shapes

Success is `(true, ...)`; a refusal is `(false, "reason")`; a resolver failure is
`(false, "unavailable", key)`. Every arm replies exactly once. See
[status vocabulary](status-vocabulary.md) for the reason list.
