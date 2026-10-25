import React, { useEffect, useRef, useState } from "react";
import "../styles/validation-input-lab.css";

const DEFAULT_ENGINEERING = [
  {
    part_number: "MOTOR-001",
    name: "Servo Motor",
    revision: "C",
    quantity: 1,
    lifecycle: "RELEASED",
  },
  {
    part_number: "STAGE-002",
    name: "Linear Stage",
    revision: "B",
    quantity: 1,
    lifecycle: "RELEASED",
  },
];

const DEFAULT_PLM = [
  {
    part_number: "MOTOR-001",
    name: "Servo Motor",
    revision: "B",
    quantity: 1,
    lifecycle: "RELEASED",
  },
  {
    part_number: "STAGE-002",
    name: "Linear Stage",
    revision: "B",
    quantity: 1,
    lifecycle: "RELEASED",
  },
];


const PART_CATALOG = [
  { part_number: "MOTOR-001", name: "Servo Motor" },
  { part_number: "STAGE-002", name: "Linear Stage" },
  { part_number: "BEARING-004", name: "Precision Bearing" },
  { part_number: "SENSOR-007", name: "Position Sensor" },
  { part_number: "CABLE-011", name: "Feedback Cable" },
  { part_number: "PLATE-012", name: "Mounting Plate" },
  { part_number: "GUIDE-013", name: "Linear Guide" },
  { part_number: "ENCODER-014", name: "Rotary Encoder" },
  { part_number: "BRACKET-015", name: "Motor Bracket" },
  { part_number: "CONTROLLER-016", name: "Motion Controller" },
  { part_number: "DRIVE-017", name: "Servo Drive" },
  { part_number: "FASTENER-018", name: "Precision Fastener" },
];

const LIFE_CYCLE_OPTIONS = ["RELEASED", "IN_REVIEW", "DRAFT", "OBSOLETE"];

function emptyPart() {
  return {
    part_number: "",
    name: "",
    revision: "",
    quantity: 1,
    lifecycle: "RELEASED",
  };
}

function normalizeRow(row = {}) {
  return {
    part_number: row.part_number ?? row.partNumber ?? "",
    name: row.name ?? "",
    revision: row.revision ?? row.rev ?? "",
    quantity: Number(row.quantity ?? row.qty ?? 1) || 1,
    lifecycle: row.lifecycle ?? "RELEASED",
  };
}

function seedRows(rows, fallback) {
  const source = Array.isArray(rows) && rows.length ? rows : fallback;
  return source.slice(0, 2).map(normalizeRow);
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? "";
    });
    return normalizeRow({
      part_number: row.part_number,
      name: row.name,
      revision: row.revision,
      quantity: row.quantity,
      lifecycle: row.lifecycle,
    });
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}


function buildWorkspaceValidation(engineeringRows, plmRows, apiData = {}) {
  const engineering = Array.isArray(engineeringRows)
    ? engineeringRows.filter((row) => row?.part_number)
    : [];

  const plm = Array.isArray(plmRows)
    ? plmRows.filter((row) => row?.part_number)
    : [];

  const results = [];
  const defects = [];

  engineering.forEach((eng, index) => {
    const target = plm.find(
      (row) => row.part_number === eng.part_number
    );

    const issues = [];

    if (!target) {
      issues.push({
        type: "Missing In PLM",
        expected: "Part exists in PLM",
        actual: "Part missing",
        severity: "HIGH",
      });
    } else {
      if (String(eng.revision) !== String(target.revision)) {
        issues.push({
          type: "Revision Mismatch",
          expected: String(eng.revision),
          actual: String(target.revision),
          severity: "HIGH",
        });
      }

      if (Number(eng.quantity) !== Number(target.quantity)) {
        issues.push({
          type: "Quantity Mismatch",
          expected: String(eng.quantity),
          actual: String(target.quantity),
          severity: "MEDIUM",
        });
      }

      if (String(eng.lifecycle) !== String(target.lifecycle)) {
        issues.push({
          type: "Lifecycle Mismatch",
          expected: String(eng.lifecycle),
          actual: String(target.lifecycle),
          severity: "MEDIUM",
        });
      }
    }

    const passed = issues.length === 0;
    const mainIssue = issues[0];

    results.push({
      id: `RESULT-${index + 1}`,

      part_number: eng.part_number,
      partNumber: eng.part_number,
      name: eng.name,

      revision: eng.revision,
      quantity: eng.quantity,
      lifecycle: eng.lifecycle,

      aligned: passed,
      passed,

      status: passed ? "PASS" : "FAIL",
      result: passed ? "PASS" : "FAIL",

      dataState: passed ? "Aligned" : "Mismatch",
      data_state: passed ? "Aligned" : "Mismatch",

      defectType: mainIssue?.type ?? null,
      defect_type: mainIssue?.type ?? null,

      expected:
        mainIssue?.expected ??
        "Engineering and PLM data aligned",

      actual:
        mainIssue?.actual ??
        "Engineering and PLM data aligned",

      severity: mainIssue?.severity ?? "PASS",

      issues,
    });

    issues.forEach((issue) => {
      const defectNumber = defects.length + 1;

      defects.push({
        id: `DEF-${String(defectNumber).padStart(4, "0")}`,
        defect_id: `DEF-${String(defectNumber).padStart(4, "0")}`,

        part_number: eng.part_number,
        partNumber: eng.part_number,
        name: eng.name,

        title: `${issue.type}: ${eng.part_number}`,

        type: issue.type,
        defectType: issue.type,
        defect_type: issue.type,

        expected: issue.expected,
        actual: issue.actual,

        severity: issue.severity,
        status: "OPEN",
      });
    });
  });

  const partsChecked = results.length;
  const passedParts = results.filter((item) => item.passed).length;
  const failedParts = partsChecked - passedParts;

  const passPercentage =
    partsChecked > 0
      ? Math.round((passedParts / partsChecked) * 100)
      : 0;

  const source =
    apiData?.validation ??
    apiData?.result ??
    apiData?.data ??
    apiData ??
    {};

  return {
    ...source,

    engineering,
    engineeringParts: engineering,

    plm,
    plmParts: plm,

    results,
    validationResults: results,
    validation_results: results,

    defects,

    partsChecked,
    passedParts,
    failedParts,

    passPercentage,
    pass_percentage: passPercentage,

    summary: {
      ...(source?.summary ?? {}),

      partsChecked,
      passedParts,
      failedParts,

      parts_checked: partsChecked,
      passed_parts: passedParts,
      failed_parts: failedParts,

      passPercentage,
      pass_percentage: passPercentage,
    },
  };
}

