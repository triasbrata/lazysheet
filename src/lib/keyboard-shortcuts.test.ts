import { describe, it, expect } from "vitest";
import { shouldCloseSheet, shouldOpenFile, shouldZoomIn, shouldZoomOut, shouldZoomReset } from "./keyboard-shortcuts";

describe("shouldCloseSheet", () => {
  it("returns true for Cmd+W with hasWorkbook=true", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "w" } as unknown as KeyboardEvent;
    expect(shouldCloseSheet(e, true)).toBe(true);
  });

  it("returns true for Ctrl+W with hasWorkbook=true", () => {
    const e = { metaKey: false, ctrlKey: true, shiftKey: false, key: "w" } as unknown as KeyboardEvent;
    expect(shouldCloseSheet(e, true)).toBe(true);
  });

  it("returns false for Cmd+W with hasWorkbook=false", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "w" } as unknown as KeyboardEvent;
    expect(shouldCloseSheet(e, false)).toBe(false);
  });

  it("returns false for Cmd+Shift+W with hasWorkbook=true", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: true, key: "w" } as unknown as KeyboardEvent;
    expect(shouldCloseSheet(e, true)).toBe(false);
  });

  it("returns false for Cmd+K with hasWorkbook=true", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "k" } as unknown as KeyboardEvent;
    expect(shouldCloseSheet(e, true)).toBe(false);
  });

  it("returns false for 'w' with no modifier and hasWorkbook=true", () => {
    const e = { metaKey: false, ctrlKey: false, shiftKey: false, key: "w" } as unknown as KeyboardEvent;
    expect(shouldCloseSheet(e, true)).toBe(false);
  });

  it("returns true for Cmd+W with uppercase key 'W' and hasWorkbook=true", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "W" } as unknown as KeyboardEvent;
    expect(shouldCloseSheet(e, true)).toBe(true);
  });
});

describe("shouldOpenFile", () => {
  it("returns true for meta+o", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "o" } as unknown as KeyboardEvent;
    expect(shouldOpenFile(e)).toBe(true);
  });

  it("returns true for ctrl+o", () => {
    const e = { metaKey: false, ctrlKey: true, shiftKey: false, key: "o" } as unknown as KeyboardEvent;
    expect(shouldOpenFile(e)).toBe(true);
  });

  it("returns false for 'o' with no modifier", () => {
    const e = { metaKey: false, ctrlKey: false, shiftKey: false, key: "o" } as unknown as KeyboardEvent;
    expect(shouldOpenFile(e)).toBe(false);
  });

  it("returns false for meta+shift+o", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: true, key: "o" } as unknown as KeyboardEvent;
    expect(shouldOpenFile(e)).toBe(false);
  });

  it("returns false for meta+k", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "k" } as unknown as KeyboardEvent;
    expect(shouldOpenFile(e)).toBe(false);
  });

  it("returns true for meta + uppercase 'O'", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "O" } as unknown as KeyboardEvent;
    expect(shouldOpenFile(e)).toBe(true);
  });
});

describe("shouldZoomIn", () => {
  it("returns true for meta+'='", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "=" } as unknown as KeyboardEvent;
    expect(shouldZoomIn(e)).toBe(true);
  });

  it("returns true for ctrl+'='", () => {
    const e = { metaKey: false, ctrlKey: true, shiftKey: false, key: "=" } as unknown as KeyboardEvent;
    expect(shouldZoomIn(e)).toBe(true);
  });

  it("returns true for meta+'+'", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "+" } as unknown as KeyboardEvent;
    expect(shouldZoomIn(e)).toBe(true);
  });

  it("returns true for meta+shift+'+' (shift allowed)", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: true, key: "+" } as unknown as KeyboardEvent;
    expect(shouldZoomIn(e)).toBe(true);
  });

  it("returns true for ctrl+shift+'=' with shiftKey", () => {
    const e = { metaKey: false, ctrlKey: true, shiftKey: true, key: "=" } as unknown as KeyboardEvent;
    expect(shouldZoomIn(e)).toBe(true);
  });

  it("returns false for '=' with no modifier", () => {
    const e = { metaKey: false, ctrlKey: false, shiftKey: false, key: "=" } as unknown as KeyboardEvent;
    expect(shouldZoomIn(e)).toBe(false);
  });

  it("returns false for '+' with no modifier", () => {
    const e = { metaKey: false, ctrlKey: false, shiftKey: false, key: "+" } as unknown as KeyboardEvent;
    expect(shouldZoomIn(e)).toBe(false);
  });

  it("returns false for meta+'-'", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "-" } as unknown as KeyboardEvent;
    expect(shouldZoomIn(e)).toBe(false);
  });
});

describe("shouldZoomOut", () => {
  it("returns true for meta+'-'", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "-" } as unknown as KeyboardEvent;
    expect(shouldZoomOut(e)).toBe(true);
  });

  it("returns true for ctrl+'-'", () => {
    const e = { metaKey: false, ctrlKey: true, shiftKey: false, key: "-" } as unknown as KeyboardEvent;
    expect(shouldZoomOut(e)).toBe(true);
  });

  it("returns false for '-' with no modifier", () => {
    const e = { metaKey: false, ctrlKey: false, shiftKey: false, key: "-" } as unknown as KeyboardEvent;
    expect(shouldZoomOut(e)).toBe(false);
  });

  it("returns false for meta+'='", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "=" } as unknown as KeyboardEvent;
    expect(shouldZoomOut(e)).toBe(false);
  });

  it("returns false for meta+'0'", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "0" } as unknown as KeyboardEvent;
    expect(shouldZoomOut(e)).toBe(false);
  });
});

describe("shouldZoomReset", () => {
  it("returns true for meta+'0'", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "0" } as unknown as KeyboardEvent;
    expect(shouldZoomReset(e)).toBe(true);
  });

  it("returns true for ctrl+'0'", () => {
    const e = { metaKey: false, ctrlKey: true, shiftKey: false, key: "0" } as unknown as KeyboardEvent;
    expect(shouldZoomReset(e)).toBe(true);
  });

  it("returns false for '0' with no modifier", () => {
    const e = { metaKey: false, ctrlKey: false, shiftKey: false, key: "0" } as unknown as KeyboardEvent;
    expect(shouldZoomReset(e)).toBe(false);
  });

  it("returns false for meta+'-'", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "-" } as unknown as KeyboardEvent;
    expect(shouldZoomReset(e)).toBe(false);
  });

  it("returns false for meta+'='", () => {
    const e = { metaKey: true, ctrlKey: false, shiftKey: false, key: "=" } as unknown as KeyboardEvent;
    expect(shouldZoomReset(e)).toBe(false);
  });
});
