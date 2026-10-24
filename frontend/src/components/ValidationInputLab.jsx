import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { executeCustomValidation } from "../api";

const EMPTY_PART = {
  partNumber: "",
  name: "",
  revision: "A",
  quantity: 1,
  lifecycle: "IN_WORK",
};

function cloneParts(parts = []) {
  return parts.map((part) => ({
    partNumber: String(part.partNumber ?? ""),
    name: String(part.name ?? ""),
    revision: String(part.revision ?? "A"),
    quantity: Number(part.quantity ?? 1),
    lifecycle: String(part.lifecycle ?? "IN_WORK"),
  }));
}

function normalizeImportedPart(part) {
  return {
    partNumber: String(
      part.partNumber ??
        part.part_number ??
        part["Part Number"] ??
        part["part number"] ??
        ""
    ),
    name: String(part.name ?? part.Name ?? ""),
    revision: String(part.revision ?? part.Revision ?? "A"),
    quantity: Number(part.quantity ?? part.Quantity ?? part.qty ?? part.Qty ?? 1),
    lifecycle: String(
      part.lifecycle ??
        part.lifecycle_state ??
        part.Lifecycle ??
        part["Lifecycle State"] ??
        "IN_WORK"
    ),
  };
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV needs a header row and at least one part.");
  }

  const headers = lines[0].split(",").map((value) => value.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return normalizeImportedPart(row);
  });
}

async function readPartsFile(file) {
  const text = await file.text();

  if (file.name.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed) ? parsed : parsed.parts;

    if (!Array.isArray(rows)) {
      throw new Error('JSON must be an array or contain a "parts" array.');
    }

    return rows.map(normalizeImportedPart);
  }

  if (file.name.toLowerCase().endsWith(".csv")) {
    return parseCsv(text);
  }

  throw new Error("Use a .csv or .json file.");
}

