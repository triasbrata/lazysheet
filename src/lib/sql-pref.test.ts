import { describe, it, expect, beforeEach } from "vitest";

import {
  SQL_DIALECT_KEY,
  SQL_TABLE_NAME_PREFIX,
  SQL_KEY_COLS_PREFIX,
  DEFAULT_SQL_DIALECT,
  isSqlDialect,
  readStoredDialect,
  writeStoredDialect,
  readStoredTableName,
  writeStoredTableName,
  readStoredKeyCols,
  writeStoredKeyCols,
  stripExt,
  sanitizeTableName,
} from "@/lib/sql-pref";

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("SQL_DIALECT_KEY is the expected string", () => {
    expect(SQL_DIALECT_KEY).toBe("lazysheet:sql-dialect");
  });

  it("SQL_TABLE_NAME_PREFIX is the expected string", () => {
    expect(SQL_TABLE_NAME_PREFIX).toBe("lazysheet:sql-table:");
  });

  it("SQL_KEY_COLS_PREFIX is the expected string", () => {
    expect(SQL_KEY_COLS_PREFIX).toBe("lazysheet:sql-keys:");
  });

  it("DEFAULT_SQL_DIALECT is 'mysql'", () => {
    expect(DEFAULT_SQL_DIALECT).toBe("mysql");
  });
});

// ---------------------------------------------------------------------------
// isSqlDialect
// ---------------------------------------------------------------------------

