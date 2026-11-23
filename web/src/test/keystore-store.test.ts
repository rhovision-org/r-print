import { beforeEach, describe, expect, it } from "vitest";
import { LocalKeystoreStore } from "../lib/keystore-store";

describe("LocalKeystoreStore", () => {
  beforeEach(() => localStorage.clear());

  it("saves, lists and removes encrypted documents", async () => {
    const store = new LocalKeystoreStore(localStorage);
    const saved = await store.save({
      label: "devnet",
      address: "1111addr",
      publicKey: "04aa",
      document: "{\"version\":3,\"crypto\":{}}",
    });
    expect(saved.id).toMatch(/^keystore:/);
    expect(await store.list()).toHaveLength(1);
    expect((await store.list())[0]?.label).toBe("devnet");
    await store.remove(saved.id);
    expect(await store.list()).toHaveLength(0);
  });

  it("never stores a password or a plaintext secret field", async () => {
    const store = new LocalKeystoreStore(localStorage);
    await store.save({
      label: "devnet",
      address: "1111addr",
      publicKey: "04aa",
      document: "{\"version\":3}",
    });
    const raw = localStorage.getItem("rprint.keystores.v1") ?? "";
    expect(raw).not.toContain("password");
    expect(raw).not.toContain("secret");
  });
});
