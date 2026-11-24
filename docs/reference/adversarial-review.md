# Adversarial review

> **Status:** Internal review of the M13 tranche, recorded 2026-11-24. Not an
> independent audit.

## Findings

| Id | Finding | Severity / priority | Disposition |
|---|---|---|---|
| RPA-001 | Adapter designation is not factory membership; a self-consistent fake policy or chain can pass | S2 / P0 | risk-accepted until M14 |
| RPA-002 | The release/release race claim was not proved (the model parameterised the milestone) | S3 / P1 | fixed by the milestone-binding refactor |
| RPA-005 | r-gen returned `Uri` values; comparing them to strings refused every real chain | S2 / P0 | fixed |
| RPA-006 | The r-gen root `resolve` arity was wrong | S2 / P0 | fixed |
| RPA-007 | Credential status was read from the issuance record, not `Credential("get")` | S2 / P0 | fixed |
| RPA-009 | Independent technical review is outstanding | S2 / P1 | risk-accepted until M14 |
| RPA-003, RPA-004 | The fund editor guard and the cover proposal-status guard diverged from the source | S3 / P2 | fixed |
| RPA-008 | Sixteen client writes have no live test | S3 / P2 | risk-accepted; explicit in the client-op map |
| RPA-010 | There is no schema source of truth | S4 / P2 | risk-accepted; M14 |

RPA-005, RPA-006 and RPA-007 were found by the first real-sibling campaign. The
mock-only suites could not see them: the adapter calls returned plausible
shapes while the real r-gen root was never asked for a resolve, and the real
KAsset/Claim records use `Uri` values rather than strings.

## Red-team probes

`harness/redteam.py` records 11 probes. Nine are `fixed` (the intended refusal
happened) and two are `accepted`:

| Probe | Observed | Meaning |
|---|---|---|
| RT-007 | A fake policy with `active`, treasury and asset is attached | RPA-001; v0.1 checks shape, not factory membership |
| RT-011 | A self-consistent fake Claim/KAsset/Provenance chain is attached | RPA-001; same trust boundary |

The accepted probes are evidence for a risk, not a pass. The ledger is
`spec/audit/redteam.yaml`; the recorded run is
`deployments/redteam-results.json`.

## Close-out

Every P0/P1 finding has one row in `spec/audit/closeout.yaml`. The two
risk-accepted rows expire on 2027-02-28. The adapter-membership decision is
`IMP-001`; the independent review is `IMP-005`; the live escrow and client
gaps are `IMP-003`.

## What this review does not claim

- No independent sign-off, no external audit, no penetration test.
- No public testnet or mainnet evidence.
- No claim that the adapters verify sibling factory membership.
- No claim that a `fixed` red-team probe proves the whole contract; it records
  one adversarial attempt on one devnet build.
