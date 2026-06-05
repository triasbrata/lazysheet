import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import testI18n from "./i18n-test";

export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={testI18n}>
      <ThemeProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}

function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export { renderWithProviders };
