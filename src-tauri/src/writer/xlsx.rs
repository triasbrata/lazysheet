use crate::commands::CellEdit;
use crate::model::CellValue;
use std::path::Path;

pub fn save_xlsx_edits(path: &str, edits: &[CellEdit]) -> Result<(), String> {
    let mut book = umya_spreadsheet::reader::xlsx::read(Path::new(path))
        .map_err(|e| format!("Failed to read xlsx: {e:?}"))?;

    for e in edits {
        let sheet = match book.get_sheet_by_name_mut(&e.sheet_name) {
            Some(s) => s,
            None => continue,
        };

        // umya is 1-indexed: (col, row)
        let coord = ((e.col + 1) as u32, (e.row + 1) as u32);
        let cell = sheet.get_cell_mut(coord);

        // Clear any formula so the literal value takes effect
        cell.set_formula("");

        match &e.value {
            CellValue::Number(c) => {
                cell.set_value_number(*c);
            }
            CellValue::Integer(c) => {
                cell.set_value_number(*c as f64);
            }
            CellValue::Bool(c) => {
                cell.set_value_bool(*c);
            }
            CellValue::Text(c) => {
                cell.set_value_string(c.clone());
            }
            CellValue::Date(c) => {
                cell.set_value_string(c.clone());
            }
            CellValue::Error(c) => {
                cell.set_value_string(c.clone());
            }
            CellValue::Empty => {
                cell.set_value("");
            }
        }
    }

    super::atomic_write(Path::new(path), |tmp| {
        umya_spreadsheet::writer::xlsx::write(&book, tmp)
            .map_err(|e| format!("Failed to write xlsx: {e:?}"))
    })
}
