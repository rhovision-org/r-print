//! The canonical client request schema.
//!
//! The CLI, the WASM facade and the web client all send one JSON shape here; no caller
//! hand-writes Rholang. Writes dispatch to the signed-deploy [`call_term`] builders; reads
//! dispatch to [`explore_call_term`], because explore-deploy captures the first private
//! name rather than a `deployId` reply.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    article_approve_term, article_attach_knowledge_term, article_attest_term, article_correct_term,
    article_publish_term, article_retract_term, article_submit_term, coordination_record_term,
    create_article_term, create_coordination_term, create_edition_term, create_publication_term,
    edition_append_term, edition_seal_term, escrow_arbitrate_term, escrow_cancel_term,
    escrow_dispute_term, escrow_expire_term, escrow_release_term, escrow_resolve_dispute_term,
    escrow_submit_term, explore_call_term, json_to_rho, proposal_accept_term,
    proposal_attach_cover_term, proposal_cancel_term, proposal_fund_term, propose_commission_term,
    publication_add_member_term, publication_admin_term, publication_attest_self_term,
    publication_pause_term, publication_remove_member_term, publication_set_role_term,
};

/// One client operation. The `op` tag is camelCase; fields are camelCase.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum TermRequest {
    CreatePublication {
        factory_uri: String,
        op_id: String,
        publication_id: String,
        charter: Value,
        members: Value,
    },
    AddMember {
        publication_uri: String,
        op_id: String,
        member_id: String,
        role: String,
        did: String,
        attestation_hash: String,
    },
    RemoveMember {
        publication_uri: String,
        op_id: String,
        member_id: String,
    },
    SetRole {
        publication_uri: String,
        op_id: String,
        member_id: String,
        role: String,
    },
    AttestSelf {
        publication_uri: String,
        op_id: String,
        did: String,
        attestation_hash: String,
    },
    PausePublication {
        publication_uri: String,
        op_id: String,
        paused: bool,
    },
    PublicationAdmin {
        publication_uri: String,
        nonce: u64,
        action: String,
        args: Value,
        sigs: Vec<String>,
    },
    ProposeCommission {
        factory_uri: String,
        op_id: String,
        proposal_id: String,
        data: Value,
    },
    AcceptProposal {
        proposal_uri: String,
        op_id: String,
    },
    FundProposal {
        proposal_uri: String,
        op_id: String,
    },
    CancelProposal {
        proposal_uri: String,
        op_id: String,
        reason_hash: String,
    },
    AttachCover {
        proposal_uri: String,
        op_id: String,
        cover_uri: String,
    },
    SubmitMilestone {
        escrow_uri: String,
        op_id: String,
        milestone_id: String,
        evidence_hash: String,
    },
    ReleaseMilestone {
        escrow_uri: String,
        op_id: String,
        milestone_id: String,
    },
    CancelEscrow {
        escrow_uri: String,
        op_id: String,
        reason_hash: String,
    },
    DisputeEscrow {
        escrow_uri: String,
        op_id: String,
        reason_hash: String,
    },
    ArbitrateEscrow {
        escrow_uri: String,
        nonce: u64,
        writer_bps: u32,
        sigs: Vec<String>,
        op_id: String,
    },
    ResolveDispute {
        escrow_uri: String,
        op_id: String,
    },
    ExpireEscrow {
        escrow_uri: String,
        op_id: String,
    },
    CreateArticle {
        factory_uri: String,
        op_id: String,
        article_id: String,
        data: Value,
    },
    SubmitArticle {
        article_uri: String,
        op_id: String,
        content_hash: String,
    },
    AttachKnowledge {
        article_uri: String,
        op_id: String,
        kasset_uri: String,
        claim_uri: String,
        provenance_uri: String,
        credential_uri: String,
    },
    AttestArticle {
        article_uri: String,
        op_id: String,
        attestation_id: String,
        kind: String,
        evidence_hash: String,
    },
    ApproveArticle {
        article_uri: String,
        op_id: String,
    },
    PublishArticle {
        article_uri: String,
        op_id: String,
    },
    CorrectArticle {
        article_uri: String,
        op_id: String,
        correction_id: String,
        kind: String,
        body_hash: String,
        reason_hash: String,
    },
    RetractArticle {
        article_uri: String,
        op_id: String,
        reason_hash: String,
    },
    CreateEdition {
        factory_uri: String,
        op_id: String,
        edition_id: String,
        data: Value,
    },
    AppendEditionArticle {
        edition_uri: String,
        op_id: String,
        article_uri: String,
    },
    SealEdition {
        edition_uri: String,
        op_id: String,
        editor_sig: String,
    },
    CreateCoordination {
        factory_uri: String,
        op_id: String,
        coordination_id: String,
        data: Value,
    },
    RecordCoordination {
        record_uri: String,
        op_id: String,
        coordination_id: String,
        poll_id_hash: String,
        outcome_hash: String,
        signatures: Value,
    },
    /// An explore-deploy read. `args` are JSON values rendered as Rholang literals.
    Read {
        uri: String,
        binding: String,
        args: Option<Vec<Value>>,
    },
}

