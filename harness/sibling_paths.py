"""Resolve the optional r-sure and r-gen sibling checkouts.

The default parent directory is the checkout next to r-print. `RPRINT_SIBLINGS_DIR`
overrides it, which is how CI points at `$GITHUB_WORKSPACE/siblings`. Every manifest
reader goes through this module so a fork or CI checkout needs no symlink.
"""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def siblings_root() -> Path:
    value = os.environ.get("RPRINT_SIBLINGS_DIR")
    return Path(value).expanduser().resolve() if value else ROOT.parent.resolve()


def repo(name: str) -> Path:
    return siblings_root() / name


def manifest(config: dict, key: str = "root_manifest_path") -> Path:
    """Resolve a sibling manifest, honouring the per-sibling environment override."""
    override = os.environ.get(f"RPRINT_{config['sibling_dir'].upper()}_MANIFEST")
    if override:
        return Path(override).expanduser().resolve()
    configured = Path(str(config.get(key, "")))
    if configured.is_absolute():
        return configured.resolve()
    return (repo(config["sibling_dir"]) / configured).resolve()
