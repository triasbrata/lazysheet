import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { OsPlatform } from "@/lib/platform";

export interface WindowControlsProps {
  platform: OsPlatform;
}

export function WindowControls({ platform }: WindowControlsProps) {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (platform === "macos") return;

    const w = getCurrentWindow();
    w.isMaximized().then(setIsMaximized);

    const unlistenPromise = w.onResized(() => {
      w.isMaximized().then(setIsMaximized);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [platform]);

  if (platform === "macos") return null;

  const handleMinimize = () => getCurrentWindow().minimize();
  const handleToggleMaximize = () => getCurrentWindow().toggleMaximize();
  const handleClose = () => getCurrentWindow().close();

  if (platform === "windows") {
    return (
      <div
        data-testid="window-controls"
        className="flex self-stretch"
      >
        <button
          type="button"
          data-testid="window-minimize"
          title={t("titlebar.minimize")}
          onClick={handleMinimize}
          className="flex h-full w-11 items-center justify-center hover:bg-accent"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          data-testid="window-maximize"
          title={isMaximized ? t("titlebar.restore") : t("titlebar.maximize")}
          onClick={handleToggleMaximize}
          className="flex h-full w-11 items-center justify-center hover:bg-accent"
        >
          {isMaximized ? (
            <Copy className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          data-testid="window-close"
          title={t("titlebar.closeWindow")}
          onClick={handleClose}
          className="flex h-full w-11 items-center justify-center hover:bg-red-600 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Linux variant: circular buttons
  return (
    <div
      data-testid="window-controls"
      className="flex items-center self-stretch gap-2 px-2"
    >
      <button
        type="button"
        data-testid="window-minimize"
        title={t("titlebar.minimize")}
        onClick={handleMinimize}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-muted hover:bg-accent"
      >
        <Minus className="h-3 w-3" />
      </button>
      <button
        type="button"
        data-testid="window-maximize"
        title={isMaximized ? t("titlebar.restore") : t("titlebar.maximize")}
        onClick={handleToggleMaximize}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-muted hover:bg-accent"
      >
        {isMaximized ? (
          <Copy className="h-3 w-3" />
        ) : (
          <Square className="h-3 w-3" />
        )}
      </button>
      <button
        type="button"
        data-testid="window-close"
        title={t("titlebar.closeWindow")}
        onClick={handleClose}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-muted hover:bg-red-600 hover:text-white"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
