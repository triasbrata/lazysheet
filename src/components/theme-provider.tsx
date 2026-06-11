import { createContext, useContext, useEffect, useState } from "react";
import {
  type ThemeSelection,
  DEFAULT_SELECTION,
  STORAGE_KEY,
  resolveBase,
} from "@/lib/themes";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: ThemeSelection;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: ThemeSelection;
  setTheme: (theme: ThemeSelection) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function applyTheme(selection: ThemeSelection) {
  const root = document.documentElement;
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false;
  const preset = resolveBase(selection, prefersDark);
  root.classList.remove("light", "dark");
  root.removeAttribute("data-theme");
  root.classList.add(preset.base);
  if (preset.palette) {
    root.setAttribute("data-theme", preset.id);
  }
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_SELECTION,
  storageKey = STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeSelection>(
    () => (localStorage.getItem(storageKey) as ThemeSelection) || defaultTheme,
  );

  // Apply theme whenever selection changes.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // When "system" is active, follow live OS preference changes.
  useEffect(() => {
    if (theme !== "system") return;
    if (
      typeof window === "undefined" ||
      !window.matchMedia ||
      typeof window.matchMedia("(prefers-color-scheme: dark)").addEventListener !==
        "function"
    ) {
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => {
      mq.removeEventListener("change", handler);
    };
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: ThemeSelection) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
