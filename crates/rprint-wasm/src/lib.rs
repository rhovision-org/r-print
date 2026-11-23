//! WASM facade for the r-print client.
//!
//! The browser calls this crate for keystore operations and canonical term builders. No
//! plaintext key is returned to JavaScript: the keystore is created and decrypted here,
//! and the caller stores only the encrypted document.

use wasm_bindgen::prelude::*;

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

/// Build a `PublicationFactory("create", ...)` call term.
#[wasm_bindgen]
pub fn create_publication_term(
    factory_uri: &str,
    op_id: &str,
    publication_id: &str,
    charter_json: &str,
    members_json: &str,
) -> Result<String, JsValue> {
    let charter: serde_json::Value = serde_json::from_str(charter_json)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    let members: serde_json::Value = serde_json::from_str(members_json)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    Ok(rprint_sdk::create_publication_term(
        factory_uri,
        op_id,
        publication_id,
        &charter,
        &members,
    ))
}

/// Build an arbitrary registry call term.
#[wasm_bindgen]
pub fn call_term(uri: &str, binding: &str, args: &str) -> String {
    rprint_sdk::call_term(
        uri,
        binding,
        if args.is_empty() { None } else { Some(args) },
    )
}

/// Encrypt a 32-byte secret into a Web3 v3 keystore document.
#[wasm_bindgen]
pub fn keystore_encrypt(
    secret_hex: &str,
    address_hex: &str,
    password: &str,
) -> Result<String, JsValue> {
    let secret = hex_bytes(secret_hex)?;
    rprint_keystore::encrypt(&secret, address_hex, password)
        .map_err(|error| JsValue::from_str(&error))
}

/// Decrypt a Web3 v3 keystore document, returning the secret hex.
#[wasm_bindgen]
pub fn keystore_decrypt(document: &str, password: &str) -> Result<String, JsValue> {
    let secret =
        rprint_keystore::decrypt(document, password).map_err(|error| JsValue::from_str(&error))?;
    Ok(secret.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn hex_bytes(text: &str) -> Result<Vec<u8>, JsValue> {
    if !text.len().is_multiple_of(2) || !text.chars().all(|character| character.is_ascii_hexdigit())
    {
        return Err(JsValue::from_str("secret is not hex"));
    }
    (0..text.len())
        .step_by(2)
        .map(|index| {
            u8::from_str_radix(&text[index..index + 2], 16)
                .map_err(|error| JsValue::from_str(&error.to_string()))
        })
        .collect()
}