/// Parse a [`TermRequest`] from JSON and build its term.
pub fn build_term(request_json: &str) -> Result<String, String> {
    let request: TermRequest =
        serde_json::from_str(request_json).map_err(|error| format!("invalid request: {error}"))?;
    Ok(build(&request))
}

/// Build the Rholang term for an already-parsed request.
pub fn build(request: &TermRequest) -> String {
    match request {
        TermRequest::CreatePublication {
            factory_uri,
            op_id,
            publication_id,
            charter,
            members,
        } => create_publication_term(factory_uri, op_id, publication_id, charter, members),
        TermRequest::AddMember {
            publication_uri,
            op_id,
            member_id,
            role,
            did,
            attestation_hash,
        } => publication_add_member_term(
            publication_uri,
            op_id,
            member_id,
            role,
            did,
            attestation_hash,
        ),
        TermRequest::RemoveMember {
            publication_uri,
            op_id,
            member_id,
        } => publication_remove_member_term(publication_uri, op_id, member_id),
        TermRequest::SetRole {
            publication_uri,
            op_id,
            member_id,
            role,
        } => publication_set_role_term(publication_uri, op_id, member_id, role),
        TermRequest::AttestSelf {
            publication_uri,
            op_id,
            did,
            attestation_hash,
        } => publication_attest_self_term(publication_uri, op_id, did, attestation_hash),
        TermRequest::PausePublication {
            publication_uri,
            op_id,
            paused,
        } => publication_pause_term(publication_uri, op_id, *paused),
        TermRequest::PublicationAdmin {
            publication_uri,
            nonce,
            action,
            args,
            sigs,
        } => publication_admin_term(publication_uri, *nonce, action, args, sigs),
        TermRequest::ProposeCommission {
            factory_uri,
            op_id,
            proposal_id,
            data,
        } => propose_commission_term(factory_uri, op_id, proposal_id, data),
        TermRequest::AcceptProposal {
            proposal_uri,
            op_id,
        } => proposal_accept_term(proposal_uri, op_id),
        TermRequest::FundProposal {
            proposal_uri,
            op_id,
        } => proposal_fund_term(proposal_uri, op_id),
        TermRequest::CancelProposal {
            proposal_uri,
            op_id,
            reason_hash,
        } => proposal_cancel_term(proposal_uri, op_id, reason_hash),
        TermRequest::AttachCover {
            proposal_uri,
            op_id,
            cover_uri,
        } => proposal_attach_cover_term(proposal_uri, op_id, cover_uri),
        TermRequest::SubmitMilestone {
            escrow_uri,
            op_id,
            milestone_id,
            evidence_hash,
        } => escrow_submit_term(escrow_uri, op_id, milestone_id, evidence_hash),
        TermRequest::ReleaseMilestone {
            escrow_uri,
            op_id,
            milestone_id,
        } => escrow_release_term(escrow_uri, op_id, milestone_id),
        TermRequest::CancelEscrow {
            escrow_uri,
            op_id,
            reason_hash,
        } => escrow_cancel_term(escrow_uri, op_id, reason_hash),
        TermRequest::DisputeEscrow {
            escrow_uri,
            op_id,
            reason_hash,
        } => escrow_dispute_term(escrow_uri, op_id, reason_hash),
        TermRequest::ArbitrateEscrow {
            escrow_uri,
            nonce,
            writer_bps,
            sigs,
            op_id,
        } => escrow_arbitrate_term(escrow_uri, *nonce, *writer_bps, sigs, op_id),
        TermRequest::ResolveDispute { escrow_uri, op_id } => {
            escrow_resolve_dispute_term(escrow_uri, op_id)
        }
        TermRequest::ExpireEscrow { escrow_uri, op_id } => escrow_expire_term(escrow_uri, op_id),
        TermRequest::CreateArticle {
            factory_uri,
            op_id,
            article_id,
            data,
        } => create_article_term(factory_uri, op_id, article_id, data),
        TermRequest::SubmitArticle {
            article_uri,
            op_id,
            content_hash,
        } => article_submit_term(article_uri, op_id, content_hash),
        TermRequest::AttachKnowledge {
            article_uri,
            op_id,
            kasset_uri,
            claim_uri,
            provenance_uri,
            credential_uri,
        } => article_attach_knowledge_term(
            article_uri,
            op_id,
            kasset_uri,
            claim_uri,
            provenance_uri,
            credential_uri,
        ),
        TermRequest::AttestArticle {
            article_uri,
            op_id,
            attestation_id,
            kind,
            evidence_hash,
        } => article_attest_term(article_uri, op_id, attestation_id, kind, evidence_hash),
        TermRequest::ApproveArticle { article_uri, op_id } => {
            article_approve_term(article_uri, op_id)
        }
        TermRequest::PublishArticle { article_uri, op_id } => {
            article_publish_term(article_uri, op_id)
        }
        TermRequest::CorrectArticle {
            article_uri,
            op_id,
            correction_id,
            kind,
            body_hash,
            reason_hash,
        } => article_correct_term(
            article_uri,
            op_id,
            correction_id,
            kind,
            body_hash,
            reason_hash,
        ),
        TermRequest::RetractArticle {
            article_uri,
            op_id,
            reason_hash,
        } => article_retract_term(article_uri, op_id, reason_hash),
        TermRequest::CreateEdition {
            factory_uri,
            op_id,
            edition_id,
            data,
        } => create_edition_term(factory_uri, op_id, edition_id, data),
        TermRequest::AppendEditionArticle {
            edition_uri,
            op_id,
            article_uri,
        } => edition_append_term(edition_uri, op_id, article_uri),
        TermRequest::SealEdition {
            edition_uri,
            op_id,
            editor_sig,
        } => edition_seal_term(edition_uri, op_id, editor_sig),
        TermRequest::CreateCoordination {
            factory_uri,
            op_id,
            coordination_id,
            data,
        } => create_coordination_term(factory_uri, op_id, coordination_id, data),
        TermRequest::RecordCoordination {
            record_uri,
            op_id,
            coordination_id,
            poll_id_hash,
            outcome_hash,
            signatures,
        } => coordination_record_term(
            record_uri,
            op_id,
            coordination_id,
            poll_id_hash,
            outcome_hash,
            signatures,
        ),
        TermRequest::Read { uri, binding, args } => {
            let rendered = args.as_ref().map(|items| {
                items
                    .iter()
                    .map(json_to_rho)
                    .collect::<Vec<String>>()
                    .join(", ")
            });
            explore_call_term(uri, binding, rendered.as_deref())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn json(op: &str, mut fields: serde_json::Map<String, Value>) -> String {
        fields.insert("op".into(), Value::String(op.into()));
        Value::Object(fields).to_string()
    }

    fn field(value: &str) -> Value {
        Value::String(value.into())
    }

    #[test]
    fn every_write_variant_maps_to_its_arm() {
        let cases = vec![
            (
                json(
                    "createPublication",
                    serde_json::Map::from_iter([
                        ("factoryUri".into(), field("rho:id:fac")),
                        ("opId".into(), field("op1")),
                        ("publicationId".into(), field("pub:1")),
                        ("charter".into(), Value::Object(serde_json::Map::new())),
                        ("members".into(), Value::Array(vec![])),
                    ]),
                ),
                "C!(\"create\"",
            ),
            (
                json(
                    "addMember",
                    serde_json::Map::from_iter([
                        ("publicationUri".into(), field("rho:id:p")),
                        ("opId".into(), field("op1")),
                        ("memberId".into(), field("1111m")),
                        ("role".into(), field("writer")),
                        ("did".into(), field("did:byoid:x")),
                        ("attestationHash".into(), field("att")),
                    ]),
                ),
                "C!(\"addMember\"",
            ),
            (
                json(
                    "removeMember",
                    serde_json::Map::from_iter([
                        ("publicationUri".into(), field("rho:id:p")),
                        ("opId".into(), field("op1")),
                        ("memberId".into(), field("1111m")),
                    ]),
                ),
                "C!(\"removeMember\"",
            ),
            (
                json(
                    "setRole",
                    serde_json::Map::from_iter([
                        ("publicationUri".into(), field("rho:id:p")),
                        ("opId".into(), field("op1")),
                        ("memberId".into(), field("1111m")),
                        ("role".into(), field("editor")),
                    ]),
                ),
                "C!(\"setRole\"",
            ),
            (
                json(
                    "attestSelf",
                    serde_json::Map::from_iter([
                        ("publicationUri".into(), field("rho:id:p")),
                        ("opId".into(), field("op1")),
                        ("did".into(), field("did:byoid:x")),
                        ("attestationHash".into(), field("att")),
                    ]),
                ),
                "C!(\"attestSelf\"",
            ),
            (
                json(
                    "pausePublication",
                    serde_json::Map::from_iter([
                        ("publicationUri".into(), field("rho:id:p")),
                        ("opId".into(), field("op1")),
                        ("paused".into(), Value::Bool(true)),
                    ]),
                ),
                "C!(\"pause\"",
            ),
            (
                json(
                    "publicationAdmin",
                    serde_json::Map::from_iter([
                        ("publicationUri".into(), field("rho:id:p")),
                        ("nonce".into(), Value::from(2)),
                        ("action".into(), field("pause")),
                        ("args".into(), Value::Array(vec![])),
                        ("sigs".into(), Value::Array(vec![field("aa")])),
                    ]),
                ),
                "C!(\"admin\"",
            ),
            (
                json(
                    "proposeCommission",
                    serde_json::Map::from_iter([
                        ("factoryUri".into(), field("rho:id:fac")),
                        ("opId".into(), field("op1")),
                        ("proposalId".into(), field("prop:1")),
                        ("data".into(), Value::Object(serde_json::Map::new())),
                    ]),
                ),
                "C!(\"propose\"",
            ),
            (
                json(
                    "acceptProposal",
                    serde_json::Map::from_iter([
                        ("proposalUri".into(), field("rho:id:prop")),
                        ("opId".into(), field("op1")),
                    ]),
                ),
                "C!(\"accept\"",
            ),
            (
                json(
                    "fundProposal",
                    serde_json::Map::from_iter([
                        ("proposalUri".into(), field("rho:id:prop")),
                        ("opId".into(), field("op1")),
                    ]),
                ),
                "C!(\"fund\"",
            ),
            (
                json(
                    "cancelProposal",
                    serde_json::Map::from_iter([
                        ("proposalUri".into(), field("rho:id:prop")),
                        ("opId".into(), field("op1")),
                        ("reasonHash".into(), field("r")),
                    ]),
                ),
                "C!(\"cancel\"",
            ),
            (
                json(
                    "attachCover",
                    serde_json::Map::from_iter([
                        ("proposalUri".into(), field("rho:id:prop")),
                        ("opId".into(), field("op1")),
                        ("coverUri".into(), field("rho:id:policy")),
                    ]),
                ),
                "C!(\"attachCover\"",
            ),
            (
                json(
                    "submitMilestone",
                    serde_json::Map::from_iter([
                        ("escrowUri".into(), field("rho:id:e")),
                        ("opId".into(), field("op1")),
                        ("milestoneId".into(), field("m1")),
                        ("evidenceHash".into(), field("ev")),
                    ]),
                ),
                "C!(\"submit\"",
            ),
            (
                json(
                    "releaseMilestone",
                    serde_json::Map::from_iter([
                        ("escrowUri".into(), field("rho:id:e")),
                        ("opId".into(), field("op1")),
                        ("milestoneId".into(), field("m1")),
                    ]),
                ),
                "C!(\"release\"",
            ),
            (
                json(
                    "cancelEscrow",
                    serde_json::Map::from_iter([
                        ("escrowUri".into(), field("rho:id:e")),
                        ("opId".into(), field("op1")),
                        ("reasonHash".into(), field("r")),
                    ]),
                ),
                "C!(\"cancel\"",
            ),
            (
                json(
                    "disputeEscrow",
                    serde_json::Map::from_iter([
                        ("escrowUri".into(), field("rho:id:e")),
                        ("opId".into(), field("op1")),
                        ("reasonHash".into(), field("r")),
                    ]),
                ),
                "C!(\"dispute\"",
            ),
            (
                json(
                    "arbitrateEscrow",
                    serde_json::Map::from_iter([
                        ("escrowUri".into(), field("rho:id:e")),
                        ("nonce".into(), Value::from(2)),
                        ("writerBps".into(), Value::from(5000)),
                        ("sigs".into(), Value::Array(vec![field("aa")])),
                        ("opId".into(), field("op1")),
                    ]),
                ),
                "C!(\"arbitrate\"",
            ),
            (
                json(
                    "resolveDispute",
                    serde_json::Map::from_iter([
                        ("escrowUri".into(), field("rho:id:e")),
                        ("opId".into(), field("op1")),
                    ]),
                ),
                "C!(\"resolveDispute\"",
            ),
            (
                json(
                    "expireEscrow",
                    serde_json::Map::from_iter([
                        ("escrowUri".into(), field("rho:id:e")),
                        ("opId".into(), field("op1")),
                    ]),
                ),
                "C!(\"expire\"",
            ),
            (
                json(
                    "createArticle",
                    serde_json::Map::from_iter([
                        ("factoryUri".into(), field("rho:id:fac")),
                        ("opId".into(), field("op1")),
                        ("articleId".into(), field("art:1")),
                        ("data".into(), Value::Object(serde_json::Map::new())),
                    ]),
                ),
                "C!(\"create\"",
            ),
            (
                json(
                    "submitArticle",
                    serde_json::Map::from_iter([
                        ("articleUri".into(), field("rho:id:a")),
                        ("opId".into(), field("op1")),
                        ("contentHash".into(), field("h")),
                    ]),
                ),
                "C!(\"submit\"",
            ),
            (
                json(
                    "attachKnowledge",
                    serde_json::Map::from_iter([
                        ("articleUri".into(), field("rho:id:a")),
                        ("opId".into(), field("op1")),
                        ("kassetUri".into(), field("rho:id:k")),
                        ("claimUri".into(), field("rho:id:c")),
                        ("provenanceUri".into(), field("rho:id:pr")),
                        ("credentialUri".into(), field("rho:id:cr")),
                    ]),
                ),
                "C!(\"attachKnowledge\"",
            ),
            (
                json(
                    "attestArticle",
                    serde_json::Map::from_iter([
                        ("articleUri".into(), field("rho:id:a")),
                        ("opId".into(), field("op1")),
                        ("attestationId".into(), field("at:1")),
                        ("kind".into(), field("factcheck")),
                        ("evidenceHash".into(), field("ev")),
                    ]),
                ),
                "C!(\"attest\"",
            ),
            (
                json(
                    "approveArticle",
                    serde_json::Map::from_iter([
                        ("articleUri".into(), field("rho:id:a")),
                        ("opId".into(), field("op1")),
                    ]),
                ),
                "C!(\"approve\"",
            ),
            (
                json(
                    "publishArticle",
                    serde_json::Map::from_iter([
                        ("articleUri".into(), field("rho:id:a")),
                        ("opId".into(), field("op1")),
                    ]),
                ),
                "C!(\"publish\"",
            ),
            (
                json(
                    "correctArticle",
                    serde_json::Map::from_iter([
                        ("articleUri".into(), field("rho:id:a")),
                        ("opId".into(), field("op1")),
                        ("correctionId".into(), field("c1")),
                        ("kind".into(), field("correction")),
                        ("bodyHash".into(), field("b")),
                        ("reasonHash".into(), field("r")),
                    ]),
                ),
                "C!(\"correct\"",
            ),
            (
                json(
                    "retractArticle",
                    serde_json::Map::from_iter([
                        ("articleUri".into(), field("rho:id:a")),
                        ("opId".into(), field("op1")),
                        ("reasonHash".into(), field("r")),
                    ]),
                ),
                "C!(\"retract\"",
            ),
            (
                json(
                    "createEdition",
                    serde_json::Map::from_iter([
                        ("factoryUri".into(), field("rho:id:fac")),
                        ("opId".into(), field("op1")),
                        ("editionId".into(), field("ed:1")),
                        ("data".into(), Value::Object(serde_json::Map::new())),
                    ]),
                ),
                "C!(\"create\"",
            ),
            (
                json(
                    "appendEditionArticle",
                    serde_json::Map::from_iter([
                        ("editionUri".into(), field("rho:id:ed")),
                        ("opId".into(), field("op1")),
                        ("articleUri".into(), field("rho:id:a")),
                    ]),
                ),
                "C!(\"append\"",
            ),
            (
                json(
                    "sealEdition",
                    serde_json::Map::from_iter([
                        ("editionUri".into(), field("rho:id:ed")),
                        ("opId".into(), field("op1")),
                        ("editorSig".into(), field("deadbeef")),
                    ]),
                ),
                "C!(\"seal\"",
            ),
            (
                json(
                    "createCoordination",
                    serde_json::Map::from_iter([
                        ("factoryUri".into(), field("rho:id:fac")),
                        ("opId".into(), field("op1")),
                        ("coordinationId".into(), field("coord:1")),
                        ("data".into(), Value::Object(serde_json::Map::new())),
                    ]),
                ),
                "C!(\"create\"",
            ),
            (
                json(
                    "recordCoordination",
                    serde_json::Map::from_iter([
                        ("recordUri".into(), field("rho:id:c")),
                        ("opId".into(), field("op1")),
                        ("coordinationId".into(), field("coord:1")),
                        ("pollIdHash".into(), field("poll")),
                        ("outcomeHash".into(), field("outcome")),
                        ("signatures".into(), Value::Array(vec![])),
                    ]),
                ),
                "C!(\"record\"",
            ),
        ];
        for (request, arm) in cases {
            let term = build_term(&request).unwrap_or_else(|error| panic!("{request}: {error}"));
            assert!(term.contains(arm), "{request}\n{term}");
        }
    }

    #[test]
    fn read_uses_the_explore_shape() {
        let request = json(
            "read",
            serde_json::Map::from_iter([
                ("uri".into(), field("rho:id:p")),
                ("binding".into(), field("info")),
                ("args".into(), Value::Null),
            ]),
        );
        let term = build_term(&request).unwrap();
        assert!(term.starts_with("new return, rl("), "{term}");
        assert!(!term.contains("deployId"), "{term}");
        assert!(term.contains("C!") || term.contains("cap!("), "{term}");
    }

    #[test]
    fn unknown_op_is_a_clear_error() {
        let error = build_term(r#"{"op":"nope"}"#).unwrap_err();
        assert!(error.contains("invalid request"), "{error}");
    }
}
