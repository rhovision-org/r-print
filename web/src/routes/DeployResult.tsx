export function DeployResult() {
  return (
    <div>
      <h1>Deploy result and history</h1>
      <p className="muted">
        There is no submitted deploy in the sketch. This screen documents the result shapes a
        later live client must render.
      </p>
      <section className="panel">
        <h2>Reply shapes</h2>
        <dl>
          <dt>Success</dt>
          <dd>
            <code>(true, value)</code> — for example <code>(true, {"{ id, uri }"})</code>.
          </dd>
          <dt>Refusal</dt>
          <dd>
            <code>(false, "reason")</code> — the reason vocabulary is fixed and asserted by the
            harness.
          </dd>
          <dt>Not run</dt>
          <dd>A deploy that never replies is a bug, not a pass; the harness reports not-run.</dd>
          <dt>Finality</dt>
          <dd>
            A processed deploy is not success. A live client waits for finalized +
            processedWithSuccess before showing a result.
          </dd>
        </dl>
      </section>
    </div>
  );
}