export default function ValidationInputLab({
  initialEngineering = DEFAULT_ENGINEERING,
  initialPlm = DEFAULT_PLM,
  onValidated,
  runValidation,
}) {
  const [engineeringRows, setEngineeringRows] = useState(
    seedRows(initialEngineering, DEFAULT_ENGINEERING)
  );
  const [plmRows, setPlmRows] = useState(seedRows(initialPlm, DEFAULT_PLM));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const engineeringFileRef = useRef(null);
  const plmFileRef = useRef(null);

  useEffect(() => {
    const normalizeForStorage = (row = {}) => ({
      partNumber:
        row.partNumber ??
        row.part_number ??
        "",
      name: row.name ?? "",
      revision:
        row.revision ??
        row.rev ??
        "",
      quantity:
        Number(
          row.quantity ??
          row.qty ??
          1
        ) || 1,
      lifecycle:
        row.lifecycle ??
        "RELEASED",
    });

    const payload = {
      engineering: engineeringRows.map(normalizeForStorage),
      plm: plmRows.map(normalizeForStorage),
    };

    try {
      sessionStorage.setItem(
        "dt_validation_inputs",
        JSON.stringify(payload)
      );

      window.dispatchEvent(
        new Event("dt-inputs-updated")
      );
    } catch (error) {
      console.error(
        "Unable to persist validation inputs:",
        error
      );
    }
  }, [engineeringRows, plmRows]);


  const updateRow = (setter, index, field, value) => {
    setter((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              [field]: field === "quantity" ? Number(value || 0) : value,
            }
          : row
      )
    );
  };

  const removeRow = (setter, rows, index) => {
    if (rows.length <= 1) return;
    setter(rows.filter((_, i) => i !== index));
  };

  const addRow = (setter) => {
    setter((prev) => [...prev, emptyPart()]);
  };

  const loadSample = () => {
    setEngineeringRows(DEFAULT_ENGINEERING);
    setPlmRows(DEFAULT_PLM);
    setError("");
  };

  const handleImport = async (event, setter) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const text = await readFile(file);
      let rows = [];

      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          rows = parsed.map(normalizeRow);
        } else if (Array.isArray(parsed.parts)) {
          rows = parsed.parts.map(normalizeRow);
        }
      } else {
        rows = parseCsv(text);
      }

      if (rows.length) {
        setter(rows.slice(0, 2));
      }
    } catch (err) {
      console.error(err);
      setError("Import failed. Please use CSV or JSON in the correct format.");
    } finally {
      event.target.value = "";
    }
  };

  const goToValidationTab = () => {
    setTimeout(() => {
      const candidates = Array.from(
        document.querySelectorAll("button, [role='tab'], a")
      );

      const validationTab = candidates.find((element) => {
        const text = (element.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

        return text === "validation";
      });

      if (validationTab) {
        validationTab.click();

        validationTab.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }, 200);
  };

  const handleRun = async () => {
    setLoading(true);
    setError("");

    const payload = {
      engineeringParts: engineeringRows,
      plmParts: plmRows,
    };

    try {
      if (typeof runValidation === "function") {
        await runValidation(payload);
      } else if (typeof onValidated === "function") {
        await onValidated(buildWorkspaceValidation(engineeringRows, plmRows, payload));
      }
      goToValidationTab();
    } catch (err) {
      console.error(err);
      setError("Validation failed. Please check the backend connection.");
    } finally {
      setLoading(false);
    }
  };

  const renderDataset = (title, subtitle, rows, setter, fileRef, variant) => (
    <section className={`validation-card validation-card--${variant}`}>
      <div className="validation-card__image" />
      <div className="validation-card__inner">
        <div className="validation-card__header">
          <div>
            <h3 className="validation-card__title">{title}</h3>
            <p className="validation-card__subtitle">{subtitle}</p>
          </div>

          <div className="validation-card__actions">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json"
              className="validation-hidden-file"
              onChange={(e) => handleImport(e, setter)}
            />
            <button
              type="button"
              className="validation-btn"
              onClick={() => fileRef.current?.click()}
            >
              Import
            </button>
            <button
              type="button"
              className="validation-btn"
              onClick={() => addRow(setter)}
            >
              + Add part
            </button>
          </div>
        </div>

        <div className="validation-card__table">
          <div className="validation-table-head">
            <div>Part #</div>
            <div>Name</div>
            <div>Rev</div>
            <div>Qty</div>
            <div>Lifecycle</div>
            <div />
          </div>

          {rows.map((row, index) => (
            <div className="validation-table-row" key={`${title}-${index}`}>
              <select
                className="validation-input"
                value={row.part_number}
                onChange={(e) => {
                  const selectedPart = PART_CATALOG.find(
                    (item) => item.part_number === e.target.value
                  );

                  setter((currentRows) =>
                    currentRows.map((currentRow, rowIndex) =>
                      rowIndex === index
                        ? {
                            ...currentRow,
                            part_number: e.target.value,
                            name: selectedPart?.name ?? "",
                          }
                        : currentRow
                    )
                  );
                }}
              >
                <option value="">Select part</option>
                {PART_CATALOG.map((item) => (
                  <option key={item.part_number} value={item.part_number}>
                    {item.part_number}
                  </option>
                ))}
              </select>

              <select
                className="validation-input"
                value={row.name}
                onChange={(e) => {
                  const selectedPart = PART_CATALOG.find(
                    (item) => item.name === e.target.value
                  );

                  setter((currentRows) =>
                    currentRows.map((currentRow, rowIndex) =>
                      rowIndex === index
                        ? {
                            ...currentRow,
                            name: e.target.value,
                            part_number: selectedPart?.part_number ?? "",
                          }
                        : currentRow
                    )
                  );
                }}
              >
                <option value="">Select name</option>
                {PART_CATALOG.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                className="validation-input"
                value={row.revision}
                onChange={(e) =>
                  updateRow(setter, index, "revision", e.target.value)
                }
                placeholder="A"
              />
              <input
                className="validation-input"
                type="number"
                min="1"
                value={row.quantity}
                onChange={(e) =>
                  updateRow(setter, index, "quantity", e.target.value)
                }
              />
              <select
                className="validation-select"
                value={row.lifecycle}
                onChange={(e) =>
                  updateRow(setter, index, "lifecycle", e.target.value)
                }
              >
                {LIFE_CYCLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="validation-remove"
                onClick={() => removeRow(setter, rows, index)}
                title="Remove row"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <path
                    d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  return (
    <section className="validation-lab-clean">
      <div className="validation-lab-clean__top">
        <div>
          <div className="validation-lab-clean__eyebrow">Test data workspace</div>
          <h2 className="validation-lab-clean__title">
            Test your own Engineering and PLM data
          </h2>
          <p className="validation-lab-clean__desc">
            Clean 2-column workspace with only 2 default rows on each side.
            Engineering/CAD is the expected source definition and PLM is the
            target being validated.
          </p>
        </div>

        <div className="validation-lab-clean__run">
          <button
            type="button"
            className="validation-btn validation-btn--primary"
            style={{ width: "100%" }}
            onClick={handleRun}
            disabled={loading}
          >
            {loading ? "Running..." : "Run my validation"}
          </button>

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              className="validation-btn"
              onClick={loadSample}
              style={{ flex: 1 }}
            >
              Load sample
            </button>
            <button
              type="button"
              className="validation-btn validation-btn--danger"
              onClick={() => {
                setEngineeringRows(seedRows([], DEFAULT_ENGINEERING));
                setPlmRows(seedRows([], DEFAULT_PLM));
                setError("");
              }}
              style={{ flex: 1 }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="validation-lab-clean__grid">
        {renderDataset(
          "Engineering / CAD Source",
          "Expected product definition",
          engineeringRows,
          setEngineeringRows,
          engineeringFileRef,
          "engineering"
        )}

        {renderDataset(
          "PLM Target",
          "Downstream data to validate",
          plmRows,
          setPlmRows,
          plmFileRef,
          "plm"
        )}
      </div>

      {error ? <div className="validation-error">{error}</div> : null}

      <div className="validation-note">
        CSV format: <strong>part_number,name,revision,quantity,lifecycle</strong>
      </div>
    </section>
  );
}
