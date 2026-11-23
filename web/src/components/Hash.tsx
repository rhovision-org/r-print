import { shortHash } from "../lib/format";

export function Hash({ value, label }: { value: string; label?: string }) {
  if (!value) return <span className="muted">—</span>;
  return (
    <code title={value} className="hash">
      {label ? `${label}: ` : ""}
      {shortHash(value)}
    </code>
  );
}
