import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppSettings } from "@/lib/settings-pref";
import { DEFAULT_SETTINGS, readStoredSettings, writeStoredSettings } from "@/lib/settings-pref";

export interface UseSettingsApi {
  settings: AppSettings;
  setAskBeforeClose: (value: boolean) => void;
}

export function useSettings(): UseSettingsApi {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let alive = true;
    readStoredSettings().then(s => {
      if (alive) setSettings(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setAskBeforeClose = useCallback((value: boolean) => {
    setSettings(prev => {
      const next = { ...prev, askBeforeClose: value };
      void writeStoredSettings(next);
      return next;
    });
  }, []);

  return useMemo(() => ({ settings, setAskBeforeClose }), [settings, setAskBeforeClose]);
}
