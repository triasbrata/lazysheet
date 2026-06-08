import { useCallback, useReducer, useRef } from "react";

export interface UndoCommand {
  label: string;
  undo: () => void;
  redo: () => void;
}

export interface UndoHistoryApi {
  canUndo: boolean;
  canRedo: boolean;
  push: (cmd: UndoCommand) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

export function useUndoHistory(limit = 200): UndoHistoryApi {
  const undoRef = useRef<UndoCommand[]>([]);
  const redoRef = useRef<UndoCommand[]>([]);
  // force re-render trigger without triggering side-effect re-runs
  const [, force] = useReducer((x: number) => x + 1, 0);

  const push = useCallback(
    (cmd: UndoCommand) => {
      let next = [...undoRef.current, cmd];
      if (next.length > limit) {
        next = next.slice(next.length - limit);
      }
      undoRef.current = next;
      redoRef.current = [];
      force();
    },
    [limit],
  );

  const undo = useCallback(() => {
    const stack = undoRef.current;
    if (stack.length === 0) return;
    const cmd = stack[stack.length - 1];
    // side effect runs outside any state updater — StrictMode safe
    cmd.undo();
    undoRef.current = stack.slice(0, -1);
    redoRef.current = [...redoRef.current, cmd];
    force();
  }, []);

  const redo = useCallback(() => {
    const stack = redoRef.current;
    if (stack.length === 0) return;
    const cmd = stack[stack.length - 1];
    // side effect runs outside any state updater — StrictMode safe
    cmd.redo();
    redoRef.current = stack.slice(0, -1);
    undoRef.current = [...undoRef.current, cmd];
    force();
  }, []);

  const clear = useCallback(() => {
    undoRef.current = [];
    redoRef.current = [];
    force();
  }, []);

  const canUndo = undoRef.current.length > 0;
  const canRedo = redoRef.current.length > 0;

  return { canUndo, canRedo, push, undo, redo, clear };
}
