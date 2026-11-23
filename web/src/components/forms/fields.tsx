import type { ChangeEvent, ReactNode } from "react";
import type { Reply } from "../../lib/types";

export function TextField({
  label,
  name,
  value,
  onChange,
  placeholder,
  disabled,
  required = false,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  type?: "text" | "password" | "url";
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
    </label>
  );
}

export function NumberField({
  label,
  name,
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(Number(event.target.value))
        }
      />
    </label>
  );
}

export function CheckboxField({
  label,
  name,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  name: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field checkbox">
      <input
        name={name}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  name: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        name={name}
        value={value}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(event.target.value as T)
        }
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextAreaField({
  label,
  name,
  value,
  onChange,
  rows = 3,
  placeholder,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        name={name}
        value={value}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(event.target.value)
        }
      />
    </label>
  );
}

export function KeyListField({
  label,
  name,
  value,
  onChange,
  disabled,
  placeholder = "04ab…, 04cd…",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <TextField
      label={label}
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}

export function Repeater({
  label,
  rows,
  onAdd,
  onRemove,
  addLabel = "Add row",
  children,
}: {
  label: string;
  rows: number[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  addLabel?: string;
  children: (index: number) => ReactNode;
}) {
  return (
    <fieldset className="repeater">
      <legend>{label}</legend>
      {rows.map((row) => (
        <div className="repeater-row" key={row}>
          {children(row)}
          <button type="button" className="secondary" onClick={() => onRemove(row)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={onAdd}>
        {addLabel}
      </button>
    </fieldset>
  );
}

export function ReplyView({ result }: { result: Reply<unknown> | null }) {
  if (!result) return null;
  return (
    <pre className={result.ok ? "reply ok" : "reply refused"}>
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

export function FormError({ error }: { error: string | null }) {
  return error ? <p className="error">{error}</p> : null;
}
