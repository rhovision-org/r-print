//! Pure r-print domain types, validation and canonical payloads.
//!
//! This crate has no network dependency. It owns the shapes that the contracts, the SDK,
//! the CLI and the WASM facade share. The named integration graph is in `spec/graph/`.

use serde::{Deserialize, Serialize};

/// The r-print protocol version.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// The canonical admin payload prefix used by `lib/Guard.rho` and `lib/PubGuard.rho`.
pub const ADMIN_PREFIX: &str = "rprint:admin:v1";

const ROLES: [&str; 6] = [
    "publisher",
    "editor",
    "writer",
    "factchecker",
    "treasurer",
    "contributor",
];

/// A publication roster role. Roles are metadata for bylines and review routing; on-chain
/// mutation authority is the publication admin set.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Publisher,
    Editor,
    Writer,
    Factchecker,
    Treasurer,
    Contributor,
}

impl Role {
    pub fn as_str(self) -> &'static str {
        match self {
            Role::Publisher => "publisher",
            Role::Editor => "editor",
            Role::Writer => "writer",
            Role::Factchecker => "factchecker",
            Role::Treasurer => "treasurer",
            Role::Contributor => "contributor",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "publisher" => Some(Role::Publisher),
            "editor" => Some(Role::Editor),
            "writer" => Some(Role::Writer),
            "factchecker" => Some(Role::Factchecker),
            "treasurer" => Some(Role::Treasurer),
            "contributor" => Some(Role::Contributor),
            _ => None,
        }
    }

    /// Roles that may accept a commission or approve/publish an article.
    pub fn is_editorial(self) -> bool {
        matches!(self, Role::Editor | Role::Publisher)
    }
}

/// Validate the role whitelist exactly as `Terms("role")` does.
pub fn validate_roles(value: &str) -> bool {
    ROLES.contains(&value)
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ValidationError {
    #[error("role")]
    Role,
    #[error("did")]
    Did,
    #[error("charter")]
    Charter,
    #[error("threshold")]
    Threshold,
    #[error("total")]
    Total,
    #[error("milestone")]
    Milestone,
    #[error("license")]
    License,
    #[error("access")]
    Access,
    #[error("edition")]
    Edition,
}

/// A DID or BYOID anchor as stored in a member or article record.
pub fn validate_did(value: &str) -> Result<(), ValidationError> {
    if value.is_empty() || value.len() > 128 {
        return Err(ValidationError::Did);
    }
    if value.starts_with("did:") || value.starts_with("byoid:rev:") {
        Ok(())
    } else {
        Err(ValidationError::Did)
    }
}

/// A member record. `member_id` is the member's derived REV address.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Member {
    pub member_id: String,
    pub role: Role,
    pub did: String,
    #[serde(default)]
    pub attestation_hash: String,
    #[serde(default = "default_active")]
    pub status: String,
    #[serde(default)]
    pub since_height: u64,
}

fn default_active() -> String {
    "active".to_string()
}

impl Member {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.member_id.is_empty() {
            return Err(ValidationError::Charter);
        }
        validate_did(&self.did)
    }

    pub fn is_active(&self) -> bool {
        self.status == "active"
    }
}

/// A publication charter. `revenue_split` is bps and must sum to 10000 when non-empty.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Charter {
    pub name_hash: String,
    pub masthead_hash: String,
    #[serde(default)]
    pub tagline_hash: String,
    pub treasury_account_id: String,
    #[serde(default = "default_asset")]
    pub asset_id: String,
    #[serde(default)]
    pub admins: Vec<String>,
    #[serde(default = "default_threshold")]
    pub threshold: u32,
    #[serde(default)]
    pub arbitrators: Vec<String>,
    #[serde(default)]
    pub arbitration_threshold: u32,
    #[serde(default)]
    pub revenue_split: Vec<(String, u32)>,
}

fn default_asset() -> String {
    "REV".to_string()
}

fn default_threshold() -> u32 {
    1
}

impl Charter {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.name_hash.is_empty()
            || self.masthead_hash.is_empty()
            || self.treasury_account_id.is_empty()
        {
            return Err(ValidationError::Charter);
        }
        if self.asset_id != "REV" {
            return Err(ValidationError::Charter);
        }
        if self.admins.is_empty() || self.admins.len() > 5 {
            return Err(ValidationError::Threshold);
        }
        if self.threshold < 1 || self.threshold as usize > self.admins.len() {
            return Err(ValidationError::Threshold);
        }
        if self.admins.iter().any(|key| key.is_empty()) {
            return Err(ValidationError::Threshold);
        }
        if !self.arbitrators.is_empty() {
            if self.arbitrators.len() < 2 || self.arbitrators.len() > 5 {
                return Err(ValidationError::Threshold);
            }
            if self.arbitration_threshold < 2
                || self.arbitration_threshold as usize > self.arbitrators.len()
            {
                return Err(ValidationError::Threshold);
            }
        }
        let bps: u32 = self.revenue_split.iter().map(|(_, bps)| *bps).sum();
        if !self.revenue_split.is_empty() && bps != 10_000 {
            return Err(ValidationError::Charter);
        }
        Ok(())
    }

    pub fn solo(&self) -> bool {
        self.admins.len() == 1
    }
}

