import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useApi } from "../../lib/api-context";
import { adminKeyList, splitKeys } from "../../lib/op";
import { useSession } from "../../lib/session";
import { useSettings } from "../../lib/settings";
import { useAsync } from "../../lib/useAsync";
import type { AdminInput } from "../../lib/types";
import { KeyListField, NumberField, SelectField, TextField } from "./fields";
import { FormPanel } from "./FormPanel";
import { MultisigPanel, type SignatureEntry } from "./MultisigPanel";
import { useSubmit } from "./useSubmit";

export function PublicationAdminForm({
  uri,
  onDone,
}: {
  uri: string;
  onDone?: () => void;
}) {
  const api = useApi();
  const session = useSession();
  const { settings } = useSettings();
  const submit = useSubmit();
  const info = useAsync(() => api.publicationInfo(uri), `${uri}:info`);
  const [nonce, setNonce] = useState(0);
  const [action, setAction] = useState<AdminInput["action"]>("pause");
  const [membersText, setMembersText] = useState("");
  const [newThreshold, setNewThreshold] = useState(1);
  const [treasury, setTreasury] = useState("");
  const [signatures, setSignatures] = useState<SignatureEntry[]>([]);

  useEffect(() => {
    if (info.reply?.ok && nonce === 0) setNonce(info.reply.value.nonce + 1);
  }, [info.reply, nonce]);

  const publication = info.reply?.ok ? info.reply.value : null;
  const authority = publication
    ? {
        kind: "publication" as const,
        keys: publication.admins,
        threshold: publication.threshold,
      }
    : { kind: "publication" as const, keys: [], threshold: 1 };

  const argsValue = useMemo(() => {
    switch (action) {
      case "pause":
      case "resume":
        return [];
      case "setAdmins":
        return [adminKeyList(splitKeys(membersText)), newThreshold];
      case "setThreshold":
        return [newThreshold];
      case "setTreasury":
        return [treasury];
    }
  }, [action, membersText, newThreshold, treasury]);

  const payloadKey = JSON.stringify({ nonce, action, args: argsValue });
  useEffect(() => {
    setSignatures([]);
  }, [payloadKey]);

  const canWrite = settings.mode === "live" && session.unlocked && Boolean(publication);
  const note =
    settings.mode === "fixture"
      ? "Fixture mode: this form is typed; switch to live mode to submit."
      : !session.unlocked
        ? "Live mode: unlock a wallet on the Keystore page to submit."
        : "The nonce must be greater than the stored nonce; signatures are over the deployed Codec payload.";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reply = await submit.run(() =>
      api.publicationAdmin(uri, {
        nonce,
        action,
        args: argsValue,
        sigs: signatures.map((entry) => entry.signature),
      }),
    );
    if (reply?.ok) {
      info.reload();
      setSignatures([]);
      onDone?.();
    }
  }

  return (
    <FormPanel
      method="publicationAdmin"
      title="Publication admin (multisig)"
      description={`Publication("admin"). ${note}`}
      onSubmit={onSubmit}
      submitLabel="Submit admin action"
      busy={submit.busy}
      disabled={!canWrite}
      result={submit.result}
      error={submit.error ?? info.error ?? null}
    >
      {publication ? (
        <>
          <p className="muted">
            Publication <code>{publication.publicationId}</code> · stored nonce{" "}
            {publication.nonce} · {publication.admins.length} admin key(s), threshold{" "}
            {publication.threshold}
          </p>
          <NumberField
            label="Nonce (must be above the stored nonce)"
            name="adminNonce"
            value={nonce}
            onChange={setNonce}
            min={1}
            disabled={!canWrite}
          />
          <SelectField
            label="Action"
            name="adminAction"
            value={action}
            onChange={setAction}
            options={[
              { value: "pause", label: "pause" },
              { value: "resume", label: "resume" },
              { value: "setAdmins", label: "setAdmins" },
              { value: "setThreshold", label: "setThreshold" },
              { value: "setTreasury", label: "setTreasury" },
            ]}
            disabled={!canWrite}
          />
          {action === "setAdmins" ? (
            <>
              <KeyListField
                label="New admin public keys"
                name="newAdmins"
                value={membersText}
                onChange={setMembersText}
                disabled={!canWrite}
              />
              <NumberField
                label="New threshold"
                name="newAdminThreshold"
                value={newThreshold}
                onChange={setNewThreshold}
                min={1}
                max={5}
                disabled={!canWrite}
              />
            </>
          ) : null}
          {action === "setThreshold" ? (
            <NumberField
              label="New threshold"
              name="newThreshold"
              value={newThreshold}
              onChange={setNewThreshold}
              min={1}
              max={5}
              disabled={!canWrite}
            />
          ) : null}
          {action === "setTreasury" ? (
            <TextField
              label="New treasury account"
              name="treasury"
              value={treasury}
              onChange={setTreasury}
              disabled={!canWrite}
            />
          ) : null}
          {canWrite ? (
            <MultisigPanel
              api={api}
              session={session}
              domain={`publication:${publication.publicationId}`}
              nonce={nonce}
              action={action}
              args={argsValue}
              authority={authority}
              onSignatures={setSignatures}
              resetKey={payloadKey}
            />
          ) : null}
        </>
      ) : (
        <p className="muted">Loading the publication state…</p>
      )}
    </FormPanel>
  );
}
