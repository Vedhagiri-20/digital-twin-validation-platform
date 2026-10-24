#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/vedha/Vedha/App/digital-twin-validation-platform"
cd "$ROOT"

cp frontend/src/App.jsx frontend/src/App.jsx.before-popup-downloads
cp frontend/src/components/ValidationInputLab.jsx frontend/src/components/ValidationInputLab.jsx.before-downloads

python3 - <<'PY'
from pathlib import Path
import re

p = Path('frontend/src/App.jsx')
s = p.read_text()

# Replace Architecture link with a popup message.
popup = '''<button
              type="button"
              className="nav-link-button"
              onClick={() => window.alert(
                "SYSTEM ARCHITECTURE\\n\\n" +
                "1. React Frontend — editable Engineering/CAD and PLM test data\\n" +
                "2. FastAPI — validation rules for missing parts, revisions, quantities and lifecycle states\\n" +
                "3. PostgreSQL / Neon — persistent demo product, PLM and validation data\\n\\n" +
                "Flow: Engineering/CAD → FastAPI validation → PLM comparison → Results + Defects"
              )}
            >
              Architecture
            </button>'''

patterns = [
    r'<a[^>]*href=["\']#architecture["\'][^>]*>\s*Architecture\s*</a>',
    r'<a[^>]*>\s*Architecture\s*</a>'
]

changed = False
for pattern in patterns:
    new_s, count = re.subn(pattern, popup, s, count=1, flags=re.IGNORECASE)
    if count:
        s = new_s
        changed = True
        break

if not changed and 'nav-link-button' not in s:
    print('WARNING: Architecture nav link was not automatically replaced.')

p.write_text(s)
print('App.jsx updated.')
PY

python3 - <<'PY'
from pathlib import Path

p = Path('frontend/src/components/ValidationInputLab.jsx')
s = p.read_text()

# Add Download icon once.
if '  Download,\n' not in s:
    s = s.replace('  FileJson,\n', '  Download,\n  FileJson,\n', 1)

# Keep latest result for exports.
marker = '  const [message, setMessage] = useState("");'
if 'const [lastResult, setLastResult]' not in s:
    if marker not in s:
        raise SystemExit('ERROR: message state not found')
    s = s.replace(marker, marker + '\n  const [lastResult, setLastResult] = useState(null);', 1)

call = '      const result = await executeCustomValidation(engineering, plm);'
if 'setLastResult(result);' not in s:
    if call not in s:
        raise SystemExit('ERROR: custom validation call not found')
    s = s.replace(call, call + '\n      setLastResult(result);', 1)

return_marker = '  return (\n    <section className="input-lab">'
if 'const downloadInputCsv = () =>' not in s:
    if return_marker not in s:
        raise SystemExit('ERROR: component return marker not found')

    helpers = r'''
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

'''

    s = s.replace(return_marker, helpers + return_marker, 1)

run_marker = '''          <button
            className="primary-button compact"
            onClick={validate}
            disabled={running}
          >'''

if 'Download input CSV' not in s:
    if run_marker not in s:
        raise SystemExit('ERROR: run validation button not found')

    buttons = r'''          <button className="ghost-button" onClick={downloadInputCsv}>
            <Download size={15} />
            Download input CSV
          </button>

          <button
            className="ghost-button"
            onClick={downloadResultCsv}
            disabled={!lastResult}
          >
            <Download size={15} />
            Download result CSV
          </button>

          <button className="ghost-button" onClick={downloadExcel}>
            <Download size={15} />
            Download Excel
          </button>

'''
    s = s.replace(run_marker, buttons + run_marker, 1)

p.write_text(s)
print('ValidationInputLab.jsx updated.')
PY

cat >> frontend/src/styles.css <<'EOF'

/* Architecture is now shown as a popup from the top navigation. */
#architecture {
  display: none !important;
}

.nav-link-button {
  border: 0;
  padding: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.nav-link-button:hover {
  color: var(--text-strong);
}

.input-lab-actions .ghost-button:disabled {
  opacity: .42;
  cursor: not-allowed;
}
EOF

echo
echo "SUCCESS: Architecture popup + CSV/Excel downloads added."
echo "Now run:"
echo "  cd frontend"
echo "  npm run build"
echo "  npm run dev"
