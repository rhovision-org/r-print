import { useState, type FormEvent } from "react";
import { useApi } from "../../lib/api-context";
import { newOpId } from "../../lib/op";
import { useSession } from "../../lib/session";
import { useSettings } from "../../lib/settings";
import { useAsync } from "../../lib/useAsync";
import { FormPanel } from "./FormPanel";
import { useSubmit } from "./useSubmit";

/** Seal computes the manifest digest in WASM and submits the editor signature. */
export function SealEditionForm({
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
  const info = useAsync(() => api.editionInfo(uri), `${uri}:info`);
  const [opId] = useState(() => newOpId("sealEdition"));
  const [signature, setSignature] = useState<{
    manifestHash: string;
    signature: string;
  } | null>(null);

  const canWrite = settings.mode === "live" && session.unlocked;
  const note =
    settings.mode === "fixture"
      ? "Fixture mode: this form is typed; switch to live mode to submit."
      : !session.unlocked
        ? "Live mode: unlock a wallet on the Keystore page to submit."
        : "The connected key must be a live editor or publisher of this publication.";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session.bridge) return;
    const fresh = await api.editionInfo(uri);
    if (!fresh.ok) {
      await submit.run(() => Promise.resolve(fresh));
      return;
    }
    const edition = fresh.value;
    let signed: { manifestHash: string; signature: string };
    try {
      signed = session.bridge.signEditionManifest({
        editionId: edition.editionId,
        publicationId: edition.publicationId,
        number: edition.number,
        titleHash: edition.titleHash,
        coverHash: edition.coverHash,
        articleHashes: edition.articles.map((entry) => entry.contentHash),
      });
    } catch (error) {
      await submit.run(() =>
        Promise.reject(error instanceof Error ? error : new Error(String(error))),
      );
      return;
    }
    setSignature(signed);
    const reply = await submit.run(() =>
      api.sealEdition(uri, { opId, editorSig: signed.signature }),
    );
    if (reply?.ok) {
      info.reload();
      onDone?.();
    }
  }

  return (
    <FormPanel
      method="sealEdition"
      title="Seal the edition"
      description={`Edition("seal") signs the ordered manifest. ${note}`}
      onSubmit={onSubmit}
      submitLabel="Sign and seal"
      busy={submit.busy}
      disabled={!canWrite || !info.reply?.ok}
      result={submit.result}
      error={submit.error ?? info.error ?? null}
      footer={
        signature ? (
          <dl>
            <dt>Manifest hash</dt>
            <dd>
              <code>{signature.manifestHash}</code>
            </dd>
            <dt>Signature</dt>
            <dd>
              <code>{signature.signature}</code>
            </dd>
          </dl>
        ) : null
      }
    >
      {info.reply?.ok ? (
        <dl>
          <dt>Edition</dt>
          <dd>{info.reply.value.editionId}</dd>
          <dt>Status</dt>
          <dd>{info.reply.value.status}</dd>
          <dt>Articles in order</dt>
          <dd>{info.reply.value.articles.length}</dd>
        </dl>
      ) : (
        <p className="muted">Loading the edition manifest…</p>
      )}
    </FormPanel>
  );
}
