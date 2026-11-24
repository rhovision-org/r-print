#!/usr/bin/env python3
"""Adversarial probes against the deployed contracts.

The suite records a classification, not a pass: `fixed` means the intended
refusal happened, `open` means an adversary got a result the review did not
accept, and `accepted` means the observed behaviour is the risk-accepted
finding RPA-001. It is an internal review, not an independent audit.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from actors import address, public
from article_fixture import (approve, create_article, edition_data,
                             editorial_publication, publish, submit)
from assertions import one
from commission_fixture import accept, fund, propose, release, submit as escrow_submit
from helpers import call_uri, resolve_component, sign_digest
from preflight import require_devnet
from publication_fixture import create_publication, quoted

import deploy as node
import sibling_fixture

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "deployments" / "redteam-results.json"


def refusal(reply, reason: str | None = None) -> bool:
    if not (isinstance(reply, tuple) and reply and reply[0] is False):
        return False
    return reason is None or (len(reply) > 1 and reply[1] == reason)


def entity_stub(payload: dict, verify: bool = False) -> str:
    extra = (
        'contract E(@"verify", @hash, ret) = { ret!((true, true)) } |'
        if verify else ""
    )
    term = f"""
new E, rs(`rho:registry:insertArbitrary`), ch, deployId(`rho:rchain:deployId`) in {{
  contract E(@"get", ret) = {{ ret!((true, {json.dumps(payload)})) }} |
  {extra}
  rs!(bundle+{{*E}}, *ch) |
  for (@u <- ch) {{ deployId!(u) }}
}}
"""
    reply = one(term)
    if not isinstance(reply, str):
        raise AssertionError(f"stub: {reply!r}")
    return reply


def mutable_stub(payload: dict, verify: bool = False) -> str:
    extra = (
        'contract E(@"verify", @hash, ret) = { ret!((true, true)) } |'
        if verify else ""
    )
    term = f"""
new E, st, rs(`rho:registry:insertArbitrary`), ch, deployId(`rho:rchain:deployId`) in {{
  st!({json.dumps(payload)}) |
  contract E(@"get", ret) = {{
    for (@p <- st) {{ st!(p) | ret!((true, p)) }}
  }} |
  contract E(@"set", @p, ret) = {{
    for (_ <- st) {{ st!(p) | ret!(true) }}
  }} |
  {extra}
  rs!(bundle+{{*E}}, *ch) |
  for (@u <- ch) {{ deployId!(u) }}
}}
"""
    reply = one(term)
    if not isinstance(reply, str):
        raise AssertionError(f"mutable stub: {reply!r}")
    return reply


def policy_stub(insured: str, asset_id: str) -> str:
    term = f"""
