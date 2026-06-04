import { describe, it, expect, beforeEach } from "vitest";

import {
  DEFAULT_COPY_FORMAT_KEY,
  DEFAULT_COPY_FORMAT,
  isCopyFormat,
  isMarkdownFormat,
  readStoredDefaultCopyFormat,
} from "@/lib/copy-format-pref";

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("DEFAULT_COPY_FORMAT_KEY is the expected string", () => {
    expect(DEFAULT_COPY_FORMAT_KEY).toBe("lazysheet:default-copy-format");
  });

  it("DEFAULT_COPY_FORMAT is 'inline'", () => {
    expect(DEFAULT_COPY_FORMAT).toBe("inline");
  });
});

// ---------------------------------------------------------------------------
// isCopyFormat
// ---------------------------------------------------------------------------

describe("isCopyFormat", () => {
  it("returns true for 'inline'", () => {
    expect(isCopyFormat("inline")).toBe(true);
  });

  it("returns true for 'title'", () => {
    expect(isCopyFormat("title")).toBe(true);
  });

  it("returns true for 'table'", () => {
    expect(isCopyFormat("table")).toBe(true);
  });

  it("returns true for 'ascii'", () => {
    expect(isCopyFormat("ascii")).toBe(true);
  });

  it("returns true for 'csv'", () => {
    expect(isCopyFormat("csv")).toBe(true);
  });

  it("returns true for 'tsv'", () => {
    expect(isCopyFormat("tsv")).toBe(true);
  });

  it("returns true for 'plain'", () => {
    expect(isCopyFormat("plain")).toBe(true);
  });

  it("returns false for an unknown format string", () => {
    expect(isCopyFormat("html")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isCopyFormat("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isCopyFormat(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isCopyFormat(undefined)).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isCopyFormat(42)).toBe(false);
  });

  it("returns false for an object", () => {
    expect(isCopyFormat({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isMarkdownFormat (deprecated alias for isCopyFormat)
// ---------------------------------------------------------------------------

describe("isMarkdownFormat (deprecated alias)", () => {
  it("is the same reference as isCopyFormat", () => {
    expect(isMarkdownFormat).toBe(isCopyFormat);
  });

  it("returns true for valid format 'table'", () => {
    expect(isMarkdownFormat("table")).toBe(true);
  });

  it("returns false for invalid format", () => {
    expect(isMarkdownFormat("garbage")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// readStoredDefaultCopyFormat
// ---------------------------------------------------------------------------

describe("readStoredDefaultCopyFormat", () => {
  it("returns DEFAULT_COPY_FORMAT ('inline') when localStorage is empty", () => {
    expect(readStoredDefaultCopyFormat()).toBe(DEFAULT_COPY_FORMAT);
  });

  it("returns stored value 'inline' when set", () => {
    localStorage.setItem(DEFAULT_COPY_FORMAT_KEY, "inline");
    expect(readStoredDefaultCopyFormat()).toBe("inline");
  });

  it("returns stored value 'table' when set", () => {
    localStorage.setItem(DEFAULT_COPY_FORMAT_KEY, "table");
    expect(readStoredDefaultCopyFormat()).toBe("table");
  });

  it("returns stored value 'csv' when set", () => {
    localStorage.setItem(DEFAULT_COPY_FORMAT_KEY, "csv");
    expect(readStoredDefaultCopyFormat()).toBe("csv");
  });

  it("returns stored value 'tsv' when set", () => {
    localStorage.setItem(DEFAULT_COPY_FORMAT_KEY, "tsv");
    expect(readStoredDefaultCopyFormat()).toBe("tsv");
  });

  it("returns stored value 'ascii' when set", () => {
    localStorage.setItem(DEFAULT_COPY_FORMAT_KEY, "ascii");
    expect(readStoredDefaultCopyFormat()).toBe("ascii");
  });

  it("returns stored value 'title' when set", () => {
    localStorage.setItem(DEFAULT_COPY_FORMAT_KEY, "title");
    expect(readStoredDefaultCopyFormat()).toBe("title");
  });

  it("returns stored value 'plain' when set", () => {
    localStorage.setItem(DEFAULT_COPY_FORMAT_KEY, "plain");
    expect(readStoredDefaultCopyFormat()).toBe("plain");
  });

  it("returns DEFAULT_COPY_FORMAT when stored value is invalid", () => {
    localStorage.setItem(DEFAULT_COPY_FORMAT_KEY, "markdown");
    expect(readStoredDefaultCopyFormat()).toBe(DEFAULT_COPY_FORMAT);
  });

  it("returns DEFAULT_COPY_FORMAT when stored value is empty string", () => {
    localStorage.setItem(DEFAULT_COPY_FORMAT_KEY, "");
    expect(readStoredDefaultCopyFormat()).toBe(DEFAULT_COPY_FORMAT);
  });
});
