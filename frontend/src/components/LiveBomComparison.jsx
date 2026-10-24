import React, { useEffect, useMemo, useState } from "react";

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
