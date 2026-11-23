import { useEffect, useState, type FormEvent } from "react";
import { SurfaceChecklist } from "../components/SurfaceChecklist";
import { TextAreaField, TextField } from "../components/forms/fields";
import {
  createKeystoreStore,
  type KeystoreStore,
  type StoredKeystore,
} from "../lib/keystore-store";
import { useSession } from "../lib/session";
import { useSettings } from "../lib/settings";

export function Keystore() {
  const session = useSession();
  const { settings } = useSettings();
  const [store] = useState<KeystoreStore>(() => createKeystoreStore());
  const [saved, setSaved] = useState<StoredKeystore[]>([]);
  const [label, setLabel] = useState("devnet");
  const [password, setPassword] = useState("");
  const [importDocument, setImportDocument] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [exportPassword, setExportPassword] = useState("");
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);

  const live = settings.mode === "live";

  async function refresh() {
    setSaved(await store.list());
  }

  useEffect(() => {
    refresh().catch(() => setSaved([]));
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const info = await session.create(password);
      if (!info.document) throw new Error("wasm did not return a keystore document");
      await store.save({
        label: label || info.address,
        address: info.address,
        publicKey: info.publicKey,
        document: info.document,
      });
      await refresh();
      setPassword("");
      setMessage(`Created ${info.address}. The key is unlocked for this session.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }

  async function unlockSaved(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const record = saved.find((item) => item.id === selected);
    if (!record) {
      setError("choose a saved keystore");
      return;
    }
    try {
      const info = await session.unlock(record.document, password);
      setPassword("");
      setMessage(`Unlocked ${info.address}.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }

  async function importKeystore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const info = await session.unlock(importDocument, importPassword);
      await store.save({
        label: label || info.address,
        address: info.address,
        publicKey: info.publicKey,
        document: importDocument,
      });
      await refresh();
      setImportDocument("");
      setImportPassword("");
      setMessage(`Imported and unlocked ${info.address}.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }

  async function remove(id: string) {
    await store.remove(id);
    await refresh();
  }

  function exportCurrent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setExported(null);
    try {
      if (!session.bridge) throw new Error("live mode is not enabled");
      setExported(session.bridge.exportKeystore(exportPassword));
      setExportPassword("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }

  return (
    <div>
      <h1>Keystore</h1>
      <p className="muted">
        The key is created, decrypted and used only inside <code>rprint-wasm</code>. The
        browser receives an encrypted Web3 v3 document and stores that. There is no plaintext
        secret in React state, storage or the network.
      </p>
      {!live ? (
        <p className="muted">
          Fixture mode. Switch to live in Network settings to create or unlock a wallet.
        </p>
      ) : null}
      {message ? (
        <p className="ok-text" data-testid="keystore-message">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="error" data-testid="keystore-error">
          {error}
        </p>
      ) : null}

      <section className="grid">
        <form
          className="panel"
          data-testid="form-keystoreCreate"
          data-method="keystoreCreate"
          onSubmit={create}
        >
          <h2>Create a wallet</h2>
          <div className="fields">
            <TextField label="Label" name="label" value={label} onChange={setLabel} />
            <TextField
              label="Password"
              name="createPassword"
              type="password"
              value={password}
              onChange={setPassword}
            />
            <button type="submit" disabled={!live || !password}>
              Create
            </button>
          </div>
        </form>

        <form
          className="panel"
          data-testid="form-keystoreUnlock"
          data-method="keystoreUnlock"
          onSubmit={unlockSaved}
        >
          <h2>Unlock a saved keystore</h2>
          <div className="fields">
            <label className="field">
              <span>Keystore</span>
              <select value={selected} onChange={(event) => setSelected(event.target.value)}>
                <option value="">Choose…</option>
                {saved.map((record) => (
                  <option
                    key={record.id}
                    value={record.id}
                    data-testid="keystore-option"
                    data-address={record.address}
                  >
                    {record.label} · {record.address.slice(0, 10)}…
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="Password"
              name="unlockPassword"
              type="password"
              value={password}
              onChange={setPassword}
            />
            <button type="submit" disabled={!live || !selected || !password}>
              Unlock
            </button>
          </div>
        </form>
      </section>

      <form
        className="panel"
        data-testid="form-importKeystore"
        data-method="importKeystore"
        onSubmit={importKeystore}
      >
        <h2>Import an encrypted document</h2>
        <div className="fields">
          <TextAreaField
            label="Web3 v3 keystore JSON"
            name="importDocument"
            value={importDocument}
            onChange={setImportDocument}
            rows={5}
          />
          <TextField
            label="Password"
            name="importPassword"
            type="password"
            value={importPassword}
            onChange={setImportPassword}
          />
          <button type="submit" disabled={!live || !importDocument || !importPassword}>
            Import and unlock
          </button>
        </div>
      </form>

      <section className="panel">
        <h2>Session</h2>
        <dl>
          <dt>Status</dt>
          <dd data-testid="session-status">
            {session.unlocked ? "unlocked" : "locked"}
          </dd>
          <dt>REV address</dt>
          <dd>
            <code data-testid="session-address">{session.address ?? "—"}</code>
          </dd>
          <dt>Public key</dt>
          <dd>
            <code data-testid="session-public-key">{session.publicKey ?? "—"}</code>
          </dd>
        </dl>
        <div className="actions">
          <button type="button" onClick={session.lock} disabled={!session.unlocked}>
            Lock
          </button>
        </div>
      </section>

      {session.unlocked ? (
        <form
          className="panel"
          data-testid="form-exportKeystore"
          data-method="exportKeystore"
          onSubmit={exportCurrent}
        >
          <h2>Export the encrypted document</h2>
          <div className="fields">
            <TextField
              label="Password"
              name="exportPassword"
              type="password"
              value={exportPassword}
              onChange={setExportPassword}
            />
            <button type="submit" disabled={!exportPassword}>
              Export
            </button>
          </div>
          {exported ? <pre className="payload">{exported}</pre> : null}
        </form>
      ) : null}

      <section className="panel">
        <h2>Saved keystores</h2>
        {saved.length === 0 ? (
          <p className="muted">No encrypted documents saved locally.</p>
        ) : (
          <ul className="deploy-list">
            {saved.map((record) => (
              <li
                key={record.id}
                data-testid="saved-keystore"
                data-address={record.address}
              >
                <strong>{record.label}</strong> <code>{record.address}</code>
                <button type="button" className="secondary" onClick={() => remove(record.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SurfaceChecklist
        title="Surface on this screen"
        methods={["keystoreCreate", "keystoreUnlock"]}
      />
    </div>
  );
}
