/** Operation ids and Rholang literal helpers for typed forms. */

/** A fresh op id. `opId` must be unique per caller for the contract's replay map. */
export function newOpId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${random}`;
}

/** A Rholang byte-array literal value, for `json_to_rho`. */
export function bytesValue(hex: string): { $bytes: string } {
  return { $bytes: hex.replace(/^0x/, "") };
}

/** A list of admin public keys as byte arrays. */
export function adminKeyList(keys: string[]): Array<{ $bytes: string }> {
  return keys.map(bytesValue);
}

/** Normalise a comma-, space- or newline-separated key list. */
export function splitKeys(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((key) => key.trim().replace(/^0x/, ""))
    .filter(Boolean);
}

/** A numeric field from a form, with a clear error instead of NaN. */
export function numberField(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number`);
  return parsed;
}
