use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
pub struct WorkbookModel {
    pub path: String,
    pub file_name: String,
    pub sheets: Vec<SheetSummary>,
    pub active_sheet: SheetModel,
}

#[derive(Serialize, Clone, Debug)]
pub struct SheetSummary {
    pub name: String,
    pub index: usize,
}

#[derive(Serialize, Clone, Debug)]
pub struct SheetModel {
    pub name: String,
    pub rows: Vec<Vec<CellModel>>,
    pub col_widths: Vec<f64>,
    pub row_heights: Vec<f64>,
    pub merges: Vec<MergeRange>,
    pub frozen_rows: u32,
    pub frozen_cols: u32,
    pub max_col: usize,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct CellModel {
    pub v: CellValue,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub s: Option<CellStyle>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub f: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(tag = "t", content = "c")]
pub enum CellValue {
    Empty,
    Text(String),
    Number(f64),
    Integer(i64),
    Bool(bool),
    Date(String),
    Error(String),
}

impl Default for CellValue {
    fn default() -> Self {
        CellValue::Empty
    }
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct CellStyle {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bg: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fg: Option<String>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub bold: bool,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub italic: bool,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub wrap: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub align_h: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub align_v: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_size: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_name: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct MergeRange {
    pub r1: u32,
    pub c1: u32,
    pub r2: u32,
    pub c2: u32,
}
