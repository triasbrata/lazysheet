use crate::model::{
    CellModel, CellStyle, CellValue, MergeRange, SheetModel, SheetSummary, WorkbookModel,
};
use std::path::Path;
use umya_spreadsheet::{reader, EnumTrait, Worksheet};

// OOXML spec column width → pixels (ECMA-376 §18.3.1.13).
// MDW = maxDigitWidth of Normal font; assume Calibri 11pt @ 96 DPI → 7.0.
const MDW: f64 = 7.0;
const COL_WIDTH_PADDING_PX: f64 = 18.0; // trunc(128 / MDW)
const DPI: f64 = 96.0;

// Excel implicit defaults when sheet XML omits defaultColWidth / defaultRowHeight.
const EXCEL_DEFAULT_COL_WIDTH_CHARS: f64 = 8.43;
const EXCEL_DEFAULT_ROW_HEIGHT_PT: f64 = 15.0;

fn col_chars_to_px(width_chars: f64) -> f64 {
    ((256.0 * width_chars + COL_WIDTH_PADDING_PX) / 256.0 * MDW).trunc()
}

fn row_pt_to_px(height_pt: f64) -> f64 {
    height_pt * DPI / 72.0
}

pub fn parse(
    path: &Path,
    path_str: String,
    file_name: String,
) -> Result<WorkbookModel, String> {
    // lazy_read defers per-sheet XML deserialization — only the sheet we
    // render is materialized below. read() would parse ALL sheets eagerly.
    let t_read = std::time::Instant::now();
    let mut book =
        reader::xlsx::lazy_read(path).map_err(|e| format!("Failed to read xlsx: {e:?}"))?;
    let read_ms = t_read.elapsed().as_millis();
    let sheet_names: Vec<String> = book
        .get_sheet_collection_no_check()
        .iter()
        .map(|s| s.get_name().to_string())
        .collect();

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

    let t_deser = std::time::Instant::now();
    book.read_sheet(0);
    let deser_ms = t_deser.elapsed().as_millis();
    let first_sheet = book
        .get_sheet(&0)
        .ok_or_else(|| "Failed to access first sheet".to_string())?;
    let t_transform = std::time::Instant::now();
    let active_sheet = parse_sheet(first_sheet)?;
    eprintln!(
        "[perf] xlsx open: read={read_ms}ms deserialize={deser_ms}ms transform={}ms",
        t_transform.elapsed().as_millis()
    );

    Ok(WorkbookModel {
        path: path_str,
        file_name,
        sheets: summaries,
        active_sheet,
    })
}

pub fn parse_sheet_by_name(path: &Path, sheet_name: &str) -> Result<SheetModel, String> {
    let mut book =
        reader::xlsx::lazy_read(path).map_err(|e| format!("Failed to read xlsx: {e:?}"))?;
    // Find the index manually — read_sheet_by_name unwrap-panics on a missing
    // name, and get_sheet_by_name asserts the sheet is already deserialized.
    let index = book
        .get_sheet_collection_no_check()
        .iter()
        .position(|s| s.get_name() == sheet_name)
        .ok_or_else(|| format!("Sheet '{sheet_name}' not found"))?;
    book.read_sheet(index);
    let sheet = book
        .get_sheet(&index)
        .ok_or_else(|| format!("Sheet '{sheet_name}' not found"))?;
    parse_sheet(sheet)
}

