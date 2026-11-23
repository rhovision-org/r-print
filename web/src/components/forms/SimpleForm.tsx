import { useState, type FormEvent } from "react";
import { useApi } from "../../lib/api-context";
import { useSession } from "../../lib/session";
import { useSettings } from "../../lib/settings";
import { newOpId } from "../../lib/op";
import {
  CheckboxField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from "./fields";
import { FormPanel } from "./FormPanel";
import type { FieldSpec, FormSpec, FormValues } from "./specs";
import { useSubmit } from "./useSubmit";

function initialValues(spec: FormSpec, defaults?: FormValues): FormValues {
  const values: FormValues = { opId: newOpId(spec.method) };
  for (const field of spec.fields) {
    if ("default" in field && field.default !== undefined) {
      values[field.name] = field.default;
    } else if (field.kind === "number") {
      values[field.name] = 0;
    } else if (field.kind === "checkbox") {
      values[field.name] = false;
    } else {
      values[field.name] = "";
    }
  }
  return defaults ? { ...values, ...defaults } : values;
}

/** A typed form for a scalar-argument write. */
export function SimpleForm({
  spec,
  uri,
  onDone,
  defaults,
}: {
  spec: FormSpec;
  uri: string;
  onDone?: () => void;
  defaults?: FormValues;
}) {
  const api = useApi();
  const session = useSession();
  const { settings } = useSettings();
  const submit = useSubmit();
  const [values, setValues] = useState<FormValues>(() =>
    initialValues(spec, defaults),
  );

  const canWrite = settings.mode === "live" && session.unlocked;
  const note =
    settings.mode === "fixture"
      ? "Fixture mode: this form is typed; switch to live mode to submit."
      : !session.unlocked
        ? "Live mode: unlock a wallet on the Keystore page to submit."
        : undefined;

  function set(name: string, value: FormValues[string]) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reply = await submit.run(() =>
      spec.submit(values, { uri, api, session, settings }),
    );
    if (reply?.ok) onDone?.();
  }

  return (
    <FormPanel
      method={spec.method}
      title={spec.title}
      description={[spec.description, note].filter(Boolean).join(" ")}
      onSubmit={onSubmit}
      submitLabel={spec.submitLabel ?? "Submit"}
      busy={submit.busy}
      disabled={!canWrite}
      result={submit.result}
      error={submit.error}
    >
      <TextField
        label="Operation id (replay key)"
        name="opId"
        value={String(values.opId ?? "")}
        onChange={(value) => set("opId", value)}
        disabled={!canWrite}
      />
      {spec.fields.map((field) => (
        <Field
          key={field.name}
          field={field}
          value={values[field.name]}
          onChange={(value) => set(field.name, value)}
          disabled={!canWrite}
        />
      ))}
    </FormPanel>
  );
}

function Field({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldSpec;
  value: FormValues[string] | undefined;
  onChange: (value: FormValues[string]) => void;
  disabled: boolean;
}) {
  switch (field.kind) {
    case "text":
    case "password":
    case "url":
      return (
        <TextField
          label={field.label}
          name={field.name}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          placeholder={field.placeholder}
          disabled={disabled}
          type={field.kind}
        />
      );
    case "textarea":
      return (
        <TextAreaField
          label={field.label}
          name={field.name}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          placeholder={field.placeholder}
          disabled={disabled}
        />
      );
    case "number":
      return (
        <NumberField
          label={field.label}
          name={field.name}
          value={typeof value === "number" ? value : 0}
          onChange={onChange}
          min={field.min}
          max={field.max}
          disabled={disabled}
        />
      );
    case "checkbox":
      return (
        <CheckboxField
          label={field.label}
          name={field.name}
          checked={value === true}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "select":
      return (
        <SelectField
          label={field.label}
          name={field.name}
          value={typeof value === "string" ? value : field.default}
          options={field.options}
          onChange={onChange}
          disabled={disabled}
        />
      );
  }
}
