import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./i18n";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
// Preload the primary Geist subset so it downloads at the highest priority,
// minimizing the fallback→Geist swap window. The autofit measurement waits for
// document.fonts.ready, so the sooner the real glyphs are available the smaller
// the layout shift (grid columns/rows resizing) on open and on header-mark.
import geistLatinUrl from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2";
import "./App.css";

{
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "font";
  link.type = "font/woff2";
  link.href = geistLatinUrl;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="lazysheet-theme">
      <TooltipProvider delayDuration={300}>
        <App />
        <Toaster position="bottom-right" closeButton />
      </TooltipProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
