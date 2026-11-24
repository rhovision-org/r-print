import RPrint.Model.Publication
import RPrint.Model.Commission
import RPrint.Model.Article
import RPrint.Model.Edition
import RPrint.Model.Adapter

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
* `rgenKassetValidation` — an r-gen K-Asset is validated by the sibling root;
* `rsurePolicyInfo` — an r-sure `Policy("info")` read returns the stated policy facts;
* `rgenKassetInfo` — a K-Asset `get` returns the stated claim reference;
* `rgenClaimInfo` — a Claim `get` returns the stated K-Asset reference and status;
* `rgenProvenanceInfo` — a Provenance `get` returns the stated asset, claim and writers;
* `rgenCredentialVerify` — a credential verify returns the stated subject and status;
* `rsurePolicyMembership` — the pinned r-sure policy book maps a policy id to its URI;
* `rgenChainMembership` — the pinned r-gen claim and credential factories verify issued URIs;
* `rgenProvenanceResidual` — provenance membership has no query in the pinned r-gen rev;
* `rgenIdentityDirectory` — the directory lookup returns the member's identity;
* `rsureSlipInfo` — a Slip `info` read returns the stated status and premium;
* `quantumRoomOffchain` — the room/poll hashes are caller-supplied anchors and the
  room exists only off-chain.
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
  rsurePolicyInfo : Bool
  rgenKassetInfo : Bool
  rgenClaimInfo : Bool
  rgenProvenanceInfo : Bool
  rgenCredentialVerify : Bool
  rsurePolicyMembership : Bool
  rgenChainMembership : Bool
  rgenProvenanceResidual : Bool
  rgenIdentityDirectory : Bool
  rsureSlipInfo : Bool
  quantumRoomOffchain : Bool
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
    rgenKassetValidation := true
    rsurePolicyInfo := true
    rgenKassetInfo := true
    rgenClaimInfo := true
    rgenProvenanceInfo := true
    rgenCredentialVerify := true
    rsurePolicyMembership := true
    rgenChainMembership := true
    rgenProvenanceResidual := true
    rgenIdentityDirectory := true
    rsureSlipInfo := true
    quantumRoomOffchain := true }

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

/-- Composition: an r-sure cover is bound to the publication treasury and asset. -/
def system_cover_attach := @cover_attach_requires_insured

/-- Composition: an r-gen knowledge link requires the proven provenance chain. -/
def system_knowledge_chain := @knowledge_attach_requires_provenance_hash

end RPrint
