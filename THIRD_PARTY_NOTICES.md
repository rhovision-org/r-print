# Third-party notices

r-print is AGPL-3.0-or-later. It reuses architectural patterns and, where noted, source
files from sibling rhovision-org projects under their own licences.

| Project | Commit | Licence | What was reused |
|---|---|---|---|
| [r-share](https://github.com/rhovision-org/r-share) | `7114acb` | AGPL-3.0-or-later | Repository scaffold, Root/kernel/admin/payments plumbing, harness patterns, tooling |
| [r-cash](https://github.com/rhovision-org/r-cash) | `49b441d` | AGPL-3.0-only | Pinned payment and signed-deploy crates (`rcash-core`, `rcash-chain`, `rcash-sdk`) |
| [rholo](https://github.com/rhovision-org/rholo) | `841cb84` | AGPL-3.0-only | `rchain-crypto` and the node parser used by `parse-check` |
| [rchain-rust](https://github.com/rchain-community/rchain-rust) | `e2d073d` | Apache-2.0 | Development node used by the harness and CI parser job |

Python harness dependencies are listed in `harness/requirements.txt`. Rust and web
dependencies are resolved by `Cargo.lock` and `web/package-lock.json`; their licences are the
licences of the respective crates and packages.

No cryptographic audit, security audit or production assurance is implied by reuse.
