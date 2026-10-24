
from pathlib import Path
import re
import subprocess

ROOT = Path("/Users/vedha/Vedha/App/digital-twin-validation-platform")
FRONTEND = ROOT / "frontend"
APP = FRONTEND / "src" / "App.jsx"
LAB = FRONTEND / "src" / "components" / "ValidationInputLab.jsx"
EXPORTS = FRONTEND / "src" / "components" / "ValidationExports.jsx"
STYLES = FRONTEND / "src" / "styles.css"

print("1) Installing real Excel writer...")
subprocess.run(["npm", "install", "xlsx"], cwd=FRONTEND, check=True)

print("2) Creating validation-only export component...")
EXPORTS.write_text(r'''import React from "react";
import * as XLSX from "xlsx";

function readStoredData() {
  let inputs = { engineering: [], plm: [] };
  let result = null;

  try {
    const inputRaw = sessionStorage.getItem("dt_validation_inputs");
    const resultRaw = sessionStorage.getItem("dt_validation_result");

    if (inputRaw) inputs = JSON.parse(inputRaw);
    if (resultRaw) result = JSON.parse(resultRaw);
  } catch (error) {
    console.error("Export data read failed:", error);
  }

  return { inputs, result };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

export default function ValidationExports() {
  const downloadInputCsv = () => {
    const { inputs } = readStoredData();

    const rows = [
      ...(inputs.engineering || []).map((part) => [
        "ENGINEERING",
        part.partNumber,
        part.name,
        part.revision,
        Number(part.quantity),
        part.lifecycle,
      ]),
      ...(inputs.plm || []).map((part) => [
        "PLM",
        part.partNumber,
        part.name,
        part.revision,
        Number(part.quantity),
        part.lifecycle,
      ]),
    ];

    if (!rows.length) {
      window.alert("Run validation first so the current inputs are available.");
      return;
    }

    const header = [
      "source",
      "part_number",
      "name",
      "revision",
      "quantity",
      "lifecycle",
    ];

    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    downloadText("digital-twin-input-data.csv", csv);
  };

  const downloadResultCsv = () => {
    const { result } = readStoredData();

    if (!result) {
      window.alert("Run validation first so results are available.");
      return;
    }

    const header = [
      "record_type",
      "part_number",
      "part_name",
      "status",
      "issue_type",
      "expected",
      "actual",
      "severity",
      "defect_id",
    ];

    const resultRows = (result.results || []).map((row) => [
      "VALIDATION_RESULT",
      row.partNumber,
      row.partName,
      row.status,
      row.issueType,
      row.expected,
      row.actual,
      row.severity,
      "",
    ]);

    const defectRows = (result.defects || []).map((row) => [
      "DEFECT",
      row.partNumber,
      "",
      row.status,
      row.issueType,
      row.expected,
      row.actual,
      row.severity,
      row.id,
    ]);

    const csv = [header, ...resultRows, ...defectRows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    downloadText("digital-twin-validation-results.csv", csv);
  };

  const downloadExcel = () => {
    const { inputs, result } = readStoredData();

    if (!result) {
      window.alert("Run validation first so the Excel report contains results.");
      return;
    }

    const workbook = XLSX.utils.book_new();

    const engineeringSheet = XLSX.utils.json_to_sheet(
      (inputs.engineering || []).map((part) => ({
        "Part Number": part.partNumber,
        Name: part.name,
        Revision: part.revision,
        Quantity: Number(part.quantity),
        Lifecycle: part.lifecycle,
      }))
    );

    const plmSheet = XLSX.utils.json_to_sheet(
      (inputs.plm || []).map((part) => ({
        "Part Number": part.partNumber,
        Name: part.name,
        Revision: part.revision,
        Quantity: Number(part.quantity),
        Lifecycle: part.lifecycle,
      }))
    );

    const summarySheet = XLSX.utils.json_to_sheet([{
      "Parts Checked": result.summary?.partsChecked ?? 0,
      "Passed Parts": result.summary?.passedParts ?? 0,
      "Failed Parts": result.summary?.failedParts ?? 0,
      "Pass Rate %": result.summary?.passRate ?? 0,
    }]);

    const resultsSheet = XLSX.utils.json_to_sheet(
      (result.results || []).map((row) => ({
        "Part Number": row.partNumber,
        "Part Name": row.partName,
        Status: row.status,
        "Issue Type": row.issueType,
        Expected: row.expected,
        Actual: row.actual,
        Severity: row.severity,
      }))
    );

    const defectsSheet = XLSX.utils.json_to_sheet(
      (result.defects || []).map((row) => ({
        "Defect ID": row.id,
        "Part Number": row.partNumber,
        Title: row.title,
        Status: row.status,
        "Issue Type": row.issueType,
        Expected: row.expected,
        Actual: row.actual,
        Severity: row.severity,
      }))
    );

    XLSX.utils.book_append_sheet(workbook, engineeringSheet, "Engineering Input");
    XLSX.utils.book_append_sheet(workbook, plmSheet, "PLM Input");
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
    XLSX.utils.book_append_sheet(workbook, resultsSheet, "Validation Results");
    XLSX.utils.book_append_sheet(workbook, defectsSheet, "Defects");

    XLSX.writeFile(workbook, "digital-twin-validation-report.xlsx");
  };

  return (
    <div className="validation-export-bar">
      <div className="validation-export-copy">
        <span>EXPORT</span>
        <strong>Download validation data</strong>
      </div>

      <div className="validation-export-actions">
        <button type="button" onClick={downloadInputCsv}>
          Input CSV
        </button>
        <button type="button" onClick={downloadResultCsv}>
          Result CSV
        </button>
        <button type="button" onClick={downloadExcel}>
          Excel report
        </button>
      </div>
    </div>
  );
}
''')

