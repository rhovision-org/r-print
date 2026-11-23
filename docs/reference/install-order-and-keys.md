# Install order and keys

> **Status:** Implemented. `make check-docs` validates this page against the profiles and the
> registered component keys.

## Order

The `safe` profile installs these terms in order:

1. `00_root.rho`
2. `01_kernel.rho`
3. `02_admin.rho`
4. `40_payments.rho`
5. `03_terms.rho`
6. `05_rgen.rho`
7. `06_rsure.rho`
8. `10_publication.rho`
9. `11_publication_cell.rho`
10. `20_commission.rho`
11. `21_commission_escrow.rho`
12. `30_article.rho`
13. `31_edition.rho`

`00_root.rho` captures the root URI; every later term is rendered with `__ROOT_URI__` set to
it. `40_payments.rho` captures the r-cash root and ensures the protocol account. The
publication factory resolves the cell factory at create time; the commission factory
resolves the escrow factory at fund time; the article factory resolves the r-gen adapter at
attach time.

## Placeholders

`__ADMINS__`, `__THRESHOLD__`, `__ROOT_URI__`, `__RCASH_ROOT_URI__`, `__PROTOCOL_OWNER__`,
`__RGEN_ROOT_URI__`, `__RSURE_ROOT_URI__`. The r-gen and r-sure roots are empty unless their
configs are enabled and a manifest is present; the adapters then report `disabled`.

## Component keys

| Key | Contract |
|---|---|
| `component:root` | `PrintRoot` |
| `component:clock` | `Clock` |
| `component:verifier` | `Verifier` |
| `component:codec` | `Codec` |
| `component:admin-guard` | `AdminGuard` |
| `component:admin` | `PrintAdmin` |
| `component:payments` | `Payments` |
| `component:terms` | `Terms` |
| `component:publication-factory` | `PublicationFactory` |
| `component:publication-cell-factory` | `PublicationCellFactory` |
| `component:commission-factory` | `CommissionFactory` |
| `component:commission-escrow-factory` | `CommissionEscrowFactory` |
| `component:article-factory` | `ArticleFactory` |
| `component:edition-factory` | `EditionFactory` |
| `component:rgen-adapter` | `RgenAdapter` |
| `component:rsure-adapter` | `RsureAdapter` |

## r-cash prerequisites

The r-print `Payments` adapter resolves these keys from the r-cash root:
`component:account-factory`, `component:asset-resolver`, `component:clock`. The pinned r-cash
commit is `49b441dea4f5561992387ed670ab263fcd5dd164`; the asset is REV.

## Sibling roots

`configs/rgen.json` pins r-gen `c0ae67d4a493800ce1f8787800f725d9f768f6b5` and lists the
required components. `configs/rsure.json` pins r-sure
`0da5d0436e5f33eec3de20adb887ece4b1edcad3` and lists the required components. Both are
`enabled: false` by default. Enabling one requires its root manifest on the same devnet; a
disabled adapter returns `(false, "disabled")`.
