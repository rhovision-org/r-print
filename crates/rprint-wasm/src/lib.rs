//! WASM facade for the r-print client.
//!
//! The browser calls this crate for keystore operations, typed reads and term builders.
//! No plaintext key is ever returned to JavaScript.

/// The r-print protocol version exposed to the browser.
pub fn version() -> String {
    rprint_core::VERSION.to_string()
}