fn parse_sheet(sheet: &Worksheet) -> Result<SheetModel, String> {
    let max_col = sheet.get_highest_column() as usize;
    let max_row = sheet.get_highest_row() as usize;

    let mut rows: Vec<Vec<CellModel>> = Vec::with_capacity(max_row.max(1));
    for r in 1..=max_row.max(1) {
        let mut row: Vec<CellModel> = Vec::with_capacity(max_col.max(1));
        for c in 1..=max_col.max(1) {
            let cell_opt = sheet.get_cell((c as u32, r as u32));
            let cm = if let Some(cell) = cell_opt {
                cell_to_model(cell)
            } else {
                CellModel::default()
            };
            row.push(cm);
        }
        rows.push(row);
    }

    let fmt = sheet.get_sheet_format_properties();
    let default_col_w_chars = {
        let v = *fmt.get_default_column_width();
        if v > 0.0 { v } else { EXCEL_DEFAULT_COL_WIDTH_CHARS }
    };
    let default_row_h_pt = {
        let v = *fmt.get_default_row_height();
        if v > 0.0 { v } else { EXCEL_DEFAULT_ROW_HEIGHT_PT }
    };

    // 0.0 = hidden (sentinel). Otherwise resolved pixels.
    // Index dims by number once — a linear find per row/col is O(n*m).
    let col_dims: std::collections::HashMap<u32, _> = sheet
        .get_column_dimensions()
        .iter()
        .map(|d| (*d.get_col_num(), d))
        .collect();
    let col_widths: Vec<f64> = (1..=max_col.max(1))
        .map(|c| {
            let dim = col_dims.get(&(c as u32));
            match dim {
                Some(d) if *d.get_hidden() => 0.0,
                Some(d) => {
                    let w = *d.get_width();
                    let chars = if w > 0.0 { w } else { default_col_w_chars };
                    col_chars_to_px(chars)
                }
                None => col_chars_to_px(default_col_w_chars),
            }
        })
        .collect();

    let row_dim_list = sheet.get_row_dimensions();
    let row_dims: std::collections::HashMap<u32, _> = row_dim_list
        .iter()
        .map(|d| (*d.get_row_num(), d))
        .collect();
    let row_heights: Vec<f64> = (1..=max_row.max(1))
        .map(|r| {
            let dim = row_dims.get(&(r as u32));
            match dim {
                Some(d) if *d.get_hidden() => 0.0,
                Some(d) if *d.get_custom_height() => row_pt_to_px(*d.get_height()),
                Some(_) => row_pt_to_px(default_row_h_pt),
                None => row_pt_to_px(default_row_h_pt),
            }
        })
        .collect();

    // Merged cells
    let merges: Vec<MergeRange> = sheet
        .get_merge_cells()
        .iter()
        .filter_map(|m| {
            let range = m.get_range();
            parse_range(&range)
        })
        .collect();

    // Frozen panes
    let (frozen_rows, frozen_cols) = sheet
        .get_sheets_views()
        .get_sheet_view_list()
        .first()
        .and_then(|view| view.get_pane())
        .map(|p| {
            // horizontal_split = xSplit (cols frozen); vertical_split = ySplit (rows frozen)
            let frozen_rows = *p.get_vertical_split() as u32;
            let frozen_cols = *p.get_horizontal_split() as u32;
            (frozen_rows, frozen_cols)
        })
        .unwrap_or((0, 0));

    Ok(SheetModel {
        name: sheet.get_name().to_string(),
        rows,
        col_widths,
        row_heights,
        merges,
        frozen_rows,
        frozen_cols,
        max_col,
    })
}

fn cell_to_model(cell: &umya_spreadsheet::Cell) -> CellModel {
    let v = cell_value(cell);
    let s = extract_style(cell);
    let h = cell.get_hyperlink().map(|hl| hl.get_url().to_string());
    let f = if cell.is_formula() {
        Some(format!("={}", cell.get_formula()))
    } else {
        None
    };
    CellModel { v, s, h, f }
}

fn cell_value(cell: &umya_spreadsheet::Cell) -> CellValue {
    let raw = cell.get_value().to_string();
    if raw.is_empty() {
        return CellValue::Empty;
    }
    let data_type = cell.get_data_type();
    match data_type {
        "b" => CellValue::Bool(raw == "1" || raw.eq_ignore_ascii_case("true")),
        "e" => CellValue::Error(raw),
        "n" => {
            if let Ok(i) = raw.parse::<i64>() {
                CellValue::Integer(i)
            } else if let Ok(f) = raw.parse::<f64>() {
                CellValue::Number(f)
            } else {
                CellValue::Text(raw)
            }
        }
        "d" => CellValue::Date(raw),
        _ => CellValue::Text(raw),
    }
}

