//! Typed r-print term builders.
//!
//! The SDK is the shared client surface for the CLI and the WASM facade. It builds the
//! Rholang call terms for the public arms and converts JSON-shaped data into Rholang
//! literals. It does not sign or submit; that is r-cash's signed-deploy client.

use serde_json::Value;

mod terms;
pub use terms::{build_term, TermRequest};

pub use rprint_core::{
    admin_payload, canonical, edition_manifest_items, validate_commission, validate_did,
    validate_roles, ArticleStatus, Charter, EditionStatus, EscrowStatus, Member, Milestone,
    ProposalStatus, PublicationStatus, Role, ValidationError, ADMIN_PREFIX, VERSION,
};

/// Convert a JSON value into a Rholang data literal.
///
/// Strings are quoted, numbers and booleans are bare, arrays become `List` literals and
/// objects become `Map` literals. An object of the form `{"$bytes": "02ab..."}` becomes
/// `"02ab...".hexToBytes()`, which is how admin public keys are passed.
pub fn json_to_rho(value: &Value) -> String {
    match value {
        Value::Null => "Nil".to_string(),
        Value::Bool(true) => "true".to_string(),
        Value::Bool(false) => "false".to_string(),
        Value::Number(number) => number.to_string(),
        Value::String(text) => serde_json::to_string(text).unwrap_or_else(|_| "\"\"".into()),
        Value::Array(items) => {
            let inner: Vec<String> = items.iter().map(json_to_rho).collect();
            format!("[{}]", inner.join(", "))
        }
        Value::Object(map) => {
            if let Some(Value::String(hex)) = map.get("$bytes") {
                return format!("\"{hex}\".hexToBytes()");
            }
            let inner: Vec<String> = map
                .iter()
                .map(|(key, value)| {
                    let key_literal = serde_json::to_string(key).unwrap_or_else(|_| "\"\"".into());
                    format!("{key_literal}: {}", json_to_rho(value))
                })
                .collect();
            format!("{{{}}}", inner.join(", "))
        }
    }
}

/// Build a signed-deploy call term: resolve `uri`, send `(binding, args..., ret)`, emit the
/// reply on `deployId`. Used for every write.
pub fn call_term(uri: &str, binding: &str, args: Option<&str>) -> String {
    let head = match args {
        Some(args) if !args.is_empty() => {
            format!(
                "{} , {}",
                serde_json::to_string(binding).unwrap_or_default(),
                args
            )
        }
        _ => serde_json::to_string(binding).unwrap_or_default(),
    };
    format!(
        "new rl(`rho:registry:lookup`), ch, ret, dId(`rho:rchain:deployerId`), \
deployId(`rho:rchain:deployId`) in {{\n  rl!(`{uri}`, *ch) |\n  for (C <- ch) {{\n    \
C!({head}, *ret) |\n    for (@r <- ret) {{ deployId!(r) }}\n  }}\n}}\n"
    )
}

/// Build an explore-deploy call term.
///
/// `POST /api/v1/explore-deploy` exposes the reply from the term's **first private name**.
/// Bind `return` first and emit there; a term built with [`call_term`] sends on `deployId`,
/// which explore-deploy does not capture. Used for every read.
pub fn explore_call_term(uri: &str, binding: &str, args: Option<&str>) -> String {
    let head = match args {
        Some(args) if !args.is_empty() => {
            format!(
                "{} , {}",
                serde_json::to_string(binding).unwrap_or_default(),
                args
            )
        }
        _ => serde_json::to_string(binding).unwrap_or_default(),
    };
    format!(
        "new return, rl(`rho:registry:lookup`), capCh, resCh in {{\n  \
rl!(`{uri}`, *capCh) |\n  for (cap <- capCh) {{\n    cap!({head}, *resCh) |\n    \
for (@r <- resCh) {{ return!(r) }}\n  }}\n}}\n"
    )
}

/// Render a hex string as a Rholang byte array.
pub fn hex_bytes(value: &str) -> String {
    format!("\"{value}\".hexToBytes()")
}

/// Render a list of hex strings as a Rholang list of byte arrays.
pub fn hex_bytes_list(values: &[String]) -> String {
    let items: Vec<String> = values.iter().map(|value| hex_bytes(value)).collect();
    format!("[{}]", items.join(", "))
}

fn quote(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "\"\"".into())
}

