import { beforeEach, describe, expect, it } from "vitest";
import { defaultSettings, loadSettings, saveSettings } from "../lib/settings";

describe("settings", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to fixture mode", () => {
    expect(defaultSettings().mode).toBe("fixture");
    expect(defaultSettings().nodeUrl).toContain("http");
  });

  it("round trips live settings", () => {
    const settings = {
      ...defaultSettings(),
      mode: "live" as const,
      nodeUrl: "http://localhost:50403",
      rootUri: "rho:id:root",
      catalogue: [
        { id: "pub:1", title: "Pub", uri: "rho:id:p", kind: "publication" as const },
      ],
    };
    saveSettings(settings);
    const loaded = loadSettings();
    expect(loaded.mode).toBe("live");
    expect(loaded.rootUri).toBe("rho:id:root");
    expect(loaded.catalogue[0]?.title).toBe("Pub");
  });

  it("falls back on corrupt storage", () => {
    localStorage.setItem("rprint.settings.v1", "not json");
    expect(loadSettings().mode).toBe("fixture");
  });
});
