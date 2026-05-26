mod commands;
mod model;
mod parser;
mod state;

use state::{OpenFile, PendingFiles};
use tauri::{Emitter, Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

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
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(PendingFiles::default())
        .manage(OpenFile::default())
        .invoke_handler(tauri::generate_handler![
            commands::open_workbook,
            commands::load_sheet,
            commands::take_pending_files,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Opened { urls } = event {
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
        });
}
