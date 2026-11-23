import type { ApiMethod } from "../lib/api";
import { surfaceFor } from "../lib/surface";

export function SurfaceChecklist({ title, methods }: { title: string; methods: ApiMethod[] }) {
  const entries = methods.map((method) => surfaceFor(method)).filter((entry) => entry !== undefined);
  if (entries.length === 0) return null;
  return (
    <section className="panel">
      <h2>{title}</h2>
      <ul className="checklist">
        {entries.map((entry) => (
          <li key={entry.method}>
            <code>{entry.method}</code>
            <span>{entry.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
