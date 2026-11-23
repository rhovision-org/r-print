import { useDeployLog, useDeployRecords } from "../lib/deploy-log-context";
import { useSettings } from "../lib/settings";

export function DeployResult() {
  const log = useDeployLog();
  const records = useDeployRecords(log);
  const { settings } = useSettings();

  return (
    <div>
      <h1>Deploy result and history</h1>
      <p className="muted">
        Local history only. A deploy is shown as <strong>finalized</strong> only after the
        node reports processed-with-success and the containing block is final.{" "}
        {settings.mode === "fixture"
          ? "Fixture mode does not submit deploys."
          : "Refusals are successful deploys carrying (false, reason)."}
      </p>

      <section className="panel">
        <h2>History</h2>
        {records.length === 0 ? (
          <p className="muted">No deploy attempts in this browser.</p>
        ) : (
          <table className="deploy-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Status</th>
                <th>Deploy id</th>
                <th>Block</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong>{record.method}</strong>
                    <br />
                    <code>{record.target}</code>
                  </td>
                  <td>
                    <span className={`tag ${record.status}`}>{record.status}</span>
                  </td>
                  <td>
                    <code>{record.deployId ?? "—"}</code>
                  </td>
                  <td>
                    {record.blockNumber !== undefined
                      ? `#${record.blockNumber}`
                      : "—"}
                  </td>
                  <td>
                    {record.reason ? <p>reason: {record.reason}</p> : null}
                    {record.error ? <p className="error">{record.error}</p> : null}
                    {record.reply !== undefined ? (
                      <pre className="reply">{JSON.stringify(record.reply, null, 2)}</pre>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button type="button" className="secondary" onClick={() => log.clear()}>
          Clear history
        </button>
      </section>

      <section className="panel">
        <h2>Reply shapes</h2>
        <dl>
          <dt>Success</dt>
          <dd>
            <code>(true, value)</code>
          </dd>
          <dt>Refusal</dt>
          <dd>
            <code>(false, "reason")</code> — returned as a refusal, not an error.
          </dd>
          <dt>Not processed / not final</dt>
          <dd>
            A timeout is never shown as success. The record keeps the deploy id and block for
            manual rechecking.
          </dd>
        </dl>
      </section>
    </div>
  );
}
