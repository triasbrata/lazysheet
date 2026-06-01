import { toast } from "sonner";
import type { CellModel } from "./types";

export function getCellFormula(cell: CellModel | undefined): string | null {
  return cell?.f ?? null;
}

export async function copyFormula(formula: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(formula);
    toast.success("Copied formula");
    return true;
  } catch (e) {
    toast.error("Copy failed", { description: String(e) });
    return false;
  }
}
