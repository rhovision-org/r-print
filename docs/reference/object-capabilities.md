# Object capabilities

> **Status:** Source-to-register review. Not a Rholang semantics proof.

Every contract is reachable only through a capability: a published bundle, a
private cell name or an ambient system channel. The register is
`spec/audit/capabilities.yaml`; `tools/check_capabilities.py` keeps it in step
with the deployed source.

## The surface

| Kind | Count | Examples |
|---|---|---|
| Published bundles | 21 | `PrintRoot`, `PrintAdmin`, `Publication`, `CommissionEscrow`, `Article`, `Edition`, the adapters |
| Ambient channels | 3 | `rho:registry:lookup`, `rho:registry:insertArbitrary`, `rho:rchain:deployerId` |
| Private names | 2 | state cells, `PurseKeeper` |

A bundle is a capability, not an endorsement. A URI is a designation; a
consumer that uses a raw `rho:id:` URI instead of resolving the canonical root
can be handed a look-alike contract. The register records the forge path and
the hazard for every row.

## Authority checks

| Contract | Authority |
|---|---|
| `PrintRoot` | installer only for `register`; resolution is public |
| `PrintAdmin` | admin multisig and a monotone nonce |
| `Publication` | caller key derived from the deploy; roster writes are publisher-only; the last publisher guard |
| `CommissionProposal` | writer proposes, editor accepts, any signer funds, editor/publisher attach a cover |
| `CommissionEscrow` | writer submits, editor/publisher releases, writer/funder dispute, the arbitration quorum arbitrates |
| `Article` | author submits and attaches knowledge; editor/publisher approves, publishes, corrects and retracts |
| `Edition` | editor appends and seals |
| `Payments` | owner-only withdraw; capability-valued account and purse facets are not returned to a non-owner |
| `RgenAdapter` / `RsureAdapter` | read-only passthrough; no creation |

`PurseKeeper` is private to the escrow closure. A leaked keeper could pay the
writer outside the milestone guard; the register records that hazard and the
checker rejects a capability sent into a state cell.

## The accepted capability finding

RPA-001 is the one disposition that is not `holds`: the sibling adapters check
the *shape* of a policy or knowledge chain, not that the pinned r-sure/r-gen
factory issued it. A fake policy that returns `active`, the right insured and
the right asset can be attached; a self-consistent fake Claim/KAsset/Provenance
set can satisfy the reciprocal checks. The red-team probes RT-007 and RT-011
record the accepted behaviour.

The v0.1 boundary is deliberate and documented; M14 must either add a factory
membership check or keep the risk acceptance with its expiry.

## What is not proved

Name unforgeability, ERTP purse atomicity and signature soundness are boundary
assumptions in `spec/lean/RPrint/Model/System.lean`. The register is a drift
check over the source, not a proof that the guards are semantically correct.
