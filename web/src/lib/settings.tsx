import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CatalogueEntry, LiveConfig } from "./types";

export type ClientMode = "fixture" | "live";

export interface Settings {
  mode: ClientMode;
  nodeUrl: string;
  rootUri: string;
  shardId: string;
  phloLimit: number;
  phloPrice: number;
  processedTimeoutMs: number;
  finalityTimeoutMs: number;
  catalogue: CatalogueEntry[];
  componentUris: Record<string, string>;
}

const STORAGE_KEY = "rprint.settings.v1";

export function defaultSettings(): Settings {
  const env = (import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  }).env ?? {};
  return {
    mode: env.VITE_RPRINT_MODE === "live" ? "live" : "fixture",
    nodeUrl: env.VITE_RPRINT_NODE ?? "http://localhost:40403",
    rootUri: env.VITE_RPRINT_ROOT ?? "",
    shardId: "/root",
    phloLimit: 4_000_000,
    phloPrice: 1,
    processedTimeoutMs: 120_000,
    finalityTimeoutMs: 120_000,
    catalogue: [],
    componentUris: {},
  };
}

export function loadSettings(): Settings {
  const base = defaultSettings();
  if (typeof localStorage === "undefined") return base;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...base,
      ...parsed,
      mode: parsed.mode === "live" ? "live" : "fixture",
      catalogue: Array.isArray(parsed.catalogue) ? parsed.catalogue : [],
      componentUris:
        parsed.componentUris && typeof parsed.componentUris === "object"
          ? parsed.componentUris
          : {},
    };
  } catch {
    return base;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage is a convenience, not a requirement.
  }
}

export function liveConfig(settings: Settings): LiveConfig {
  return {
    nodeUrl: settings.nodeUrl,
    rootUri: settings.rootUri,
    shardId: settings.shardId,
    phloLimit: settings.phloLimit,
    phloPrice: settings.phloPrice,
    processedTimeoutMs: settings.processedTimeoutMs,
    finalityTimeoutMs: settings.finalityTimeoutMs,
    componentUris: settings.componentUris,
  };
}

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: Settings;
}) {
  const [settings, setSettings] = useState<Settings>(() => initial ?? loadSettings());

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      update: (patch) => setSettings((current) => ({ ...current, ...patch })),
      reset: () => setSettings(defaultSettings()),
    }),
    [settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside SettingsProvider");
  return value;
}
