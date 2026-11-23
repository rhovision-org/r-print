# Authority and refusal

> **Status:** Implemented. The refusal suites and the admin-key suite pass.

Every public arm has one success shape and one refusal vocabulary. A refusal is not an
exception; it is a `(false, "reason")` reply after the state cell has been reposted
unchanged.

## Authority layers

| Layer | Who | Arms |
|---|---|---|
| Publication roster | active `publisher` | `addMember`, `removeMember`, `setRole`, `pause` |
| Publication admin | admin threshold | `setAdmins`, `setThreshold`, `setTreasury` |
| Editorial | active `editor`/`publisher` | commission accept/release, article approve/publish, edition append/seal |
| Author | first author's derived address | article submit, commission milestone submit |
| Funder | the address that funded the escrow | cancel, dispute |
| Platform admin | global threshold | global pause, platform arbitration fallback |
| Permissionless | anyone | `expire`, `resolveDispute` after the window |

A role does not widen a signature check. `authOwner` derives the caller's REV address from
the deployer id; a publisher cannot act as another member, and a writer cannot call an
editor arm by naming themselves.

## Reply shapes

- Success: `(true, Nil)`, `(true, uri)`, `(true, state)`, `(true, list)`,
  `(true, admins, threshold)`.
- Refusal: `(false, "reason")`.
- Resolver failure: `(false, "unavailable", key)`.

Every public arm replies exactly once. An unmatched `for` is a silent hang, not an error;
the suites assert refusal reasons and read the cell afterwards to prove it is still live.

## The refusal vocabulary

The full list is in [status vocabulary](../reference/status-vocabulary.md). The important
ones are `role`, `status`, `paused`, `duplicate`, `replay`, `below threshold`, `threshold`,
`not writer`, `not author`, `not member`, `last publisher`, `milestone`, `not submitted`,
`too early`, `too late`, `closed`, `kasset`, `signature`, `publication`.

## Why exact reasons

A vague refusal hides a bug. "It failed" cannot distinguish a wrong key from a wrong state.
The suites pin the exact string; a change to a refusal reason is a breaking change and must
update the suite. The same applies to the `opId` replay map: a repeated deploy returns the
stored reply, not a second mutation.
