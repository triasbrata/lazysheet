use crate::model::{SheetModel, WorkbookModel};
use crate::parser;
use crate::state::{OpenFile, PendingFiles};
use std::path::PathBuf;
use tauri::State;

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
