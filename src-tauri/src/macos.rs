//! macOS-only native fixes for WKWebView live-resize lag.
#![cfg(target_os = "macos")]

use objc2::msg_send;
use objc2_app_kit::{NSColor, NSView, NSViewLayerContentsRedrawPolicy, NSWindow};
use objc2_core_graphics::CGColor;
use objc2_quartz_core::kCAGravityTopLeft;

/// L1 (static, once at setup): pin webview content during live resize so the
/// exposed region doesn't clear to white. WKWebView is an NSView subclass.
pub fn apply_resize_pinning(window: &tauri::WebviewWindow) {
    let _ = window.with_webview(|webview| unsafe {
        let view_ptr = webview.inner().cast::<NSView>();
        if view_ptr.is_null() {
            return;
        }
        let view = &*view_ptr;

        // Keep the view's layer contents during resize and pin them to the top-left
        // instead of clearing/stretching → exposed region shows layer bg, not white.
        view.setLayerContentsRedrawPolicy(NSViewLayerContentsRedrawPolicy::OnSetNeedsDisplay);
        if let Some(layer) = view.layer() {
            layer.setContentsGravity(kCAGravityTopLeft);
        }

        // The REAL lever for the trailing white band: NSWindow's
        // setPreservesContentDuringLiveResize: (read-only on NSView, settable on NSWindow).
        // Tells AppKit to preserve already-rendered content and only invalidate the
        // newly-exposed rect during live resize.
        let ns_window_ptr = webview.ns_window().cast::<NSWindow>();
        if !ns_window_ptr.is_null() {
            let ns_window = &*ns_window_ptr;
            ns_window.setPreservesContentDuringLiveResize(true);
        }
    });
}

/// L2: color the resize gap = resolved theme background (kills white flash).
pub fn set_background_color(window: &tauri::WebviewWindow, r: u8, g: u8, b: u8) {
    let _ = window.with_webview(move |webview| unsafe {
        let view_ptr = webview.inner().cast::<NSView>();
        if view_ptr.is_null() {
            return;
        }
        let view = &*view_ptr;

        let color = NSColor::colorWithSRGBRed_green_blue_alpha(
            r as f64 / 255.0,
            g as f64 / 255.0,
            b as f64 / 255.0,
            1.0,
        );

        // NSWindow background — exposed region during resize paints this color.
        let ns_window_ptr = webview.ns_window().cast::<NSWindow>();
        if !ns_window_ptr.is_null() {
            let ns_window = &*ns_window_ptr;
            ns_window.setBackgroundColor(Some(&color));
        }

        // Host view layer background (CGColor) — covers gaps the remote web layer hasn't painted.
        if let Some(layer) = view.layer() {
            let cg_color: objc2::rc::Retained<CGColor> = color.CGColor();
            layer.setBackgroundColor(Some(&cg_color));
        }

        // WKWebView.underPageBackgroundColor (macOS 12+) — WebKit's own exposed-area color.
        let sel = objc2::sel!(setUnderPageBackgroundColor:);
        let responds: bool = msg_send![view, respondsToSelector: sel];
        if responds {
            let _: () = msg_send![view, setUnderPageBackgroundColor: &*color];
        }
    });
}
