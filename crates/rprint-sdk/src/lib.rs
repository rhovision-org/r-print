//! Typed r-print protocol operations.
//!
//! The SDK is the shared client surface for the CLI and the WASM facade. It builds the
//! canonical Rholang terms for every public arm and decodes the state cells.

pub use rprint_core::VERSION;

/// The canonical admin payload domain prefix.
pub const ADMIN_DOMAIN: &str = "rprint:admin:v1";
