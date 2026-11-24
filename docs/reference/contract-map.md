# Contract map

> **Status:** Implemented. `make check-arch` validates this catalogue.

## Deploy terms

| Term | Components | State cells |
|---|---|---|
| `00_root.rho` | `PrintRoot` | `rootState` |
| `01_kernel.rho` | `Clock`, `Verifier`, `Codec` | none |
| `02_admin.rho` | `AdminGuard`, `PrintAdmin` | `adminState` |
| `03_terms.rho` | `Terms` | none |
| `05_rgen.rho` | `RgenAdapter` | none |
| `06_rsure.rho` | `RsureAdapter` | none |
| `10_publication.rho` | `PublicationFactory` | `factoryState` |
| `11_publication_cell.rho` | `PublicationCellFactory` | `publicationState` |
| `20_commission.rho` | `CommissionFactory`, `CommissionProposal` | `commissionFactoryState`, `commissionProposalState` |
| `21_commission_escrow.rho` | `CommissionEscrowFactory`, `CommissionEscrow` | `escrowFactoryState`, `commissionEscrowState` |
| `30_article.rho` | `ArticleFactory`, `Article` | `articleFactoryState`, `articleState` |
| `31_edition.rho` | `EditionFactory`, `Edition` | `editionFactoryState`, `editionState` |
| `32_coordination.rho` | `CoordinationFactory` | `coordinationFactoryState` |
| `33_coordination_cell.rho` | `CoordinationCellFactory`, `CoordinationRecord` | `coordinationState` |
| `40_payments.rho` | `Payments` | `paymentsState` |

## Component responsibilities

| Component | File | Responsibility |
|---|---|---|
| `PrintRoot` | `00_root.rho` | Installer-gated component directory |
| `Clock` | `01_kernel.rho` | Block-height clock |
| `Verifier` | `01_kernel.rho` | blake2b and secp256k1 wrappers |
| `Codec` | `01_kernel.rho` | Canonical text, hash and admin payload |
| `AdminGuard` | `02_admin.rho` | Platform threshold signature verifier |
| `PrintAdmin` | `02_admin.rho` | Platform pause and admin nonce |
| `Payments` | `40_payments.rho` | r-cash account, issuer and deposit-facet adapter |
| `Terms` | `03_terms.rho` | Role/DID/charter/commission/article/edition validation and hashing |
| `PublicationFactory` | `10_publication.rho` | Charter validation, canonical id binding, cell spawn |
| `PublicationCellFactory` | `11_publication_cell.rho` | One publication cell: roster, roles, pause, admin, arbitration |
| `CommissionFactory` | `20_commission.rho` | Commission proposal factory |
| `CommissionProposal` | `20_commission.rho` | Accept, fund, cover, cancel |
| `CommissionEscrowFactory` | `21_commission_escrow.rho` | Fund a purse and spawn one escrow |
| `CommissionEscrow` | `21_commission_escrow.rho` | Milestones, release, refund, dispute, arbitration |
| `RgenAdapter` | `05_rgen.rho` | Read/verify r-gen identity, credential, Claim, KAsset, Provenance |
| `RsureAdapter` | `06_rsure.rho` | Read an r-sure Policy or Slip; health |
| `ArticleFactory` | `30_article.rho` | Canonical article creation |
| `Article` | `30_article.rho` | Lifecycle, reviews, corrections, optional knowledge links |
| `EditionFactory` | `31_edition.rho` | Canonical edition creation |
| `Edition` | `31_edition.rho` | Ordered manifest and editor-signed seal |
| `CoordinationFactory` | `32_coordination.rho` | Publication-bound coordination record creation |
| `CoordinationCellFactory` | `33_coordination_cell.rho` | One record cell per coordination id |
| `CoordinationRecord` | `33_coordination_cell.rho` | Signer-verified room/poll outcome anchor |

## State cells

`rootState`, `adminState`, `paymentsState`, `factoryState` (publication factory),
`publicationState`, `commissionFactoryState`, `commissionProposalState`, `escrowFactoryState`,
`commissionEscrowState`, `articleFactoryState`, `articleState`, `editionFactoryState`,
`editionState`, `coordinationFactoryState`, `coordinationState`.

Each cell has one writer. The factory cells are issuance/replay maps. The publication,
commission, escrow, article, edition and coordination cells are the entity state.

## Dependency rule

The component graph is acyclic. A child factory checks the canonical publication binding
through `PublicationFactory("issued")`; it never trusts a caller-supplied publication URI.
The r-print-owned contracts read r-gen and r-sure facts by `rho:id:` URI through the
adapters; the siblings never call back into r-print.
