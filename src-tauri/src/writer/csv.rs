use crate::commands::CellEdit;
use crate::model::CellValue;
use std::path::Path;

pub fn save_csv_edits(path: &str, edits: &[CellEdit]) -> Result<(), String> {
    let ext = Path::new(path)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    // Mirror delimiter detection from parser/csv.rs:
    // .tsv extension => tab delimiter; otherwise comma.
    let delimiter = if ext == "tsv" { b'\t' } else { b',' };

    // Read existing file into a grid.
    // Note: BOM / UTF-16 encoding is NOT preserved on write — output is always UTF-8.
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .delimiter(delimiter)
        .from_path(path)
        .map_err(|e| format!("Failed to open CSV for reading: {e}"))?;

    let mut grid: Vec<Vec<String>> = Vec::new();
    for result in reader.records() {
        let record = result.map_err(|e| format!("CSV parse error: {e}"))?;
        grid.push(record.iter().map(|s| s.to_string()).collect());
    }

    apply_edits_to_grid(&mut grid, edits);

    super::atomic_write(Path::new(path), |tmp| {
        let mut wtr = csv::WriterBuilder::new()
            .delimiter(delimiter)
            .from_path(tmp)
            .map_err(|e| format!("Failed to create CSV writer: {e}"))?;

        for row in &grid {
            wtr.write_record(row)
                .map_err(|e| format!("Failed to write CSV row: {e}"))?;
        }

        wtr.flush().map_err(|e| format!("Failed to flush CSV: {e}"))
    })
}

pub fn cell_value_to_string(v: &CellValue) -> String {
    match v {
        CellValue::Empty => String::new(),
        CellValue::Text(c) => c.clone(),
        CellValue::Date(c) => c.clone(),
        CellValue::Error(c) => c.clone(),
        CellValue::Integer(c) => c.to_string(),
        CellValue::Number(c) => c.to_string(),
        CellValue::Bool(c) => {
            if *c {
                "TRUE".to_string()
            } else {
                "FALSE".to_string()
            }
        }
    }
}

pub fn apply_edits_to_grid(grid: &mut Vec<Vec<String>>, edits: &[CellEdit]) {
    for e in edits {
        while grid.len() <= e.row {
            grid.push(Vec::new());
        }
        let row = &mut grid[e.row];
        while row.len() <= e.col {
            row.push(String::new());
        }
        row[e.col] = cell_value_to_string(&e.value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cell_value_to_string_empty() {
        assert_eq!(cell_value_to_string(&CellValue::Empty), "");
    }

    #[test]
    fn cell_value_to_string_text() {
        assert_eq!(
            cell_value_to_string(&CellValue::Text("hello".into())),
            "hello"
        );
    }

    #[test]
    fn cell_value_to_string_integer() {
        assert_eq!(cell_value_to_string(&CellValue::Integer(42)), "42");
    }

    #[test]
    fn cell_value_to_string_number() {
        assert_eq!(cell_value_to_string(&CellValue::Number(3.14)), "3.14");
    }

    #[test]
    fn cell_value_to_string_bool_true() {
        assert_eq!(cell_value_to_string(&CellValue::Bool(true)), "TRUE");
    }

    #[test]
    fn cell_value_to_string_bool_false() {
        assert_eq!(cell_value_to_string(&CellValue::Bool(false)), "FALSE");
    }

    #[test]
    fn cell_value_to_string_date() {
        assert_eq!(
            cell_value_to_string(&CellValue::Date("2024-01-15".into())),
            "2024-01-15"
        );
    }

    #[test]
    fn cell_value_to_string_error() {
        assert_eq!(
            cell_value_to_string(&CellValue::Error("#DIV/0!".into())),
            "#DIV/0!"
        );
    }

    #[test]
    fn apply_edits_sets_existing_cell() {
        let mut grid: Vec<Vec<String>> = vec![
            vec!["a".into(), "b".into()],
            vec!["c".into(), "d".into()],
        ];
        let edits = vec![CellEdit {
            sheet_name: "Sheet1".into(),
            row: 0,
            col: 1,
            value: CellValue::Text("X".into()),
        }];
        apply_edits_to_grid(&mut grid, &edits);
        assert_eq!(grid[0][1], "X");
        // other cells unchanged
        assert_eq!(grid[0][0], "a");
        assert_eq!(grid[1][0], "c");
    }

    #[test]
    fn apply_edits_grows_grid_for_out_of_bounds_row() {
        let mut grid: Vec<Vec<String>> = vec![vec!["a".into()]];
        let edits = vec![CellEdit {
            sheet_name: "Sheet1".into(),
            row: 3,
            col: 2,
            value: CellValue::Integer(99),
        }];
        apply_edits_to_grid(&mut grid, &edits);
        assert!(grid.len() > 3);
        assert_eq!(grid[3][2], "99");
    }

    #[test]
    fn apply_edits_grows_row_for_out_of_bounds_col() {
        let mut grid: Vec<Vec<String>> = vec![vec!["a".into()]];
        let edits = vec![CellEdit {
            sheet_name: "Sheet1".into(),
            row: 0,
            col: 5,
            value: CellValue::Bool(true),
        }];
        apply_edits_to_grid(&mut grid, &edits);
        assert!(grid[0].len() > 5);
        assert_eq!(grid[0][5], "TRUE");
    }
}
