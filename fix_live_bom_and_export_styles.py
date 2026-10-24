from pathlib import Path
import re

ROOT = Path("/Users/vedha/Vedha/App/digital-twin-validation-platform")
APP = ROOT / "frontend" / "src" / "App.jsx"
LAB = ROOT / "frontend" / "src" / "components" / "ValidationInputLab.jsx"
BOM = ROOT / "frontend" / "src" / "components" / "LiveBomComparison.jsx"
STYLES = ROOT / "frontend" / "src" / "styles.css"

print("1) Creating live BOM comparison component...")

BOM.write_text(r'''import React, { useEffect, useMemo, useState } from "react";

function readInputs() {
  try {
    const raw = sessionStorage.getItem("dt_validation_inputs");

    if (!raw) {
      return { engineering: [], plm: [] };
    }

    const parsed = JSON.parse(raw);

    return {
      engineering: parsed.engineering || [],
      plm: parsed.plm || [],
    };
  } catch (error) {
    console.error("Unable to read BOM inputs:", error);
    return { engineering: [], plm: [] };
  }
}

function keyOf(value) {
  return String(value || "").trim().toUpperCase();
}

export default function LiveBomComparison() {
  const [inputs, setInputs] = useState(readInputs);

  useEffect(() => {
    const refresh = () => setInputs(readInputs());

    window.addEventListener("dt-inputs-updated", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("dt-inputs-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const rows = useMemo(() => {
    const engineeringMap = new Map(
      (inputs.engineering || []).map((part) => [keyOf(part.partNumber), part])
    );

    const plmMap = new Map(
      (inputs.plm || []).map((part) => [keyOf(part.partNumber), part])
    );

    const partNumbers = Array.from(
      new Set([...engineeringMap.keys(), ...plmMap.keys()])
    ).filter(Boolean);

    return partNumbers.map((partNumber) => {
      const engineering = engineeringMap.get(partNumber);
      const plm = plmMap.get(partNumber);

      let aligned = true;
      const issues = [];

      if (!engineering) {
        aligned = false;
        issues.push("missing in Engineering");
      }

      if (!plm) {
        aligned = false;
        issues.push("missing in PLM");
      }

      if (engineering && plm) {
        if (keyOf(engineering.revision) !== keyOf(plm.revision)) {
          aligned = false;
          issues.push("revision");
        }

        if (Number(engineering.quantity) !== Number(plm.quantity)) {
          aligned = false;
          issues.push("quantity");
        }

        if (keyOf(engineering.lifecycle) !== keyOf(plm.lifecycle)) {
          aligned = false;
          issues.push("lifecycle");
        }
      }

      return {
        partNumber,
        name: engineering?.name || plm?.name || "",
        engineering,
        plm,
        aligned,
        issues,
      };
    });
  }, [inputs]);

  return (
    <div className="live-bom">
      <div className="live-bom-header">
        <div>
          <span className="live-bom-kicker">BILL OF MATERIALS</span>
          <h3>Engineering vs. PLM comparison</h3>
          <p>
            This table reflects the current Engineering/CAD and PLM values from
            the Overview test workspace.
          </p>
        </div>

        <span className="live-bom-badge">LIVE INPUT</span>
      </div>

      {rows.length === 0 ? (
        <div className="live-bom-empty">
          No input data available. Open Overview and load or enter test data.
        </div>
      ) : (
        <div className="live-bom-table-wrap">
          <table className="live-bom-table">
            <thead>
              <tr>
                <th>Part</th>
                <th>Engineering</th>
                <th>PLM</th>
                <th>Data state</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.partNumber}>
                  <td>
                    <strong>{row.partNumber}</strong>
                    <span>{row.name}</span>
                  </td>

                  <td>
                    {row.engineering ? (
                      <>
                        <strong>
                          Rev {row.engineering.revision} · Qty {row.engineering.quantity}
                        </strong>
                        <span>{row.engineering.lifecycle}</span>
                      </>
                    ) : (
                      <span className="live-bom-missing">Missing</span>
                    )}
                  </td>

                  <td>
                    {row.plm ? (
                      <>
                        <strong>
                          Rev {row.plm.revision} · Qty {row.plm.quantity}
                        </strong>
                        <span>{row.plm.lifecycle}</span>
                      </>
                    ) : (
                      <span className="live-bom-missing">Missing</span>
                    )}
                  </td>

                  <td>
                    <span
                      className={
                        row.aligned
                          ? "live-bom-state aligned"
                          : "live-bom-state mismatch"
                      }
                    >
                      {row.aligned ? "✓ Aligned" : "× Mismatch"}
                    </span>

                    {!row.aligned && (
                      <small>{row.issues.join(", ")} difference</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
''')

print("2) Publishing Overview inputs live to BOM...")

lab = LAB.read_text()

if "useEffect" not in lab:
    lab = lab.replace(
        'import { useMemo, useRef, useState } from "react";',
        'import { useEffect, useMemo, useRef, useState } from "react";'
    )
    lab = lab.replace(
        'import React, { useMemo, useRef, useState } from "react";',
        'import React, { useEffect, useMemo, useRef, useState } from "react";'
    )

if 'window.dispatchEvent(new Event("dt-inputs-updated"))' not in lab:
    marker = "  const plmUpload = useRef(null);"

    if marker not in lab:
        raise RuntimeError("Could not find plmUpload ref in ValidationInputLab.jsx")

    effect = '''
  useEffect(() => {
    sessionStorage.setItem(
      "dt_validation_inputs",
      JSON.stringify({ engineering, plm })
    );

    window.dispatchEvent(new Event("dt-inputs-updated"));
  }, [engineering, plm]);
'''

    lab = lab.replace(marker, marker + "\n" + effect, 1)

