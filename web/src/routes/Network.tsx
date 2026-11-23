import { AsyncBlock } from "../components/AsyncBlock";
import { Hash } from "../components/Hash";
import { SurfaceChecklist } from "../components/SurfaceChecklist";
import { useApi } from "../lib/api-context";
import { useAsync } from "../lib/useAsync";

export function Network() {
  const api = useApi();
  const status = useAsync(() => api.networkStatus(), "network");
  const payments = useAsync(
    () => api.resolveComponent("component:payments"),
    "component:payments",
  );

  return (
    <div>
      <h1>Network</h1>
      <p className="muted">
        The reference client is devnet-only. Reads are fixture-backed; a live mode would call
        the same methods through <code>WasmApi</code>.
      </p>

      <section className="grid">
        <div className="panel">
          <h2>Node</h2>
          <AsyncBlock state={status}>
            {(value) => (
              <dl>
                <dt>Endpoint</dt>
                <dd>{value.node}</dd>
                <dt>Network / shard</dt>
                <dd>
                  {value.networkId} · {value.shardId}
                </dd>
                <dt>Latest height</dt>
                <dd>{value.latestBlockNumber}</dd>
                <dt>Accepts deploys</dt>
                <dd>{value.acceptsDeploys ? "yes" : "no"}</dd>
                <dt>Degraded</dt>
                <dd>{value.degraded}</dd>
              </dl>
            )}
          </AsyncBlock>
        </div>
        <div className="panel">
          <h2>Component read</h2>
          <AsyncBlock state={payments}>
            {(value) => (
              <dl>
                <dt>Key</dt>
                <dd>
                  <code>{value.component}</code>
                </dd>
                <dt>URI</dt>
                <dd>
                  <Hash value={value.uri} />
                </dd>
                <dt>Version</dt>
                <dd>{value.version}</dd>
              </dl>
            )}
          </AsyncBlock>
        </div>
      </section>

      <SurfaceChecklist title="Surface on this screen" methods={["networkStatus", "resolveComponent"]} />
    </div>
  );
}
