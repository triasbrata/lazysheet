/**
 * Offscreen DOM text measurement for Excel-style autofit.
 *
 * Uses a single reused hidden div appended to document.body. Honors CSS
 * font, padding, line-height, wrap (pre-wrap) and per-cell style overrides.
 */

export interface MeasureOptions {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  paddingX?: number;
  paddingY?: number;
  lineHeight?: number | string;
  wrap?: boolean;
  maxWidth?: number;
}

export interface MeasuredSize {
  width: number;
  height: number;
}

// Must stay in sync with Cell.tsx baseStyle padding ("6px 10px" → X=2*10, Y=2*6).
const DEFAULT_PADDING_X = 20;
const DEFAULT_PADDING_Y = 12;
const DEFAULT_WRAP_LINE_HEIGHT = 1.35;
// Safety buffer to avoid edge-case ellipsis-truncation from sub-pixel
// rendering. 2px is below visual notice but covers float-rounding gaps.
const TEXT_SAFETY_BUFFER_PX = 2;

let measureEl: HTMLDivElement | null = null;
let fontsReadyPromise: Promise<void> | null = null;

function ensureMeasureEl(): HTMLDivElement {
  if (measureEl) return measureEl;
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.position = "absolute";
  el.style.left = "-9999px";
  el.style.top = "0";
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  el.style.boxSizing = "border-box";
  el.style.contain = "layout";
  document.body.appendChild(el);
  measureEl = el;
  return el;
}

function inheritedFontFamily(): string {
  if (typeof window === "undefined") return "sans-serif";
  return window.getComputedStyle(document.body).fontFamily || "sans-serif";
}

/**
 * Sample the actual computed font properties from a rendered cell DOM node.
 * Falls back to body when no cell node is present (initial empty sheet).
 *
 * The body's font-family is correct only AFTER `document.fonts.ready`
 * resolves — before that it may report the fallback family. Sampling from a
 * cell that's already in the layout tree is more reliable because the
 * browser has resolved its computed style against the actual loaded font.
 */
export function sampleCellFont(): {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
} {
  if (typeof window === "undefined") {
    return { fontFamily: "sans-serif", fontSize: 14, fontWeight: "400" };
  }
  const sample =
    document.querySelector<HTMLElement>("[data-r][data-c]") ?? document.body;
  const cs = window.getComputedStyle(sample);
  const fontFamily = cs.fontFamily || "sans-serif";
  const fontSize = parseFloat(cs.fontSize) || 14;
  const fontWeight = cs.fontWeight || "400";
  return { fontFamily, fontSize, fontWeight };
}

export function awaitFontsReady(): Promise<void> {
  if (fontsReadyPromise) return fontsReadyPromise;
  if (typeof document !== "undefined" && (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts) {
    fontsReadyPromise = (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready.then(() => undefined);
  } else {
    fontsReadyPromise = Promise.resolve();
  }
  return fontsReadyPromise;
}

function applyStyle(el: HTMLDivElement, opts: MeasureOptions): void {
  const wrap = opts.wrap ?? false;
  const paddingX = opts.paddingX ?? DEFAULT_PADDING_X;
  const paddingY = opts.paddingY ?? DEFAULT_PADDING_Y;
  const halfX = paddingX / 2;
  const halfY = paddingY / 2;
  const lineHeight =
    opts.lineHeight !== undefined
      ? typeof opts.lineHeight === "number"
        ? String(opts.lineHeight)
        : opts.lineHeight
      : wrap
        ? String(DEFAULT_WRAP_LINE_HEIGHT)
        : "normal";

  el.style.fontFamily = opts.fontFamily ?? inheritedFontFamily();
  el.style.fontSize = opts.fontSize !== undefined ? `${opts.fontSize}px` : "";
  el.style.fontWeight = opts.fontWeight !== undefined ? String(opts.fontWeight) : "";
  el.style.padding = `${halfY}px ${halfX}px`;
  el.style.lineHeight = lineHeight;
  el.style.whiteSpace = wrap ? "pre-wrap" : "nowrap";
  el.style.wordBreak = wrap ? "break-word" : "normal";

  if (wrap && opts.maxWidth !== undefined && opts.maxWidth > 0) {
    el.style.width = `${Math.max(0, opts.maxWidth)}px`;
    el.style.maxWidth = `${Math.max(0, opts.maxWidth)}px`;
  } else {
    el.style.width = "";
    el.style.maxWidth = "";
  }
}

export function measureText(text: string, opts: MeasureOptions = {}): MeasuredSize {
  if (typeof document === "undefined") return { width: 0, height: 0 };
  const el = ensureMeasureEl();
  applyStyle(el, opts);
  // Empty strings still have line height — render a zero-width space to capture row metrics.
  el.textContent = text.length === 0 ? "​" : text;
  const rect = el.getBoundingClientRect();
  return {
    width: Math.ceil(rect.width),
    height: Math.ceil(rect.height),
  };
}

function mergeOpts(base: MeasureOptions, override?: Partial<MeasureOptions>): MeasureOptions {
  if (!override) return base;
  return { ...base, ...override };
}

export function measureAutofitColumn(
  texts: string[],
  baseOpts: MeasureOptions,
  perCellOpts?: Array<Partial<MeasureOptions> | undefined>,
): number {
  if (texts.length === 0) return 0;
  let max = 0;
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (t === undefined || t === null || t === "") continue;
    const opts = perCellOpts ? mergeOpts(baseOpts, perCellOpts[i]) : baseOpts;
    // For column width measurement, always measure as single-line — Excel autofit
    // makes column wide enough to fit the longest line without wrapping (the user
    // can still wrap visually via cell wrap, but autofit width = unwrapped).
    const singleLineOpts: MeasureOptions = { ...opts, wrap: false, maxWidth: undefined };
    const { width } = measureText(t, singleLineOpts);
    if (width > max) max = width;
  }
  return max > 0 ? max + TEXT_SAFETY_BUFFER_PX : 0;
}

export function measureAutofitRow(
  texts: string[],
  colWidths: number[],
  baseOpts: MeasureOptions,
  perCellOpts?: Array<Partial<MeasureOptions> | undefined>,
): number {
  if (texts.length === 0) return 0;
  let max = 0;
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (t === undefined || t === null) continue;
    const opts = perCellOpts ? mergeOpts(baseOpts, perCellOpts[i]) : baseOpts;
    // For row height, constrain width to the column width so wrap-on cells
    // produce their actual rendered height. wrap=false rows stay single-line.
    const w = colWidths[i] ?? 0;
    const rowOpts: MeasureOptions = w > 0 ? { ...opts, maxWidth: w } : opts;
    const { height } = measureText(t === "" ? "​" : t, rowOpts);
    if (height > max) max = height;
  }
  return max > 0 ? max + TEXT_SAFETY_BUFFER_PX : 0;
}
