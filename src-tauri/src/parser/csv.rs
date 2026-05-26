use crate::model::{CellModel, CellValue, SheetModel, SheetSummary, WorkbookModel};
use encoding_rs::UTF_8;
use encoding_rs_io::DecodeReaderBytesBuilder;
use std::fs::File;
use std::io::Read;
use std::path::Path;

pub fn parse(
    path: &Path,
    path_str: String,
    file_name: String,
) -> Result<WorkbookModel, String> {
    let sheet_name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Sheet1")
        .to_string();

    let sheet = parse_sheet(path, &sheet_name)?;

    Ok(WorkbookModel {
        path: path_str,
        file_name,
        sheets: vec![SheetSummary {
            name: sheet_name.clone(),
            index: 0,
        }],
        active_sheet: sheet,
    })
}

pub fn parse_sheet(path: &Path, name: &str) -> Result<SheetModel, String> {
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    let delimiter = if ext == "tsv" { b'\t' } else { b',' };

    let file = File::open(path).map_err(|e| format!("Open failed: {e}"))?;

    // Sniff BOM for UTF-16/UTF-8
    let mut buf = Vec::new();
    let mut f = file;
    f.read_to_end(&mut buf).map_err(|e| format!("Read failed: {e}"))?;

    let (encoding, content) = detect_encoding(&buf);
    let decoded = DecodeReaderBytesBuilder::new()
        .encoding(Some(encoding))
        .build(content);

    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .delimiter(delimiter)
        .from_reader(decoded);

    let mut rows: Vec<Vec<CellModel>> = Vec::new();
    let mut max_col = 0usize;

    for record in reader.records() {
        let rec = record.map_err(|e| format!("CSV parse error: {e}"))?;
        let row: Vec<CellModel> = rec
            .iter()
            .map(|s| CellModel {
                v: parse_csv_value(s),
                s: None,
                h: None,
            })
            .collect();
        if row.len() > max_col {
            max_col = row.len();
        }
        rows.push(row);
    }

    // Pad rows to max_col so frontend doesn't need to handle ragged
    for row in &mut rows {
        while row.len() < max_col {
            row.push(CellModel::default());
        }
    }

    Ok(SheetModel {
        name: name.to_string(),
        rows,
        col_widths: vec![],
        row_heights: vec![],
        merges: vec![],
        frozen_rows: 0,
        frozen_cols: 0,
        max_col,
    })
}

fn detect_encoding(buf: &[u8]) -> (&'static encoding_rs::Encoding, &[u8]) {
    if buf.starts_with(&[0xEF, 0xBB, 0xBF]) {
        (UTF_8, &buf[3..])
    } else if buf.starts_with(&[0xFF, 0xFE]) {
        (encoding_rs::UTF_16LE, &buf[2..])
    } else if buf.starts_with(&[0xFE, 0xFF]) {
        (encoding_rs::UTF_16BE, &buf[2..])
    } else {
        (UTF_8, buf)
    }
}

fn parse_csv_value(s: &str) -> CellValue {
    if s.is_empty() {
        return CellValue::Empty;
    }
    if let Ok(i) = s.parse::<i64>() {
        return CellValue::Integer(i);
    }
    if let Ok(f) = s.parse::<f64>() {
        return CellValue::Number(f);
    }
    match s.to_ascii_lowercase().as_str() {
        "true" => CellValue::Bool(true),
        "false" => CellValue::Bool(false),
        _ => CellValue::Text(s.to_string()),
    }
}
