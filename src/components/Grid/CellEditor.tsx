import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface CellEditorProps {
  initialText: string;
  left: number;
  top: number;
  width: number;
  height: number;
  onCommit(raw: string, nav: "down" | "right" | "none"): void;
  onCancel(): void;
}

export function CellEditor({
  initialText,
  left,
  top,
  width,
  height,
  onCommit,
  onCancel,
}: CellEditorProps): React.JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initialText);

  useEffect(() => {
    queueMicrotask(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        el.select();
      }
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onCommit(value, "down");
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      onCommit(value, "right");
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }

    // Shift+Enter: stopPropagation already called, allow newline naturally
  };

  return (
    <textarea
      data-testid="cell-editor"
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onCommit(value, "none")}
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        zIndex: 30,
        fontFamily: "inherit",
        fontSize: "inherit",
        lineHeight: "inherit",
      }}
      className={cn(
        "resize-none",
        "px-1 py-0.5",
        "border-2 border-primary",
        "bg-background text-foreground",
        "outline-none",
        "overflow-hidden",
      )}
    />
  );
}
