# Identity and coordination

> **Status:** Surface for r-gen identity/credentials; interface-only for BYOID and
> quantum-os. `interfaces` passes; the adapters are disabled by default.

## Identity is a REV address

r-print does not invent an identity namespace. A member is keyed by the REV address derived
from their deployer key. r-gen's `IdentityDirectory("lookup", address)` is the sibling
lookup for a richer profile, and r-gen credentials are scoped qualifications with a
one-shot proof path.

The `RgenAdapter` exposes `identity(address)` and `credential(uri)`. Both are disabled unless
`configs/rgen.json` is enabled with a root manifest. A disabled call returns
`(false, "disabled")`. A publication should treat a credential URI as evidence only after
`CredentialFactory("verify")` and `Credential("check")` or `Credential("prove")` agree; it
must never fabricate a proof boolean.

BYOID is a separate anchor. A member row can carry `did` (`did:byoid:…` or
`byoid:rev:<address>`) and an `attestationHash`; verification is off-chain. This is
interface-only, not an on-chain DID registry.

## Coordination

A quantum-os room or poll is an off-chain coordination surface. The design edge
`recordsOutcome` anchors `roomIdHash`, `pollIdHash`, `outcomeHash` and a signer set in a
coordination record. The record is provenance, not authority: editorial authority remains
the publication admin set.

The current repo names this edge in `spec/graph/edges.yaml` as design. A fork that wants
quantum-os coordination can implement the record without changing publication, commission,
article or edition semantics.

## The boundary rule

r-print reads sibling facts by `rho:id:` URI. r-gen and r-sure never call back into r-print.
This is why the adapters are readers: they do not create identities, claims, K-Assets,
policies or slips. A publication that wants those primitives uses the sibling's own flow and
links the resulting URI.
