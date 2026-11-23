import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { DeployLog, DeployRecord } from "./deploy-log";

const DeployLogContext = createContext<DeployLog | null>(null);

export function DeployLogProvider({
  log,
  children,
}: {
  log: DeployLog;
  children: ReactNode;
}) {
  return <DeployLogContext.Provider value={log}>{children}</DeployLogContext.Provider>;
}

export function useDeployLog(): DeployLog {
  const log = useContext(DeployLogContext);
  if (!log) throw new Error("useDeployLog must be used inside DeployLogProvider");
  return log;
}

/** Subscribe a component to the in-memory history. */
export function useDeployRecords(log: DeployLog): DeployRecord[] {
  const [records, setRecords] = useState<DeployRecord[]>(() => log.list());
  useEffect(() => {
    setRecords(log.list());
    return log.subscribe(() => setRecords(log.list()));
  }, [log]);
  return records;
}
