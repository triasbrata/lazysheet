import { Check, Palette } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import { THEME_PRESETS, getPreset } from "@/lib/themes";

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  // Resolve the light/dark default presets for swatch use
  const lightPreset = getPreset("light")!;
  const darkPreset = getPreset("dark")!;

  const defaultItems = [
    { id: "light",  label: t("theme.light"),  swatch: lightPreset.swatch },
    { id: "dark",   label: t("theme.dark"),   swatch: darkPreset.swatch },
    { id: "system", label: t("theme.system"), swatch: lightPreset.swatch },
  ];

  const palettePresets = THEME_PRESETS.filter((p) => p.palette);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          data-testid="theme-toggle-btn"
          aria-label={t("theme.customize")}
        >
          <Palette className="h-3.5 w-3.5" />
          <span className="sr-only">{t("theme.customize")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto">
        {defaultItems.map(({ id, label, swatch }) => (
          <DropdownMenuItem
            key={id}
            data-testid={`theme-item-${id}`}
            onClick={() => setTheme(id)}
          >
            <span
              className="mr-2 inline-block h-3 w-3 rounded-full border"
              style={{ backgroundColor: swatch }}
            />
            {label}
            {theme === id && <Check className="ml-auto h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("theme.customize")}</DropdownMenuLabel>

        {palettePresets.map((preset) => (
          <DropdownMenuItem
            key={preset.id}
            data-testid={`theme-item-${preset.id}`}
            onClick={() => setTheme(preset.id)}
          >
            <span
              className="mr-2 inline-block h-3 w-3 rounded-full border"
              style={{ backgroundColor: preset.swatch }}
            />
            {preset.name}
            {theme === preset.id && <Check className="ml-auto h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