print("3) Cleaning Overview workspace...")
lab = LAB.read_text()

# Only 3 sample rows per side.
lab = lab.replace(
    "useState(() => cloneParts(initialEngineering))",
    "useState(() => cloneParts(initialEngineering).slice(0, 3))"
)
lab = lab.replace(
    "useState(() => cloneParts(initialPlm))",
    "useState(() => cloneParts(initialPlm).slice(0, 3))"
)
lab = lab.replace(
    "setEngineering(cloneParts(sampleEngineering));",
    "setEngineering(cloneParts(sampleEngineering).slice(0, 3));"
)
lab = lab.replace(
    "setPlm(cloneParts(samplePlm));",
    "setPlm(cloneParts(samplePlm).slice(0, 3));"
)

# Save current inputs/results after successful validation.
call = "      const result = await executeCustomValidation(engineering, plm);"
if call not in lab:
    raise RuntimeError("Could not find executeCustomValidation call.")

if 'sessionStorage.setItem("dt_validation_inputs"' not in lab:
    lab = lab.replace(
        call,
        call + '''
      sessionStorage.setItem(
        "dt_validation_inputs",
        JSON.stringify({ engineering, plm })
      );
      sessionStorage.setItem(
        "dt_validation_result",
        JSON.stringify(result)
      );''',
        1,
    )

# Remove the three download buttons from Overview only.
for label in ("Download input CSV", "Download result CSV", "Download Excel"):
    pattern = re.compile(
        r'<button\b[^>]*>[\s\S]*?' + re.escape(label) + r'[\s\S]*?</button>',
        re.MULTILINE,
    )
    lab, _ = pattern.subn("", lab, count=1)

LAB.write_text(lab)

print("4) Moving exports into Validation view...")
app = APP.read_text()

import_line = 'import ValidationExports from "./components/ValidationExports";'
if import_line not in app:
    import_matches = list(re.finditer(r'^import .*?;\s*$', app, re.MULTILINE))
    if not import_matches:
        raise RuntimeError("Could not find App.jsx import block.")
    pos = import_matches[-1].end()
    app = app[:pos] + "\n" + import_line + app[pos:]

if "<ValidationExports" not in app:
    pattern = re.compile(
        r'\{activeTab === "validation" &&\s*(<[^{}]+?/>)\s*\}',
        re.MULTILINE,
    )
    match = pattern.search(app)

    if not match:
        raise RuntimeError('Could not locate activeTab === "validation" block.')

    validation_component = match.group(1)
    replacement = (
        '{activeTab === "validation" && (\n'
        '                <>\n'
        f'                  {validation_component}\n'
        '                  <ValidationExports />\n'
        '                </>\n'
        '              )}'
    )
    app = app[:match.start()] + replacement + app[match.end():]

APP.write_text(app)

print("5) Adding compact Validation export styling...")
styles = STYLES.read_text()

if "/* Validation export bar */" not in styles:
    styles += r'''

/* Validation export bar */
.validation-export-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin: 14px 24px 22px;
  padding: 12px 14px;
  border: 1px solid #2d3b43;
  border-radius: 5px;
  background: #12191e;
}

.validation-export-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.validation-export-copy span {
  color: #67aa9c;
  font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .11em;
}

.validation-export-copy strong {
  color: #dfe5e8;
  font-size: 12px;
}

.validation-export-actions {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}

.validation-export-actions button {
  padding: 7px 10px;
  border: 1px solid #34434b;
  border-radius: 4px;
  color: #aeb9bf;
  background: #10161a;
  font-size: 10px;
  font-weight: 650;
  cursor: pointer;
}

.validation-export-actions button:hover {
  border-color: #567068;
  color: #dce6e2;
  background: #15211e;
}

@media (max-width: 760px) {
  .validation-export-bar {
    align-items: flex-start;
    flex-direction: column;
  }
}
'''
    STYLES.write_text(styles)

print()
print("SUCCESS")
print("- Overview sample trimmed to 3 Engineering + 3 PLM rows")
print("- Download buttons moved to Validation")
print("- Result CSV rebuilt")
print("- Excel export is now a real .xlsx workbook")
print()
print("Next:")
print("cd /Users/vedha/Vedha/App/digital-twin-validation-platform/frontend")
print("npm run build")
