import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import type { CopyFormat } from "@/lib/markdown-export";
import type { QueryKind } from "@/lib/sql-copy";

const QUERY_KINDS: { kind: QueryKind; label: string }[] = [
  { kind: "insert", label: "INSERT" },
  { kind: "update", label: "UPDATE" },
  { kind: "upsert", label: "UPSERT" },
];

// Store translation keys; labels are resolved via t() at render time.
// The fmt VALUE strings are identifiers used for copy logic / default-format
// persistence and must remain unchanged.
const MARKDOWN_FORMATS: { fmt: CopyFormat; labelKey: string }[] = [
  { fmt: "inline", labelKey: "contextMenu.fmtInline" },
  { fmt: "title", labelKey: "contextMenu.fmtTitle" },
  { fmt: "table", labelKey: "contextMenu.fmtTable" },
];
const COPY_LEAVES: { fmt: CopyFormat; labelKey: string }[] = [
  { fmt: "csv", labelKey: "contextMenu.fmtCsv" },
  { fmt: "tsv", labelKey: "contextMenu.fmtTsv" },
  { fmt: "ascii", labelKey: "contextMenu.fmtAscii" },
  { fmt: "plain", labelKey: "contextMenu.fmtPlain" },
];

export type GridContextMenuTarget =
  | { type: "row"; row: number }
  | { type: "cell"; row: number; col: number }
  | { type: "col"; col: number }
  | null;

interface GridContextMenuContentProps {
  ctx: GridContextMenuTarget;
  headerRow: number | null;
  canCopy: boolean;
  canSummarize?: boolean;
  onMarkHeader: (row: number | null) => void;
  defaultCopyFormat?: CopyFormat;
  onCopyFormat?: (format: CopyFormat, setAsDefault: boolean) => void;
  onSetDefaultFormat?: (format: CopyFormat) => void;
  onSummarize?: () => void;
  // Resize-related
  hasColOverride?: boolean;
  hasRowOverride?: boolean;
  hasAnyOverride?: boolean;
  onResetColWidth?: () => void;
  onResetRowHeight?: () => void;
  onResetAllDimensions?: () => void;
  // Autofit + manual-input. Labels surface multi-target count when caller
  // signals a range selection (e.g. "Autofit 5 columns").
  multiColCount?: number;
  multiRowCount?: number;
  onAutofitCol?: () => void;
  onAutofitRow?: () => void;
  onOpenColWidthDialog?: () => void;
  onOpenRowHeightDialog?: () => void;
  canCopyFormula: boolean;
  onCopyFormula: () => void;
  canCopyQuery?: boolean;
  onCopyQuery?: (kind: QueryKind) => void;
}