export default function ValidationInputLab({
  initialEngineering,
  initialPlm,
  onValidated,
}) {
  const sampleEngineering = useMemo(
    () => cloneParts(initialEngineering),
    [initialEngineering]
  );
  const samplePlm = useMemo(
    () => cloneParts(initialPlm),
    [initialPlm]
  );

  const [engineering, setEngineering] = useState(
    () => cloneParts(initialEngineering)
  );
  const [plm, setPlm] = useState(
    () => cloneParts(initialPlm)
  );
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [lastResult, setLastResult] = useState(null);

  const engineeringUpload = useRef(null);
  const plmUpload = useRef(null);

  useEffect(() => {
    sessionStorage.setItem(
      "dt_validation_inputs",
      JSON.stringify({ engineering, plm })
    );

    window.dispatchEvent(new Event("dt-inputs-updated"));
  }, [engineering, plm]);


  const updateRow = (side, index, field, value) => {
    const setter = side === "engineering" ? setEngineering : setPlm;

    setter((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: field === "quantity" ? Number(value) : value,
            }
          : row
      )
    );
  };

  const addRow = (side) => {
    const setter = side === "engineering" ? setEngineering : setPlm;
    setter((current) => [...current, { ...EMPTY_PART }]);
  };

  const deleteRow = (side, index) => {
    const setter = side === "engineering" ? setEngineering : setPlm;
    setter((current) =>
      current.filter((_, rowIndex) => rowIndex !== index)
    );
  };

  const importFile = async (side, file) => {
    if (!file) return;

    try {
      const rows = await readPartsFile(file);

      if (side === "engineering") {
        setEngineering(rows);
      } else {
        setPlm(rows);
      }

      setMessage(`${rows.length} ${side} records loaded from ${file.name}.`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const loadSample = () => {
    setEngineering(cloneParts(sampleEngineering).slice(0, 3));
    setPlm(cloneParts(samplePlm).slice(0, 3));
    setMessage("Sample data restored.");
  };

  const clearAll = () => {
    setEngineering([]);
    setPlm([]);
    setMessage("Workspace cleared.");
  };

  const validate = async () => {
    if (engineering.length === 0) {
      setMessage("Add at least one Engineering/CAD source part.");
      return;
    }

    const invalid = [...engineering, ...plm].some(
      (part) =>
        !part.partNumber.trim() ||
        !part.revision.trim() ||
        !part.lifecycle.trim()
    );

    if (invalid) {
      setMessage("Part number, revision, and lifecycle are required.");
      return;
    }

    setRunning(true);
    setMessage("Running Engineering → PLM comparison...");

    try {
      const result = await executeCustomValidation(engineering, plm);
      sessionStorage.setItem(
        "dt_validation_inputs",
        JSON.stringify({ engineering, plm })
      );
      sessionStorage.setItem(
        "dt_validation_result",
        JSON.stringify(result)
      );
      setLastResult(result);
      setMessage(
        `Validation complete: ${result.summary.passedParts} passed, ${result.summary.failedParts} failed.`
      );
      onValidated(result);
    } catch (error) {
      console.error(error);
      setMessage(`Validation failed: ${error.message}`);
    } finally {
      setRunning(false);
    }
  };


  const csvEscape = (value) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const downloadBlob = (filename, content, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const downloadInputCsv = () => {
    const rows = [
      ["source", "part_number", "name", "revision", "quantity", "lifecycle"],
      ...engineering.map((part) => [
        "ENGINEERING",
        part.partNumber,
        part.name,
        part.revision,
        part.quantity,
        part.lifecycle,
      ]),
      ...plm.map((part) => [
        "PLM",
        part.partNumber,
        part.name,
        part.revision,
        part.quantity,
        part.lifecycle,
      ]),
    ];

    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    downloadBlob("digital-twin-input-data.csv", csv, "text/csv;charset=utf-8");
  };

  const downloadResultCsv = () => {
    if (!lastResult) {
      setMessage("Run validation first, then download the result.");
      return;
    }

    const rows = [
      ["record_type", "part_number", "status", "issue_type", "expected", "actual", "severity", "defect_id"],
      ...lastResult.results.map((row) => [
        "VALIDATION_RESULT",
        row.partNumber,
        row.status,
        row.issueType,
        row.expected,
        row.actual,
        row.severity,
        "",
      ]),
      ...lastResult.defects.map((row) => [
        "DEFECT",
        row.partNumber,
        row.status,
        row.issueType,
        row.expected,
        row.actual,
        row.severity,
        row.id,
      ]),
    ];

    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    downloadBlob("digital-twin-validation-results.csv", csv, "text/csv;charset=utf-8");
  };

  const htmlTable = (title, headers, rows) => `
    <h2>${title}</h2>
    <table border="1">
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${String(cell ?? "")}</td>`).join("")}</tr>`)
          .join("")}
      </tbody>
    </table>
  `;

  const downloadExcel = () => {
    const inputHeaders = ["Part Number", "Name", "Revision", "Quantity", "Lifecycle"];
    const engineeringRows = engineering.map((part) => [
      part.partNumber,
      part.name,
      part.revision,
      part.quantity,
      part.lifecycle,
    ]);
    const plmRows = plm.map((part) => [
      part.partNumber,
      part.name,
      part.revision,
      part.quantity,
      part.lifecycle,
    ]);

    let body = htmlTable("Engineering / CAD Input", inputHeaders, engineeringRows);
    body += htmlTable("PLM Input", inputHeaders, plmRows);

    if (lastResult) {
      body += htmlTable(
        "Validation Summary",
        ["Parts Checked", "Passed", "Failed", "Pass Rate %"],
        [[
          lastResult.summary.partsChecked,
          lastResult.summary.passedParts,
          lastResult.summary.failedParts,
          lastResult.summary.passRate,
        ]]
      );

      body += htmlTable(
        "Validation Results",
        ["Part Number", "Part Name", "Status", "Issue Type", "Expected", "Actual", "Severity"],
        lastResult.results.map((row) => [
          row.partNumber,
          row.partName,
          row.status,
          row.issueType,
          row.expected,
          row.actual,
          row.severity,
        ])
      );

      body += htmlTable(
        "Defects",
        ["Defect ID", "Part Number", "Title", "Status", "Issue Type", "Expected", "Actual", "Severity"],
        lastResult.defects.map((row) => [
          row.id,
          row.partNumber,
          row.title,
          row.status,
          row.issueType,
          row.expected,
          row.actual,
          row.severity,
        ])
      );
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
    downloadBlob("digital-twin-validation-report.xls", html, "application/vnd.ms-excel");
  };

  return (
    <section className="input-lab">
      <div className="input-lab-header">
        <div>
          <span className="input-lab-kicker">TEST DATA WORKSPACE</span>
          <h3>Test your own Engineering and PLM data</h3>
          <p>
            Edit values directly or import CSV/JSON files. Engineering/CAD is
            treated as the expected source definition; PLM is the target being
            validated.
          </p>
        </div>

        <div className="input-lab-actions">
          

          

          

          <button
            className="primary-button compact"
            onClick={validate}
            disabled={running}
          >
            <Play size={15} />
            {running ? "Validating..." : "Run my validation"}
          </button>
        </div>
      </div>

      <div className="input-grid">
        <PartEditor
          title="Engineering / CAD Source"
          subtitle="Expected product definition"
          rows={engineering}
          side="engineering"
          onChange={updateRow}
          onAdd={addRow}
          onDelete={deleteRow}
          onUpload={() => engineeringUpload.current?.click()}
        />

        <PartEditor
          title="PLM Target"
          subtitle="Downstream data to validate"
          rows={plm}
          side="plm"
          onChange={updateRow}
          onAdd={addRow}
          onDelete={deleteRow}
          onUpload={() => plmUpload.current?.click()}
        />
      </div>

      <input
        ref={engineeringUpload}
        className="hidden-file-input"
        type="file"
        accept=".csv,.json"
        onChange={(event) =>
          importFile("engineering", event.target.files?.[0])
        }
      />

      <input
        ref={plmUpload}
        className="hidden-file-input"
        type="file"
        accept=".csv,.json"
        onChange={(event) =>
          importFile("plm", event.target.files?.[0])
        }
      />

      <div className="input-lab-footer">
        <div className="file-help">
          <FileSpreadsheet size={15} />
          CSV:
          <code>part_number,name,revision,quantity,lifecycle</code>
        </div>

        <div className="file-help">
          <FileJson size={15} />
          JSON: array of parts or <code>{"{ parts: [...] }"}</code>
        </div>

        {message && (
          <div className="input-lab-message">{message}</div>
        )}
      </div>
    </section>
  );
}

function PartEditor({
  title,
  subtitle,
  rows,
  side,
  onChange,
  onAdd,
  onDelete,
  onUpload,
}) {
  return (
    <div className="part-editor">
      <div className="part-editor-header">
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>

        <div>
          <button className="editor-icon-button" onClick={onUpload}>
            <Upload size={14} />
            Import
          </button>

          <button
            className="editor-icon-button"
            onClick={() => onAdd(side)}
          >
            <Plus size={14} />
            Add part
          </button>
        </div>
      </div>

      <div className="editable-table-wrap">
        <table className="editable-table">
          <thead>
            <tr>
              <th>Part #</th>
              <th>Name</th>
              <th>Rev</th>
              <th>Qty</th>
              <th>Lifecycle</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-table-cell">
                  No records. Add a part or import a file.
                </td>
              </tr>
            ) : (
              rows.map((part, index) => (
                <tr key={`${side}-${index}`}>
                  <td>
                    <input
                      value={part.partNumber}
                      onChange={(event) =>
                        onChange(
                          side,
                          index,
                          "partNumber",
                          event.target.value
                        )
                      }
                      placeholder="MOTOR-001"
                    />
                  </td>

                  <td>
                    <input
                      value={part.name}
                      onChange={(event) =>
                        onChange(side, index, "name", event.target.value)
                      }
                      placeholder="Servo Motor"
                    />
                  </td>

                  <td>
                    <input
                      value={part.revision}
                      onChange={(event) =>
                        onChange(
                          side,
                          index,
                          "revision",
                          event.target.value
                        )
                      }
                      placeholder="A"
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      min="0"
                      value={part.quantity}
                      onChange={(event) =>
                        onChange(
                          side,
                          index,
                          "quantity",
                          event.target.value
                        )
                      }
                    />
                  </td>

                  <td>
                    <select
                      value={part.lifecycle}
                      onChange={(event) =>
                        onChange(
                          side,
                          index,
                          "lifecycle",
                          event.target.value
                        )
                      }
                    >
                      <option value="IN_WORK">IN_WORK</option>
                      <option value="IN_REVIEW">IN_REVIEW</option>
                      <option value="RELEASED">RELEASED</option>
                      <option value="OBSOLETE">OBSOLETE</option>
                    </select>
                  </td>

                  <td>
                    <button
                      className="row-delete-button"
                      onClick={() => onDelete(side, index)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
