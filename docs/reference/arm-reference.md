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

Factory: `propose`, `issued`. Proposal reads: `info`, `status`, `milestones`, `cover`.
Proposal writes: `accept`, `fund`, `attachCover`, `cancel`.

## CommissionEscrowFactory / CommissionEscrow

Factory: `createFunded`, `issued`. Escrow reads: `info`, `status`, `balance`, `milestones`,
`cover`. Escrow writes: `submit`, `release`, `cancel`, `dispute`, `arbitrate`,
`resolveDispute`, `expire`.

## RgenAdapter / RsureAdapter

`RgenAdapter`: `health`, `claim`, `kasset`, `provenance`, `identity`, `credential`.
`RsureAdapter`: `health`, `policy`, `slip`.

## ArticleFactory / Article

Factory: `create`, `issued`. Article reads: `info`, `status`, `attestations`, `corrections`,
`knowledge`. Article writes: `submit`, `attachKnowledge`, `attest`, `approve`, `publish`,
`correct`, `retract`.

## EditionFactory / Edition

Factory: `create`, `issued`. Edition reads: `info`, `status`, `manifest`. Edition writes:
`append`, `seal`.

## Reply shapes

Success is `(true, ...)`; a refusal is `(false, "reason")`; a resolver failure is
`(false, "unavailable", key)`. Every arm replies exactly once. See
[status vocabulary](status-vocabulary.md) for the reason list.
