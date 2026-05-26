import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./App.css";

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
