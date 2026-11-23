//! Encrypted keystore support for r-print.
//!
//! The implementation is a port of the r-cash / r-share Web3 Secret Storage v3 module.
//! The scaffold deliberately exposes no plaintext-key path.

/// The keystore format version.
pub const KEYSTORE_VERSION: u32 = 3;
