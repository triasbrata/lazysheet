pub mod csv;
pub mod xls;
pub mod xlsx;

use crate::model::WorkbookModel;
use std::path::Path;

pub fn open(path: &Path) -> Result<WorkbookModel, String> {
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    let file_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("(unknown)")
        .to_string();
    let path_str = path.to_string_lossy().to_string();

    match ext.as_str() {
        "xlsx" | "xlsm" => xlsx::parse(path, path_str, file_name),
        "xls" | "xlsb" | "ods" => xls::parse(path, path_str, file_name),
        "csv" | "tsv" | "txt" => csv::parse(path, path_str, file_name),
        _ => Err(format!("Unsupported file extension: .{ext}")),
    }
}

pub fn load_sheet_by_name(
    path: &Path,
    sheet_name: &str,
) -> Result<crate::model::SheetModel, String> {
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "xlsx" | "xlsm" => xlsx::parse_sheet_by_name(path, sheet_name),
        "xls" | "xlsb" | "ods" => xls::parse_sheet_by_name(path, sheet_name),
        "csv" | "tsv" | "txt" => csv::parse_sheet(path, sheet_name),
        _ => Err(format!("Unsupported file extension: .{ext}")),
    }
}
