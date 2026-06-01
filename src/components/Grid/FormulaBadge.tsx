import { useState } from "react";
import { Copy } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { copyFormula } from "@/lib/formula-copy";

interface FormulaBadgeProps {
  formula: string;
}

export function FormulaBadge({ formula }: FormulaBadgeProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Show formula"
          onPointerDown={(e) => { e.stopPropagation(); }}
          onClick={(e) => { e.stopPropagation(); }}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 0,
            height: 0,
            padding: 0,
            border: "none",
            background: "transparent",
            // Render a right-triangle in the top-right corner via CSS borders:
            // top border (blue, 12px) + right border (blue, 12px) form a ◥ shape.
            borderTop: "12px solid #3b82f6",
            borderLeft: "12px solid transparent",
            cursor: "pointer",
            lineHeight: 0,
            fontSize: 0,
            outline: "none",
            zIndex: 1,
          }}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto max-w-xs p-2"
        onPointerDown={(e) => { e.stopPropagation(); }}
        onClick={(e) => { e.stopPropagation(); }}
      >
        <code
          className="block text-xs font-mono break-all whitespace-pre-wrap text-foreground"
        >
          {formula}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 w-full"
          onPointerDown={(e) => { e.stopPropagation(); }}
          onClick={async (e) => {
            e.stopPropagation();
            await copyFormula(formula);
            setOpen(false);
          }}
        >
          <Copy className="mr-1 size-3" />
          Copy
        </Button>
      </PopoverContent>
    </Popover>
  );
}