describe("isSqlDialect", () => {
  it("returns true for 'mysql'", () => {
    expect(isSqlDialect("mysql")).toBe(true);
  });

  it("returns true for 'postgres'", () => {
    expect(isSqlDialect("postgres")).toBe(true);
  });

  it("returns true for 'sqlite'", () => {
    expect(isSqlDialect("sqlite")).toBe(true);
  });

  it("returns true for 'ansi'", () => {
    expect(isSqlDialect("ansi")).toBe(true);
  });

  it("returns false for an unknown string", () => {
    expect(isSqlDialect("mssql")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isSqlDialect("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isSqlDialect(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isSqlDialect(undefined)).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isSqlDialect(42)).toBe(false);
  });

  it("returns false for an object", () => {
    expect(isSqlDialect({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// readStoredDialect / writeStoredDialect
// ---------------------------------------------------------------------------

describe("readStoredDialect", () => {
  it("returns DEFAULT_SQL_DIALECT when localStorage is empty", () => {
    expect(readStoredDialect()).toBe(DEFAULT_SQL_DIALECT);
  });

  it("returns stored value when a valid dialect is stored", () => {
    localStorage.setItem(SQL_DIALECT_KEY, "postgres");
    expect(readStoredDialect()).toBe("postgres");
  });

  it("returns DEFAULT_SQL_DIALECT when stored value is invalid", () => {
    localStorage.setItem(SQL_DIALECT_KEY, "oracle");
    expect(readStoredDialect()).toBe(DEFAULT_SQL_DIALECT);
  });
});

describe("writeStoredDialect → readStoredDialect round-trip", () => {
  it("persists 'mysql'", () => {
    writeStoredDialect("mysql");
    expect(readStoredDialect()).toBe("mysql");
  });

  it("persists 'postgres'", () => {
    writeStoredDialect("postgres");
    expect(readStoredDialect()).toBe("postgres");
  });

  it("persists 'sqlite'", () => {
    writeStoredDialect("sqlite");
    expect(readStoredDialect()).toBe("sqlite");
  });

  it("persists 'ansi'", () => {
    writeStoredDialect("ansi");
    expect(readStoredDialect()).toBe("ansi");
  });

  it("overwrites a previous value", () => {
    writeStoredDialect("mysql");
    writeStoredDialect("sqlite");
    expect(readStoredDialect()).toBe("sqlite");
  });
});

// ---------------------------------------------------------------------------
// readStoredTableName / writeStoredTableName
// ---------------------------------------------------------------------------

describe("readStoredTableName", () => {
  it("returns null when nothing stored for that key", () => {
    expect(readStoredTableName("file.csv", "Sheet1")).toBeNull();
  });

  it("returns stored table name after write", () => {
    writeStoredTableName("file.csv", "Sheet1", "my_table");
    expect(readStoredTableName("file.csv", "Sheet1")).toBe("my_table");
  });

  it("uses separate keys per (file, sheet) — different sheet returns null", () => {
    writeStoredTableName("file.csv", "Sheet1", "table_a");
    expect(readStoredTableName("file.csv", "Sheet2")).toBeNull();
  });

  it("uses separate keys per file — different file returns null", () => {
    writeStoredTableName("file.csv", "Sheet1", "table_a");
    expect(readStoredTableName("other.xlsx", "Sheet1")).toBeNull();
  });

  it("round-trip overwrites previous value", () => {
    writeStoredTableName("file.csv", "Sheet1", "old_name");
    writeStoredTableName("file.csv", "Sheet1", "new_name");
    expect(readStoredTableName("file.csv", "Sheet1")).toBe("new_name");
  });
});

// ---------------------------------------------------------------------------
// readStoredKeyCols / writeStoredKeyCols
// ---------------------------------------------------------------------------

describe("readStoredKeyCols", () => {
  it("returns null when nothing stored", () => {
    expect(readStoredKeyCols("file.csv", "Sheet1", "update")).toBeNull();
  });

  it("returns stored array after write for 'update'", () => {
    writeStoredKeyCols("file.csv", "Sheet1", "update", [0, 2]);
    expect(readStoredKeyCols("file.csv", "Sheet1", "update")).toEqual([0, 2]);
  });

  it("returns stored array after write for 'upsert'", () => {
    writeStoredKeyCols("file.csv", "Sheet1", "upsert", [1]);
    expect(readStoredKeyCols("file.csv", "Sheet1", "upsert")).toEqual([1]);
  });

  it("uses separate keys per kind — 'insert' key is independent", () => {
    writeStoredKeyCols("file.csv", "Sheet1", "update", [0]);
    expect(readStoredKeyCols("file.csv", "Sheet1", "insert")).toBeNull();
  });

  it("returns null when stored value is corrupt JSON", () => {
    localStorage.setItem(
      SQL_KEY_COLS_PREFIX + "file.csv::Sheet1::update",
      "not-json",
    );
    expect(readStoredKeyCols("file.csv", "Sheet1", "update")).toBeNull();
  });

  it("returns null when stored value is valid JSON but not an array of numbers", () => {
    localStorage.setItem(
      SQL_KEY_COLS_PREFIX + "file.csv::Sheet1::update",
      JSON.stringify(["a", "b"]),
    );
    expect(readStoredKeyCols("file.csv", "Sheet1", "update")).toBeNull();
  });

  it("returns null when stored value is an object (not array)", () => {
    localStorage.setItem(
      SQL_KEY_COLS_PREFIX + "file.csv::Sheet1::update",
      JSON.stringify({ a: 1 }),
    );
    expect(readStoredKeyCols("file.csv", "Sheet1", "update")).toBeNull();
  });

  it("handles empty array round-trip", () => {
    writeStoredKeyCols("file.csv", "Sheet1", "upsert", []);
    expect(readStoredKeyCols("file.csv", "Sheet1", "upsert")).toEqual([]);
  });

  it("overwrites previous value", () => {
    writeStoredKeyCols("file.csv", "Sheet1", "update", [0]);
    writeStoredKeyCols("file.csv", "Sheet1", "update", [0, 3, 5]);
    expect(readStoredKeyCols("file.csv", "Sheet1", "update")).toEqual([0, 3, 5]);
  });
});

// ---------------------------------------------------------------------------
// stripExt
// ---------------------------------------------------------------------------

describe("stripExt", () => {
  it('"a.csv" → "a"', () => {
    expect(stripExt("a.csv")).toBe("a");
  });

  it('"a.b.xlsx" → "a.b"', () => {
    expect(stripExt("a.b.xlsx")).toBe("a.b");
  });

  it('"noext" → "noext"', () => {
    expect(stripExt("noext")).toBe("noext");
  });

  it('".hidden" → ".hidden" (dot at position 0 is not treated as separator)', () => {
    expect(stripExt(".hidden")).toBe(".hidden");
  });

  it('"data.xlsx" → "data"', () => {
    expect(stripExt("data.xlsx")).toBe("data");
  });

  it('"my.data.csv" → "my.data"', () => {
    expect(stripExt("my.data.csv")).toBe("my.data");
  });

  it('empty string → empty string', () => {
    expect(stripExt("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// sanitizeTableName
// ---------------------------------------------------------------------------

describe("sanitizeTableName", () => {
  it('spaces become underscores: "my data" → "my_data"', () => {
    expect(sanitizeTableName("my data")).toBe("my_data");
  });

  it('leading digit gets "t_" prefix: "123" → "t_123"', () => {
    expect(sanitizeTableName("123")).toBe("t_123");
  });

  it('consecutive underscores collapsed: "a__b" → "a_b"', () => {
    expect(sanitizeTableName("a__b")).toBe("a_b");
  });

  it('empty string → "t_"', () => {
    expect(sanitizeTableName("")).toBe("t_");
  });

  it("illegal chars stripped/replaced", () => {
    expect(sanitizeTableName("foo-bar!baz")).toBe("foo_bar_baz");
  });

  it("leading/trailing underscores stripped", () => {
    expect(sanitizeTableName("_foo_")).toBe("foo");
  });

  it("already-valid identifier is unchanged", () => {
    expect(sanitizeTableName("valid_name")).toBe("valid_name");
  });

  it("trims whitespace before processing", () => {
    expect(sanitizeTableName("  my_table  ")).toBe("my_table");
  });

  it('leading digit with letters: "1abc" → "t_1abc"', () => {
    expect(sanitizeTableName("1abc")).toBe("t_1abc");
  });

  it("only special chars → t_", () => {
    // all special chars become '_', collapsed then stripped → '' → 't_'
    expect(sanitizeTableName("!!!")).toBe("t_");
  });

  it("mixed valid and invalid chars", () => {
    expect(sanitizeTableName("my-table 2024")).toBe("my_table_2024");
  });
});
