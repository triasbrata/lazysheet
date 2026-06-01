import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";
import { getCellFormula, copyFormula } from "./formula-copy";

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, "navigator", {
    value: {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    },
    writable: true,
    configurable: true,
  });
});

describe("getCellFormula", () => {
  it('returns the formula string when cell has an "f" field', () => {
    const cell = { v: { t: "Number" as const, c: 5 }, f: "=SUM(A1:A5)" };
    expect(getCellFormula(cell)).toBe("=SUM(A1:A5)");
  });

  it("returns null when cell is undefined", () => {
    expect(getCellFormula(undefined)).toBeNull();
  });

  it("returns null when cell has no f property", () => {
    const cell = { v: { t: "Number" as const, c: 5 } };
    expect(getCellFormula(cell)).toBeNull();
  });
});

describe("copyFormula", () => {
  it("calls writeText with the exact formula, calls toast.success, and returns true on success", async () => {
    const formula = "=SUM(A1:A5)";
    const result = await copyFormula(formula);

    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(formula);
    expect(toast.success).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });

  it("calls toast.error and returns false when writeText rejects", async () => {
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("permission denied")
    );

    const result = await copyFormula("=SUM(A1:A5)");

    expect(toast.error).toHaveBeenCalledOnce();
    expect(result).toBe(false);
  });
});
