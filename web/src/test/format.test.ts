import { describe, expect, it } from "vitest";
import { bpsToPercent, formatHeight, roleLabel, shortHash, statusLabel } from "../lib/format";

describe("format", () => {
  it("shortens long hashes and keeps short ones", () => {
    expect(shortHash("abc", 2)).toBe("abc");
    expect(shortHash("0123456789abcdef", 4)).toBe("0123…cdef");
  });

  it("formats heights, statuses, roles and bps", () => {
    expect(formatHeight(0)).toBe("—");
    expect(formatHeight(42)).toBe("#42");
    expect(statusLabel("not_submitted")).toBe("not submitted");
    expect(roleLabel("factchecker")).toBe("Fact-checker");
    expect(bpsToPercent(4000)).toBe("40.00%");
  });
});
