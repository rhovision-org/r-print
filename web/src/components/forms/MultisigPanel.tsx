import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LiveApi } from "../../lib/live-api";
import { createKeystoreStore, type StoredKeystore } from "../../lib/keystore-store";
import type { RprintApi } from "../../lib/api";
import type { SessionContextValue } from "../../lib/session";
import type { ArbitrationAuthority, Reply } from "../../lib/types";
import { TextField } from "./fields";

export interface SignatureEntry {
  publicKey: string;
  signature: string;
}

/**
 * Collect m-of-n signatures over the deployed Codec payload.
 *
 * One keystore is unlocked at a time in a temporary WASM wallet; the secret is dropped as
 * soon as the signature is produced. The parent submits only the signatures.
 */
export function MultisigPanel({
  api,
  session,
  domain,
  nonce,
  action,
  args,
  authority,
  onSignatures,
  resetKey,
}: {
  api: RprintApi;
  session: SessionContextValue;
  domain: string;
  nonce: number;
  action: string;
  args: unknown;
  authority: ArbitrationAuthority;
  onSignatures: (signatures: SignatureEntry[]) => void;
  resetKey?: string;
}) {
  const [payload, setPayload] = useState<string | null>(null);
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [keystores, setKeystores] = useState<StoredKeystore[]>([]);
  const [selected, setSelected] = useState("");
  const [password, setPassword] = useState("");
  const [signatures, setSignatures] = useState<SignatureEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createKeystoreStore()
      .list()
      .then((records) => setKeystores(records))
      .catch(() => setKeystores([]));
  }, []);

  useEffect(() => {
    setSignatures([]);
    setPayload(null);
    onSignatures([]);
    // The parent supplies a stable reset key for the payload inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  async function prepare() {
    setPayloadError(null);
    setBusy(true);
    try {
      if (!(api instanceof LiveApi)) {
        throw new Error("live mode is required to fetch the canonical payload");
      }
      const reply: Reply<{ payload: string }> = await api.payloadFor(
        domain,
        nonce,
        action,
        args,
      );
      if (!reply.ok) throw new Error(reply.reason);
      setPayload(reply.value.payload);
    } catch (failure) {
      setPayloadError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    setError(null);
    if (!payload) {
      setError("prepare the payload first");
      return;
    }
    if (!session.bridge) {
      setError("live mode is not enabled");
      return;
    }
    const record = keystores.find((item) => item.id === selected);
    if (!record) {
      setError("choose a saved keystore");
      return;
    }
    setBusy(true);
    try {
      const signed = session.bridge.signWithKeystore(
        record.document,
        password,
        payload,
      );
      const key = signed.publicKey.toLowerCase();
      if (signatures.some((entry) => entry.publicKey.toLowerCase() === key)) {
        throw new Error("this key has already signed");
      }
      if (!authority.keys.some((candidate) => candidate.toLowerCase() === key)) {
        throw new Error("this key is not in the effective authority set");
      }
      const next = [...signatures, signed];
      setSignatures(next);
      onSignatures(next);
      setPassword("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="multisig">
      <legend>
        Multisig {signatures.length}/{authority.threshold} ({authority.kind})
      </legend>
      <p className="muted">
        Payload text comes from the deployed <code>Codec</code>. Each signer unlocks once;
        the temporary wallet is dropped immediately.
      </p>
      <button type="button" className="secondary" onClick={prepare} disabled={busy}>
        {payload ? "Refresh payload" : "Prepare payload"}
      </button>
      {payloadError ? <p className="error">{payloadError}</p> : null}
      {payload ? (
        <pre className="payload">
          <code>{payload}</code>
        </pre>
      ) : null}

      {keystores.length === 0 ? (
        <p className="muted">
          No saved keystores. <Link to="/keystore">Create or import one</Link>.
        </p>
      ) : (
        <>
          <label className="field">
            <span>Signer keystore</span>
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">Choose…</option>
              {keystores.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.label || record.address}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Keystore password"
            name="multisig-password"
            type="password"
            value={password}
            onChange={setPassword}
          />
          <button type="button" onClick={sign} disabled={busy || !payload}>
            Sign payload
          </button>
        </>
      )}
      {error ? <p className="error">{error}</p> : null}
      {signatures.length > 0 ? (
        <ul className="signatures">
          {signatures.map((entry) => (
            <li key={entry.publicKey}>
              <code>{entry.publicKey.slice(0, 18)}…</code>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  const next = signatures.filter(
                    (item) => item.publicKey !== entry.publicKey,
                  );
                  setSignatures(next);
                  onSignatures(next);
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}
