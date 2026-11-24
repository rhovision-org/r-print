# Arm reference

> **Status:** Implemented. The arm strings below are the deployed contract arms.
> The 31 mutating cornerstone arms have a guard row in `spec/guards/arms.yaml`
> (31 `proved`, 0 `partial`, 0 `owed`); 19 arms are `proved-conformance` and map to
> `spec/vectors/core.tsv`.

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
`credential`, `membership`. `RsureAdapter`: `health`, `policy`, `slip`, `membership`.
`provenanceInfo` refuses an empty URI with `uri`; the other entity reads resolve by
caller-supplied URI.

`identity` and `slip` are read-only and are `assumption` rows in the flow manifest.
`unit_interfaces` exercises a local `Slip("info")` mock, a positive r-gen identity from the
sibling fixture and a real bound r-sure slip. The membership arms check policy, claim,
KAsset and credential issuance; provenance membership remains the documented residual. The
r-gen adapter calls the root with `(key, ret)` (r-sure uses `(key, minVersion, ret)`),
normalises r-gen `Uri` state values with `.toString()`, and reads credential status from
`Credential("get")`. These details were found by the first real-sibling campaign.

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
`spec/vectors/client-ops.tsv` maps all 43 methods: 22 are `recorded`, 5 are `fixture-only`
and 8 have no live test. `make check-client-ops` keeps that map explicit; it does not claim
the 16 are live-tested.

## Reply shapes

Success is `(true, ...)`; a refusal is `(false, "reason")`; a resolver failure is
`(false, "unavailable", key)`. Every arm replies exactly once. See
[status vocabulary](status-vocabulary.md) for the reason list.
