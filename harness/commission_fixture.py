#!/usr/bin/env python3
"""Build, propose, accept and fund commissions for the escrow suites."""

from __future__ import annotations

import actors
import corpus
from assertions import one
from helpers import block_height, call_uri, resolve_component
from publication_fixture import create_publication, quoted

import deploy as node


def rsure_enabled() -> bool:
    """True when the installed r-print root has a real r-sure adapter."""
    health = one(call_uri(resolve_component("component:rsure-adapter"), "health"))
    return isinstance(health, tuple) and bool(health) and health[0] is True


def commission_data(publication: dict, writer: str, total: int = 1000,
                    milestones: list[tuple[str, int, int]] | None = None,
                    grace: int = 10, dispute_window: int = 10) -> str:
    if milestones is None:
        now = block_height()
        milestones = [("m1", 400, now + 100), ("m2", 600, now + 200)]
    ms = ", ".join(
        '{"id": ' + quoted(mid) + ', "kind": "stipend", "amount": ' + str(amount)
        + ', "deadlineHeight": ' + str(deadline) + "}"
        for mid, amount, deadline in milestones)
    return (
        '{"publicationId": ' + quoted(publication["publication_id"])
        + ', "publicationUri": ' + quoted(publication["uri"])
        + ', "writerDid": ' + quoted(f"did:byoid:{writer}")
        + ', "titleHash": "title:fixture", "briefHash": "brief:fixture"'
        + ', "total": ' + str(total)
        + ', "milestones": [' + ms + ']'
        + ', "graceBlocks": ' + str(grace)
        + ', "disputeWindowBlocks": ' + str(dispute_window)
        + ', "requireFactCheck": false, "fundingSource": "funder"}'
    )


def editor_publication(label: str = "commission") -> dict:
    return create_publication(
        label,
        publisher="deployer",
        members=[("deployer", "publisher"), ("reporter1", "editor"),
                 ("reporter2", "factchecker")],
        admins=["deployer"], threshold=1)


def propose(publication: dict, writer: str = "reporter3", total: int = 1000,
            milestones: list[tuple[str, int, int]] | None = None,
            grace: int = 10, dispute_window: int = 10,
            proposal_id: str | None = None, case: str | None = None) -> dict:
    actors.ensure_vault(writer)
    factory = resolve_component("component:commission-factory")
    pid = proposal_id or f"proposal:{block_height()}:{writer}"
    data = commission_data(publication, writer, total, milestones, grace, dispute_window)
    reply = one(call_uri(
        factory, "propose",
        f'*dId, {quoted("propose:" + pid)}, {quoted(pid)}, {data}'),
        key=writer)
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"propose {pid}: {reply!r}")
    if case:
        corpus.assert_row(case, reply)
    return {"proposal_id": pid, "uri": reply[1], "publication": publication,
            "writer": writer, "total": total}


def accept(proposal: dict, editor: str = "reporter1",
           case: str | None = None) -> None:
    actors.ensure_vault(editor)
    reply = one(call_uri(proposal["uri"], "accept",
                         f'*dId, {quoted("accept:" + proposal["proposal_id"])}'),
                key=editor)
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"accept {proposal['proposal_id']}: {reply!r}")
    if case:
        corpus.assert_row(case, reply)


def fund(proposal: dict, funder: str = "deployer", amount: int | None = None,
         case: str | None = None) -> dict:
    amount = amount or proposal["total"]
    actors.ensure_vault(funder)
    actors.ensure_account(funder)
    actors.fund(funder, max(amount * 2, 2000))
    actors.ensure_account(proposal["writer"])
    reply = one(call_uri(proposal["uri"], "fund",
                         f'*dId, {quoted("fund:" + proposal["proposal_id"])}'),
                key=funder)
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"fund {proposal['proposal_id']}: {reply!r}")
    if case:
        corpus.assert_row(case, reply)
    return {"proposal": proposal, "escrow_uri": reply[1], "funder": funder}


def submit(escrow: dict, milestone: str, evidence: str = "evidence",
           writer: str | None = None) -> None:
    key = writer or escrow["proposal"]["writer"]
    reply = one(call_uri(escrow["escrow_uri"], "submit",
                         f'*dId, {quoted("submit:" + milestone + ":" + evidence)}, '
                         f'{quoted(milestone)}, {quoted(evidence)}'),
                key=key)
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"submit {milestone}: {reply!r}")


def release(escrow: dict, milestone: str, editor: str = "reporter1") -> None:
    reply = one(call_uri(escrow["escrow_uri"], "release",
                         f'*dId, {quoted("release:" + milestone)}, {quoted(milestone)}'),
                key=editor)
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"release {milestone}: {reply!r}")


def cancel(escrow: dict, actor: str = "deployer", case: str | None = None) -> None:
    reply = one(call_uri(escrow["escrow_uri"], "cancel",
                         f'*dId, {quoted("cancel:" + escrow["proposal"]["proposal_id"])}, "reason"'),
                key=actor)
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"cancel: {reply!r}")
    if case:
        corpus.assert_row(case, reply)


def dispute(escrow: dict, actor: str | None = None) -> None:
    key = actor or escrow["proposal"]["writer"]
    reply = one(call_uri(escrow["escrow_uri"], "dispute",
                         f'*dId, {quoted("dispute:" + escrow["proposal"]["proposal_id"])}, "reason"'),
                key=key)
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"dispute: {reply!r}")


def expire(escrow: dict, case: str | None = None) -> None:
    reply = one(call_uri(escrow["escrow_uri"], "expire", '"expire-op"'))
    if not (isinstance(reply, tuple) and reply and reply[0] is True):
        raise AssertionError(f"expire: {reply!r}")
    if case:
        corpus.assert_row(case, reply)