/// `PublicationFactory("create", dId, opId, publicationId, charter, members)`.
pub fn create_publication_term(
    factory_uri: &str,
    op_id: &str,
    publication_id: &str,
    charter: &Value,
    members: &Value,
) -> String {
    let args = format!(
        "*dId, {}, {}, {}, {}",
        quote(op_id),
        quote(publication_id),
        json_to_rho(charter),
        json_to_rho(members)
    );
    call_term(factory_uri, "create", Some(&args))
}

/// `CommissionFactory("propose", dId, opId, proposalId, data)`.
pub fn propose_commission_term(
    factory_uri: &str,
    op_id: &str,
    proposal_id: &str,
    data: &Value,
) -> String {
    let args = format!(
        "*dId, {}, {}, {}",
        quote(op_id),
        quote(proposal_id),
        json_to_rho(data)
    );
    call_term(factory_uri, "propose", Some(&args))
}

/// Accept a proposal or attach an r-sure policy.
pub fn proposal_accept_term(proposal_uri: &str, op_id: &str) -> String {
    call_term(
        proposal_uri,
        "accept",
        Some(&format!("*dId, {}", quote(op_id))),
    )
}

pub fn proposal_fund_term(proposal_uri: &str, op_id: &str) -> String {
    call_term(
        proposal_uri,
        "fund",
        Some(&format!("*dId, {}", quote(op_id))),
    )
}

pub fn proposal_attach_cover_term(proposal_uri: &str, op_id: &str, cover_uri: &str) -> String {
    call_term(
        proposal_uri,
        "attachCover",
        Some(&format!("*dId, {}, {}", quote(op_id), quote(cover_uri))),
    )
}

pub fn escrow_submit_term(
    escrow_uri: &str,
    op_id: &str,
    milestone: &str,
    evidence: &str,
) -> String {
    call_term(
        escrow_uri,
        "submit",
        Some(&format!(
            "*dId, {}, {}, {}",
            quote(op_id),
            quote(milestone),
            quote(evidence)
        )),
    )
}

pub fn escrow_release_term(escrow_uri: &str, op_id: &str, milestone: &str) -> String {
    call_term(
        escrow_uri,
        "release",
        Some(&format!("*dId, {}, {}", quote(op_id), quote(milestone))),
    )
}

/// `ArticleFactory("create", dId, opId, articleId, data)`.
pub fn create_article_term(
    factory_uri: &str,
    op_id: &str,
    article_id: &str,
    data: &Value,
) -> String {
    call_term(
        factory_uri,
        "create",
        Some(&format!(
            "*dId, {}, {}, {}",
            quote(op_id),
            quote(article_id),
            json_to_rho(data)
        )),
    )
}

pub fn article_submit_term(article_uri: &str, op_id: &str, content_hash: &str) -> String {
    call_term(
        article_uri,
        "submit",
        Some(&format!("*dId, {}, {}", quote(op_id), quote(content_hash))),
    )
}

/// Link an optional r-gen Claim, KAsset, Provenance and credential.
pub fn article_attach_knowledge_term(
    article_uri: &str,
    op_id: &str,
    kasset_uri: &str,
    claim_uri: &str,
    provenance_uri: &str,
    credential_uri: &str,
) -> String {
    call_term(
        article_uri,
        "attachKnowledge",
        Some(&format!(
            "*dId, {}, {}, {}, {}, {}",
            quote(op_id),
            quote(kasset_uri),
            quote(claim_uri),
            quote(provenance_uri),
            quote(credential_uri)
        )),
    )
}

pub fn article_approve_term(article_uri: &str, op_id: &str) -> String {
    call_term(
        article_uri,
        "approve",
        Some(&format!("*dId, {}", quote(op_id))),
    )
}

pub fn article_publish_term(article_uri: &str, op_id: &str) -> String {
    call_term(
        article_uri,
        "publish",
        Some(&format!("*dId, {}", quote(op_id))),
    )
}

pub fn article_correct_term(
    article_uri: &str,
    op_id: &str,
    correction_id: &str,
    kind: &str,
    body_hash: &str,
    reason_hash: &str,
) -> String {
    call_term(
        article_uri,
        "correct",
        Some(&format!(
            "*dId, {}, {}, {}, {}, {}",
            quote(op_id),
            quote(correction_id),
            quote(kind),
            quote(body_hash),
            quote(reason_hash)
        )),
    )
}

/// `EditionFactory("create", dId, opId, editionId, data)`.
pub fn create_edition_term(
    factory_uri: &str,
    op_id: &str,
    edition_id: &str,
    data: &Value,
) -> String {
    call_term(
        factory_uri,
        "create",
        Some(&format!(
            "*dId, {}, {}, {}",
            quote(op_id),
            quote(edition_id),
            json_to_rho(data)
        )),
    )
}