fn extract_style(cell: &umya_spreadsheet::Cell) -> Option<CellStyle> {
    let style = cell.get_style();
    let mut s = CellStyle::default();
    let mut has_any = false;

    // Background color (Fill)
    let fill = style.get_fill();
    if let Some(fill) = fill {
        if let Some(pattern) = fill.get_pattern_fill() {
            if let Some(color) = pattern.get_foreground_color() {
                let argb = color.get_argb();
                if !argb.is_empty() {
                    s.bg = Some(argb_to_hex(argb));
                    has_any = true;
                }
            }
        }
    }

    // Font properties
    let font = style.get_font();
    if let Some(font) = font {
        let bold = *font.get_font_bold().get_val();
        let italic = *font.get_font_italic().get_val();
        if bold {
            s.bold = true;
            has_any = true;
        }
        if italic {
            s.italic = true;
            has_any = true;
        }
        let size = *font.get_font_size().get_val();
        if size > 0.0 {
            s.font_size = Some(size);
            has_any = true;
        }
        let name = font.get_font_name().get_val();
        if !name.is_empty() {
            s.font_name = Some(name.to_string());
            has_any = true;
        }
        let color = font.get_color();
        let argb = color.get_argb();
        if !argb.is_empty() && argb != "FF000000" && argb != "00000000" {
            s.fg = Some(argb_to_hex(argb));
            has_any = true;
        }
    }

    // Alignment + wrap
    if let Some(alignment) = style.get_alignment() {
        let wrap = *alignment.get_wrap_text();
        if wrap {
            s.wrap = true;
            has_any = true;
        }
        let h = alignment.get_horizontal().get_value_string();
        if !h.is_empty() && h != "general" {
            s.align_h = Some(h.to_string());
            has_any = true;
        }
        let v = alignment.get_vertical().get_value_string();
        if !v.is_empty() && v != "bottom" {
            s.align_v = Some(v.to_string());
            has_any = true;
        }
    }

    if has_any {
        Some(s)
    } else {
        None
    }
}

fn argb_to_hex(argb: &str) -> String {
    // umya gives 8-char ARGB like "FFFF0000" — drop alpha, prefix '#'
    if argb.len() == 8 {
        format!("#{}", &argb[2..])
    } else if argb.len() == 6 {
        format!("#{argb}")
    } else {
        argb.to_string()
    }
}

fn parse_range(range: &str) -> Option<MergeRange> {
    // Range like "A1:C3"
    let parts: Vec<&str> = range.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let (c1, r1) = parse_cell_ref(parts[0])?;
    let (c2, r2) = parse_cell_ref(parts[1])?;
    Some(MergeRange { r1, c1, r2, c2 })
}

