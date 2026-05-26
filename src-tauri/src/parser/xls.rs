use crate::model::{CellModel, CellValue, SheetModel, SheetSummary, WorkbookModel};
use calamine::{open_workbook_auto, Data, Reader};
use std::path::Path;

pub fn parse(
    path: &Path,
    path_str: String,
    file_name: String,
) -> Result<WorkbookModel, String> {
    let mut wb = open_workbook_auto(path).map_err(|e| format!("Failed to read: {e:?}"))?;
    let sheet_names = wb.sheet_names().to_owned();

    if sheet_names.is_empty() {
        return Err("Workbook has no sheets".to_string());
    }

    let summaries: Vec<SheetSummary> = sheet_names
        .iter()
        .enumerate()
        .map(|(i, n)| SheetSummary {
            name: n.clone(),
            index: i,
        })
        .collect();

    let first = &sheet_names[0];
    let range = wb
        .worksheet_range(first)
        .map_err(|e| format!("Failed to read sheet '{first}': {e:?}"))?;
    let active_sheet = range_to_sheet(first.clone(), &range);

    Ok(WorkbookModel {
        path: path_str,
        file_name,
        sheets: summaries,
        active_sheet,
    })
}

pub fn parse_sheet_by_name(path: &Path, sheet_name: &str) -> Result<SheetModel, String> {
    let mut wb = open_workbook_auto(path).map_err(|e| format!("Failed to read: {e:?}"))?;
    let range = wb
        .worksheet_range(sheet_name)
        .map_err(|e| format!("Failed to read sheet '{sheet_name}': {e:?}"))?;
    Ok(range_to_sheet(sheet_name.to_string(), &range))
}

fn range_to_sheet(name: String, range: &calamine::Range<Data>) -> SheetModel {
    let height = range.height();
    let width = range.width();

    let mut rows: Vec<Vec<CellModel>> = Vec::with_capacity(height);
    for r in 0..height {
        let mut row_cells: Vec<CellModel> = Vec::with_capacity(width);
        for c in 0..width {
            let cell = range.get((r, c)).unwrap_or(&Data::Empty);
            row_cells.push(CellModel {
                v: data_to_value(cell),
                s: None,
                h: None,
            });
        }
        rows.push(row_cells);
    }

    // calamine 0.26 does not expose row heights or column widths for
    // .xls, .xlsb, or .ods (no public API; layout metadata discarded during parse).
    // Empty vectors → frontend falls back to DEFAULT_COL_WIDTH / DEFAULT_ROW_HEIGHT.
    // Supporting custom dimensions for these formats requires a custom BIFF/ODS parser
    // (see .rpi/accurate-row-col-dimensions/rpi-research.md §6 — deferred).
    SheetModel {
        name,
        rows,
        col_widths: vec![],
        row_heights: vec![],
        merges: vec![],
        frozen_rows: 0,
        frozen_cols: 0,
        max_col: width,
    }
}

fn data_to_value(d: &Data) -> CellValue {
    match d {
        Data::Empty => CellValue::Empty,
        Data::String(s) => CellValue::Text(s.clone()),
        Data::Float(f) => {
            if f.fract() == 0.0 && f.abs() < i64::MAX as f64 {
                CellValue::Integer(*f as i64)
            } else {
                CellValue::Number(*f)
            }
        }
        Data::Int(i) => CellValue::Integer(*i),
        Data::Bool(b) => CellValue::Bool(*b),
        Data::DateTime(dt) => CellValue::Date(dt.to_string()),
        Data::DateTimeIso(s) => CellValue::Date(s.clone()),
        Data::DurationIso(s) => CellValue::Text(s.clone()),
        Data::Error(e) => CellValue::Error(format!("{e:?}")),
    }
}