pub fn edition_append_term(edition_uri: &str, op_id: &str, article_uri: &str) -> String {
    call_term(
        edition_uri,
        "append",
        Some(&format!("*dId, {}, {}", quote(op_id), quote(article_uri))),
    )
}

/// Seal with a DER signature over the canonical manifest hash. `signature_hex` is rendered
/// as a Rholang byte array, which is what `Verifier("sigOk")` checks.
pub fn edition_seal_term(edition_uri: &str, op_id: &str, signature_hex: &str) -> String {
    call_term(
        edition_uri,
        "seal",
        Some(&format!(
            "*dId, {}, {}",
            quote(op_id),
            hex_bytes(signature_hex)
        )),
    )
}

/// `CoordinationFactory("create", dId, opId, coordinationId, data)`.
pub fn create_coordination_term(
    factory_uri: &str,
    op_id: &str,
    coordination_id: &str,
    data: &Value,
) -> String {
    call_term(
        factory_uri,
        "create",
        Some(&format!(
            "*dId, {}, {}, {}",
            quote(op_id),
            quote(coordination_id),
            json_to_rho(data)
        )),
    )
}

/// `CoordinationRecord("record", dId, opId, coordinationId, poll, outcome, sigs)`.
/// Each signature entry carries `memberId` plus `pubKey`/`sig` as `{"$bytes": hex}`.
pub fn coordination_record_term(
    record_uri: &str,
    op_id: &str,
    coordination_id: &str,
    poll_id_hash: &str,
    outcome_hash: &str,
    signatures: &Value,
) -> String {
    call_term(
        record_uri,
        "record",
        Some(&format!(
            "*dId, {}, {}, {}, {}, {}",
            quote(op_id),
            quote(coordination_id),
            quote(poll_id_hash),
            quote(outcome_hash),
            json_to_rho(signatures)
        )),
    )
}

/// `Publication("addMember", dId, opId, memberId, role, did, attestationHash)`.
pub fn publication_add_member_term(
    publication_uri: &str,
    op_id: &str,
    member_id: &str,
    role: &str,
    did: &str,
    attestation_hash: &str,
) -> String {
    call_term(
        publication_uri,
        "addMember",
        Some(&format!(
            "*dId, {}, {}, {}, {}, {}",
            quote(op_id),
            quote(member_id),
            quote(role),
            quote(did),
            quote(attestation_hash)
        )),
    )
}

/// `Publication("removeMember", dId, opId, memberId)`.
pub fn publication_remove_member_term(
    publication_uri: &str,
    op_id: &str,
    member_id: &str,
) -> String {
    call_term(
        publication_uri,
        "removeMember",
        Some(&format!("*dId, {}, {}", quote(op_id), quote(member_id))),
    )
}

/// `Publication("setRole", dId, opId, memberId, role)`.
pub fn publication_set_role_term(
    publication_uri: &str,
    op_id: &str,
    member_id: &str,
    role: &str,
) -> String {
    call_term(
        publication_uri,
        "setRole",
        Some(&format!(
            "*dId, {}, {}, {}",
            quote(op_id),
            quote(member_id),
            quote(role)
        )),
    )
}

/// `Publication("attestSelf", dId, opId, did, attestationHash)`.
///
/// The member id is derived by the contract from `deployerId`; it is not an argument.
pub fn publication_attest_self_term(
    publication_uri: &str,
    op_id: &str,
    did: &str,
    attestation_hash: &str,
) -> String {
    call_term(
        publication_uri,
        "attestSelf",
        Some(&format!(
            "*dId, {}, {}, {}",
            quote(op_id),
            quote(did),
            quote(attestation_hash)
        )),
    )
}

/// `Publication("pause", dId, opId, paused)`.
pub fn publication_pause_term(publication_uri: &str, op_id: &str, paused: bool) -> String {
    call_term(
        publication_uri,
        "pause",
        Some(&format!("*dId, {}, {paused}", quote(op_id))),
    )
}

/// `Publication("admin", nonce, action, args, sigs)`.
///
/// This arm has no `dId`: authority is the multisig over `args`, not the caller. `args` is
/// rendered with [`json_to_rho`] (use `{"$bytes": hex}` for public keys) and `sigs` are
/// DER signature hex strings.
pub fn publication_admin_term(
    publication_uri: &str,
    nonce: u64,
    action: &str,
    args: &Value,
    sigs: &[String],
) -> String {
    call_term(
        publication_uri,
        "admin",
        Some(&format!(
            "{nonce}, {}, {}, {}",
            quote(action),
            json_to_rho(args),
            hex_bytes_list(sigs)
        )),
    )
}

