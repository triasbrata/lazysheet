import { useEffect } from "react";
import {
  isSupportedFile,
  onFilesOpened,
  onWebviewDragDrop,
  takePendingFiles,
} from "@/lib/tauri-api";

export function useFileEvents(onOpen: (path: string) => void) {
  useEffect(() => {
    let unlistenFiles: (() => void) | null = null;
    let unlistenDrop: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      const pending = await takePendingFiles();
      if (!cancelled && pending.length > 0) {
        const first = pending.find(isSupportedFile);
        if (first) onOpen(first);
      }

      unlistenFiles = await onFilesOpened((paths) => {
        const first = paths.find(isSupportedFile);
        if (first) onOpen(first);
      });

      unlistenDrop = await onWebviewDragDrop((paths) => {
        const first = paths.find(isSupportedFile);
        if (first) onOpen(first);
      });
    })();

    return () => {
      cancelled = true;
      unlistenFiles?.();
      unlistenDrop?.();
    };
  }, [onOpen]);
}
