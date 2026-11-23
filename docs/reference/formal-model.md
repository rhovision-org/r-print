# Formal model

> **Status:** Implemented. The model builds with Lean 4.12 and no Mathlib. Its results are
> `proved-model`: theorems about the shallow Lean state machines, not a refinement of the
> deployed Rholang.

`proved-model` means proved about the model in `spec/lean`, not about Rholang reduction,
ERTP purse atomicity, phlo, cryptography, node scheduling or deploy atomicity. The flow
manifest is the traceability link; it is not a correctness proof of the node.

## What is proved

`spec/lean/` is a self-contained Lean project pinned to `leanprover/lean4:v4.12.0` with an
empty package manifest:

| Module | Content |
|---|---|
| `RPrint/Basic.lean` | amounts, heights, basis points, share and remainder helpers |
| `RPrint/Linear/Cell.lean` | one-value cells, `peek`/`take`/`put`/`call`/`commit`, well-formedness, D1–D3 rejection theorems |
| `RPrint/Linear/Protocol.lean` | pure helper, caller-token, delegated and await-then-commit protocols |
| `RPrint/Model/Publication.lean` | roster, roles, publisher count, last-publisher guard, pause, admin nonce and arbitration fallback |
| `RPrint/Model/Commission.lean` | proposal statuses; escrow milestones, release, cancel, expire, dispute, arbitration and conservation |
| `RPrint/Model/Article.lean` | `draft → submitted → approved → published → retracted`; hash freeze, append-only corrections, retraction |
| `RPrint/Model/Edition.lean` | `draft → sealed`; published/same-publication/duplicate/cap append guards, manifest binding, sealed terminal |
| `RPrint/Model/System.lean` | composition aliases and the explicit boundary assumptions |
| `RPrint/Invariants.lean` | stable `I`-names pointing at carrying theorems |
| `RPrint/Audit.lean` | `#print axioms` for every theorem |
| `RPrint/Emit.lean` | deterministic conformance vectors |
| `RPrint.lean` | library root; imports every module |

### Publication authority

The model proves that adding a member requires a publisher key, the member cap and duplicate
checks refuse, removing or demoting the last publisher is refused, `attestSelf` requires an
active member, pause requires a publisher, and the admin action is nonce-gated. The
arbitration fallback chooses publication arbitrators, else publication admins with at least
two keys, else the platform set. Carrying theorems include
`RPrint.publication_addMember_requires_publisher`,
`RPrint.publication_removeMember_refuses_last_publisher`,
`RPrint.publication_setRole_refuses_last_publisher`,
`RPrint.publication_admin_replay_refused` and
`RPrint.publication_solo_arbitration_platform`.

### Commission escrow

A commission is funded from an accepted proposal and creates an active escrow with the full
total. A milestone is submitted by the writer, not too late, and released by an editor only
after a prior submit; a released milestone cannot pay twice. The escrow tracks
`paidWriter + refundedFunder + purse = total` and every release, cancel, expire, dispute
resolution and arbitration preserves it. Arbitration refuses a replay and an out-of-range
split, and the writer share and refund partition the remaining purse. Carrying theorems
include `RPrint.commission_fund_creates_active_escrow`,
`RPrint.escrow_release_pays_once`, `RPrint.escrow_release_conserves`,
`RPrint.escrow_cancel_conserves`, `RPrint.escrow_expire_conserves`,
`RPrint.escrow_arbitrate_conserves` and `RPrint.escrow_terminal_conserved`.

### Article and edition

An article is submitted only from `draft` by its author, approved only by an editor (with
the optional K-Asset gate), published only from `approved`, and `publish` freezes the content
hash. Corrections and retractions append records; they never rewrite the hash or the earlier
corrections. An edition appends only a published article from the same publication, refuses
duplicates and caps the manifest at 64; `seal` requires a non-empty manifest and a signature,
binds the manifest hash and is terminal. Carrying theorems include
`RPrint.article_publish_freezes_hash`, `RPrint.article_correct_append_only`,
`RPrint.article_retract_appends_record`, `RPrint.edition_append_guards` and
`RPrint.edition_seal_binds_manifest`.

## What is not proved

The state machines are shallow. A member key is an `Id`, not a key derivation; a DID is an
anchor; a content hash is an `Id`, not a hash; a signature is a `Bool`; a purse is a `Nat`.
The model does not formalise Rholang syntax, ERTP, phlo, cryptography, the node scheduler or
deploy atomicity.

`RPrint/Model/System.lean` records the boundary as named assumptions:
`ertpPurseAtomic`, `cryptoAuthority`, `deployAtomicity`, `clockHeight`, `codecHash`,
`adminMultisig`, `schedulerFairness`, `canonicalUriBinding`, `memberKeyDerivation`,
`arbitrationQuorumTie` and `rgenKassetValidation`. These are assumptions, never theorems.

## Status vocabulary

| Label | Meaning |
|---|---|
| `proved-model` | Machine-checked about the Lean model; no node tie. |
| `proved-model-bounded` | Machine-checked over a stated finite bound. |
| `modeled` | A transition exists; no safety theorem. |
| `assumption` | An explicit boundary assumption; not proved. |
| `owed` | An arm outside the current model. |
| `open` | Not yet analysed. |

`spec/flows/core.yaml` names the carrying theorem for every model rule. `tools/check_flows.py
--strict` rejects a `proved-model` target that is a definition or constructor. The invariant
aliases in `RPrint/Invariants.lean` are for the docs; the flow manifest names the theorem.

## Audit baseline

The project builds 108 source theorems with 108 axiom audits, no `sorry`/`admit`/`axiom`/
`native_decide`, and only `propext`, `Classical.choice` and `Quot.sound`. `spec/flows/core.yaml`
has 31 rules over 31 arms, 15 core arms are `proved-model`, 26 rules are `proved-model`, and
`make check-flows-strict` reports zero proof-quality warnings. `RPrint/Emit.lean` emits 38
deterministic vectors; `spec/vectors/lean.json` is generated from them and never hand-edited.

## Run it

```sh
make lean-build          # lake build
make lean-check          # build, escape scan and axiom audit
make lean-vectors        # compare spec/vectors/lean.json with a fresh emission
make lean-vectors-write  # regenerate after an intentional transition change
make check-flows-strict  # every core arm names a theorem
make formal-check        # all of the above
```

> **Where to go deeper.** [Verification](verification.md) is the behavioural and live record.
> [Invariants](invariants.md) is the normative list and evidence map.
> [Platform constraints](platform-constraints.md) is the Rholang discipline the model
> abstracts.
