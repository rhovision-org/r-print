import { useEffect, useState } from "react";
import type { Reply } from "./types";

export interface AsyncState<T> {
  loading: boolean;
  reply?: Reply<T>;
  error?: string;
}

/** Run a fixture/live read once per key change and expose loading/reply/error. */
export function useAsync<T>(
  load: () => Promise<Reply<T>>,
  key: string,
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  useEffect(() => {
    let live = true;
    setState({ loading: true });
    load()
      .then((reply) => {
        if (live) setState({ loading: false, reply });
      })
      .catch((error: unknown) => {
        if (live) {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      live = false;
    };
    // The caller passes a stable key; the loader closes over the current URI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
