import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { WasmBridge, WalletInfo } from "./wasm-bridge";

export interface SessionContextValue {
  bridge: WasmBridge | null;
  unlocked: boolean;
  address?: string;
  publicKey?: string;
  create: (password: string) => Promise<WalletInfo>;
  unlock: (document: string, password: string) => Promise<WalletInfo>;
  lock: () => void;
  refresh: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  bridge,
  children,
}: {
  bridge: WasmBridge | null;
  children: ReactNode;
}) {
  const [info, setInfo] = useState<WalletInfo | null>(() => bridge?.info() ?? null);

  useEffect(() => {
    setInfo(bridge?.info() ?? null);
  }, [bridge]);

  const create = useCallback(
    async (password: string) => {
      if (!bridge) throw new Error("live mode is not enabled");
      const created = bridge.createWallet(password);
      setInfo(created);
      return created;
    },
    [bridge],
  );

  const unlock = useCallback(
    async (document: string, password: string) => {
      if (!bridge) throw new Error("live mode is not enabled");
      const unlocked = bridge.unlockWallet(document, password);
      setInfo(unlocked);
      return unlocked;
    },
    [bridge],
  );

  const lock = useCallback(() => {
    bridge?.lockWallet();
    setInfo(null);
  }, [bridge]);

  const refresh = useCallback(() => {
    setInfo(bridge?.info() ?? null);
  }, [bridge]);

  const value = useMemo<SessionContextValue>(
    () => ({
      bridge,
      unlocked: Boolean(bridge?.isUnlocked()),
      address: info?.address,
      publicKey: info?.publicKey,
      create,
      unlock,
      lock,
      refresh,
    }),
    [bridge, info, create, unlock, lock, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
