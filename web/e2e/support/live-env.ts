import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { APIRequestContext } from "@playwright/test";

export const LIVE_ENABLED = process.env.RPRINT_E2E_LIVE === "1";
export const nodeUrl = process.env.RPRINT_NODE ?? "http://localhost:40403";
export const password = process.env.RPRINT_E2E_PASSWORD ?? "browser-e2e-password";

export function repoRoot(): string {
  return process.env.RPRINT_REPO ?? resolve(process.cwd(), "..");
}

function manifestPath(): string {
  return resolve(repoRoot(), "deployments/devnet.json");
}

export function rootUri(): string {
  if (process.env.RPRINT_ROOT) return process.env.RPRINT_ROOT;
  const manifest = JSON.parse(readFileSync(manifestPath(), "utf8")) as {
    root_uri?: unknown;
  };
  if (typeof manifest.root_uri !== "string") {
    throw new Error("deployments/devnet.json has no root_uri");
  }
  return manifest.root_uri;
}

/** The full manifest when present; a minimal manifest when only RPRINT_ROOT is supplied. */
export function manifestJson(): string {
  try {
    return readFileSync(manifestPath(), "utf8");
  } catch {
    return JSON.stringify({ root_uri: rootUri() });
  }
}

async function status(request: APIRequestContext): Promise<Record<string, unknown>> {
  const response = await request.get(`${nodeUrl}/api/v1/status`);
  if (!response.ok()) {
    throw new Error(`node status returned ${response.status()}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

export async function height(request: APIRequestContext): Promise<number> {
  const body = await status(request);
  const value = body.latestBlockNumber;
  if (typeof value !== "number") {
    throw new Error("node status has no latestBlockNumber");
  }
  return value;
}

export async function nodeBuild(request: APIRequestContext): Promise<string> {
  const body = await status(request);
  const version = body.version;
  if (version && typeof version === "object" && "node" in version) {
    const node = (version as { node?: unknown }).node;
    if (typeof node === "string") return node;
  }
  return "unknown";
}
