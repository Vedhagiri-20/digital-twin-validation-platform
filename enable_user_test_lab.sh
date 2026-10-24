#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/vedha/Vedha/App/digital-twin-validation-platform"
cd "$ROOT"

echo "Adding editable Engineering vs PLM validation sandbox..."

mkdir -p frontend/src/components

# ---------- Backend: visitor-supplied validation endpoint ----------
python3 - <<'PY'
from pathlib import Path

p = Path("backend/app/main.py")
s = p.read_text()

if "from pydantic import BaseModel, Field" not in s:
    anchor = "from sqlalchemy.orm import Session\n"
    if anchor not in s:
        raise SystemExit("Could not find sqlalchemy Session import in backend/app/main.py")
    s = s.replace(anchor, anchor + "from pydantic import BaseModel, Field\n", 1)

marker = "# === CUSTOM VALIDATION WORKSPACE ==="
if marker not in s:
    endpoint = """

# === CUSTOM VALIDATION WORKSPACE ===

class CustomPartInput(BaseModel):
    part_number: str = Field(min_length=1, max_length=80)
    name: str = Field(default="", max_length=200)
    revision: str = Field(min_length=1, max_length=20)
    quantity: int = Field(ge=0)
    lifecycle: str = Field(min_length=1, max_length=40)


class CustomValidationRequest(BaseModel):
    engineering_parts: list[CustomPartInput]
    plm_parts: list[CustomPartInput]


@app.post("/validate/custom")
def validate_custom(payload: CustomValidationRequest):
    plm_map = {
        part.part_number.strip().upper(): part
        for part in payload.plm_parts
    }

    results = []
    defects = []
    passed_parts = 0
    failed_parts = 0
    defect_number = 1

    def fail(part, issue_type, expected, actual, severity):
        nonlocal defect_number

        results.append({
            "part_number": part.part_number,
            "part_name": part.name,
            "status": "FAIL",
            "issue_type": issue_type,
            "expected": str(expected),
            "actual": str(actual),
            "severity": severity,
        })

        defects.append({
            "id": f"TEST-DEF-{1000 + defect_number}",
            "part_number": part.part_number,
            "title": f"{issue_type.replace('_', ' ').title()}: {part.part_number}",
            "issue_type": issue_type,
            "severity": severity,
            "status": "OPEN",
            "expected": str(expected),
            "actual": str(actual),
        })

        defect_number += 1

    for engineering in payload.engineering_parts:
        key = engineering.part_number.strip().upper()
        plm = plm_map.get(key)
        part_failed = False

        if plm is None:
            fail(
                engineering,
                "MISSING_IN_PLM",
                "Part exists in PLM",
                "Part missing",
                "HIGH",
            )
            failed_parts += 1
            continue

        if engineering.revision.strip().upper() != plm.revision.strip().upper():
            part_failed = True
            fail(
                engineering,
                "REVISION_MISMATCH",
                engineering.revision,
                plm.revision,
                "HIGH",
            )

        if engineering.quantity != plm.quantity:
            part_failed = True
            fail(
                engineering,
                "QUANTITY_MISMATCH",
                engineering.quantity,
                plm.quantity,
                "MEDIUM",
            )

        if engineering.lifecycle.strip().upper() != plm.lifecycle.strip().upper():
            part_failed = True
            fail(
                engineering,
                "LIFECYCLE_MISMATCH",
                engineering.lifecycle,
                plm.lifecycle,
                "MEDIUM",
            )

        if part_failed:
            failed_parts += 1
        else:
            passed_parts += 1
            results.append({
                "part_number": engineering.part_number,
                "part_name": engineering.name,
                "status": "PASS",
                "issue_type": "",
                "expected": "",
                "actual": "",
                "severity": "LOW",
            })

    parts_checked = len(payload.engineering_parts)

    return {
        "parts_checked": parts_checked,
        "passed_parts": passed_parts,
        "failed_parts": failed_parts,
        "pass_rate": round((passed_parts / parts_checked) * 100, 1)
        if parts_checked
        else 0.0,
        "results": results,
        "defects": defects,
    }
"""
    p.write_text(s + endpoint)
    print("Added POST /validate/custom")
else:
    print("POST /validate/custom already exists")
PY

# ---------- Frontend API ----------
if ! grep -q "executeCustomValidation" frontend/src/api.js; then
cat >> frontend/src/api.js <<'EOF'

