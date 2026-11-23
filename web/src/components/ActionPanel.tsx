import { useState } from "react";
import type { RprintApi } from "../lib/api";
import { useApi } from "../lib/api-context";
import { NotImplementedError } from "../lib/stub-api";

export interface ActionDefinition {
  label: string;
  method: string;
  description: string;
  run: (api: RprintApi) => Promise<unknown>;
}

/**
 * Renders a write surface without pretending it works. Every action calls the stub API and
 * shows the documented NotImplementedError; a later implementation swaps in a live API.
 */
export function ActionPanel({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: ActionDefinition[];
}) {
  const api = useApi();
  const [message, setMessage] = useState<string | null>(null);

  async function invoke(action: ActionDefinition) {
    try {
      await action.run(api);
      setMessage(`${action.label}: submitted (unexpected in the sketch)`);
    } catch (error) {
      if (error instanceof NotImplementedError) {
        setMessage(`Not implemented in v0.1: ${error.method}`);
      } else {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    }
  }

  return (
    <section className="panel action-panel">
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="actions">
        {actions.map((action) => (
          <button key={action.method} type="button" onClick={() => invoke(action)}>
            <span>{action.label}</span>
            <small>{action.method}</small>
          </button>
        ))}
      </div>
      {message ? <p className="action-message">{message}</p> : null}
    </section>
  );
}
