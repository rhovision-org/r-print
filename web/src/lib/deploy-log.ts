/** A local deploy history. No node access, no indexer, no secret. */

import { newOpId } from "./op";

export type DeployRecordStatus = "pending" | "finalized" | "refused" | "failed";

export interface DeployRecord {
  id: string;
  method: string;
  target: string;
  opId?: string;
  startedAt: number;
  status: DeployRecordStatus;
  deployId?: string;
  blockHash?: string;
  blockNumber?: number;
  reason?: string;
  error?: string;
  reply?: unknown;
}

export interface DeployInput {
  method: string;
  target: string;
  opId?: string;
}

export interface DeployLog {
  begin(input: DeployInput): string;
  update(id: string, patch: Partial<DeployRecord>): void;
  list(): DeployRecord[];
  clear(): void;
  subscribe(listener: () => void): () => void;
}

const LIMIT = 100;
const STORAGE_KEY = "rprint.deploys.v1";

/** In-memory history; the Node live script uses this. */
export class MemoryDeployLog implements DeployLog {
  protected records: DeployRecord[] = [];
  private listeners = new Set<() => void>();

  begin(input: DeployInput): string {
    const record: DeployRecord = {
      id: newOpId("deploy"),
      method: input.method,
      target: input.target,
      opId: input.opId,
      startedAt: Date.now(),
      status: "pending",
    };
    this.records = [record, ...this.records].slice(0, LIMIT);
    this.changed();
    return record.id;
  }

  update(id: string, patch: Partial<DeployRecord>): void {
    let found = false;
    this.records = this.records.map((record) => {
      if (record.id !== id) return record;
      found = true;
      return { ...record, ...patch, id: record.id };
    });
    if (found) this.changed();
  }

  list(): DeployRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.records = [];
    this.changed();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  protected changed(): void {
    for (const listener of this.listeners) listener();
  }
}

/** History persisted in localStorage when a browser has it. */
export class BrowserDeployLog extends MemoryDeployLog {
  constructor(private readonly storage: Storage) {
    super();
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DeployRecord[];
        if (Array.isArray(parsed)) this.records = parsed.slice(0, LIMIT);
      }
    } catch {
      this.records = [];
    }
  }

  override begin(input: DeployInput): string {
    const id = super.begin(input);
    this.persist();
    return id;
  }

  override update(id: string, patch: Partial<DeployRecord>): void {
    super.update(id, patch);
    this.persist();
  }

  override clear(): void {
    super.clear();
    this.persist();
  }

  private persist(): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch {
      // A full or unavailable storage must not break a deploy.
    }
  }
}

export function createBrowserDeployLog(): DeployLog {
  if (typeof localStorage === "undefined") return new MemoryDeployLog();
  return new BrowserDeployLog(localStorage);
}