export async function executeCustomValidation(engineeringParts, plmParts) {
  const payload = {
    engineering_parts: engineeringParts.map((part) => ({
      part_number: part.partNumber.trim(),
      name: part.name.trim(),
      revision: part.revision.trim(),
      quantity: Number(part.quantity),
      lifecycle: part.lifecycle.trim(),
    })),
    plm_parts: plmParts.map((part) => ({
      part_number: part.partNumber.trim(),
      name: part.name.trim(),
      revision: part.revision.trim(),
      quantity: Number(part.quantity),
      lifecycle: part.lifecycle.trim(),
    })),
  };

  const data = await request("/validate/custom", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    summary: {
      partsChecked: data.parts_checked,
      passedParts: data.passed_parts,
      failedParts: data.failed_parts,
      passRate: data.pass_rate,
    },
    results: data.results.map((item) => ({
      partNumber: item.part_number,
      partName: item.part_name,
      status: item.status,
      issueType: item.issue_type,
      expected: item.expected,
      actual: item.actual,
      severity: item.severity,
    })),
    defects: data.defects.map((item) => ({
      id: item.id,
      partNumber: item.part_number,
      title: item.title,
      issueType: item.issue_type,
      severity: item.severity,
      status: item.status,
      expected: item.expected,
      actual: item.actual,
    })),
  };
}
EOF
fi

# ---------- Frontend component ----------
cat > frontend/src/components/ValidationInputLab.jsx <<'EOF'
import { useMemo, useRef, useState } from "react";
import {
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

  const engineeringUpload = useRef(null);
  const plmUpload = useRef(null);

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
    setEngineering(cloneParts(sampleEngineering));
    setPlm(cloneParts(samplePlm));
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
          <button className="ghost-button" onClick={loadSample}>
            <RotateCcw size={15} />
            Load sample
          </button>

          <button className="ghost-button" onClick={clearAll}>
            Clear
          </button>

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
EOF

# ---------- Insert component into Overview ----------
python3 - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/App.jsx")
s = p.read_text()

import_line = 'import ValidationInputLab from "./components/ValidationInputLab";'

if import_line not in s:
    imports = list(re.finditer(r'^import .*?;\s*$', s, re.MULTILINE))
    if not imports:
        raise SystemExit("Could not find App.jsx imports")
    last = imports[-1]
    s = s[:last.end()] + "\n" + import_line + s[last.end():]

if "<ValidationInputLab" not in s:
    match = re.search(r'(<Overview\b[\s\S]*?\/>)', s)
    if not match:
        raise SystemExit("Could not locate <Overview ... /> in App.jsx")

    block = """
                <ValidationInputLab
                  initialEngineering={engineeringParts}
                  initialPlm={plmParts}
                  onValidated={(data) => {
                    setValidation(data);
                    setActiveTab("validation");
                  }}
                />"""

    s = s[:match.end()] + block + s[match.end():]

p.write_text(s)
print("Inserted Test Data Workspace into Overview")
PY

# ---------- Styles ----------
cat >> frontend/src/styles.css <<'EOF'

.input-lab {
  margin-top: 22px;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #11181d;
}

.input-lab-header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}

.input-lab-header > div:first-child {
  max-width: 760px;
}

.input-lab-kicker {
  color: var(--accent-strong);
  font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .11em;
}

.input-lab-header h3 {
  margin: 7px 0 6px;
  color: var(--text-strong);
  font-size: 18px;
  font-weight: 620;
}

.input-lab-header p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.input-lab-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  justify-content: flex-end;
}

.input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 18px;
}

.part-editor {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #2d3942;
  border-radius: 5px;
  background: #141b20;
}

.part-editor-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #29353d;
}

.part-editor-header strong,
.part-editor-header span {
  display: block;
}

.part-editor-header strong {
  color: #dce2e5;
  font-size: 12px;
}

.part-editor-header span {
  margin-top: 2px;
  color: #697983;
  font-size: 9px;
}

.part-editor-header > div:last-child {
  display: flex;
  gap: 5px;
}

.editor-icon-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 8px;
  border: 1px solid #34424a;
  border-radius: 4px;
  color: #9eabb3;
  background: #10161a;
  font-size: 9px;
  font-weight: 650;
}

.editable-table-wrap {
  overflow-x: auto;
}

.editable-table {
  min-width: 690px;
}

.editable-table th {
  padding: 8px 7px;
}

.editable-table td {
  padding: 6px;
}

.editable-table input,
.editable-table select {
  width: 100%;
  min-width: 72px;
  padding: 7px 8px;
  border: 1px solid #2c3941;
  border-radius: 3px;
  outline: none;
  color: #cdd5da;
  background: #0f1519;
  font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
}

.editable-table input:focus,
.editable-table select:focus {
  border-color: #5c9186;
  box-shadow: 0 0 0 1px #315d55;
}

.row-delete-button {
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;
  border: 1px solid #553636;
  border-radius: 3px;
  color: #ba6b68;
  background: #231718;
}

.empty-table-cell {
  height: 90px;
  color: #62717b;
  text-align: center;
}

.hidden-file-input {
  display: none;
}

.input-lab-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #26323a;
}

.file-help {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #71818b;
  font-size: 9px;
}

.file-help svg {
  color: var(--accent);
}

.file-help code {
  color: #9eabb3;
}

.input-lab-message {
  flex: 1 1 100%;
  color: #9ab0aa;
  font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
}

@media (max-width: 1150px) {
  .input-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .input-lab-header {
    flex-direction: column;
  }

  .input-lab-actions {
    justify-content: flex-start;
  }
}
EOF

echo
echo "SUCCESS: visitor-editable validation sandbox added."
