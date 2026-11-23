# BYOID and quantum-os adapters

> **Status:** Interface-only. DID and room/poll anchors are strings and hashes; verification
> is off-chain. No BYOID or quantum-os code is a dependency.

## BYOID

A member row and an article's author list carry a `did` that starts with `did:` or
`byoid:rev:`. The member row may also carry an `attestationHash`. These are anchors:

- they do not prove control of the DID;
- they do not prove the credential or attestation is valid;
- they do not give the publication an on-chain reputation score.

The r-gen identity path is the REV address: `RgenAdapter("identity", address)` looks up an
r-gen identity through `IdentityDirectory`. That is separate from BYOID. A publication that
wants a BYOID DID verified should do it in its client and store the result off-chain.

## Quantum-os

The design edge `recordsOutcome` anchors a room/poll outcome:

```
{ subjectRef: {kind, id, uri}, roomIdHash, pollIdHash, outcomeHash,
  signers: [memberId], signatures: [...] }
```

A signer would sign the canonical text `rprint:coord:v1|<id>|<pollIdHash>|<outcomeHash>`
and the record would verify the signature with `Verifier("sigOk")`. The record is
provenance, not authority. Editorial authority remains the publication admin set. The
coordination record is **design** in v0.1; the named edge is in
[the integration graph](integration-graph.md).

## Why interface-only

BYOID and quantum-os are POC-stage. Hard-depending on their contracts would couple r-print's
masthead to an unfinished identity or coordination protocol. The adapter boundary lets a
publication attach anchors today and swap in a verified resolver when the sibling is ready,
without changing publication, commission, article or edition state.

## Future pinning

When BYOID or quantum-os ship a stable contract, add a pinned commit to
`spec/versions.yaml`, a `configs/` entry, and an adapter arm that resolves the sibling root.
Keep the on-chain fields (`did`, `anchor`, `roomIdHash`, `pollIdHash`, `outcomeHash`) and
version the component. Do not silently reinterpret an existing anchor as a proof.
