/**
 * Future live-read adapter.
 *
 * Wiring plan: `rprint-wasm` exposes `resolve`, `publicationInfo`, `articleInfo`,
 * `editionInfo`, `commissionInfo`, `networkStatus`, and the term builders. The browser
 * loads the wasm-pack output from `src/wasm/pkg`, then this class maps each read method to
 * the corresponding export. Writes stay behind the same interface and require the
 * keystore unlock plus a signed deploy.
 *
 * v0.1 deliberately does not import the generated package: the sketch must build and test
 * without Rust or a node. Every method inherits the documented NotImplementedError.
 */
import type { RprintApi } from "./api";
import { NotImplementedError, StubApi } from "./stub-api";

export class WasmApi extends StubApi implements RprintApi {
  readonly mode = "wasm";

  constructor() {
    super();
    throw new NotImplementedError(
      "WasmApi (live reads are specified but not wired in v0.1; use FixtureApi)",
    );
  }
}
