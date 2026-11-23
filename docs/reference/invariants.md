# Invariants

> **Status:** Implemented obligations. The suites and the Lean model are the evidence; the
> model is `proved-model`, not a formal refinement of the deployed Rholang.

## Cells and authority

- **I1.** Each entity has one state cell with one writer. A mutating arm consumes, validates
  and reposts once; a refusal reposts unchanged.
- **I2.** A child record is bound to the canonical publication URI issued by
  `PublicationFactory("issued")`.
- **I3.** Member identity is the derived REV address. A publisher supplies an address; only
  the key that derives to it can act as that member.
- **I4.** Removing or demoting the last active publisher is refused. Removed members are
  never deleted.
- **I5.** Platform admin sets require at least two distinct keys and threshold at least two.
  Publication admin sets allow 1-of-1 solo mode.

## Escrow

- **I6.** A commission is funded once, upfront, for the full total.
- **I7.** A milestone is submitted by the writer and released by a live editor or publisher;
  no release without a prior submit; prior milestones must be released.
- **I8.** A milestone pays at most once.
- **I9.** At a terminal state, `paidWriter + refundedFunder == total` and the purse is empty.
- **I10.** `cancel`, `expire` and `resolveDispute` refund at most the remaining balance.
- **I11.** A solo publisher cannot arbitrate their own commission; the effective quorum is
  the publication arbitrators, else admins with at least two distinct keys, else the
  platform `PrintAdmin`.

## Articles and editions

- **I12.** A published article's content hash is frozen. `submit` is draft-only; approval
  and publication do not change it.
- **I13.** Corrections are append-only. No arm removes, rewrites or reorders them.
- **I14.** A retraction appends a retraction record; it does not erase the article.
- **I15.** An edition append requires a published article from the same canonical
  publication and refuses duplicates.
- **I16.** A sealed edition manifest is immutable and carries an editor signature over the
  canonical ordered manifest.

## Interfaces and money

- **I17.** BYOID DID and attestation fields are anchors, not proof. No on-chain DID
  verification is claimed.
- **I18.** A quantum-os coordination record is provenance, not authority.
- **I19.** Money is integer minor units. Block heights, not wall clocks, carry deadlines.
- **I20.** Spec-only features (subscriptions, revenue splits, crowdfunding, tips,
  syndication) do not change v0.1 cell semantics.

## Evidence map

| Invariant | Suites | Lean |
|---|---|---|
| I1 | root, publication, commission, article, edition | `RPrint.commit_all_or_none` |
| I2 | schema, publication, commission, article, edition | assumption: canonical URI binding |
| I3 | membership_auth, publication | assumption: key derivation |
| I4 | publication, membership_auth | `RPrint.publication_removeMember_refuses_last_publisher` |
| I5 | admin, admin_keys, publication | `RPrint.publication_solo_arbitration_platform` |
| I6–I10 | commission, commission_refusals, commission_dispute, conservation | `RPrint.escrow_release_pays_once`, `RPrint.escrow_release_conserves`, `RPrint.escrow_terminal_conserved` |
| I11 | commission, commission_dispute | assumption: solo arbitration quorum tie |
| I12–I16 | article, article_refusals, corrections, edition, behavior | `RPrint.article_publish_freezes_hash`, `RPrint.article_correct_append_only`, `RPrint.article_retract_appends_record`, `RPrint.edition_append_guards`, `RPrint.edition_sealed_manifest_immutable` |
| I17–I19 | interfaces, behavior, money checks | outside the model |
| I20 | spec review | outside the model |

The model evidence is `spec/lean/`; `spec/flows/core.yaml` names the carrying theorem for
each rule. The model is shallow and does not formalise ERTP, phlo, cryptography, the node
scheduler or deploy atomicity. See [Formal model](formal-model.md).
