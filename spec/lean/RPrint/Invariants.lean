import RPrint.Linear.Cell
import RPrint.Model.Publication
import RPrint.Model.Commission
import RPrint.Model.Article
import RPrint.Model.Edition
import RPrint.Model.Adapter

/-!
# Invariant aliases

Stable names for the formal-model chapter and the flow manifest. Each alias
points at the theorem that carries the invariant; the flow manifest names the
theorem, not the alias.
-/

namespace RPrint
namespace Invariants

/-- I1 — one cell, consume and repost once; a commit is all-or-none. -/
def I1_cell_all_or_none := @commit_all_or_none
def I1_cell_no_lost_take := @take_without_put_not_wf
def I1_cell_no_nested_call := @nested_call_rejected

/-- I4 — the last publisher cannot be removed or demoted. -/
def I4_remove_last_publisher := @publication_removeMember_refuses_last_publisher
def I4_demote_last_publisher := @publication_setRole_refuses_last_publisher

/-- I6 — funding creates an active escrow for the full total. -/
def I6_fund_creates_escrow := @commission_fund_creates_active_escrow

/-- I7 — release requires a submitted milestone and prior releases. -/
def I7_release_requires_submitted := @escrow_release_requires_submitted
def I7_release_requires_prior := @escrow_release_requires_prior

/-- I8 — a milestone pays at most once. -/
def I8_pay_once := @escrow_release_pays_once

/-- I9 — terminal conservation. -/
def I9_terminal_conservation := @escrow_terminal_conserved
def I9_release_conservation := @escrow_release_conserves
def I9_cancel_conservation := @escrow_cancel_conserves
def I9_expire_conservation := @escrow_expire_conserves
def I9_arbitrate_conservation := @escrow_arbitrate_conserves

/-- I10 — cancel, expire and resolve refund at most the remaining purse. -/
def I10_cancel_refunds := @escrow_cancel_refunds_remaining
def I10_expire_conserves := @escrow_expire_conserves
def I10_resolve_conserves := @escrow_resolveDispute_conserves

/-- I12 — a published content hash is frozen. -/
def I12_published_hash_frozen := @article_publish_freezes_hash
def I12_correct_preserves_hash := @article_correct_preserves_hash
def I12_retract_preserves_hash := @article_retract_preserves_hash

/-- I13 — corrections are append-only. -/
def I13_corrections_append := @article_correct_append_only

/-- I14 — a retraction appends a record. -/
def I14_retract_appends := @article_retract_appends_record

/-- I15 — an edition append requires a published article from the publication. -/
def I15_append_published := @edition_append_requires_published_article
def I15_append_same_publication := @edition_append_same_publication
def I15_append_no_duplicate := @edition_append_refuses_duplicate

/-- I16 — a sealed manifest is bound and immutable. -/
def I16_seal_binds_manifest := @edition_seal_binds_manifest
def I16_sealed_immutable := @edition_sealed_manifest_immutable

/-- I24 — an r-sure cover is active, insured to the treasury and asset-bound. -/
def I24_cover_active := @cover_attach_requires_active_policy
def I24_cover_insured := @cover_attach_requires_insured
def I24_cover_asset := @cover_attach_requires_asset

/-- I25 — an r-gen knowledge link requires the reciprocal, authored chain. -/
def I25_kasset_claim := @knowledge_attach_requires_kasset_claim
def I25_claim_kasset := @knowledge_attach_requires_claim_kasset
def I25_provenance := @knowledge_attach_requires_provenance_hash
def I25_author := @knowledge_attach_requires_author
def I25_credential := @knowledge_attach_requires_credential

/-- I26 — a sibling link is single-assignment; an identical link is a replay. -/
def I26_cover_single := @cover_attach_single_assignment
def I26_knowledge_single := @knowledge_attach_single_assignment

end Invariants
end RPrint
