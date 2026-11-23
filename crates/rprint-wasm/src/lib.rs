//! WASM facade for the r-print client.
//!
//! The browser calls this crate for term building, keystore operations, deploy signing and
//! reply decoding. The key lives only inside `rprint-wallet`; no export returns a plaintext
//! secret. `build_term` is the single Rholang entry point.

use serde::Deserialize;
use wasm_bindgen::prelude::*;

use rprint_wallet::Wallet as WalletCore;

/// The r-print protocol version.
#[wasm_bindgen]
pub fn version() -> String {
    rprint_core::VERSION.to_string()
}

/// Convert a JSON value into a Rholang data literal.
#[wasm_bindgen]
pub fn json_to_rho(value: &str) -> Result<String, JsValue> {
    let parsed: serde_json::Value =
        serde_json::from_str(value).map_err(|error| JsValue::from_str(&error.to_string()))?;
    Ok(rprint_sdk::json_to_rho(&parsed))
}

/// Build a signed-deploy call term (reply on `deployId`).
#[wasm_bindgen]
pub fn call_term(uri: &str, binding: &str, args: &str) -> String {
    rprint_sdk::call_term(
        uri,
        binding,
        if args.is_empty() { None } else { Some(args) },
    )
}

/// Build any client term from the canonical JSON request schema.
///
/// Writes become signed-deploy terms; reads become explore-deploy terms whose reply is
/// emitted on the first private name.
#[wasm_bindgen]
pub fn build_term(request_json: &str) -> Result<String, JsValue> {
    rprint_sdk::build_term(request_json).map_err(|error| JsValue::from_str(&error))
}

/// Decode one node `RhoExpr` value into `{ok, values|reason}` JSON.
#[wasm_bindgen]
pub fn decode_reply(expr_json: &str) -> Result<String, JsValue> {
    let reply = rprint_wallet::decode_reply_json(expr_json).map_err(js_err)?;
    serde_json::to_string(&reply).map_err(js_err)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeployOptionsJson {
    valid_after: i64,
    phlo_limit: i64,
    phlo_price: i64,
    shard: String,
    #[serde(default)]
    timestamp_millis: Option<i64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EditionManifestJson {
    edition_id: String,
    publication_id: String,
    number: u64,
    title_hash: String,
    cover_hash: String,
    article_hashes: Vec<String>,
}

/// A wallet whose key never leaves this module.
#[wasm_bindgen]
pub struct Wallet {
    inner: WalletCore,
}

#[wasm_bindgen]
impl Wallet {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Wallet {
        Wallet {
            inner: WalletCore::locked(),
        }
    }

    /// Generate a key, return `{address, publicKey, document}`, and stay unlocked.
    pub fn create(&mut self, password: &str) -> Result<String, JsValue> {
        let (wallet, document, info) = WalletCore::create(password).map_err(js_err)?;
        self.inner = wallet;
        to_json(&serde_json::json!({
            "address": info.address,
            "publicKey": info.public_key,
            "document": document,
        }))
    }

    /// Decrypt a keystore document into this wallet and return `{address, publicKey}`.
    pub fn unlock(&mut self, document: &str, password: &str) -> Result<String, JsValue> {
        let (wallet, info) = WalletCore::unlock(document, password).map_err(js_err)?;
        self.inner = wallet;
        to_json(&serde_json::json!({
            "address": info.address,
            "publicKey": info.public_key,
        }))
    }

    pub fn lock(&mut self) {
        self.inner.lock();
    }

    pub fn is_unlocked(&self) -> bool {
        self.inner.is_unlocked()
    }

    /// `{address, publicKey}` or `null` when locked.
    pub fn info(&self) -> Option<String> {
        self.inner.info().map(|info| {
            serde_json::json!({
                "address": info.address,
                "publicKey": info.public_key,
            })
            .to_string()
        })
    }

    pub fn address(&self) -> Result<String, JsValue> {
        self.inner
            .info()
            .map(|info| info.address)
            .ok_or_else(|| JsValue::from_str("wallet is locked"))
    }

    pub fn public_key(&self) -> Result<String, JsValue> {
        self.inner
            .info()
            .map(|info| info.public_key)
            .ok_or_else(|| JsValue::from_str("wallet is locked"))
    }

    /// Re-encrypt the current key with a (possibly new) password.
    pub fn export(&self, password: &str) -> Result<String, JsValue> {
        self.inner.export(password).map_err(js_err)
    }

    /// Sign a deploy. `options_json` is `{validAfter, phloLimit, phloPrice, shard,
    /// timestampMillis}`; returns `{deployId, body}`.
    pub fn sign_deploy(&self, term: &str, options_json: &str) -> Result<String, JsValue> {
        let options: DeployOptionsJson = serde_json::from_str(options_json).map_err(js_err)?;
        let signed = self
            .inner
            .sign_deploy(
                term,
                &rprint_wallet::DeploySignOptions {
                    valid_after: options.valid_after,
                    phlo_limit: options.phlo_limit,
                    phlo_price: options.phlo_price,
                    shard: options.shard,
                    timestamp_millis: options.timestamp_millis,
                },
            )
            .map_err(js_err)?;
        to_json(&serde_json::json!({
            "deployId": signed.deploy_id,
            "body": signed.body,
        }))
    }

    /// Sign a canonical admin payload. The payload text must come from the deployed `Codec`.
    pub fn sign_text_payload(&self, payload: &str) -> Result<String, JsValue> {
        self.inner.sign_text_payload(payload).map_err(js_err)
    }

    /// Sign the canonical edition manifest; returns `{manifestHash, signature}`.
    pub fn sign_edition_manifest(&self, input_json: &str) -> Result<String, JsValue> {
        let input: EditionManifestJson = serde_json::from_str(input_json).map_err(js_err)?;
        let (manifest_hash, signature) = self
            .inner
            .sign_edition_manifest(
                &input.edition_id,
                &input.publication_id,
                input.number,
                &input.title_hash,
                &input.cover_hash,
                &input.article_hashes,
            )
            .map_err(js_err)?;
        to_json(&serde_json::json!({
            "manifestHash": manifest_hash,
            "signature": signature,
        }))
    }
}

impl Default for Wallet {
    fn default() -> Self {
        Self::new()
    }
}

fn to_json(value: &serde_json::Value) -> Result<String, JsValue> {
    serde_json::to_string(value).map_err(js_err)
}

fn js_err(error: impl ToString) -> JsValue {
    JsValue::from_str(&error.to_string())
}
