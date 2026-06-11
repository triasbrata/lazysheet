import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/components/theme-provider";
import { THEME_PRESETS, getPreset } from "@/lib/themes";
import type { AppSettings } from "@/lib/settings-pref";
import { SUPPORTED_LANGUAGES } from "@/i18n/languages";

function SettingRow({
  title,
  description,
  control,
  htmlFor,
}: {
  title: string;
  description: string;
  control: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-sm font-medium">
            {title}
          </label>
        ) : (
          <span className="text-sm font-medium">{title}</span>
        )}
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AppSettings;
  onChangeAskBeforeClose: (value: boolean) => void;
  onChangeDisableRunningText: (value: boolean) => void;
}

export function SettingsModal({
  open,
  onOpenChange,
  settings,
  onChangeAskBeforeClose,
  onChangeDisableRunningText,
}: SettingsModalProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  const palettePresets = THEME_PRESETS.filter((p) => p.palette);
  const currentLangCode = i18n.language.split("-")[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="settings-modal" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
        </DialogHeader>

        <div className="divide-y divide-border py-2">
          <SettingRow
            htmlFor="ask-before-close"
            title={t("settings.askBeforeClose")}
            description={t("settings.askBeforeCloseDesc")}
            control={
              <Checkbox
                id="ask-before-close"
                checked={settings.askBeforeClose}
                onCheckedChange={(c) => onChangeAskBeforeClose(c === true)}
              />
            }
          />

          <SettingRow
            title={t("settings.theme")}
            description={t("settings.themeDesc")}
            control={
              <Select value={theme} onValueChange={(v) => setTheme(v)}>
                <SelectTrigger
                  data-testid="settings-theme-select"
                  className="w-44"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectGroup>
                    <SelectLabel>{t("settings.themeDefaultGroup")}</SelectLabel>
                    <SelectItem value="light" data-testid="theme-opt-light">
                      <span
                        className="mr-2 inline-block h-3 w-3 rounded-full border"
                        style={{ backgroundColor: getPreset("light")!.swatch }}
                      />
                      {t("theme.light")}
                    </SelectItem>
                    <SelectItem value="dark" data-testid="theme-opt-dark">
                      <span
                        className="mr-2 inline-block h-3 w-3 rounded-full border"
                        style={{ backgroundColor: getPreset("dark")!.swatch }}
                      />
                      {t("theme.dark")}
                    </SelectItem>
                    <SelectItem value="system" data-testid="theme-opt-system">
                      {t("theme.system")}
                    </SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>{t("theme.customize")}</SelectLabel>
                    {palettePresets.map((preset) => (
                      <SelectItem
                        key={preset.id}
                        value={preset.id}
                        data-testid={`theme-opt-${preset.id}`}
                      >
                        <span
                          className="mr-2 inline-block h-3 w-3 rounded-full border"
                          style={{ backgroundColor: preset.swatch }}
                        />
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            }
          />

          <SettingRow
            title={t("settings.language")}
            description={t("settings.languageDesc")}
            control={
              <Select
                value={currentLangCode}
                onValueChange={(v) => i18n.changeLanguage(v)}
              >
                <SelectTrigger
                  data-testid="settings-language-select"
                  className="w-44"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map(({ code, nativeLabel }) => (
                    <SelectItem
                      key={code}
                      value={code}
                      data-testid={"lang-opt-" + code}
                    >
                      {nativeLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />

          <SettingRow
            htmlFor="disable-running-text"
            title={t("settings.runningText")}
            description={t("settings.runningTextDesc")}
            control={
              <Checkbox
                id="disable-running-text"
                checked={settings.disableRunningText}
                onCheckedChange={(c) => onChangeDisableRunningText(c === true)}
              />
            }
          />
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            {t("settings.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
