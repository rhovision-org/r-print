import { useState, type FormEvent } from "react";
import { AsyncBlock } from "../components/AsyncBlock";
import { SurfaceChecklist } from "../components/SurfaceChecklist";
import { NumberField, SelectField, TextField } from "../components/forms/fields";
import { useApi } from "../lib/api-context";
import { HttpTransport } from "../lib/node-client";
import { useSession } from "../lib/session";
import { useSettings } from "../lib/settings";
import { isAccountFunding, type CatalogueEntry } from "../lib/types";
import { useAsync } from "../lib/useAsync";

const SAMPLE_KEYS = [
  "component:publication-factory",
  "component:commission-factory",
  "component:article-factory",
  "component:edition-factory",
  "component:payments",
  "component:codec",
];

export function Network() {
  const api = useApi();
  const session = useSession();
  const { settings, update } = useSettings();
  const status = useAsync(() => api.networkStatus(), `${settings.nodeUrl}:status`);
  const [nodeUrl, setNodeUrl] = useState(settings.nodeUrl);
  const [rootUri, setRootUri] = useState(settings.rootUri);
  const [shardId, setShardId] = useState(settings.shardId);
  const [phloLimit, setPhloLimit] = useState(settings.phloLimit);
  const [phloPrice, setPhloPrice] = useState(settings.phloPrice);
  const [manifest, setManifest] = useState("");
  const [componentKey, setComponentKey] = useState("component:payments");
  const [resolved, setResolved] = useState<string | null>(null);
  const [faucet, setFaucet] = useState<string | null>(null);
  const [rcashAccountFactory, setRcashAccountFactory] = useState(
    settings.rcashAccountFactory,
  );
  const [depositAmount, setDepositAmount] = useState(10);
  const [depositResult, setDepositResult] = useState<string | null>(null);
  const [depositBusy, setDepositBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<CatalogueEntry>({
    id: "",
    title: "",
    uri: "",
    kind: "publication",
  });

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({
      nodeUrl,
      rootUri,
      shardId,
      phloLimit,
      phloPrice,
      rcashAccountFactory,
    });
  }

  function loadManifest() {
    setError(null);
    try {
      const parsed = JSON.parse(manifest) as {
        root_uri?: string;
        rcash?: { account_factory_uri?: string };
        components?: Record<string, string>;
      };
      if (typeof parsed.root_uri !== "string") {
        throw new Error("manifest has no root_uri");
      }
      setRootUri(parsed.root_uri);
      if (typeof parsed.rcash?.account_factory_uri === "string") {
        setRcashAccountFactory(parsed.rcash.account_factory_uri);
      }
      setManifest("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }

  async function resolve() {
    setError(null);
    setResolved(null);
    try {
      const reply = await api.resolveComponent(componentKey);
      setResolved(reply.ok ? `${reply.value.uri} (v${reply.value.version})` : reply.reason);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }

  async function requestFaucet() {
    setError(null);
    setFaucet(null);
    if (!session.address) {
      setError("unlock a wallet first");
      return;
    }
    try {
      const transport = new HttpTransport(settings.nodeUrl);
      const response = await transport.faucet(session.address);
      setFaucet(JSON.stringify(response));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }

  async function requestDeposit() {
    setError(null);
    setDepositResult(null);
    if (!isAccountFunding(api)) {
      setError("the r-cash funding helper is only available in live mode");
      return;
    }
    if (!settings.rcashAccountFactory.trim()) {
      setError("save the r-cash account factory first");
      return;
    }
    setDepositBusy(true);
    try {
      const reply = await api.fundNativeAccount(depositAmount);
      setDepositResult(
        reply.ok
          ? `Funded ${reply.value.ownerId || "the r-cash account"}`
          : `Refused: ${reply.reason}`,
      );
    } catch (failure) {
      setError(
        `${failure instanceof Error ? failure.message : String(failure)}. ` +
          "Check the deploy id before retrying; do not submit the same deposit twice.",
      );
    } finally {
      setDepositBusy(false);
    }
  }

  function addCatalogueEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!entry.uri.trim()) return;
    update({ catalogue: [...settings.catalogue, { ...entry, id: entry.id || entry.uri }] });
    setEntry({ id: "", title: "", uri: "", kind: "publication" });
  }

  return (
    <div>
      <h1>Network</h1>
      <p className="muted">
        Live mode is opt-in and devnet-only. Fixture mode keeps the book's reference pages
        usable with no node. There is no indexer; the catalogue is a local list of links.
      </p>
      {error ? <p className="error">{error}</p> : null}

      <section className="panel">
        <h2>Mode</h2>
        <div className="fields">
          <SelectField
            label="Client mode"
            name="mode"
            value={settings.mode}
            options={[
              { value: "fixture", label: "Fixture (no node)" },
              { value: "live", label: "Live (node + WASM)" },
            ]}
            onChange={(mode) => update({ mode })}
          />
        </div>
      </section>

      <form className="panel" onSubmit={save}>
        <h2>Node and root</h2>
        <div className="fields">
          <TextField label="Node URL" name="nodeUrl" value={nodeUrl} onChange={setNodeUrl} />
          <TextField label="Root URI" name="rootUri" value={rootUri} onChange={setRootUri} />
          <TextField label="Shard id" name="shardId" value={shardId} onChange={setShardId} />
          <TextField
            label="r-cash account factory"
            name="rcashAccountFactory"
            value={rcashAccountFactory}
            onChange={setRcashAccountFactory}
            placeholder="rho:id:…"
          />
          <NumberField label="Phlo limit" name="phloLimit" value={phloLimit} onChange={setPhloLimit} min={0} />
          <NumberField label="Phlo price" name="phloPrice" value={phloPrice} onChange={setPhloPrice} min={0} />
          <button type="submit">Save settings</button>
        </div>
      </form>

      <section className="panel">
        <h2>Import a deployment manifest</h2>
        <p className="muted">
          Paste <code>deployments/devnet.json</code> to take its <code>root_uri</code> and
          <code>rcash.account_factory_uri</code>.
        </p>
        <textarea
          className="manifest"
          data-testid="manifest-input"
          rows={4}
          value={manifest}
          onChange={(event) => setManifest(event.target.value)}
        />
        <button type="button" className="secondary" onClick={loadManifest}>
          Use root_uri
        </button>
      </section>

      <section className="grid">
        <div className="panel">
          <h2>Node status</h2>
          <AsyncBlock state={status}>
            {(value) => (
              <dl data-testid="network-status">
                <dt>Endpoint</dt>
                <dd data-testid="node-endpoint">{value.node}</dd>
                <dt>Network / shard</dt>
                <dd data-testid="node-network">
                  {value.networkId} · {value.shardId}
                </dd>
                <dt>Latest height</dt>
                <dd data-testid="node-height">{value.latestBlockNumber}</dd>
                <dt>Accepts deploys</dt>
                <dd data-testid="node-accepts">{value.acceptsDeploys ? "yes" : "no"}</dd>
                <dt>Degraded</dt>
                <dd>{value.degraded || "—"}</dd>
              </dl>
            )}
          </AsyncBlock>
        </div>
        <div className="panel">
          <h2>Component resolution</h2>
          <div className="fields">
            <TextField
              label="Component key"
              name="componentKey"
              value={componentKey}
              onChange={setComponentKey}
            />
            <button type="button" onClick={resolve}>
              Resolve
            </button>
            {resolved ? (
              <p data-testid="component-resolution">
                <code>{resolved}</code>
              </p>
            ) : null}
            <p className="muted">Common keys:</p>
            <ul className="checklist">
              {SAMPLE_KEYS.map((key) => (
                <li key={key}>
                  <button type="button" className="link" onClick={() => setComponentKey(key)}>
                    {key}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Devnet faucet</h2>
        <p className="muted">
          Funds the unlocked REV address for phlo. Commission funding additionally requires an
          r-cash-funded account; use the deposit action below to move REV from the native
          vault into that account.
        </p>
        <button type="button" onClick={requestFaucet} disabled={!session.address}>
          Request 30 REV
        </button>
        {faucet ? (
          <pre className="payload" data-testid="faucet-result">
            {faucet}
          </pre>
        ) : null}
      </section>

      <section className="panel">
        <h2>Fund the r-cash account</h2>
        <p className="muted">
          Moves REV from the unlocked key's native vault into its r-cash account, so a
          commission can be funded. The deploy is value-moving: after a timeout, check its
          deploy id before doing anything else; never submit the same deposit twice.
        </p>
        <div className="fields">
          <NumberField
            label="Deposit amount (REV)"
            name="depositAmount"
            value={depositAmount}
            onChange={setDepositAmount}
            min={1}
          />
          <button
            type="button"
            onClick={requestDeposit}
            disabled={
              depositBusy ||
              settings.mode !== "live" ||
              !session.unlocked ||
              !settings.rcashAccountFactory.trim() ||
              depositAmount <= 0
            }
          >
            Deposit REV
          </button>
        </div>
        {depositResult ? (
          <pre className="payload" data-testid="deposit-result">
            {depositResult}
          </pre>
        ) : null}
      </section>

      <section className="panel">
        <h2>Catalogue (local links)</h2>
        {settings.catalogue.length === 0 ? (
          <p className="muted">No live catalogue entries.</p>
        ) : (
          <ul className="deploy-list">
            {settings.catalogue.map((item) => (
              <li
                key={`${item.kind}:${item.uri}`}
                data-testid="network-catalogue-item"
                data-uri={item.uri}
              >
                <span className="tag">{item.kind}</span> <strong>{item.title}</strong>{" "}
                <code>{item.uri}</code>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    update({
                      catalogue: settings.catalogue.filter((row) => row.uri !== item.uri),
                    })
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addCatalogueEntry}>
          <div className="fields">
            <TextField label="Title" name="title" value={entry.title} onChange={(title) => setEntry({ ...entry, title })} />
            <TextField label="URI" name="uri" value={entry.uri} onChange={(uri) => setEntry({ ...entry, uri })} />
            <SelectField
              label="Kind"
              name="kind"
              value={entry.kind}
              options={[
                { value: "publication", label: "publication" },
                { value: "article", label: "article" },
                { value: "edition", label: "edition" },
                { value: "commission", label: "commission" },
              ]}
              onChange={(kind) => setEntry({ ...entry, kind })}
            />
            <button type="submit">Add link</button>
          </div>
        </form>
      </section>

      <SurfaceChecklist title="Surface on this screen" methods={["networkStatus", "resolveComponent"]} />
    </div>
  );
}
