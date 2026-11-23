/** Display helpers for hashes, heights and on-chain status strings. */

export function shortHash(value: string, keep = 10): string {
  if (value.length <= keep * 2 + 1) return value;
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

export function formatHeight(height: number): string {
  return height > 0 ? `#${height}` : "—";
}

export function roleLabel(role: string): string {
  switch (role) {
    case "factchecker":
      return "Fact-checker";
    case "publisher":
      return "Publisher";
    case "editor":
      return "Editor";
    case "writer":
      return "Writer";
    case "treasurer":
      return "Treasurer";
    case "contributor":
      return "Contributor";
    default:
      return role;
  }
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function formatFee(amount: number): string {
  return `${amount.toLocaleString()} minor units`;
}

export function replyReason(reply: { ok: false; reason: string }): string {
  return reply.reason;
}
