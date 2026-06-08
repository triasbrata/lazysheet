use std::path::Path;

pub mod csv;
pub mod xlsx;

use crate::commands::CellEdit;

pub fn save_edits_to_path(path: &str, edits: &[CellEdit]) -> Result<(), String> {
    let ext = Path::new(path)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "xlsx" | "xlsm" => xlsx::save_xlsx_edits(path, edits),
        "csv" | "tsv" | "txt" => csv::save_csv_edits(path, edits),
        _ => Err(format!(
            "unsupported_format: only xlsx/xlsm/csv/tsv can be saved (got .{ext})"
        )),
    }
}

pub(crate) fn atomic_write(
    target: &Path,
    write_fn: impl FnOnce(&Path) -> Result<(), String>,
) -> Result<(), String> {
    let mut tmp = target.to_path_buf();
    let original_name = tmp
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();
    tmp.set_file_name(format!("{original_name}.lazysheet.tmp"));

    if let Err(e) = write_fn(&tmp) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e);
    }

    std::fs::rename(&tmp, target).map_err(|e| format!("Failed to finalize save: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unsupported_format_returns_err() {
        let edits: Vec<CellEdit> = vec![];
        let result = save_edits_to_path("x.ods", &edits);
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(
            msg.contains("unsupported_format"),
            "expected 'unsupported_format' in error, got: {msg}"
        );
    }
}
