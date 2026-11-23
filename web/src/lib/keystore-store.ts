/**
 * Encrypted keystore storage. Only the v3 document is stored; never a password or secret.
 * IndexedDB is used when available, with a localStorage fallback for tests and restricted
 * browsers.
 */

import { newOpId } from "./op";

export interface StoredKeystore {
  id: string;
  label: string;
  address: string;
  publicKey: string;
  document: string;
  createdAt: number;
}

export interface KeystoreStore {
  list(): Promise<StoredKeystore[]>;
  save(entry: Omit<StoredKeystore, "id" | "createdAt"> & { id?: string }): Promise<StoredKeystore>;
  remove(id: string): Promise<void>;
}

const DB_NAME = "rprint";
const DB_VERSION = 1;
const STORE = "keystores";
const LOCAL_KEY = "rprint.keystores.v1";

/** localStorage-backed storage; also the IndexedDB fallback. */
export class LocalKeystoreStore implements KeystoreStore {
  constructor(private readonly storage: Storage = localStorage) {}

  async list(): Promise<StoredKeystore[]> {
    return this.read();
  }

  async save(
    entry: Omit<StoredKeystore, "id" | "createdAt"> & { id?: string },
  ): Promise<StoredKeystore> {
    const records = this.read();
    const record: StoredKeystore = {
      id: entry.id ?? newOpId("keystore"),
      label: entry.label,
      address: entry.address,
      publicKey: entry.publicKey,
      document: entry.document,
      createdAt: Date.now(),
    };
    const next = [record, ...records.filter((item) => item.id !== record.id)];
    this.write(next);
    return record;
  }

  async remove(id: string): Promise<void> {
    this.write(this.read().filter((item) => item.id !== id));
  }

  private read(): StoredKeystore[] {
    try {
      const raw = this.storage.getItem(LOCAL_KEY);
      const parsed = raw ? (JSON.parse(raw) as StoredKeystore[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private write(records: StoredKeystore[]): void {
    this.storage.setItem(LOCAL_KEY, JSON.stringify(records));
  }
}

/** IndexedDB storage with a localStorage fallback. */
export class IndexedDbKeystoreStore implements KeystoreStore {
  private fallback = new LocalKeystoreStore();

  async list(): Promise<StoredKeystore[]> {
    const db = await open();
    if (!db) return this.fallback.list();
    return request<StoredKeystore[]>(db, "readonly", (store) => store.getAll());
  }

  async save(
    entry: Omit<StoredKeystore, "id" | "createdAt"> & { id?: string },
  ): Promise<StoredKeystore> {
    const db = await open();
    if (!db) return this.fallback.save(entry);
    const record: StoredKeystore = {
      id: entry.id ?? newOpId("keystore"),
      label: entry.label,
      address: entry.address,
      publicKey: entry.publicKey,
      document: entry.document,
      createdAt: Date.now(),
    };
    await request<IDBValidKey>(db, "readwrite", (store) => store.put(record));
    return record;
  }

  async remove(id: string): Promise<void> {
    const db = await open();
    if (!db) return this.fallback.remove(id);
    await request<undefined>(db, "readwrite", (store) => store.delete(id));
  }
}

export function createKeystoreStore(): KeystoreStore {
  if (typeof indexedDB === "undefined") {
    return typeof localStorage === "undefined"
      ? new LocalKeystoreStore(memoryStorage())
      : new LocalKeystoreStore();
  }
  return new IndexedDbKeystoreStore();
}

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function request<T = void>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const result = action(store);
    result.onsuccess = () => resolve(result.result);
    result.onerror = () => reject(result.error ?? new Error("indexedDB request failed"));
    transaction.oncomplete = () => db.close();
  });
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}
