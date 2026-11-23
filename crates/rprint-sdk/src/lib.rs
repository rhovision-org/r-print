//! Typed r-print term builders.
//!
//! The SDK is the shared client surface for the CLI and the WASM facade. It builds the
//! Rholang call terms for the public arms and converts JSON-shaped data into Rholang
//! literals. It does not sign or submit; that is r-cash's signed-deploy client.

use serde_json::Value;

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

/// Build a registry call term: resolve `uri`, send `(binding, args..., ret)`, emit the reply.
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

/// Sign the canonical manifest digest externally and pass the signature here.
pub fn edition_seal_term(edition_uri: &str, op_id: &str, signature: &str) -> String {
    call_term(
        edition_uri,
        "seal",
        Some(&format!("*dId, {}, {}", quote(op_id), signature)),
    )
}

/// Read an arm without signing.
pub fn read_term(uri: &str, binding: &str, args: Option<&str>) -> String {
    call_term(uri, binding, args)
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
