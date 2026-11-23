import RPrint.Model.Publication
import RPrint.Model.Commission
import RPrint.Model.Article
import RPrint.Model.Edition

/-!
# System composition and boundary

The four cores compose by single-cell ownership: publication authority, the
commission proposal, the escrow, the article and the edition each have one
state cell. The aliases below record which theorem carries each composition
obligation.

Everything outside the shallow model is an explicit boundary assumption. These
are not theorems and are never described as proved:
* `ertpPurseAtomic` — an ERTP purse transfer is atomic;
* `cryptoAuthority` — a signature or key derivation is sound;
* `deployAtomicity` — a deploy commits all-or-none;
* `clockHeight` — deadlines are block heights, not wall clocks;
* `codecHash` — the canonical hash is the deployed `Codec.hash`;
* `adminMultisig` — the deployed admin set and threshold are the model's;
* `schedulerFairness` — the node schedules fair;
* `canonicalUriBinding` — a child is bound to the canonical publication URI;
* `memberKeyDerivation` — a member key is the derived REV address;
* `arbitrationQuorumTie` — the deployed arbitration fallback matches the model;
* `rgenKassetValidation` — an r-gen K-Asset is validated by the sibling root.
-/

namespace RPrint

structure Boundary where
  ertpPurseAtomic : Bool
  cryptoAuthority : Bool
  deployAtomicity : Bool
  clockHeight : Bool
  codecHash : Bool
  adminMultisig : Bool
  schedulerFairness : Bool
  canonicalUriBinding : Bool
  memberKeyDerivation : Bool
  arbitrationQuorumTie : Bool
  rgenKassetValidation : Bool
  deriving DecidableEq, Repr

def boundary : Boundary :=
  { ertpPurseAtomic := true
    cryptoAuthority := true
    deployAtomicity := true
    clockHeight := true
    codecHash := true
    adminMultisig := true
    schedulerFairness := true
    canonicalUriBinding := true
    memberKeyDerivation := true
    arbitrationQuorumTie := true
    rgenKassetValidation := true }

/-- Composition: a publication member write is guarded by the publisher key. -/
def system_publication_authority := @publication_addMember_requires_publisher

/-- Composition: a proposal is accepted only by an editor from `proposed`. -/
def system_commission_accept := @commission_accept_requires_proposed

/-- Composition: a milestone release preserves escrow conservation. -/
def system_escrow_conservation := @escrow_release_conserves

/-- Composition: publish freezes the article content hash. -/
def system_article_freeze := @article_publish_freezes_hash

/-- Composition: a sealed edition binds its manifest and is terminal. -/
def system_edition_seal := @edition_seal_binds_manifest

end RPrint
