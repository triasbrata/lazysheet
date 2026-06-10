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
import type { AppSettings } from "@/lib/settings-pref";

export interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AppSettings;
  onChangeAskBeforeClose: (value: boolean) => void;
}

export function SettingsModal({
  open,
  onOpenChange,
  settings,
  onChangeAskBeforeClose,
}: SettingsModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="settings-modal">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div className="flex items-start gap-3">
            <Checkbox
              id="ask-before-close"
              checked={settings.askBeforeClose}
              onCheckedChange={(c) => onChangeAskBeforeClose(c === true)}
            />
            <label
              htmlFor="ask-before-close"
              className="flex flex-col gap-0.5 text-sm"
            >
              {t("settings.askBeforeClose")}
              <span className="text-xs text-muted-foreground">
                {t("settings.askBeforeCloseDesc")}
              </span>
            </label>
          </div>
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
