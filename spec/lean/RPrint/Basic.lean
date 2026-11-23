/-!
# Basic quantities

All amounts are integer minor units. Heights are block numbers. The contracts
use `Nat` where a guard supplies non-negativity.

The model is deliberately shallow: it does not formalise Rholang syntax, ERTP,
phlo, cryptography or the node scheduler. The flow manifest in `spec/flows`
ties each arm to a declaration here; that is traceability, not a refinement
proof.
-/

namespace RPrint

abbrev Amount := Nat
abbrev Height := Nat
abbrev Id := Nat
abbrev Bps : Nat := 10000

/-- Truncating division, the node's `/` on naturals. -/
def floorDiv (n d : Nat) : Nat := n / d

/-- Division rounded up. `ceilDiv n 0` is `0` by Lean's convention and is never
reached: every caller guards `d > 0`. -/
def ceilDiv (n d : Nat) : Nat := (n + d - 1) / d

def minNat (a b : Nat) : Nat := if a ≤ b then a else b
def maxNat (a b : Nat) : Nat := if a ≤ b then b else a

/-- A basis-point share, truncated. The escrow guards `bps ≤ Bps`. -/
def shareOf (n bps : Nat) : Nat := n * bps / Bps

/-- The part of `n` not paid by `shareOf n bps`, given `bps ≤ Bps`. -/
def remainderOf (n bps : Nat) : Nat := n - shareOf n bps

/-- A basis-point share never exceeds the whole when `bps ≤ 10000`. -/
theorem shareOf_le {n bps : Nat} (h : bps ≤ Bps) : shareOf n bps ≤ n := by
  unfold shareOf
  have h1 : n * bps ≤ Bps * n := by
    calc n * bps ≤ n * Bps := Nat.mul_le_mul_left n h
      _ = Bps * n := Nat.mul_comm n Bps
  exact Nat.div_le_of_le_mul h1

/-- The share and the remainder partition the whole. -/
theorem shareOf_add_remainder {n bps : Nat} (h : bps ≤ Bps) :
    shareOf n bps + remainderOf n bps = n := by
  unfold remainderOf
  exact Nat.add_sub_of_le (shareOf_le h)

end RPrint
