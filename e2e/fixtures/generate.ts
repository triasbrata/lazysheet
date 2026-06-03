import * as XLSX from "npm:xlsx@^0.18.5";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── multi.xlsx ───────────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();

// Sheet 1: "People"
// Row 0 (A1:C1): merged title
// Row 1: headers
// Rows 2-4: data
// Row 5 (B6): SUM formula
const peopleData = [
  ["People Directory", null, null], // row 0  — A1 will be merged across A1:C1
  ["Name", "Age", "City"],          // row 1  — headers
  ["Ada", 36, "London"],            // row 2
  ["Linus", 55, "Helsinki"],        // row 3
  ["Grace", 85, "NewYork"],         // row 4
  [null, null, null],               // row 5  — B6 gets formula below
];

const wsP = XLSX.utils.aoa_to_sheet(peopleData);

// Merged title: A1:C1  (row 0, cols 0-2, zero-based)
wsP["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];

// Formula cell B6  (row index 5, col index 1 → address B6)
wsP["B6"] = { f: "SUM(B3:B5)" };

XLSX.utils.book_append_sheet(wb, wsP, "People");

// Sheet 2: "Nums"  — header [N, Square], rows for 1..3
const numsData = [
  ["N", "Square"],
  [1, 1],
  [2, 4],
  [3, 9],
];

const wsN = XLSX.utils.aoa_to_sheet(numsData);
XLSX.utils.book_append_sheet(wb, wsN, "Nums");

const xlsxPath = join(__dirname, "multi.xlsx");
XLSX.writeFile(wb, xlsxPath);
console.log(`Written: ${xlsxPath}`);

// ── legacy.xls ───────────────────────────────────────────────────────────────
try {
  const xlsPath = join(__dirname, "legacy.xls");
  XLSX.writeFile(wb, xlsPath, { bookType: "biff8" });
  console.log(`Written: ${xlsPath}`);
} catch (err) {
  console.warn(`WARNING: legacy.xls generation failed (optional): ${err}`);
}
