import { useEffect, useMemo, useState } from "react";
import { HashRouter } from "react-router-dom";
import { ApiProvider } from "./lib/api-context";
import { createBrowserDeployLog } from "./lib/deploy-log";
import { DeployLogProvider } from "./lib/deploy-log-context";
import { FixtureApi } from "./lib/fixture-api";
import { LiveApi } from "./lib/live-api";
import { HttpTransport } from "./lib/node-client";
import { SessionProvider } from "./lib/session";
import { SettingsProvider, liveConfig, useSettings } from "./lib/settings";
import { loadBrowserWasm, type WasmBridge } from "./lib/wasm-bridge";
import { AppRoutes } from "./routes";

export function App() {
  return (
    <SettingsProvider>
      <ClientShell />
    </SettingsProvider>
  );
}

function ClientShell() {
  const { settings, update } = useSettings();
  const log = useMemo(() => createBrowserDeployLog(), []);
  const [bridge, setBridge] = useState<WasmBridge | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(settings.mode === "live");

  useEffect(() => {
    if (settings.mode !== "live") {
      setBridge(null);
      setBridgeError(null);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    setBridgeError(null);
    loadBrowserWasm()
      .then((loaded) => {
        if (!live) return;
        setBridge(loaded);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!live) return;
        setBridgeError(error instanceof Error ? error.message : String(error));
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [settings.mode]);

  const api = useMemo(() => {
    if (settings.mode === "live" && bridge) {
      return new LiveApi({
        bridge,
        transport: new HttpTransport(settings.nodeUrl),
        config: liveConfig(settings),
        log,
      });
    }
    return new FixtureApi();
  }, [settings, bridge, log]);

  if (settings.mode === "live" && (loading || !bridge)) {
    return (
      <main className="boot">
        <h1>Starting the live client</h1>
        {bridgeError ? (
          <>
            <p className="error" data-testid="boot-error">
              {bridgeError}
            </p>
            <button type="button" onClick={() => update({ mode: "fixture" })}>
              Use fixture mode
            </button>
          </>
        ) : (
          <p className="muted" data-testid="boot-loading">
            Loading the WASM wallet and term builders…
          </p>
        )}
      </main>
    );
  }

  return (
    <SessionProvider bridge={settings.mode === "live" ? bridge : null}>
      <DeployLogProvider log={log}>
        <ApiProvider api={api}>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </ApiProvider>
      </DeployLogProvider>
    </SessionProvider>
  );
}
