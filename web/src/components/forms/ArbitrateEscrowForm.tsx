import { useEffect, useState, type FormEvent } from "react";
import { useApi } from "../../lib/api-context";
import { newOpId } from "../../lib/op";
import { useSession } from "../../lib/session";
import { useSettings } from "../../lib/settings";
import { useAsync } from "../../lib/useAsync";
import type { ArbitrationAuthority } from "../../lib/types";
import { NumberField } from "./fields";
import { FormPanel } from "./FormPanel";
import { MultisigPanel, type SignatureEntry } from "./MultisigPanel";
import { useSubmit } from "./useSubmit";

const EMPTY_AUTHORITY: ArbitrationAuthority = {
  kind: "publication",
  keys: [],
  threshold: 1,
};

export function ArbitrateEscrowForm({
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
  const info = useAsync(() => api.escrowInfo(uri), `${uri}:info`);
  const publicationUri = info.reply?.ok ? info.reply.value.publicationUri : "";
  const authorityReply = useAsync(
    () =>
      publicationUri
        ? api.publicationArbitration(publicationUri)
        : Promise.resolve({ ok: false as const, reason: "loading escrow" }),
    `${publicationUri}:arbitration`,
  );
  const [nonce, setNonce] = useState(0);
  const [writerBps, setWriterBps] = useState(5000);
  const [opId] = useState(() => newOpId("arbitrateEscrow"));
  const [signatures, setSignatures] = useState<SignatureEntry[]>([]);

  useEffect(() => {
    if (info.reply?.ok && nonce === 0) setNonce(info.reply.value.nonce + 1);
  }, [info.reply, nonce]);

  const escrow = info.reply?.ok ? info.reply.value : null;
  const authority = authorityReply.reply?.ok
    ? authorityReply.reply.value
    : EMPTY_AUTHORITY;
  const payloadKey = JSON.stringify({ nonce, writerBps });
  useEffect(() => {
    setSignatures([]);
  }, [payloadKey]);

  const canWrite = settings.mode === "live" && session.unlocked && Boolean(escrow);
  const note =
    settings.mode === "fixture"
      ? "Fixture mode: this form is typed; switch to live mode to submit."
      : !session.unlocked
        ? "Live mode: unlock a wallet on the Keystore page to submit."
        : "The effective authority is the publication's arbitrators, its admins when ≥2 keys, or the platform PrintAdmin fallback.";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reply = await submit.run(() =>
      api.arbitrateEscrow(uri, {
        nonce,
        writerBps,
        sigs: signatures.map((entry) => entry.signature),
        opId,
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
      title="Arbitrate the dispute"
      description={`CommissionEscrow("arbitrate"). ${note}`}
      onSubmit={onSubmit}
      submitLabel="Submit split"
      busy={submit.busy}
      disabled={!canWrite}
      result={submit.result}
      error={submit.error ?? info.error ?? authorityReply.error ?? null}
    >
      {escrow ? (
        <>
          <p className="muted">
            Escrow <code>{escrow.escrowId}</code> · status {escrow.status} · stored nonce{" "}
            {escrow.nonce} · authority {authority.kind} ({authority.threshold} of{" "}
            {authority.keys.length})
          </p>
          <NumberField
            label="Nonce (must be above the stored nonce)"
            name="arbitrateNonce"
            value={nonce}
            onChange={setNonce}
            min={1}
            disabled={!canWrite}
          />
          <NumberField
            label="Writer share (basis points of the remaining balance)"
            name="writerBps"
            value={writerBps}
            onChange={setWriterBps}
            min={0}
            max={10000}
            disabled={!canWrite}
          />
          {canWrite ? (
            <MultisigPanel
              api={api}
              session={session}
              domain={`commission:${escrow.escrowId}`}
              nonce={nonce}
              action="split"
              args={[escrow.escrowId, writerBps]}
              authority={authority}
              onSignatures={setSignatures}
              resetKey={payloadKey}
            />
          ) : null}
        </>
      ) : (
        <p className="muted">Loading the escrow state…</p>
      )}
    </FormPanel>
  );
}
