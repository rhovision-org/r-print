//! The r-print wallet core.
//!
//! One place holds the key, signs deploys, signs canonical payloads and decodes replies.
//! The CLI and the WASM facade both use this crate; neither reimplements protobuf,
//! secp256k1, hashing or the keystore. A plaintext secret never leaves this crate through
//! `Wallet`'s public API — `create` returns the encrypted document and `unlock` takes it.

mod decode;

pub use decode::{decode_reply_json, ReplyJson};

use rcash_chain::address::eth_address_from_public_key;
use rcash_chain::deploy::DeployOptions;
use rcash_chain::KeyPair;
use rprint_core::{admin_payload, canonical, edition_manifest_items};
use serde::Serialize;
use serde_json::Value;
use zeroize::Zeroize;

/// A wallet error, tagged by the stage that failed.
#[derive(Debug, thiserror::Error)]
pub enum WalletError {
    #[error("keystore: {0}")]
    Keystore(String),
    #[error("key: {0}")]
    Key(String),
    #[error("signing: {0}")]
    Signing(String),
    #[error("decode: {0}")]
    Decode(String),
    #[error("term: {0}")]
    Term(String),
}

/// What the UI may show about an unlocked wallet.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletInfo {
    /// The REV address the chain uses as the member identity.
    pub address: String,
    /// The 65-byte uncompressed public key, hex.
    pub public_key: String,
}

/// The node request body and locally computed deploy id.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedRequest {
    pub deploy_id: String,
    pub body: Value,
}

/// The caller-controlled deploy fields.
#[derive(Debug, Clone)]
pub struct DeploySignOptions {
    pub valid_after: i64,
    pub phlo_limit: i64,
    pub phlo_price: i64,
    pub shard: String,
    /// `None` uses the current wall clock; tests and parity fixtures pin it.
    pub timestamp_millis: Option<i64>,
}

impl Default for DeploySignOptions {
    fn default() -> Self {
        Self {
            valid_after: 0,
            phlo_limit: 1_000_000,
            phlo_price: 1,
            shard: "/root".to_string(),
            timestamp_millis: None,
        }
    }
}

impl DeploySignOptions {
    pub fn devnet(valid_after: i64) -> Self {
        Self {
            valid_after,
            ..Self::default()
        }
    }
}

/// An unlocked or locked wallet. The secret is zeroized when the wallet drops.
pub struct Wallet {
    key: Option<KeyPair>,
}

impl std::fmt::Debug for Wallet {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Wallet")
            .field("unlocked", &self.key.is_some())
            .finish()
    }
}

impl Wallet {
    /// A wallet with no key. Unlock or create before signing.
    pub fn locked() -> Wallet {
        Wallet { key: None }
    }

    /// Generate a key, encrypt it into a Web3 v3 document and return it unlocked.
    pub fn create(password: &str) -> Result<(Wallet, String, WalletInfo), WalletError> {
        let key = KeyPair::generate().map_err(map_key)?;
        let info = info_for(&key)?;
        let eth = eth_address_from_public_key(key.public_bytes()).map_err(map_key)?;
        let document = rprint_keystore::encrypt(key.secret_bytes(), &eth, password)
            .map_err(WalletError::Keystore)?;
        Ok((Wallet { key: Some(key) }, document, info))
    }

    /// Decrypt a keystore document and keep the key inside this wallet.
    pub fn unlock(document: &str, password: &str) -> Result<(Wallet, WalletInfo), WalletError> {
        let mut secret =
            rprint_keystore::decrypt(document, password).map_err(WalletError::Keystore)?;
        let key = KeyPair::from_secret_bytes(&secret).map_err(map_key);
        secret.zeroize();
        let key = key?;
        let info = info_for(&key)?;
        Ok((Wallet { key: Some(key) }, info))
    }

    /// Drop the key from memory.
    pub fn lock(&mut self) {
        self.key = None;
    }

    pub fn is_unlocked(&self) -> bool {
        self.key.is_some()
    }

    pub fn info(&self) -> Option<WalletInfo> {
        self.key.as_ref().and_then(|key| info_for(key).ok())
    }

