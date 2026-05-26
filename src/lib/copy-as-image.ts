// Generate a PNG screenshot of a DOM node and copy it to the system clipboard.
//
// User-gesture rule: navigator.clipboard.write([new ClipboardItem(...)]) must
// be invoked synchronously inside the user-gesture tick. Any await before the
// write call lets the gesture expire and the browser/webview rejects with
// NotAllowedError. All async setup runs inside the Promise<Blob> that
// ClipboardItem holds — the outer function reaches navigator.clipboard.write
// with only synchronous work before it.
//
// WebKit blank-first-render: WKWebView (used by Tauri on macOS) sometimes
// produces a fully-blank PNG on the first html-to-image toBlob call due to
// timing of SVG foreignObject rasterization. A throw-away warm-up call before
// the real render reliably fixes this.

export interface CopyNodeAsImageOptions {
  backgroundColor?: string;
  pixelRatio?: number;
  filter?: (node: Node) => boolean;
}

export interface CopyNodeAsImageResult {
  ok: boolean;
  bytes?: number;
  error?: string;
}

function resolveBackgroundColor(explicit?: string): string {
  if (explicit) return explicit;
  const root = document.documentElement;
  const raw = getComputedStyle(root).getPropertyValue("--background").trim();
  if (raw) return raw;
  return "#ffffff";
}

export async function copyNodeAsImage(
  node: HTMLElement,
  opts: CopyNodeAsImageOptions = {},
): Promise<CopyNodeAsImageResult> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    return {
      ok: false,
      error: "Clipboard image write not supported in this environment",
    };
  }

  const pixelRatio =
    opts.pixelRatio ?? Math.max(2, window.devicePixelRatio || 1);
  const backgroundColor = resolveBackgroundColor(opts.backgroundColor);
  const filter = opts.filter;

  const blobPromise: Promise<Blob> = (async () => {
    await document.fonts?.ready?.catch(() => undefined);
    const { toBlob } = await import("html-to-image");

    const htiOpts = {
      pixelRatio,
      backgroundColor,
      cacheBust: false,
      filter,
    };

    // WebKit first-call-blank workaround: discard first render.
    await toBlob(node, htiOpts).catch(() => undefined);
    const b = await toBlob(node, htiOpts);
    if (!b) throw new Error("Failed to render node to PNG");
    return b;
  })();

  try {
    const item = new ClipboardItem({ "image/png": blobPromise });
    await navigator.clipboard.write([item]);
    const blob = await blobPromise;
    return { ok: true, bytes: blob.size };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
