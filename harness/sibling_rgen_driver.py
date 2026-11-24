#!/usr/bin/env python3
"""Create a real r-gen knowledge chain for the sibling fixture.

Run from the r-gen checkout with its harness on `sys.path`. Prints one
`SIBLING_RESULT <json>` line. The r-print orchestrator runs this in a subprocess so
the two harnesses never share module names.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve()
SIBLINGS = Path(os.environ.get("RPRINT_SIBLINGS_DIR", HERE.parent.parent))
RGen = SIBLINGS / "RGen"
sys.path.insert(0, str(RGen / "harness"))

import actors  # noqa: E402
import assertions  # noqa: E402
import fixtures  # noqa: E402
import suite_base  # noqa: E402


def stub(payload: dict) -> str:
    """One entity with a fixed `get` reply, used for the unreachable real negatives."""
    term = f"""
new E, rs(`rho:registry:insertArbitrary`), ch, deployId(`rho:rchain:deployId`) in {{
  contract E(@"get", ret) = {{ ret!((true, {json.dumps(payload)})) }} |
  rs!(bundle+{{*E}}, *ch) |
  for (@u <- ch) {{ deployId!(u) }}
}}
"""
    return assertions.one(term, key="deployer")


def main() -> int:
    addrs = suite_base.setup(("reporter1", "reporter2", "reporter3", "deployer"))
    author = addrs["reporter1"]
    content_hash = f"rprint:knowledge:{int(time.time())}"

    validator_cred = fixtures.issue(
        addrs["reporter2"], "Validator", "structural", "US-TX", "validator",
        issuer="deployer")
    assertions.expect_ok("validator credential", validator_cred)
    validator_cred = validator_cred[1]
    author_cred = fixtures.issue(
        addrs["reporter1"], "Writer", "structural", "US-TX", "writer",
        issuer="deployer")
    assertions.expect_ok("author credential", author_cred)
    author_cred = author_cred[1]

    def chain(claimant: str, verdict: str = "valid") -> tuple[str, str]:
        claim_reply = fixtures.claim(claimant, suite_base.claim_req(addrs[claimant]))
        assertions.expect_ok("claim", claim_reply)
        claim_uri = claim_reply[1]["uri"]
        validated = fixtures.claim_validate(
            claim_uri, validator_cred, "reporter2",
            suite_base.validation(validator_cred, verdict=verdict))
        assertions.expect_ok("claim validate", validated)
        return claim_uri, validated[1]["uri"]

    claim_uri, kasset_uri = chain("reporter1")
    provenance = fixtures.provenance_create(kasset_uri, [author], key="deployer")
    assertions.expect_ok("provenance", provenance)
    provenance_uri = provenance[1]["uri"]
    anchored = fixtures.provenance_anchor(
        provenance_uri, "reporter1", {"kind": "content", "hash": content_hash})
    assertions.expect_ok("provenance anchor", anchored)

    second_claim, second_kasset = chain("reporter1")
    wrong_asset = fixtures.provenance_create(second_kasset, [author], key="deployer")
    assertions.expect_ok("second provenance", wrong_asset)

    mismatch = fixtures.provenance_create(kasset_uri, [author], key="deployer")
    assertions.expect_ok("mismatch provenance", mismatch)
    mismatch_uri = mismatch[1]["uri"]
    fixtures.provenance_anchor(mismatch_uri, "reporter1",
                               {"kind": "content", "hash": "not-the-article"})

    rejected_claim, rejected_kasset = chain("reporter1", verdict="invalid")

    non_author_claim, non_author_kasset = chain("reporter3")
    non_author_prov = fixtures.provenance_create(
        non_author_kasset, [addrs["reporter3"]], key="deployer")
    assertions.expect_ok("non-author provenance", non_author_prov)

    revoked = fixtures.issue(
        addrs["reporter1"], "Writer", "structural", "US-TX", "writer",
        issuer="deployer")
    revoked_uri = revoked[1]
    fixtures.revoke_credential(revoked_uri, "reporter1")
    expired = fixtures.issue(
        addrs["reporter1"], "Writer", "structural", "US-TX", "writer",
        expires_at=1, issuer="deployer")
    assertions.expect_ok("expired credential", expired)

    claim_kasset_stub = stub({
        "status": "validated",
        "kassetRef": {"uri": "rho:id:other-kasset"},
    })
    provenance_claim_stub = stub({
        "assetRef": {"uri": kasset_uri, "claimRef": {"uri": "rho:id:other-claim"}},
        "writers": [author],
    })

    result = {
        "contentHash": content_hash,
        "authorAddress": author,
        "credentialUri": author_cred,
        "revokedCredentialUri": revoked_uri,
        "expiredCredentialUri": expired[1],
        "otherSubjectCredentialUri": validator_cred,
        "kassetUri": kasset_uri,
        "claimUri": claim_uri,
        "provenanceUri": provenance_uri,
        "secondKassetUri": second_kasset,
        "secondClaimUri": second_claim,
        "rejectedKassetUri": rejected_kasset,
        "rejectedClaimUri": rejected_claim,
        "wrongAssetProvenanceUri": wrong_asset[1]["uri"],
        "hashMismatchProvenanceUri": mismatch_uri,
        "nonAuthorClaimUri": non_author_claim,
        "nonAuthorKassetUri": non_author_kasset,
        "nonAuthorProvenanceUri": non_author_prov[1]["uri"],
        "claimKassetMismatchClaimUri": claim_kasset_stub,
        "provenanceClaimMismatchUri": provenance_claim_stub,
    }
    print("SIBLING_RESULT " + json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
