mod commands;
mod model;
mod parser;
mod state;
mod writer;
#[cfg(target_os = "macos")]
mod macos;

use std::path::Path;
use state::{OpenFile, PendingFiles};
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // E2E WebDriver automation server — only when built with `--features webdriver`,
    // never in release. Powers native cross-platform e2e via tauri-webdriver.
    #[cfg(any(feature = "webdriver", feature = "webdriver-dev"))]
    {
        builder = builder.plugin(tauri_plugin_webdriver::init());
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            // Windows/Linux: second launch w/ file path passes via argv
            let paths = existing_file_args(&args, Some(Path::new(&cwd)));
            if !paths.is_empty() {
                if let Some(state) = app.try_state::<PendingFiles>() {
                    state.0.lock().unwrap().extend(paths.clone());
                }
                let _ = app.emit("files-opened", paths);
            }
            if let Some(window) = app.webview_windows().values().next() {
                let _ = window.set_focus();
            }
        }));
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
        builder = builder.plugin(tauri_plugin_process::init());
    }

    builder
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_clipboard::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .manage(PendingFiles::default())
        .manage(OpenFile::default())
        .setup(|app| {
            // E2E runs: spawn the window on the primary monitor instead of whichever monitor is
            // active, so multi-monitor dev machines get deterministic placement.
            // Never affects release builds.
            #[cfg(any(feature = "webdriver", feature = "webdriver-dev"))]
            if let Some(window) = app.webview_windows().values().next() {
                if let Ok(Some(monitor)) = window.primary_monitor() {
                    let _ = window.set_position(*monitor.position());
                    let _ = window.center();
                }
            }

            // Windows/Linux first launch passes the double-clicked file via argv.
            // Harmless no-op on macOS (macOS delivers via RunEvent::Opened; the file
            // path is not in argv). We seed PendingFiles here so the frontend can
            // drain them via take_pending_files once the webview has mounted.
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                let argv: Vec<String> = std::env::args().collect();
                let paths = existing_file_args(&argv, None);
                if !paths.is_empty() {
                    app.state::<PendingFiles>().0.lock().unwrap().extend(paths);
                }
            }

            #[cfg(target_os = "macos")]
            if let Some(win) = app.get_webview_window("main") {
                macos::apply_resize_pinning(&win);
            }

            #[cfg(not(any(feature = "webdriver", feature = "webdriver-dev")))]
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_workbook,
            commands::load_sheet,
            commands::take_pending_files,
            commands::save_edits,
            commands::set_native_background,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // RunEvent::Opened (macOS file-open / "Open With") only exists on macOS.
            // Windows/Linux receive file paths via the single-instance plugin above.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = event {
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().to_string())
                    .collect();
                if !paths.is_empty() {
                    if let Some(state) = app.try_state::<PendingFiles>() {
                        state.0.lock().unwrap().extend(paths.clone());
                    }
                    let _ = app.emit("files-opened", paths);
                }
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}

/// Returns the subset of `args` that refer to existing filesystem paths.
///
/// Skips the first element (the executable path). For each remaining arg, if
/// the path is relative and `cwd` is `Some`, the candidate is resolved as
/// `cwd.join(arg)`; otherwise the arg is used as-is. Only candidates whose
/// resolved path exists on disk are returned.
fn existing_file_args(args: &[String], cwd: Option<&Path>) -> Vec<String> {
    args.iter()
        .skip(1)
        .filter_map(|arg| {
            let candidate = {
                let p = Path::new(arg);
                if p.is_relative() {
                    if let Some(base) = cwd {
                        base.join(p)
                    } else {
                        p.to_path_buf()
                    }
                } else {
                    p.to_path_buf()
                }
            };
            if candidate.exists() {
                Some(candidate.to_string_lossy().into_owned())
            } else {
                None
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn existing_file_args_filters_nonexistent() {
        let cargo_toml = format!("{}/Cargo.toml", env!("CARGO_MANIFEST_DIR"));
        let args = vec![
            "exe".to_string(),
            cargo_toml.clone(),
            "/nonexistent/x.xlsx".to_string(),
        ];
        let result = existing_file_args(&args, None);
        assert_eq!(result, vec![cargo_toml]);
    }

    #[test]
    fn existing_file_args_resolves_relative_against_cwd() {
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        let args = vec!["exe".to_string(), "Cargo.toml".to_string()];
        let result = existing_file_args(&args, Some(Path::new(manifest_dir)));
        let expected = format!("{}/Cargo.toml", manifest_dir);
        assert_eq!(result, vec![expected]);
    }
}