    /// Re-encrypt the current key with a (possibly new) password.
    pub fn export(&self, password: &str) -> Result<String, WalletError> {
        let key = self.key()?;
        let eth = eth_address_from_public_key(key.public_bytes()).map_err(map_key)?;
        rprint_keystore::encrypt(key.secret_bytes(), &eth, password).map_err(WalletError::Keystore)
    }

    /// Sign a deploy and return the node request body plus the deploy id.
    pub fn sign_deploy(
        &self,
        term: &str,
        options: &DeploySignOptions,
    ) -> Result<SignedRequest, WalletError> {
        let key = self.key()?;
        let mut builder = DeployOptions::new(term)
            .phlo(options.phlo_limit, options.phlo_price)
            .valid_after_block_number(options.valid_after)
            .shard_id(options.shard.clone());
        if let Some(timestamp) = options.timestamp_millis {
            builder = builder.timestamp(timestamp);
        }
        let data = builder
            .build()
            .map_err(|error| WalletError::Term(error.to_string()))?;
        let signed = key
            .sign_deploy(data)
            .map_err(|error| WalletError::Signing(error.to_string()))?;
        let body = signed.request_body();
        Ok(SignedRequest {
            deploy_id: signed.deploy_id,
            body,
        })
    }

    /// BLAKE2b-256 over the UTF-8 payload, then DER secp256k1. This is the shape the admin
    /// guard verifies; the payload text must come from the deployed `Codec`.
    pub fn sign_text_payload(&self, payload: &str) -> Result<String, WalletError> {
        let key = self.key()?;
        let signature = key
            .sign_payload(payload.as_bytes())
            .map_err(|error| WalletError::Signing(error.to_string()))?;
        Ok(hex(&signature))
    }

    /// Sign the canonical edition manifest. Returns `(manifest hash, signature)`.
    pub fn sign_edition_manifest(
        &self,
        edition_id: &str,
        publication_id: &str,
        number: u64,
        title_hash: &str,
        cover_hash: &str,
        article_hashes: &[String],
    ) -> Result<(String, String), WalletError> {
        let key = self.key()?;
        let items = edition_manifest_items(
            edition_id,
            publication_id,
            number,
            title_hash,
            cover_hash,
            article_hashes,
        );
        let refs: Vec<&str> = items.iter().map(String::as_str).collect();
        let text = canonical("rprint:edition:v1", &refs);
        let digest = rchain_crypto::hash::blake2b256::hash(text.as_bytes());
        let signature = key
            .sign_prehash(&digest)
            .map_err(|error| WalletError::Signing(error.to_string()))?;
        Ok((hex(&digest), hex(&signature)))
    }

    /// Sign the canonical admin payload used by `pubVerifyAdmin`.
    ///
    /// The contract hashes the payload with blake2b256 and verifies a prehash
    /// signature, so this signs the digest rather than the text.
    pub fn sign_admin_payload(
        &self,
        domain: &str,
        nonce: u64,
        action: &str,
        args: &[&str],
    ) -> Result<String, WalletError> {
        let key = self.key()?;
        let text = admin_payload(domain, nonce, action, args);
        let digest = rchain_crypto::hash::blake2b256::hash(text.as_bytes());
        let signature = key
            .sign_prehash(&digest)
            .map_err(|error| WalletError::Signing(error.to_string()))?;
        Ok(hex(&signature))
    }

    fn key(&self) -> Result<&KeyPair, WalletError> {
        self.key
            .as_ref()
            .ok_or_else(|| WalletError::Key("wallet is locked".to_string()))
    }
}

fn info_for(key: &KeyPair) -> Result<WalletInfo, WalletError> {
    Ok(WalletInfo {
        address: key.rev_address().map_err(map_key)?,
        public_key: key.public_hex(),
    })
}