/// `CommissionProposal("cancel", dId, opId, reasonHash)`.
pub fn proposal_cancel_term(proposal_uri: &str, op_id: &str, reason_hash: &str) -> String {
    call_term(
        proposal_uri,
        "cancel",
        Some(&format!("*dId, {}, {}", quote(op_id), quote(reason_hash))),
    )
}

/// `CommissionEscrow("cancel", dId, opId, reasonHash)`.
pub fn escrow_cancel_term(escrow_uri: &str, op_id: &str, reason_hash: &str) -> String {
    call_term(
        escrow_uri,
        "cancel",
        Some(&format!("*dId, {}, {}", quote(op_id), quote(reason_hash))),
    )
}

/// `CommissionEscrow("dispute", dId, opId, reasonHash)`.
pub fn escrow_dispute_term(escrow_uri: &str, op_id: &str, reason_hash: &str) -> String {
    call_term(
        escrow_uri,
        "dispute",
        Some(&format!("*dId, {}, {}", quote(op_id), quote(reason_hash))),
    )
}

/// `CommissionEscrow("arbitrate", nonce, writerBps, sigs, opId)`.
///
/// No `dId`: authority is the effective arbitration quorum, not the caller.
pub fn escrow_arbitrate_term(
    escrow_uri: &str,
    nonce: u64,
    writer_bps: u32,
    sigs: &[String],
    op_id: &str,
) -> String {
    call_term(
        escrow_uri,
        "arbitrate",
        Some(&format!(
            "{nonce}, {writer_bps}, {}, {}",
            hex_bytes_list(sigs),
            quote(op_id)
        )),
    )
}

/// `CommissionEscrow("resolveDispute", opId)` — permissionless after the dispute window.
pub fn escrow_resolve_dispute_term(escrow_uri: &str, op_id: &str) -> String {
    call_term(escrow_uri, "resolveDispute", Some(&quote(op_id)))
}

/// `CommissionEscrow("expire", opId)` — permissionless after the hard deadline.
pub fn escrow_expire_term(escrow_uri: &str, op_id: &str) -> String {
    call_term(escrow_uri, "expire", Some(&quote(op_id)))
}

/// `Article("attest", dId, opId, attestationId, kind, evidenceHash)`.
pub fn article_attest_term(
    article_uri: &str,
    op_id: &str,
    attestation_id: &str,
    kind: &str,
    evidence_hash: &str,
) -> String {
    call_term(
        article_uri,
        "attest",
        Some(&format!(
            "*dId, {}, {}, {}, {}",
            quote(op_id),
            quote(attestation_id),
            quote(kind),
            quote(evidence_hash)
        )),
    )
}

/// `Article("retract", dId, opId, reasonHash)`.
pub fn article_retract_term(article_uri: &str, op_id: &str, reason_hash: &str) -> String {
    call_term(
        article_uri,
        "retract",
        Some(&format!("*dId, {}, {}", quote(op_id), quote(reason_hash))),
    )
}

/// Read an arm without signing. This is an explore-deploy term: the reply is emitted on the
/// first private name (`return`), which the node's `explore-deploy` captures.
pub fn read_term(uri: &str, binding: &str, args: Option<&str>) -> String {
    explore_call_term(uri, binding, args)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn bytes_and_maps_round_trip_to_rholang() {
        let value = json!({"admins": [{"$bytes": "02aabb"}], "threshold": 1});
        assert_eq!(
            json_to_rho(&value),
            "{\"admins\": [\"02aabb\".hexToBytes()], \"threshold\": 1}"
        );
    }

    #[test]
    fn call_term_contains_the_binding_and_reply() {
        let term = call_term("rho:id:abc", "info", None);
        assert!(term.contains("C!(\"info\", *ret)"));
        assert!(term.contains("deployId!(r)"));
    }

    #[test]
    fn publication_term_carries_ids_and_data() {
        let term = create_publication_term(
            "rho:id:fac",
            "op1",
            "pub:1",
            &json!({"nameHash": "n"}),
            &json!([{"memberId": "1111"} ]),
        );
        assert!(term.contains("*dId, \"op1\", \"pub:1\""));
        assert!(term.contains("\"nameHash\": \"n\""));
    }

    #[test]
    fn admin_payload_is_the_contract_shape() {
        assert_eq!(
            admin_payload("publication:p", 3, "pause", &[]),
            "rprint:admin:v1|publication:p|3|pause|"
        );
    }
}
