import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./theme-provider";

/**
 * Task D: cover line 18 (the no-op setTheme in initialState).
 *
 * Line 18: `setTheme: () => null` is the default value in the createContext call.
 * It executes when useTheme() is consumed outside a ThemeProvider — useContext
 * returns the createContext default (initialState), which has the no-op setTheme.
 *
 * Line 65: `if (context === undefined) throw ...` is unreachable because
 * createContext with a non-undefined default never returns undefined from
 * useContext — TypeScript's typed generics aside, the runtime always returns
 * initialState. This guard is a dead-code safety net; we do NOT test it.
 */

// Consumer component that calls useTheme() and optionally invokes setTheme.
function ThemeConsumer({ callSetTheme }: { callSetTheme?: boolean }) {
  const { theme, setTheme } = useTheme();
  if (callSetTheme) {
    // Invoke the no-op setTheme from initialState (line 18)
    setTheme("dark");
  }
  return <div data-testid="theme">{theme}</div>;
}

describe("theme-provider", () => {
  it("ThemeProvider renders children and provides theme context", () => {
    const { getByTestId } = render(
      <ThemeProvider defaultTheme="light">
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(getByTestId("theme")).toBeInTheDocument();
  });

  it("useTheme outside ThemeProvider returns initialState with no-op setTheme (line 18)", () => {
    // Render without a ThemeProvider — useContext returns createContext default (initialState).
    // Calling setTheme on initialState executes line 18's arrow fn: () => null.
    // This must not throw.
    expect(() =>
      render(<ThemeConsumer callSetTheme />)
    ).not.toThrow();
  });

  it("initialState no-op setTheme returns null and does not crash (line 18)", () => {
    // Directly verify the no-op by calling useTheme() outside provider and
    // asserting that setTheme can be called without error.
    let capturedSetTheme: ((theme: "dark" | "light" | "system") => void) | null = null;

    function Capturer() {
      const { setTheme } = useTheme();
      capturedSetTheme = setTheme;
      return null;
    }

    render(<Capturer />);
    // capturedSetTheme is the initialState no-op (line 18)
    expect(capturedSetTheme).not.toBeNull();
    // Calling it executes line 18 — should return null silently
    expect(() => capturedSetTheme!("light")).not.toThrow();
  });

  // Line 65 (the undefined-context throw) is UNREACHABLE:
  // createContext always provides initialState as the default, so useContext
  // never returns undefined. This throw guard is dead code and is intentionally
  // left uncovered — forcing it would require hacks (monkeypatching useContext).
});