new P, rs(`rho:registry:insertArbitrary`), ch, deployId(`rho:rchain:deployId`) in {{
  contract P(@"info", ret) = {{
    ret!((true, {{"status": "active", "insured": {quoted(insured)},
                   "assetId": {quoted(asset_id)}, "perClaimLimit": 1000,
                   "aggregateRemaining": 5000}}))
  }} |
  rs!(bundle+{{*P}}, *ch) |
  for (@u <- ch) {{ deployId!(u) }}
}}
"""
    reply = one(term)
    if not isinstance(reply, str):
        raise AssertionError(f"policy stub: {reply!r}")
    return reply


def main() -> int:
    print("redteam")
    if not require_devnet("redteam"):
        return 2
    results: list[dict] = []

    def record(pid: str, name: str, expected: str, fn, finding: str = "-") -> None:
        observed = None
        classification = "not_reproduced"
        try:
            observed = fn()
            if expected == "refuse":
                classification = "fixed" if refusal(observed) else "open"
            elif expected == "accept":
                classification = "accepted" if (
                    isinstance(observed, tuple) and observed and observed[0] is True) else "not_reproduced"
        except Exception as error:  # a setup failure is not a pass
            observed = f"{type(error).__name__}: {error}"
        results.append({"id": pid, "name": name, "expected": expected,
                        "classification": classification, "finding": finding,
                        "observed": observed})
        print(f"  {pid}: {classification}")

    pub = create_publication(
        "redteam", publisher="deployer",
        members=[("deployer", "publisher"), ("reporter1", "editor"),
                 ("reporter3", "writer")],
        admins=["deployer"], threshold=1)

    record("RT-001", "editor impersonates a publisher", "refuse",
           lambda: one(call_uri(pub["uri"], "addMember",
                                f'*dId, "rt-add", {quoted(address("sender"))}, '
                                '"writer", "did:rt", "att:rt"'), key="reporter1"))

    solo = create_publication("redteam-solo", publisher="deployer",
                              members=[("deployer", "publisher")])
    record("RT-002", "last publisher removes themselves", "refuse",
           lambda: one(call_uri(solo["uri"], "removeMember",
                                f'*dId, "rt-remove", {quoted(address("deployer"))}'),
                       key="deployer"))

    one(call_uri(pub["uri"], "pause", '*dId, "rt-pause", true'), key="deployer")
    record("RT-003", "write against a paused publication", "refuse",
           lambda: one(call_uri(pub["uri"], "addMember",
                                f'*dId, "rt-paused", {quoted(address("sender"))}, '
                                '"writer", "did:rt", "att:rt"'), key="deployer"))
    one(call_uri(pub["uri"], "pause", '*dId, "rt-resume", false'), key="deployer")

    admin = resolve_component("component:admin")
    record("RT-004", "replay a platform admin nonce", "refuse",
           lambda: one(call_uri(admin, "admin", '0, "pauseAll", [], []')))

    proposal = propose(pub)
    record("RT-005", "writer accepts their own proposal", "refuse",
           lambda: one(call_uri(proposal["uri"], "accept",
                                f'*dId, "rt-accept:{proposal["proposal_id"]}"'),
                       key="reporter3"))

    accept(proposal)
    escrow = fund(proposal)
    escrow_submit(escrow, "m1")
    release(escrow, "m1")
    record("RT-006", "double release", "refuse",
           lambda: one(call_uri(escrow["escrow_uri"], "release",
                                '*dId, "rt-release", "m1"'), key="reporter1"))

    fake_policy = policy_stub(pub["treasury"], pub["asset_id"])
    covered = propose(pub, proposal_id=f"rt-cover:{node.height()}")
    accept(covered)
    record("RT-007", "attach a self-consistent fake policy", "refuse",
           lambda: one(call_uri(covered["uri"], "attachCover",
                                f'*dId, "rt-cover", "{fake_policy}"'), key="reporter1"),
           finding="RPA-001")

    other = editorial_publication("redteam-other")
    foreign = create_article(other, "content:foreign")
    submit(foreign)
    approve(foreign)
    publish(foreign)
    edition = one(call_uri(resolve_component("component:edition-factory"), "create",
                           f'*dId, "rt-edition", "rt-edition:{node.height()}", '
                           + edition_data(pub)))
    if not (isinstance(edition, tuple) and edition and edition[0] is True):
        raise AssertionError(f"edition create: {edition!r}")
    record("RT-008", "append an article from another publication", "refuse",
           lambda: one(call_uri(edition[1], "append",
                                f'*dId, "rt-append", "{foreign["uri"]}"'),
                       key="deployer"))

    local = create_article(pub, "content:local")
    submit(local)
    approve(local)
    publish(local)
    one(call_uri(edition[1], "append", f'*dId, "rt-append-local", "{local["uri"]}"'),
        key="deployer")
    record("RT-009", "writer seals an edition", "refuse",
           lambda: one(call_uri(edition[1], "seal", '*dId, "rt-seal", "00"'),
                       key="reporter3"))

    fixture = sibling_fixture.load()
    if fixture and fixture.get("rgen"):
        rgen = fixture["rgen"]
        article = create_article(pub, rgen["contentHash"], label="redteam")
        submit(article)
        record("RT-010", "revoked credential on a real chain", "refuse",
               lambda: one(call_uri(
                   article["uri"], "attachKnowledge",
                   f'*dId, "rt-knowledge", "{rgen["kassetUri"]}", '
                   f'"{rgen["claimUri"]}", "{rgen["provenanceUri"]}", '
                   f'"{rgen["revokedCredentialUri"]}"'), key="reporter1"),
               finding="RPA-007")

        fake_hash = f"redteam:fake:{int(time.time())}"
        fake_article = create_article(pub, fake_hash, label="redteam-fake")
        submit(fake_article)
        fake_claim = mutable_stub({
            "claimant": address("reporter1"),
            "kassetRef": {"uri": "rho:id:pending"},
            "status": "validated",
        })
        fake_kasset = mutable_stub({"claimRef": {"uri": fake_claim}})
        one(call_uri(fake_claim, "set", json.dumps({
            "claimant": address("reporter1"),
            "kassetRef": {"uri": fake_kasset},
            "status": "validated",
        })))
        fake_prov = entity_stub({"assetRef": {"uri": fake_kasset,
                                              "claimRef": {"uri": fake_claim}},
                                 "writers": [address("reporter1")]}, verify=True)
        record("RT-011", "attach a self-consistent fake knowledge chain", "refuse",
               lambda: one(call_uri(
                   fake_article["uri"], "attachKnowledge",
                   f'*dId, "rt-fake-knowledge", "{fake_kasset}", '
                   f'"{fake_claim}", "{fake_prov}", ""'), key="reporter1"),
               finding="RPA-001")

        fake_real_prov = entity_stub({
            "assetRef": {"uri": rgen["kassetUri"], "claimRef": {"uri": rgen["claimUri"]}},
            "writers": [address("reporter1")],
        }, verify=True)
        real_article = create_article(pub, rgen["contentHash"], label="redteam-prov")
        submit(real_article)
        record("RT-012", "real chain with a self-consistent fake provenance", "accept",
               lambda: one(call_uri(
                   real_article["uri"], "attachKnowledge",
                   f'*dId, "rt-fake-provenance", "{rgen["kassetUri"]}", '
                   f'"{rgen["claimUri"]}", "{fake_real_prov}", ""'), key="reporter1"),
               finding="RPA-001")
    else:
        for pid, name in (("RT-010", "revoked credential on a real chain"),
                          ("RT-011", "attach a self-consistent fake knowledge chain")):
            results.append({"id": pid, "name": name, "expected": "refuse",
                            "classification": "not_run", "finding": "RPA-001",
                            "observed": "no sibling fixture"})
            print(f"  {pid}: not_run (no sibling fixture)")

    keys = node.load_keys()
    coord_factory = resolve_component("component:coordination-factory")
    codec = resolve_component("component:codec")

    def coord_digest(cid: str, poll: str, outcome: str) -> bytes:
        reply = one(call_uri(
            codec, "hash",
            f'"rprint:coord:v1", [{quoted(cid)}, {quoted(poll)}, {quoted(outcome)}]'))
        if not (isinstance(reply, tuple) and reply and reply[0] is True
                and isinstance(reply[1], bytes)):
            raise AssertionError(f"coordination digest: {reply!r}")
        return reply[1]

    def coord_entry(name: str, digest: bytes, signer: str | None = None) -> str:
        signer = signer or name
        return ('{"memberId": ' + quoted(address(name))
                + ', "pubKey": "' + public(name) + '".hexToBytes()'
                + ', "sig": ' + sign_digest(keys, signer, digest) + '}')

    def new_coordination(cid: str, signer_names: list[str]) -> str:
        signers = ", ".join(quoted(address(name)) for name in signer_names)
        data = ('{"publicationId": ' + quoted(pub["publication_id"])
                + ', "publicationUri": ' + quoted(pub["uri"])
                + ', "subjectRef": {"kind": "publication", "id": '
                + quoted(pub["publication_id"]) + ', "uri": ' + quoted(pub["uri"]) + '}'
                + ', "roomIdHash": "room:redteam", "signerIds": [' + signers + ']}')
        reply = one(call_uri(
            coord_factory, "create",
            f'*dId, "create:{cid}", {quoted(cid)}, {data}'), key="deployer")
        if not (isinstance(reply, tuple) and reply and reply[0] is True):
            raise AssertionError(f"coordination create: {reply!r}")
        return reply[1]

    cid13 = f"coord:rt13:{node.height()}"
    uri13 = new_coordination(cid13, ["deployer", "reporter1"])
    poll13, outcome13 = "poll:rt13", "outcome:rt13"
    good13 = coord_digest(cid13, poll13, outcome13)
    wrong13 = coord_digest(cid13, poll13, "outcome:forged")
    sigs13 = ("[" + coord_entry("deployer", good13) + ", "
              + coord_entry("reporter1", wrong13) + "]")
    record("RT-013", "forge a signer signature over a different outcome", "refuse",
           lambda: one(call_uri(
               uri13, "record",
               f'*dId, "rt13", {quoted(cid13)}, {quoted(poll13)}, '
               f'{quoted(outcome13)}, {sigs13}')))

    cid14 = f"coord:rt14:{node.height()}"
    uri14 = new_coordination(cid14, ["deployer", "reporter1"])
    poll14, outcome14 = "poll:rt14", "outcome:rt14"
    good14 = coord_digest(cid14, poll14, outcome14)
    sigs14 = ("[" + coord_entry("deployer", good14) + ", "
              + coord_entry("reporter3", good14) + "]")
    record("RT-014", "substitute a member outside the fixed signer set", "refuse",
           lambda: one(call_uri(
               uri14, "record",
               f'*dId, "rt14", {quoted(cid14)}, {quoted(poll14)}, '
               f'{quoted(outcome14)}, {sigs14}')))

    payload = {
        "node": node.NODE,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "pass": all(row["classification"] in {"fixed", "accepted", "not_run"}
                    for row in results),
        "results": results,
    }
    RESULTS.parent.mkdir(parents=True, exist_ok=True)
    RESULTS.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"redteam: wrote {RESULTS.relative_to(ROOT)}")
    return 0 if payload["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
