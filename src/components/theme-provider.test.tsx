import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
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

// Consumer with a button to trigger setTheme for new tests.
function ThemeConsumerWithButton({ id }: { id: string }) {
  const { setTheme } = useTheme();
  return (
    <button
      data-testid={`set-theme-${id}`}
      onClick={() => setTheme(id)}
    >
      set {id}
    </button>
  );
}

// Clean up documentElement and localStorage after each test so theme-applying tests don't leak.
afterEach(() => {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

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

  // -------------------------------------------------------------------------
  // New tests: preset application (class + data-theme on documentElement)
  // -------------------------------------------------------------------------

  it("defaultTheme='dark' applies .dark class to documentElement", () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setTheme('palenight') sets data-theme='palenight' and .dark class", () => {
    const { getByTestId } = render(
      <ThemeProvider defaultTheme="light">
        <ThemeConsumerWithButton id="palenight" />
      </ThemeProvider>
    );
    act(() => {
      getByTestId("set-theme-palenight").click();
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("palenight");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setTheme('light') removes data-theme attribute and .dark class", () => {
    const { getByTestId } = render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumerWithButton id="light" />
      </ThemeProvider>
    );
    act(() => {
      getByTestId("set-theme-light").click();
    });
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setTheme('lighter') sets data-theme='lighter' and no .dark class", () => {
    const { getByTestId } = render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumerWithButton id="lighter" />
      </ThemeProvider>
    );
    act(() => {
      getByTestId("set-theme-lighter").click();
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("lighter");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("system theme: triggers live matchMedia change handler (lines 57-72)", async () => {
    // Capture the "change" event listener registered by the effect.
    // The effect calls window.matchMedia twice: once in the guard check (line 62)
    // and once to get the mq object (line 67). We use a single stub for both calls.
    let captured: ((e?: any) => void) | null = null;
    const mqStub = {
      matches: false,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener(_type: string, cb: (e?: any) => void) {
        captured = cb;
      },
      removeEventListener() {},
      dispatchEvent: () => false,
    };
    const spy = vi.spyOn(window, "matchMedia").mockReturnValue(mqStub as any);

    try {
      // Wrap the render in act to ensure all effects (including useEffect) flush
      await act(async () => {
        render(
          <ThemeProvider defaultTheme="system">
            <ThemeConsumer />
          </ThemeProvider>
        );
      });

      // The effect should have registered the handler by now
      expect(captured).not.toBeNull();

      // Fire the handler — this exercises the applyTheme("system") body (line 68)
      await act(async () => { captured?.(); });

      // documentElement should have a base class set by applyTheme
      const hasDarkOrLight =
        document.documentElement.classList.contains("dark") ||
        document.documentElement.classList.contains("light");
      expect(hasDarkOrLight).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("system theme: defensive early-return when addEventListener is not a function (line 65)", () => {
    // Provide a matchMedia stub whose addEventListener is undefined so the
    // guard at line 65 triggers and the effect returns early (no throw).
    const mqStubNoListener = {
      matches: false,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener: undefined,
      removeEventListener() {},
      dispatchEvent: () => false,
    };
    const spy = vi.spyOn(window, "matchMedia").mockReturnValue(mqStubNoListener as any);

    try {
      expect(() =>
        render(
          <ThemeProvider defaultTheme="system">
            <ThemeConsumer />
          </ThemeProvider>
        )
      ).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});
