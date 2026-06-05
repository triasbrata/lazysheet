import { useEffect, useRef } from "react";
import {
  isSupportedFile,
  onFilesOpened,
  onWebviewDragDrop,
  takePendingFiles,
} from "@/lib/tauri-api";

export function useFileEvents(onOpen: (path: string) => void): void {
  const onOpenRef = useRef(onOpen);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    const delivered = new Set<string>();

    function openFirstSupported(paths: string[], fromDrain: boolean) {
      const first = paths.find(isSupportedFile);
      if (!first) return;
      if (fromDrain && delivered.has(first)) return;
      delivered.add(first);
      onOpenRef.current(first);
    }

    let unlistenFiles: (() => void) | null = null;
    let unlistenDrop: (() => void) | null = null;
    let disposed = false;

    (async () => {
      // drain#1: deliver any files queued before mount
      const pending = await takePendingFiles();
      openFirstSupported(pending, true);

      unlistenFiles = await onFilesOpened((paths) =>
        openFirstSupported(paths, false),
      );
      if (disposed) {
        unlistenFiles();
        unlistenFiles = null;
      }

      unlistenDrop = await onWebviewDragDrop((paths) =>
        openFirstSupported(paths, false),
      );
      if (disposed) {
        unlistenDrop();
        unlistenDrop = null;
      }

      // drain#2: closes the race where a path is pushed+emitted between drain#1
      // and listener registration — the emit is lost but the path sits in
      // PendingFiles; drain#2 catches it. If the listener already delivered it,
      // the delivered-set drops the duplicate.
      const pending2 = await takePendingFiles();
      openFirstSupported(pending2, true);
    })();

    return () => {
      disposed = true;
      unlistenFiles?.();
      unlistenDrop?.();
    };
  }, []);
}
