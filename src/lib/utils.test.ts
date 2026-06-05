import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// cn — clsx + tailwind-merge
// ---------------------------------------------------------------------------

describe("cn", () => {
  it("returns empty string with no arguments", () => {
    expect(cn()).toBe("");
  });

  it("returns a single class name unchanged", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("merges multiple class names", () => {
    const result = cn("foo", "bar", "baz");
    expect(result).toContain("foo");
    expect(result).toContain("bar");
    expect(result).toContain("baz");
  });

  it("filters out falsy values: undefined, null, false, 0, empty string", () => {
    expect(cn(undefined)).toBe("");
    expect(cn(null as unknown as string)).toBe("");
    expect(cn(false as unknown as string)).toBe("");
    expect(cn("")).toBe("");
    expect(cn("foo", undefined, null as unknown as string, false as unknown as string, "bar")).toBe("foo bar");
  });

  it("handles conditional class objects (clsx object syntax)", () => {
    expect(cn({ foo: true, bar: false })).toBe("foo");
    expect(cn({ foo: true, bar: true })).toContain("foo");
    expect(cn({ foo: true, bar: true })).toContain("bar");
    expect(cn({ foo: false })).toBe("");
  });

  it("handles array of class names", () => {
    expect(cn(["a", "b"])).toBe("a b");
    expect(cn(["a", undefined, "b"])).toBe("a b");
  });

  it("deduplicates conflicting tailwind classes (last wins)", () => {
    // text-* conflict: last one should win
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
    expect(result).not.toContain("text-red-500");
  });

  it("deduplicates conflicting padding classes", () => {
    const result = cn("p-2", "p-4");
    expect(result).toBe("p-4");
    expect(result).not.toContain("p-2");
  });

  it("deduplicates conflicting margin classes", () => {
    const result = cn("m-2", "m-8");
    expect(result).toBe("m-8");
    expect(result).not.toContain("m-2");
  });

  it("keeps non-conflicting tailwind classes together", () => {
    const result = cn("p-2", "m-4", "text-red-500");
    expect(result).toContain("p-2");
    expect(result).toContain("m-4");
    expect(result).toContain("text-red-500");
  });

  it("handles conditional class with tailwind conflict resolution", () => {
    const isActive = true;
    const result = cn("bg-gray-100", isActive && "bg-blue-500");
    expect(result).toBe("bg-blue-500");
    expect(result).not.toContain("bg-gray-100");
  });

  it("handles conditional class with falsy condition — keeps base class", () => {
    const isActive = false;
    const result = cn("bg-gray-100", isActive && "bg-blue-500");
    expect(result).toBe("bg-gray-100");
  });

  it("handles nested arrays", () => {
    const result = cn(["flex", ["items-center", "justify-between"]]);
    expect(result).toContain("flex");
    expect(result).toContain("items-center");
    expect(result).toContain("justify-between");
  });
});