/// A commission milestone. Amounts are integer minor units.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Milestone {
    pub id: String,
    pub kind: String,
    pub amount: u64,
    pub deadline_height: u64,
}

impl Milestone {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.id.is_empty() || self.amount == 0 || self.deadline_height == 0 {
            return Err(ValidationError::Milestone);
        }
        if !matches!(
            self.kind.as_str(),
            "stipend" | "draft" | "final" | "expense" | "bonus"
        ) {
            return Err(ValidationError::Milestone);
        }
        Ok(())
    }
}

/// Validate a commission's total and milestones exactly as `Terms("commission")` does.
pub fn validate_commission(total: u64, milestones: &[Milestone]) -> Result<(), ValidationError> {
    if total == 0 || total > 1_000_000_000_000 {
        return Err(ValidationError::Total);
    }
    if milestones.is_empty() || milestones.len() > 8 {
        return Err(ValidationError::Milestone);
    }
    let mut seen = std::collections::BTreeSet::new();
    let mut sum = 0u64;
    for milestone in milestones {
        milestone.validate()?;
        if !seen.insert(milestone.id.clone()) {
            return Err(ValidationError::Milestone);
        }
        sum = sum.saturating_add(milestone.amount);
    }
    if sum != total {
        return Err(ValidationError::Total);
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PublicationStatus {
    Active,
    Paused,
    Closed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProposalStatus {
    Proposed,
    Accepted,
    Funded,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EscrowStatus {
    Active,
    Completed,
    Cancelled,
    Disputed,
    Arbitrated,
    Expired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ArticleStatus {
    Draft,
    Submitted,
    Approved,
    Published,
    Retracted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EditionStatus {
    Draft,
    Sealed,
}

/// The signed admin payload: `rprint:admin:v1|domain|nonce|action|arg0,arg1,...`.
pub fn admin_payload(domain: &str, nonce: u64, action: &str, args: &[&str]) -> String {
    format!(
        "{ADMIN_PREFIX}|{domain}|{nonce}|{action}|{}",
        args.join(",")
    )
}

/// The canonical text used by `Codec("canonical")`: schema then `|`-joined items.
pub fn canonical(schema: &str, items: &[&str]) -> String {
    if items.is_empty() {
        schema.to_string()
    } else {
        format!("{schema}|{}", items.join("|"))
    }
}

/// The canonical edition manifest items: edition fields then ordered article hashes.
pub fn edition_manifest_items(
    edition_id: &str,
    publication_id: &str,
    number: u64,
    title_hash: &str,
    cover_hash: &str,
    article_hashes: &[String],
) -> Vec<String> {
    let mut items = vec![
        edition_id.to_string(),
        publication_id.to_string(),
        number.to_string(),
        title_hash.to_string(),
        cover_hash.to_string(),
    ];
    items.extend(article_hashes.iter().cloned());
    items
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roles_round_trip() {
        for role in ROLES {
            assert_eq!(Role::parse(role).map(Role::as_str), Some(role));
        }
        assert!(!validate_roles("king"));
        assert!(Role::Editor.is_editorial());
        assert!(!Role::Writer.is_editorial());
    }

    #[test]
    fn admin_payload_is_stable() {
        assert_eq!(
            admin_payload("publication:abc", 7, "setTreasury", &["1111x"]),
            "rprint:admin:v1|publication:abc|7|setTreasury|1111x"
        );
    }

    #[test]
    fn commission_sums_must_match() {
        let milestones = vec![
            Milestone {
                id: "m1".into(),
                kind: "stipend".into(),
                amount: 400,
                deadline_height: 10,
            },
            Milestone {
                id: "m2".into(),
                kind: "final".into(),
                amount: 600,
                deadline_height: 20,
            },
        ];
        assert_eq!(validate_commission(1000, &milestones), Ok(()));
        assert_eq!(
            validate_commission(999, &milestones),
            Err(ValidationError::Total)
        );
        assert_eq!(
            validate_commission(1000, &milestones[..1]),
            Err(ValidationError::Total)
        );
    }

    #[test]
    fn solo_and_arbitration_rules() {
        let mut charter = Charter {
            name_hash: "n".into(),
            masthead_hash: "m".into(),
            tagline_hash: String::new(),
            treasury_account_id: "1111t".into(),
            asset_id: "REV".into(),
            admins: vec!["02aa".into()],
            threshold: 1,
            arbitrators: Vec::new(),
            arbitration_threshold: 0,
            revenue_split: Vec::new(),
        };
        assert!(charter.validate().is_ok());
        assert!(charter.solo());
        charter.threshold = 0;
        assert_eq!(charter.validate(), Err(ValidationError::Threshold));
        charter.threshold = 1;
        charter.arbitrators = vec!["02aa".into()];
        charter.arbitration_threshold = 1;
        assert_eq!(charter.validate(), Err(ValidationError::Threshold));
    }

    #[test]
    fn did_and_manifest_helpers() {
        assert!(validate_did("did:byoid:abc").is_ok());
        assert!(validate_did("byoid:rev:1111abc").is_ok());
        assert_eq!(validate_did("plain"), Err(ValidationError::Did));
        let items = edition_manifest_items("e", "p", 1, "t", "c", &["h1".into()]);
        assert_eq!(items, ["e", "p", "1", "t", "c", "h1"]);
        assert_eq!(canonical("s", &["a", "b"]), "s|a|b");
    }
}
