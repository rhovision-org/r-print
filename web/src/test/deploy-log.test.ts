import { beforeEach, describe, expect, it } from "vitest";
import { BrowserDeployLog, MemoryDeployLog } from "../lib/deploy-log";

describe("deploy history", () => {
  beforeEach(() => localStorage.clear());

  it("records begin/update and notifies subscribers", () => {
    const log = new MemoryDeployLog();
    let notifications = 0;
    const stop = log.subscribe(() => {
      notifications += 1;
    });
    const id = log.begin({ method: "publishArticle", target: "rho:id:a", opId: "op:1" });
    log.update(id, {
      status: "finalized",
      deployId: "deploy-1",
      blockHash: "block-1",
      blockNumber: 4,
      reply: { ok: true },
    });
    expect(log.list()[0]).toMatchObject({
      method: "publishArticle",
      target: "rho:id:a",
      status: "finalized",
      deployId: "deploy-1",
      blockNumber: 4,
    });
    expect(notifications).toBe(2);
    stop();
    log.clear();
    expect(log.list()).toHaveLength(0);
  });

  it("persists to and reloads from storage", () => {
    const first = new BrowserDeployLog(localStorage);
    const id = first.begin({ method: "addMember", target: "rho:id:p" });
    first.update(id, { status: "refused", reason: "role" });
    const second = new BrowserDeployLog(localStorage);
    expect(second.list()[0]).toMatchObject({ method: "addMember", status: "refused" });
  });
});
