import React from "react";
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
