import type { FormEvent, ReactNode } from "react";
import type { Reply } from "../../lib/types";
import { FormError, ReplyView } from "./fields";

/** A typed write form: fields, submit, busy/error and the chain reply. */
export function FormPanel({
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Submit",
  busy = false,
  disabled = false,
  result = null,
  error = null,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  result?: Reply<unknown> | null;
  error?: string | null;
  footer?: ReactNode;
}) {
  return (
    <section className="panel form-panel">
      <h2>{title}</h2>
      {description ? <p className="muted">{description}</p> : null}
      <form onSubmit={onSubmit}>
        <div className="fields">{children}</div>
        <button type="submit" disabled={busy || disabled}>
          {busy ? "Submitting…" : submitLabel}
        </button>
      </form>
      <FormError error={error} />
      <ReplyView result={result} />
      {footer}
    </section>
  );
}