export function GridContextMenuContent({
  ctx,
  headerRow,
  canCopy,
  canSummarize,
  onMarkHeader,
  defaultCopyFormat,
  onCopyFormat,
  onSetDefaultFormat,
  onSummarize,
  hasColOverride,
  hasRowOverride,
  hasAnyOverride,
  onResetColWidth,
  onResetRowHeight,
  onResetAllDimensions,
  multiColCount,
  multiRowCount,
  onAutofitCol,
  onAutofitRow,
  onOpenColWidthDialog,
  onOpenRowHeightDialog,
  canCopyFormula,
  onCopyFormula,
  canCopyQuery,
  onCopyQuery,
}: GridContextMenuContentProps) {
  const { t } = useTranslation();

  // Tracks whether the pointer that triggered onSelect held Cmd/Ctrl. Radix's
  // onSelect event does not expose modifier keys, so we stash it on pointerdown.
  const modRef = useRef(false);
  // Set when the pointer landed on the star, so onSelect sets-default-only and
  // keeps the menu open instead of copying.
  const starRef = useRef(false);

  if (!ctx) return null;

  if (ctx.type === "col") {
    const colLabel =
      multiColCount && multiColCount > 1
        ? t("contextMenu.autofitColumnsMulti", { count: multiColCount })
        : t("contextMenu.autofitColumnWidth");
    return (
      <ContextMenuContent data-testid="context-menu">
        {onAutofitCol && (
          <ContextMenuItem onSelect={() => onAutofitCol()}>
            {colLabel}
          </ContextMenuItem>
        )}
        {onOpenColWidthDialog && (
          <ContextMenuItem onSelect={() => onOpenColWidthDialog()}>
            {t("contextMenu.columnWidth")}
          </ContextMenuItem>
        )}
        {(onAutofitCol || onOpenColWidthDialog) && <ContextMenuSeparator />}
        <ContextMenuItem
          disabled={!hasColOverride || !onResetColWidth}
          onSelect={() => onResetColWidth?.()}
        >
          {t("contextMenu.resetWidth")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={!hasAnyOverride || !onResetAllDimensions}
          onSelect={() => onResetAllDimensions?.()}
        >
          {t("contextMenu.resetAllDimensions")}
        </ContextMenuItem>
      </ContextMenuContent>
    );
  }

  const isRow = ctx.type === "row";
  const isHeader = isRow && headerRow === ctx.row;
  const rowLabel =
    multiRowCount && multiRowCount > 1
      ? t("contextMenu.autofitRowsMulti", { count: multiRowCount })
      : t("contextMenu.autofitRowHeight");

  function renderCopyItem(fmt: CopyFormat, label: string) {
    const isDefault = defaultCopyFormat === fmt;
    return (
      <ContextMenuItem
        key={fmt}
        data-testid={`ctx-copy-${fmt}`}
        title={t("contextMenu.copyHint")}
        onPointerDown={(e) => {
          modRef.current = e.metaKey || e.ctrlKey;
        }}
        onKeyDown={(e) => {
          // Keyboard select never sets default and never hits the star.
          if (e.key === "Enter" || e.key === " ") {
            modRef.current = false;
            starRef.current = false;
          }
        }}
        onSelect={(e) => {
          if (starRef.current) {
            // Star clicked → set default only, keep menu open.
            starRef.current = false;
            modRef.current = false;
            e.preventDefault();
            onSetDefaultFormat?.(fmt);
            return;
          }
          const setAsDefault = modRef.current;
          modRef.current = false;
          onCopyFormat?.(fmt, setAsDefault);
        }}
      >
        {label}
        <span
          role="button"
          aria-label={
            isDefault
              ? t("contextMenu.isDefaultFormat", { label })
              : t("contextMenu.setAsDefaultFormat", { label })
          }
          title={isDefault ? t("contextMenu.defaultCopyFormat") : t("contextMenu.setAsDefault")}
          onPointerDown={() => {
            starRef.current = true;
          }}
          className={`ml-auto inline-flex items-center ${
            isDefault
              ? "text-foreground"
              : "text-muted-foreground/40 hover:text-foreground"
          }`}
        >
          <Star
            className={`size-3 ${isDefault ? "fill-current" : ""}`}
          />
        </span>
      </ContextMenuItem>
    );
  }

  return (
    <ContextMenuContent data-testid="context-menu">
      {isRow && (
        <ContextMenuItem
          data-testid="ctx-mark-header"
          onSelect={() => onMarkHeader(isHeader ? null : ctx.row)}
        >
          {isHeader ? t("contextMenu.unmarkAsHeader") : t("contextMenu.markAsHeader")}
        </ContextMenuItem>
      )}
      {isRow && canCopy && <ContextMenuSeparator />}
      {ctx.type === "cell" && canCopyFormula && (
        <>
          <ContextMenuItem onSelect={onCopyFormula}>
            {t("contextMenu.copyFunction")}
            <ContextMenuShortcut>⌘⇧C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      {ctx.type === "cell" && canSummarize && onSummarize && (
        <>
          <ContextMenuItem data-testid="ctx-summarize" onSelect={() => onSummarize()}>
            {t("contextMenu.summarizeRange")}
          </ContextMenuItem>
          {canCopy && <ContextMenuSeparator />}
        </>
      )}
      {canCopy && (
        <ContextMenuSub>
          <ContextMenuSubTrigger data-testid="ctx-copy">{t("contextMenu.copy")}</ContextMenuSubTrigger>
          <ContextMenuSubContent
            // Capture-phase reset: runs before any item's bubble-phase
            // onPointerDown, so a stale star press (released off-item) can never
            // leak into a later row click.
            onPointerDownCapture={() => {
              starRef.current = false;
            }}
          >
            <ContextMenuSub>
              <ContextMenuSubTrigger data-testid="ctx-copy-markdown">{t("contextMenu.markdown")}</ContextMenuSubTrigger>
              <ContextMenuSubContent
                onPointerDownCapture={() => {
                  starRef.current = false;
                }}
              >
                {MARKDOWN_FORMATS.map(({ fmt, labelKey }) =>
                  renderCopyItem(fmt, t(labelKey))
                )}
              </ContextMenuSubContent>
            </ContextMenuSub>
            {COPY_LEAVES.map(({ fmt, labelKey }) => renderCopyItem(fmt, t(labelKey)))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      {canCopyQuery && onCopyQuery && (
        <ContextMenuSub>
          <ContextMenuSubTrigger data-testid="ctx-copy-query">Copy as Query</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {QUERY_KINDS.map(({ kind, label }) => (
              <ContextMenuItem key={kind} data-testid={`ctx-query-${kind}`} onSelect={() => onCopyQuery(kind)}>
                {label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}

      {/* Cell-context resize submenu — operates on the clicked cell's col/row. */}
      {ctx.type === "cell" &&
        (onAutofitCol ||
          onAutofitRow ||
          onOpenColWidthDialog ||
          onOpenRowHeightDialog) && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger data-testid="ctx-resize">{t("contextMenu.resize")}</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {onAutofitCol && (
                  <ContextMenuItem onSelect={() => onAutofitCol()}>
                    {t("contextMenu.autofitColumnWidth")}
                  </ContextMenuItem>
                )}
                {onAutofitRow && (
                  <ContextMenuItem onSelect={() => onAutofitRow()}>
                    {t("contextMenu.autofitRowHeight")}
                  </ContextMenuItem>
                )}
                {(onAutofitCol || onAutofitRow) &&
                  (onOpenColWidthDialog || onOpenRowHeightDialog) && (
                    <ContextMenuSeparator />
                  )}
                {onOpenColWidthDialog && (
                  <ContextMenuItem data-testid="ctx-col-width" onSelect={() => onOpenColWidthDialog()}>
                    {t("contextMenu.columnWidth")}
                  </ContextMenuItem>
                )}
                {onOpenRowHeightDialog && (
                  <ContextMenuItem onSelect={() => onOpenRowHeightDialog()}>
                    {t("contextMenu.rowHeight")}
                  </ContextMenuItem>
                )}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}

      {isRow && (
        <>
          <ContextMenuSeparator />
          {onAutofitRow && (
            <ContextMenuItem onSelect={() => onAutofitRow()}>
              {rowLabel}
            </ContextMenuItem>
          )}
          {onOpenRowHeightDialog && (
            <ContextMenuItem onSelect={() => onOpenRowHeightDialog()}>
              {t("contextMenu.rowHeight")}
            </ContextMenuItem>
          )}
          {(onAutofitRow || onOpenRowHeightDialog) && <ContextMenuSeparator />}
          <ContextMenuItem
            disabled={!hasRowOverride || !onResetRowHeight}
            onSelect={() => onResetRowHeight?.()}
          >
            {t("contextMenu.resetHeight")}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!hasAnyOverride || !onResetAllDimensions}
            onSelect={() => onResetAllDimensions?.()}
          >
            {t("contextMenu.resetAllDimensions")}
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}
