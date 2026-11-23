import type { ReactNode } from "react";
import type { AsyncState } from "../lib/useAsync";
import type { Reply } from "../lib/types";

export function AsyncBlock<T>({
  state,
  children,
}: {
  state: AsyncState<T>;
  children: (value: T) => ReactNode;
}) {
  if (state.loading) return <p className="muted">Loading…</p>;
  if (state.error) return <p className="error">{state.error}</p>;
  if (!state.reply) return <p className="error">No reply.</p>;
  if (!state.reply.ok) {
    const reply = state.reply as Extract<Reply<T>, { ok: false }>;
    return <p className="error">Refused: {reply.reason}</p>;
  }
  return <>{children(state.reply.value)}</>;
}
