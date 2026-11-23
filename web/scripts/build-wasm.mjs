// Build the wasm module into public/wasm (web) or tests/wasm-node (nodejs).
// Paths are repo-relative; run from anywhere.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(webDir, "..");
const target = process.argv[2] === "nodejs" ? "nodejs" : "web";
const outDir =
  target === "nodejs"
    ? resolve(webDir, "tests/wasm-node")
    : resolve(webDir, "public/wasm");
const result = spawnSync(
  "wasm-pack",
  [
    "build",
    resolve(repo, "crates/rprint-wasm"),
    "--target",
    target,
    "--release",
    "--out-dir",
    outDir,
  ],
  { cwd: repo, stdio: "inherit" },
);
process.exit(result.status ?? 1);
