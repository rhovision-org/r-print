# Membership and roles

> **Status:** Implemented. `publication`, `membership_auth` and `admin_keys` pass.

## Identity is the REV address

A member is keyed by the **REV address derived from their deployer key**
(`authOwner(deployerId)`). The publisher supplies the intended address when adding a member;
only the key that derives to that address can later act as that member. This is why an
`addMember` call cannot be spoofed by passing someone else's id: the contract checks the
derived address, not a caller-supplied name.

The roster row stores `role`, `did`, `attestationHash`, `status` and `sinceHeight`. The
`did` and `attestationHash` are anchors, not proof. r-gen identity is the REV address; BYOID
DIDs are an interface-only anchor. A publication that wants r-gen credentials should read
them through the `RgenAdapter` surface, not trust the row's string.

## Roles

| Role | Intended use |
|---|---|
| `publisher` | Owns the masthead, roster and pause |
| `editor` | Accepts commissions, releases milestones, approves and publishes |
| `writer` | Authors articles and submits milestone evidence |
| `factchecker` | Attests a fact-check record and can append corrections |
| `treasurer` | A named business role; treasury actions are admin-signed |
| `contributor` | A writer-like role for occasional contributors |

Roles are metadata for authority, bylines and future revenue splits. On-chain mutation
authority is explicit: roster and pause are `publisher` actions; governance (`setAdmins`,
`setThreshold`, `setTreasury`) is the publication admin threshold.

## Roster rules

- The creator must be a member with role `publisher` at creation.
- `addMember` refuses an active duplicate, validates the role and respects `maxMembers`.
- A removed member is never deleted; `status` becomes `removed` and `roleOf` refuses.
- The last active publisher cannot be removed or demoted.
- A member can `attestSelf` their own DID/attestation hash; nobody can do it for them.
- `addMember`/`removeMember`/`setRole`/`pause` require the caller to be an active publisher.

## Solo mode

A publication may start with one publisher key, 1-of-1. That is deliberate: a solo writer
should be able to found a publication without recruiting a co-signer first. The safety
consequence is that a solo publisher must not both fund and judge a disputed commission.
At dispute time the escrow resolves the publication's arbitration authority: its
`arbitrators` set if present, else its admins if there are at least two distinct keys, else
the platform `PrintAdmin` quorum. A solo publisher can release milestones but cannot
unilaterally arbitrate against a funder.

## Authority is not reputation

A role does not prove competence. r-gen credentials and r-sure underwriting are separate
facts with separate proofs. r-print records the role the publication granted; it does not
pretend that is a credential.
