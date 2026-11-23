//! Pure r-print domain types, validation and canonical payloads.
//!
//! This crate has no network dependency. It owns the shapes that the contracts, the SDK,
//! the CLI and the WASM facade share.

/// The r-print protocol version.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