fn map_key(error: rcash_chain::ChainError) -> WalletError {
    WalletError::Key(error.to_string())
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixed_wallet(secret_hex: &str) -> Wallet {
        Wallet {
            key: Some(KeyPair::from_secret_hex(secret_hex).expect("valid secret")),
        }
    }

    fn unhex(text: &str) -> Vec<u8> {
        (0..text.len())
            .step_by(2)
            .map(|index| u8::from_str_radix(&text[index..index + 2], 16).expect("hex"))
            .collect()
    }

    #[test]
    fn keystore_round_trips_and_locks() {
        let (wallet, document, info) = Wallet::create("correct horse").unwrap();
        assert!(wallet.is_unlocked());
        assert!(info.address.starts_with("1111"));
        assert_eq!(info.public_key.len(), 130);
        assert!(!document.contains("secret"));

        let (mut unlocked, same) = Wallet::unlock(&document, "correct horse").unwrap();
        assert_eq!(unlocked.info().unwrap(), info);
        assert_eq!(same, info);
        assert!(Wallet::unlock(&document, "wrong").is_err());
        unlocked.lock();
        assert!(!unlocked.is_unlocked());
        assert!(unlocked
            .sign_deploy("Nil", &DeploySignOptions::default())
            .is_err());
    }

    #[test]
    fn deploy_signing_matches_the_r0a_parity_fixture() {
        let wallet = fixed_wallet(&"01".repeat(32));
        let options = DeploySignOptions {
            valid_after: 12_345,
            phlo_limit: 1_000_000,
            phlo_price: 1,
            shard: "/root".to_string(),
            timestamp_millis: Some(1_700_000_000_000),
        };
        let signed = wallet.sign_deploy("Nil", &options).unwrap();
        assert_eq!(
            signed.body["signature"].as_str().unwrap(),
            "3044022059126613d09aad982947545c814ee8f4bc44ced6441f70cd8d29840c2d90f78c02206b2e2b145457fd54329096b246e005b64bdaa76ffd94563ec00613bea38d6287"
        );
        assert_eq!(signed.deploy_id, signed.body["signature"].as_str().unwrap());
        assert_eq!(
            wallet.info().unwrap().address,
            "1111pjC8LgoBQApxaJeuGBJWhC4rAQDbVbkSMLaXjGdfiUynCXef9"
        );
    }

    #[test]
    fn text_payload_signature_verifies() {
        let secret = "02".repeat(32);
        let wallet = fixed_wallet(&secret);
        let key = KeyPair::from_secret_hex(&secret).unwrap();
        let payload = "rprint:admin:v1|publication:p|3|setTreasury|1111x";
        let signature = wallet.sign_text_payload(payload).unwrap();
        let digest = rchain_crypto::hash::blake2b256::hash(payload.as_bytes());
        assert!(key.verify_prehash(&digest, &unhex(&signature)));
        assert!(!key.verify_prehash(&digest, &unhex("00")));
    }

    #[test]
    fn client_vectors_match_the_python_reference() {
        let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../spec/vectors/client.json");
        let text = std::fs::read_to_string(path).expect("client vectors");
        let doc: serde_json::Value = serde_json::from_str(&text).expect("vector JSON");
        for vector in doc["vectors"].as_array().expect("vectors") {
            if vector["kind"] != "blake2b" {
                continue;
            }
            let payload = vector["text"].as_str().expect("text");
            let digest = rchain_crypto::hash::blake2b256::hash(payload.as_bytes());
            assert_eq!(hex(&digest), vector["digest"].as_str().expect("digest"));
        }
    }

    #[test]
    fn edition_manifest_hash_and_signature_verify() {
        let secret = "03".repeat(32);
        let wallet = fixed_wallet(&secret);
        let key = KeyPair::from_secret_hex(&secret).unwrap();
        let hashes = vec!["h1".to_string(), "h2".to_string()];
        let (digest, signature) = wallet
            .sign_edition_manifest("ed", "pub", 1, "title", "cover", &hashes)
            .unwrap();
        let text = canonical(
            "rprint:edition:v1",
            &["ed", "pub", "1", "title", "cover", "h1", "h2"],
        );
        let expected = rchain_crypto::hash::blake2b256::hash(text.as_bytes());
        assert_eq!(digest, hex(&expected));
        assert!(key.verify_prehash(&expected, &unhex(&signature)));
    }
}
