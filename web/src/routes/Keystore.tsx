import { ActionPanel } from "../components/ActionPanel";
import { SurfaceChecklist } from "../components/SurfaceChecklist";

export function Keystore() {
  return (
    <div>
      <h1>Keystore</h1>
      <p className="muted">
        The key is created and decrypted only inside <code>rprint-wasm</code>; the browser
        receives an encrypted Web3 v3 document and stores that in IndexedDB. The content of a
        wallet is a password and a keystore document, never a plaintext key in React state.
      </p>
      <section className="panel">
        <h2>What the later implementation must do</h2>
        <ol>
          <li>Load the wasm-pack output from <code>src/wasm/pkg</code>.</li>
          <li>
            Call <code>keystore_encrypt(secret, address, password)</code> on create and{" "}
            <code>keystore_decrypt(document, password)</code> on unlock.
          </li>
          <li>Keep only the encrypted document and the derived address in the UI.</li>
          <li>Sign a deploy in WASM, submit through the r-cash signed-deploy client, and wait for finalized + processedWithSuccess.</li>
        </ol>
      </section>

      <ActionPanel
        title="Keystore actions (stub)"
        description="Both actions reject with the documented NotImplementedError in v0.1."
        actions={[
          {
            label: "Create keystore",
            method: "keystoreCreate",
            description: "Password-protected v3 document",
            run: (api) => api.keystoreCreate({ password: "demo", name: "devnet" }),
          },
          {
            label: "Unlock keystore",
            method: "keystoreUnlock",
            description: "Decrypt inside WASM",
            run: (api) =>
              api.keystoreUnlock({ password: "demo", document: "{}" }),
          },
        ]}
      />

      <SurfaceChecklist title="Surface on this screen" methods={["keystoreCreate", "keystoreUnlock"]} />
    </div>
  );
}