fn parse_cell_ref(s: &str) -> Option<(u32, u32)> {
    let mut col = 0u32;
    let mut row_str = String::new();
    let mut col_done = false;
    for ch in s.chars() {
        if ch.is_ascii_alphabetic() && !col_done {
            col = col * 26 + (ch.to_ascii_uppercase() as u32 - 'A' as u32 + 1);
        } else if ch.is_ascii_digit() {
            col_done = true;
            row_str.push(ch);
        }
    }
    let row: u32 = row_str.parse().ok()?;
    Some((col, row))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a 2-sheet workbook fixture on disk and return its path.
    /// Sheet1: A1="hello". Sheet2: B2="world".
    fn write_fixture(name: &str) -> std::path::PathBuf {
        let mut book = umya_spreadsheet::new_file();
        book.get_sheet_by_name_mut("Sheet1")
            .unwrap()
            .get_cell_mut("A1")
            .set_value("hello");
        let sheet2 = book.new_sheet("Sheet2").unwrap();
        sheet2.get_cell_mut("B2").set_value("world");
        let path = std::env::temp_dir().join(format!(
            "lazysheet_test_{}_{}.xlsx",
            name,
            std::process::id()
        ));
        umya_spreadsheet::writer::xlsx::write(&book, &path).unwrap();
        path
    }

    #[test]
    fn lazy_parse_returns_all_summaries_and_first_sheet_content() {
        let path = write_fixture("parse");
        let wb = parse(&path, path.to_string_lossy().to_string(), "f.xlsx".into()).unwrap();
        let _ = std::fs::remove_file(&path);

        let names: Vec<&str> = wb.sheets.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(names, vec!["Sheet1", "Sheet2"]);
        assert_eq!(wb.active_sheet.name, "Sheet1");
        match &wb.active_sheet.rows[0][0].v {
            CellValue::Text(t) => assert_eq!(t, "hello"),
            other => panic!("expected Text(\"hello\"), got {other:?}"),
        }
    }

    #[test]
    fn lazy_parse_sheet_by_name_loads_second_sheet() {
        let path = write_fixture("by_name");
        let sheet = parse_sheet_by_name(&path, "Sheet2").unwrap();
        let _ = std::fs::remove_file(&path);

        assert_eq!(sheet.name, "Sheet2");
        match &sheet.rows[1][1].v {
            CellValue::Text(t) => assert_eq!(t, "world"),
            other => panic!("expected Text(\"world\"), got {other:?}"),
        }
    }

    #[test]
    fn parse_sheet_by_name_missing_returns_err() {
        let path = write_fixture("missing");
        let err = parse_sheet_by_name(&path, "Nope").unwrap_err();
        let _ = std::fs::remove_file(&path);
        assert!(err.contains("not found"), "got: {err}");
    }

    #[test]
    fn dims_resolved_from_hashmap_lookups() {
        let mut book = umya_spreadsheet::new_file();
        let sheet = book.get_sheet_by_name_mut("Sheet1").unwrap();
        sheet.get_cell_mut("C3").set_value("x"); // extent: 3 cols, 3 rows
        sheet.get_column_dimension_mut("A").set_width(10.0);
        sheet.get_column_dimension_mut("B").set_hidden(true);
        let row2 = sheet.get_row_dimension_mut(&2);
        row2.set_height(30.0);
        row2.set_custom_height(true);
        let path = std::env::temp_dir()
            .join(format!("lazysheet_test_dims_{}.xlsx", std::process::id()));
        umya_spreadsheet::writer::xlsx::write(&book, &path).unwrap();

        let model = parse_sheet_by_name(&path, "Sheet1").unwrap();
        let _ = std::fs::remove_file(&path);

        assert_eq!(model.col_widths[0], col_chars_to_px(10.0)); // custom width
        assert_eq!(model.col_widths[1], 0.0); // hidden sentinel
        assert_eq!(
            model.col_widths[2],
            col_chars_to_px(EXCEL_DEFAULT_COL_WIDTH_CHARS)
        ); // default
        assert_eq!(model.row_heights[1], row_pt_to_px(30.0)); // custom height
    }

    #[test]
    fn col_default_width_843_to_59px() {
        // Excel default col width 8.43 chars → 59 px per OOXML spec (Calibri 11pt).
        assert_eq!(col_chars_to_px(8.43), 59.0);
    }

    #[test]
    fn col_width_10_to_70px() {
        // (256*10 + 18) / 256 * 7 = 70.49 → trunc 70
        assert_eq!(col_chars_to_px(10.0), 70.0);
    }

    #[test]
    fn col_width_zero_yields_zero() {
        // Formula on 0 returns trunc(18/256 * 7) = trunc(0.49) = 0.
        assert_eq!(col_chars_to_px(0.0), 0.0);
    }

    #[test]
    fn row_default_15pt_to_20px() {
        assert_eq!(row_pt_to_px(15.0), 20.0);
    }

    #[test]
    fn row_30pt_to_40px() {
        assert_eq!(row_pt_to_px(30.0), 40.0);
    }
}

