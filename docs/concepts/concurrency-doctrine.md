# Concurrency doctrine

> **Status:** Implemented. `spec-check` enforces no `select`, no forbidden captures, integer
> money and bounded terms.

r-print follows the r-* cell doctrine: one state cell per object, one writer, consume and
repost exactly once. The rules are not stylistic; they are what makes a refusal and a
double-spend inspectable.

## Rules

1. **One consumable cell per entity.** A mutating arm takes the cell, validates, reposts
   once and replies. A refusal reposts unchanged. Never leave a taken cell unreposted.
2. **No `select`.** The node desugars `select` into parallel receives; it is not committed
   choice. `make check-select` fails the build.
3. **Peeks are hints.** A peek can tell you what was true; it cannot reserve anything. Never
   carry a peek across an external await into a write.
4. **A deploy is atomic, blocks are sequential.** A multi-step arm is not one comm event.
   Every consumed record is reposted before the arm replies.
5. **After value moves, fail.** Return `(false, reason)` only before a withdrawal or
   deposit. Afterwards an unexpected branch calls `1/0` so the deploy rolls back.
6. **No timers.** Deadlines are block heights. `expire` and `resolveDispute` are lazy and
   permissionless.
7. **Capabilities are resolved per arm.** Use `lib/Resolve.rho`; never capture a resolved
   capability in a bundle or a state map.
8. **No global mutable cache.** A publication cell is not a cache for articles or
   commissions. Child cells are independent.

## The commission example

The escrow takes `commissionEscrowState`, finds the milestone, checks status and ordering,
moves value from the purse, then reposts the state and replies. Two concurrent releases of
the same milestone cannot both succeed: the first consumes the cell, the second waits and
then sees `released`. If the payment branch fails after the withdrawal, `1/0` rolls the
deploy back; the cell is left as it was.

## The publication example

Roster writes consume `publicationState`, check the caller's derived address and role, then
repost once. `opId` replay keys make a repeated deploy return the stored reply instead of
adding a second member. The last-publisher rule is checked against the active roster in the
same take.

## Platform limits

The deploy term cap is 64 KiB inclusive; the hard budget is 56 KiB. Parser depth is 128
and the project budget is 96. A term that grows past the per-file budget must split, as
`10_publication.rho` and `11_publication_cell.rho` do.
