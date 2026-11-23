"""Install and suite profiles.

r-print has one safe profile in v0.1. There is no experimental engine.
"""

from __future__ import annotations

SAFE_TERMS = [
    "00_root.rho",
    "01_kernel.rho",
    "02_admin.rho",
    "40_payments.rho",
    "03_terms.rho",
    "05_rgen.rho",
    "06_rsure.rho",
    "10_publication.rho",
    "11_publication_cell.rho",
    "20_commission.rho",
    "21_commission_escrow.rho",
    "30_article.rho",
    "31_edition.rho",
]

PROFILES = {
    "safe": SAFE_TERMS,
}

DEFAULT_PROFILE = "safe"
