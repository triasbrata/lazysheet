import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoHistory } from "@/hooks/useUndoHistory";

function makeCmd(label = "cmd") {
  return {
    label,
    undo: vi.fn(),
    redo: vi.fn(),
  };
}

describe("useUndoHistory", () => {
  describe("initial state", () => {
    it("canUndo is false initially", () => {
      const { result } = renderHook(() => useUndoHistory());
      expect(result.current.canUndo).toBe(false);
    });

    it("canRedo is false initially", () => {
      const { result } = renderHook(() => useUndoHistory());
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe("push", () => {
    it("push makes canUndo true", () => {
      const { result } = renderHook(() => useUndoHistory());
      const cmd = makeCmd();

      act(() => {
        result.current.push(cmd);
      });

      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it("push after undo truncates redo branch (canRedo becomes false)", () => {
      const { result } = renderHook(() => useUndoHistory());
      const cmd1 = makeCmd("A");
      const cmd2 = makeCmd("B");

      act(() => {
        result.current.push(cmd1);
      });
      act(() => {
        result.current.undo();
      });
      expect(result.current.canRedo).toBe(true);

      act(() => {
        result.current.push(cmd2);
      });

      expect(result.current.canRedo).toBe(false);
      expect(result.current.canUndo).toBe(true);
    });
  });

  describe("undo", () => {
    it("push then undo calls cmd.undo() and canRedo becomes true", () => {
      const { result } = renderHook(() => useUndoHistory());
      const cmd = makeCmd();

      act(() => {
        result.current.push(cmd);
      });
      act(() => {
        result.current.undo();
      });

      expect(cmd.undo).toHaveBeenCalledOnce();
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(true);
    });

    it("undo on empty stack is a no-op (does not throw)", () => {
      const { result } = renderHook(() => useUndoHistory());

      expect(() => {
        act(() => {
          result.current.undo();
        });
      }).not.toThrow();

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it("ordering: push A, push B → undo calls B.undo then A.undo", () => {
      const { result } = renderHook(() => useUndoHistory());
      const cmdA = makeCmd("A");
      const cmdB = makeCmd("B");

      act(() => {
        result.current.push(cmdA);
        result.current.push(cmdB);
      });
      act(() => {
        result.current.undo();
      });
      expect(cmdB.undo).toHaveBeenCalledOnce();
      expect(cmdA.undo).not.toHaveBeenCalled();

      act(() => {
        result.current.undo();
      });
      expect(cmdA.undo).toHaveBeenCalledOnce();
    });
  });

  describe("redo", () => {
    it("redo after undo calls cmd.redo() and canUndo becomes true again", () => {
      const { result } = renderHook(() => useUndoHistory());
      const cmd = makeCmd();

      act(() => {
        result.current.push(cmd);
      });
      act(() => {
        result.current.undo();
      });
      act(() => {
        result.current.redo();
      });

      expect(cmd.redo).toHaveBeenCalledOnce();
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it("redo on empty stack is a no-op (does not throw)", () => {
      const { result } = renderHook(() => useUndoHistory());

      expect(() => {
        act(() => {
          result.current.redo();
        });
      }).not.toThrow();

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe("limit cap", () => {
    it("caps undo stack to the given limit, dropping oldest first", () => {
      const limit = 3;
      const { result } = renderHook(() => useUndoHistory(limit));

      const cmds = Array.from({ length: limit + 5 }, (_, i) => makeCmd(`cmd-${i}`));

      act(() => {
        for (const cmd of cmds) {
          result.current.push(cmd);
        }
      });

      // undo all — should only be able to undo `limit` times
      let undoCount = 0;
      while (result.current.canUndo) {
        act(() => {
          result.current.undo();
        });
        undoCount++;
        // safety: break if somehow more than cmds.length
        if (undoCount > cmds.length) break;
      }

      expect(undoCount).toBe(limit);
    });

    it("oldest commands are dropped when limit is exceeded", () => {
      const limit = 3;
      const { result } = renderHook(() => useUndoHistory(limit));

      // push limit+2 commands
      const cmds = Array.from({ length: limit + 2 }, (_, i) => makeCmd(`cmd-${i}`));
      act(() => {
        for (const cmd of cmds) {
          result.current.push(cmd);
        }
      });

      // undo all — oldest 2 should have been dropped
      act(() => { result.current.undo(); });
      act(() => { result.current.undo(); });
      act(() => { result.current.undo(); });

      // oldest (index 0 and 1) should never have been undone
      expect(cmds[0].undo).not.toHaveBeenCalled();
      expect(cmds[1].undo).not.toHaveBeenCalled();
      // last 3 (indices 2,3,4) should have been undone
      expect(cmds[4].undo).toHaveBeenCalled();
      expect(cmds[3].undo).toHaveBeenCalled();
      expect(cmds[2].undo).toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("clear resets canUndo and canRedo to false", () => {
      const { result } = renderHook(() => useUndoHistory());
      const cmd = makeCmd();

      act(() => {
        result.current.push(cmd);
      });
      expect(result.current.canUndo).toBe(true);

      act(() => {
        result.current.undo();
      });
      expect(result.current.canRedo).toBe(true);

      act(() => {
        result.current.clear();
      });

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it("clear on empty state is a no-op (does not throw)", () => {
      const { result } = renderHook(() => useUndoHistory());

      expect(() => {
        act(() => {
          result.current.clear();
        });
      }).not.toThrow();
    });
  });
});