LAB.write_text(lab)

print("3) Replacing static BOM tab with live BOM component...")

app = APP.read_text()

import_line = 'import LiveBomComparison from "./components/LiveBomComparison";'

if import_line not in app:
    imports = list(re.finditer(r'^import .*?;\s*$', app, re.MULTILINE))

    if not imports:
        raise RuntimeError("Could not find imports in App.jsx")

    pos = imports[-1].end()
    app = app[:pos] + "\n" + import_line + app[pos:]

condition = re.search(
    r'\{activeTab\s*===\s*["\']([^"\']*bom[^"\']*)["\']\s*&&',
    app,
    flags=re.IGNORECASE,
)

if not condition:
    raise RuntimeError("Could not find BOM activeTab block in App.jsx")

tab_value = condition.group(1)
start = condition.start()
depth = 0
end = None

for index in range(start, len(app)):
    char = app[index]

    if char == "{":
        depth += 1
    elif char == "}":
        depth -= 1

        if depth == 0:
            end = index + 1
            break

if end is None:
    raise RuntimeError("Could not determine end of BOM JSX block")

replacement = f'{{activeTab === "{tab_value}" && <LiveBomComparison />}}'

app = app[:start] + replacement + app[end:]
APP.write_text(app)

print(f'   BOM tab "{tab_value}" now uses live inputs.')

print("4) Adding professional BOM + export button styling...")

styles = STYLES.read_text()

if "/* Live BOM comparison final */" not in styles:
    styles += r'''

/* Live BOM comparison final */
.live-bom {
  padding: 26px;
}

.live-bom-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #2b3840;
}

.live-bom-kicker {
  color: #67aa9c;
  font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .11em;
}

.live-bom-header h3 {
  margin: 7px 0 6px;
  color: #e2e7e9;
  font-size: 18px;
}

.live-bom-header p {
  margin: 0;
  max-width: 700px;
  color: #85949d;
  font-size: 11px;
  line-height: 1.6;
}

.live-bom-badge {
  padding: 6px 8px;
  border: 1px solid #31594f;
  border-radius: 4px;
  color: #82b9ac;
  background: #15251f;
  font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .08em;
}

.live-bom-table-wrap {
  overflow-x: auto;
  margin-top: 16px;
}

.live-bom-table {
  width: 100%;
  border-collapse: collapse;
}

.live-bom-table th {
  padding: 10px;
  border-bottom: 1px solid #314049;
  color: #73838c;
  font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .08em;
  text-align: left;
  text-transform: uppercase;
}

.live-bom-table td {
  padding: 12px 10px;
  border-bottom: 1px solid #27343b;
  vertical-align: middle;
}

.live-bom-table td strong,
.live-bom-table td span {
  display: block;
}

.live-bom-table td strong {
  color: #cfd7db;
  font-size: 10px;
}

.live-bom-table td span:not(.live-bom-state) {
  margin-top: 3px;
  color: #70808a;
  font-size: 9px;
}

.live-bom-state {
  display: inline-flex !important;
  width: fit-content;
  font-size: 9px !important;
  font-weight: 700;
}

.live-bom-state.aligned {
  color: #74b18c;
}

.live-bom-state.mismatch {
  color: #d56e67;
}

.live-bom-table td small {
  display: block;
  margin-top: 3px;
  color: #66767f;
  font-size: 8px;
}

.live-bom-missing {
  color: #d56e67 !important;
}

.live-bom-empty {
  margin-top: 18px;
  padding: 36px 20px;
  border: 1px dashed #334149;
  border-radius: 5px;
  color: #71818a;
  text-align: center;
  font-size: 11px;
}

/* Validation export buttons final */
.validation-export-bar {
  display: flex !important;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  margin: 18px 26px 24px !important;
  padding: 14px 16px !important;
  border: 1px solid #2d3b43 !important;
  border-radius: 5px !important;
  background: #12191e !important;
}

.validation-export-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
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
  font-weight: 650;
}

.validation-export-actions {
  display: flex !important;
  flex-wrap: wrap;
  gap: 8px !important;
}

.validation-export-actions button {
  appearance: none;
  min-height: 34px;
  padding: 8px 12px !important;
  border: 1px solid #3a4a52 !important;
  border-radius: 4px !important;
  color: #b8c3c8 !important;
  background: #151d22 !important;
  font-family: inherit !important;
  font-size: 10px !important;
  font-weight: 650 !important;
  line-height: 1 !important;
  cursor: pointer;
  transition: 120ms ease;
}

.validation-export-actions button:hover {
  border-color: #5b8279 !important;
  color: #e2ebe8 !important;
  background: #192722 !important;
}

.validation-export-actions button:focus-visible {
  outline: 2px solid #5b9185;
  outline-offset: 2px;
}

@media (max-width: 760px) {
  .live-bom-header,
  .validation-export-bar {
    flex-direction: column;
    align-items: flex-start;
  }
}
'''

STYLES.write_text(styles)

print()
print("SUCCESS")
print("- BOM Comparison now uses current Overview input data")
print("- BOM updates when Engineering/PLM values change")
print("- Validation export buttons now match the site UI")
print()
print("Next:")
print("cd /Users/vedha/Vedha/App/digital-twin-validation-platform/frontend")
print("npm run build")
