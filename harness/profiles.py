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
    "10_publication.rho",
    "11_publication_cell.rho",
]

PROFILES = {
    "safe": SAFE_TERMS,
}

DEFAULT_PROFILE = "safe"
