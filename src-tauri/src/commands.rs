use crate::model::{SheetModel, WorkbookModel};
use crate::parser;
use crate::state::{OpenFile, PendingFiles};
use std::path::PathBuf;
use tauri::State;

#[derive(serde::Deserialize)]
pub struct CellEdit {
    pub sheet_name: String,
    pub row: usize,
    pub col: usize,
    pub value: crate::model::CellValue,
}

#[tauri::command]
pub async fn open_workbook(
    path: String,
    open_file: State<'_, OpenFile>,
) -> Result<WorkbookModel, String> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("File not found: {path}"));
    }
    let wb = tauri::async_runtime::spawn_blocking(move || parser::open(&path_buf))
        .await
        .map_err(|e| format!("Task join error: {e}"))??;

    *open_file.0.lock().unwrap() = Some(wb.path.clone());
    Ok(wb)
}

#[tauri::command]
pub async fn load_sheet(
    sheet_name: String,
    open_file: State<'_, OpenFile>,
) -> Result<SheetModel, String> {
    let path = open_file
        .0
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "No file is currently open".to_string())?;
    let path_buf = PathBuf::from(path);
    let sheet =
        tauri::async_runtime::spawn_blocking(move || parser::load_sheet_by_name(&path_buf, &sheet_name))
            .await
            .map_err(|e| format!("Task join error: {e}"))??;
    Ok(sheet)
}

#[tauri::command]
pub fn take_pending_files(pending: State<'_, PendingFiles>) -> Vec<String> {
    let mut guard = pending.0.lock().unwrap();
    std::mem::take(&mut *guard)
}

#[tauri::command]
pub async fn save_edits(
    edits: Vec<CellEdit>,
    open_file: State<'_, OpenFile>,
) -> Result<(), String> {
    let path = open_file
        .0
        .lock()
        .unwrap()
        .clone()
        .ok_or("No file open")?;
    tauri::async_runtime::spawn_blocking(move || crate::writer::save_edits_to_path(&path, &edits))
        .await
        .map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
pub fn set_native_background(
    window: tauri::WebviewWindow,
    r: u8,
    g: u8,
    b: u8,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    crate::macos::set_background_color(&window, r, g, b);
    #[cfg(not(target_os = "macos"))]
    let _ = (window, r, g, b);
    Ok(())
}
