/**
 * The historical name for the live client. `WasmApi` is the live `RprintApi` over the
 * node transport and the WASM bridge; it no longer throws in its constructor.
 */
export { LiveApi, LiveApi as WasmApi, WalletLockedError } from "./live-api";
export type { LiveApiOptions } from "./live-api";
