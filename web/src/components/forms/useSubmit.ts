import { useState } from "react";
import type { Reply } from "../../lib/types";

export interface SubmitState {
  busy: boolean;
  result: Reply<unknown> | null;
  error: string | null;
  run: (action: () => Promise<Reply<unknown>>) => Promise<Reply<unknown> | null>;
  reset: () => void;
}

/** Run one write and expose busy/result/error. The API throws for transport failures. */
export function useSubmit(): SubmitState {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Reply<unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<Reply<unknown>>) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const reply = await action();
      setResult(reply);
      return reply;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      return null;
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    result,
    error,
    run,
    reset: () => {
      setResult(null);
      setError(null);
    },
  };
}
