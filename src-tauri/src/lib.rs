mod commands;
mod model;
mod parser;
mod state;

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
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Windows/Linux: second launch w/ file path passes via argv
            let paths: Vec<String> = args
                .iter()
                .skip(1)
                .filter(|a| std::path::Path::new(a).exists())
                .cloned()
                .collect();
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
            #[cfg(not(any(feature = "webdriver", feature = "webdriver-dev")))]
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_workbook,
            commands::load_sheet,
            commands::take_pending_files,
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
