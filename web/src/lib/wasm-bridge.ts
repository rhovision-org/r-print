/**
 * The WASM boundary.
 *
 * The real bridge loads the generated module at runtime (never statically, so a fixture
 * build does not need Rust). Tests and the Node live script inject an already-initialized
 * module. The key lives inside the WASM `Wallet`; this file never receives a secret.
 */

export interface WalletInfo {
  address: string;
  publicKey: string;
  document?: string;
}

export interface SignOptions {
  validAfter: number;
  phloLimit: number;
  phloPrice: number;
  shard: string;
  timestampMillis?: number;
}

export interface SignedDeployWire {
  deployId: string;
  body: unknown;
}

export interface EditionManifestInput {
  editionId: string;
  publicationId: string;
  number: number;
  titleHash: string;
  coverHash: string;
  articleHashes: string[];
}

export interface DecodedReply {
  ok: boolean;
  values?: unknown[];
  reason?: string;
}

export interface WasmBridge {
  version(): string;
  createWallet(password: string): WalletInfo;
  unlockWallet(document: string, password: string): WalletInfo;
  lockWallet(): void;
  isUnlocked(): boolean;
  info(): WalletInfo | null;
  exportKeystore(password: string): string;
  buildTerm(request: unknown): string;
  decodeReply(expr: unknown): DecodedReply;
  signDeploy(term: string, options: SignOptions): SignedDeployWire;
  signTextPayload(payload: string): string;
  signEditionManifest(input: EditionManifestInput): {
    manifestHash: string;
    signature: string;
  };
  signWithKeystore(
    document: string,
    password: string,
    payload: string,
  ): { publicKey: string; signature: string };
}

export class WasmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WasmError";
  }
}

interface WasmWallet {
  free?: () => void;
  create(password: string): string;
  unlock(document: string, password: string): string;
  lock(): void;
  is_unlocked(): boolean;
  info(): string | undefined;
  export(password: string): string;
  sign_deploy(term: string, optionsJson: string): string;
  sign_text_payload(payload: string): string;
  sign_edition_manifest(inputJson: string): string;
}

/** The shape of the generated module (web or nodejs target). */
export interface WasmModule {
  default?: (input?: unknown) => Promise<unknown>;
  version(): string;
  build_term(requestJson: string): string;
  decode_reply(exprJson: string): string;
  Wallet: new () => WasmWallet;
}

/** A bridge over an initialized generated module. */
export class RprintWasmBridge implements WasmBridge {
  private readonly wallet: WasmWallet;

  constructor(private readonly module: WasmModule) {
    this.wallet = new module.Wallet();
  }

  version(): string {
    return this.module.version();
  }

  createWallet(password: string): WalletInfo {
    return this.parse<WalletInfo>(this.call(() => this.wallet.create(password)));
  }

  unlockWallet(document: string, password: string): WalletInfo {
    return this.parse<WalletInfo>(
      this.call(() => this.wallet.unlock(document, password)),
    );
  }

  lockWallet(): void {
    this.wallet.lock();
  }

  isUnlocked(): boolean {
    return this.wallet.is_unlocked();
  }

  info(): WalletInfo | null {
    const raw = this.call(() => this.wallet.info());
    return raw ? this.parse<WalletInfo>(raw) : null;
  }

  exportKeystore(password: string): string {
    return this.call(() => this.wallet.export(password));
  }

  buildTerm(request: unknown): string {
    return this.call(() => this.module.build_term(JSON.stringify(request)));
  }

  decodeReply(expr: unknown): DecodedReply {
    const raw = this.call(() => this.module.decode_reply(JSON.stringify(expr)));
    return this.parse<DecodedReply>(raw);
  }

  signDeploy(term: string, options: SignOptions): SignedDeployWire {
    const raw = this.call(() =>
      this.wallet.sign_deploy(term, JSON.stringify(options)),
    );
    return this.parse<SignedDeployWire>(raw);
  }

  signTextPayload(payload: string): string {
    return this.call(() => this.wallet.sign_text_payload(payload));
  }

  signEditionManifest(input: EditionManifestInput): {
    manifestHash: string;
    signature: string;
  } {
    const raw = this.call(() =>
      this.wallet.sign_edition_manifest(JSON.stringify(input)),
    );
    return this.parse<{ manifestHash: string; signature: string }>(raw);
  }

  signWithKeystore(
    document: string,
    password: string,
    payload: string,
  ): { publicKey: string; signature: string } {
    const temporary = new this.module.Wallet();
    try {
      const info = this.parse<WalletInfo>(this.call(() => temporary.unlock(document, password)));
      const signature = this.call(() => temporary.sign_text_payload(payload));
      return { publicKey: info.publicKey, signature };
    } finally {
      temporary.free?.();
    }
  }

  private call<T>(action: () => T): T {
    try {
      return action();
    } catch (error) {
      throw new WasmError(error instanceof Error ? error.message : String(error));
    }
  }

  private parse<T>(raw: string): T {
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new WasmError("wasm returned malformed JSON");
    }
  }
}

/**
 * Load the web-target module from `public/wasm` at runtime and initialise it.
 *
 * The `@vite-ignore` is deliberate: the generated package is not a build-time dependency,
 * and fixture mode must build and typecheck without Rust. A live build without the wasm
 * artifact reports a clear error instead of failing the whole app.
 */
export async function loadBrowserWasm(moduleUrl?: string): Promise<WasmBridge> {
  const env = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env;
  const url = moduleUrl ?? `${env?.BASE_URL ?? "/"}wasm/rprint_wasm.js`;
  try {
    const module = (await import(/* @vite-ignore */ url)) as unknown as WasmModule;
    await module.default?.();
    return new RprintWasmBridge(module);
  } catch (error) {
    throw new WasmError(
      `live mode requires the wasm build at ${url}; run make client-wasm-pack (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }
}
