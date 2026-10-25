import React from "react";
import ExcelJS from "exceljs";
import reportImageUrl from "../assets/cad_to_plm_validation_flow.png";

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
  const blob = new Blob([content], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function getPartNumber(part = {}) {
  return part.partNumber ?? part.part_number ?? "";
}

function getPartName(part = {}) {
  return part.partName ?? part.part_name ?? part.name ?? "";
}

function getRevision(part = {}) {
  return part.revision ?? part.rev ?? "";
}

function getQuantity(part = {}) {
  return Number(part.quantity ?? part.qty ?? 0);
}

function getLifecycle(part = {}) {
  return (
    part.lifecycle ??
    part.lifecycleState ??
    part.lifecycle_state ??
    ""
  );
}

function normalizeResult(row = {}) {
  return {
    partNumber:
      row.partNumber ??
      row.part_number ??
      "",

    partName:
      row.partName ??
      row.part_name ??
      row.name ??
      "",

    status: String(
      row.status ?? ""
    ).toUpperCase(),

    issueType:
      row.issueType ??
      row.issue_type ??
      row.defectType ??
      row.defect_type ??
      row.check ??
      row.message ??
      "Aligned",

    expected:
      row.expected ??
      row.expectedValue ??
      row.expected_value ??
      "",

    actual:
      row.actual ??
      row.actualValue ??
      row.actual_value ??
      "",

    severity: String(
      row.severity ??
      ""
    ).toUpperCase(),
  };
}

function normalizeDefect(row = {}) {
  return {
    id:
      row.id ??
      row.defectId ??
      row.defect_id ??
      "",

    partNumber:
      row.partNumber ??
      row.part_number ??
      "",

    issueType:
      row.issueType ??
      row.issue_type ??
      row.defectType ??
      row.defect_type ??
      row.title ??
      "Validation defect",

    status: String(
      row.status ?? "OPEN"
    ).toUpperCase(),

    expected:
      row.expected ??
      row.expectedValue ??
      row.expected_value ??
      "",

    actual:
      row.actual ??
      row.actualValue ??
      row.actual_value ??
      "",

    severity: String(
      row.severity ?? ""
    ).toUpperCase(),
  };
}

function normalizePercentage(value) {
  if (typeof value === "string") {
    value = value.replace("%", "").trim();
  }

  let numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (numeric > 0 && numeric <= 1) {
    numeric *= 100;
  }

  return Math.round(numeric);
}

function getReportData(validationProp, engineeringProp, plmProp) {
  const stored = readStoredData();

  const result =
    validationProp ??
    stored.result ??
    null;

  const engineeringFromResult =
    result?.engineering ??
    result?.engineeringParts ??
    result?.engineering_parts;

  const plmFromResult =
    result?.plm ??
    result?.plmParts ??
    result?.plm_parts;

  const inputs = {
    engineering: Array.isArray(engineeringFromResult)
      ? engineeringFromResult
      : Array.isArray(engineeringProp)
      ? engineeringProp
      : Array.isArray(stored.inputs?.engineering)
      ? stored.inputs.engineering
      : [],

    plm: Array.isArray(plmFromResult)
      ? plmFromResult
      : Array.isArray(plmProp)
      ? plmProp
      : Array.isArray(stored.inputs?.plm)
      ? stored.inputs.plm
      : [],
  };

  const engineering = Array.isArray(inputs?.engineering)
    ? inputs.engineering
    : [];

  const plm = Array.isArray(inputs?.plm)
    ? inputs.plm
    : [];

  const results = Array.isArray(result?.results)
    ? result.results.map(normalizeResult)
    : [];

  const defects = Array.isArray(result?.defects)
    ? result.defects.map(normalizeDefect)
    : [];

  const computedChecked = results.length;

  const computedPassed = results.filter(
    (row) => row.status === "PASS"
  ).length;

  const computedFailed =
    computedChecked - computedPassed;

  const computedRate = computedChecked
    ? Math.round(
        (computedPassed / computedChecked) * 100
      )
    : 0;

  const summary = result?.summary ?? {};

  const partsChecked =
    summary.partsChecked ??
    summary.parts_checked ??
    summary.totalParts ??
    summary.total_parts ??
    computedChecked;

  const passedParts =
    summary.passedParts ??
    summary.passed_parts ??
    summary.passed ??
    computedPassed;

  const failedParts =
    summary.failedParts ??
    summary.failed_parts ??
    summary.failed ??
    computedFailed;

  const rawPassRate =
    summary.passRate ??
    summary.pass_rate ??
    summary.passPercentage ??
    summary.pass_percentage ??
    computedRate;

  return {
    inputs: {
      engineering,
      plm,
    },

    result,
    results,
    defects,

    summary: {
      partsChecked: Number(partsChecked) || 0,
      passedParts: Number(passedParts) || 0,
      failedParts: Number(failedParts) || 0,
      passRate: normalizePercentage(rawPassRate),
    },
  };
}

async function imageToBase64(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Unable to load report image: ${response.status}`
    );
  }

  const blob = await response.blob();

  return await new Promise(
    (resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () =>
        resolve(String(reader.result || ""));

      reader.onerror = reject;

      reader.readAsDataURL(blob);
    }
  );
}

function borderStyle() {
  return {
    top: {
      style: "thin",
      color: { argb: "FFD5D9DD" },
    },
    left: {
      style: "thin",
      color: { argb: "FFD5D9DD" },
    },
    bottom: {
      style: "thin",
      color: { argb: "FFD5D9DD" },
    },
    right: {
      style: "thin",
      color: { argb: "FFD5D9DD" },
    },
  };
}

function styleSectionTitle(
  sheet,
  rowNumber,
  title
) {
  sheet.mergeCells(
    rowNumber,
    1,
    rowNumber,
    8
  );

  const cell =
    sheet.getCell(rowNumber, 1);

  cell.value = title;

  cell.font = {
    name: "Arial",
    size: 14,
    bold: true,
    color: {
      argb: "FFFFFFFF",
    },
  };

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: "FF171717",
    },
  };

  cell.alignment = {
    vertical: "middle",
    horizontal: "left",
  };

  sheet.getRow(rowNumber).height = 28;
}

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.font = {
      name: "Arial",
      size: 10,
      bold: true,
      color: {
        argb: "FFFFFFFF",
      },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FF4B5156",
      },
    };

    cell.border = borderStyle();

    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
  });

  row.height = 26;
}

function styleDataRow(row) {
  row.eachCell((cell) => {
    cell.font = {
      name: "Arial",
      size: 10,
      color: {
        argb: "FF202428",
      },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FFFFFFFF",
      },
    };

    cell.border = borderStyle();

    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
  });

  row.height = 24;
}

export default function ValidationExports({
  validation,
  engineering = [],
  plm = [],
}) {
  const downloadInputCsv = () => {
    const { inputs } = getReportData(validation, engineering, plm);

    const rows = [
      ...inputs.engineering.map(
        (part) => [
          "ENGINEERING",
          getPartNumber(part),
          getPartName(part),
          getRevision(part),
          getQuantity(part),
          getLifecycle(part),
        ]
      ),

      ...inputs.plm.map(
        (part) => [
          "PLM",
          getPartNumber(part),
          getPartName(part),
          getRevision(part),
          getQuantity(part),
          getLifecycle(part),
        ]
      ),
    ];

    if (!rows.length) {
      window.alert(
        "Run validation first so the current inputs are available."
      );

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

    const csv = [
      header,
      ...rows,
    ]
      .map((row) =>
        row.map(csvEscape).join(",")
      )
      .join("\n");

    downloadText(
      "digital-twin-input-data.csv",
      csv
    );
  };

  const downloadResultCsv = () => {
    const {
      result,
      results,
      defects,
    } = getReportData(validation, engineering, plm);

    if (!result) {
      window.alert(
        "Run validation first so results are available."
      );

      return;
    }

    const header = [
      "record_type",
      "part_number",
      "part_name",
      "status",
      "validation_check",
      "expected",
      "actual",
      "severity",
      "defect_id",
    ];

    const resultRows =
      results.map((row) => [
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

    const defectRows =
      defects.map((row) => [
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

    const csv = [
      header,
      ...resultRows,
      ...defectRows,
    ]
      .map((row) =>
        row.map(csvEscape).join(",")
      )
      .join("\n");

    downloadText(
      "digital-twin-validation-results.csv",
      csv
    );
  };

  const downloadReport = async () => {
    try {
      const {
        inputs,
        result,
        results,
        defects,
        summary,
      } = getReportData(validation, engineering, plm);

      if (!result) {
        window.alert(
          "Run validation first so the report contains validation results."
        );

        return;
      }

      const workbook =
        new ExcelJS.Workbook();

      workbook.creator =
        "Digital Twin Validation Lab";

      workbook.title =
        "Digital Twin Validation Report";

      workbook.subject =
        "Engineering CAD to PLM validation";

      workbook.created =
        new Date();

      const sheet =
        workbook.addWorksheet(
          "Digital Twin Report",
          {
            views: [
              {
                showGridLines: false,
              },
            ],

            pageSetup: {
              orientation: "landscape",
              fitToPage: true,
              fitToWidth: 1,
              fitToHeight: 0,
              paperSize: 9,
            },
          }
        );

      sheet.columns = [
        { width: 20 },
        { width: 24 },
        { width: 16 },
        { width: 24 },
        { width: 27 },
        { width: 27 },
        { width: 16 },
        { width: 26 },
      ];

      sheet.mergeCells("A1:H2");

      const title =
        sheet.getCell("A1");

      title.value =
        "DIGITAL TWIN VALIDATION REPORT";

      title.font = {
        name: "Arial",
        size: 22,
        bold: true,
        color: {
          argb: "FFFFFFFF",
        },
      };

      title.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "FF171717",
        },
      };

      title.alignment = {
        vertical: "middle",
        horizontal: "center",
      };

      sheet.getRow(1).height = 30;
      sheet.getRow(2).height = 30;

      const imageBase64 =
        await imageToBase64(
          reportImageUrl
        );

      const imageId =
        workbook.addImage({
          base64: imageBase64,
          extension: "png",
        });

      for (
        let row = 3;
        row <= 20;
        row += 1
      ) {
        sheet.getRow(row).height = 25;
      }

      sheet.addImage(
        imageId,
        {
          tl: {
            col: 0,
            row: 2,
          },

          br: {
            col: 8,
            row: 20,
          },
        }
      );

      styleSectionTitle(
        sheet,
        22,
        "VALIDATION SUMMARY"
      );

      const summaryRow1 =
        sheet.getRow(23);

      const summaryRow2 =
        sheet.getRow(24);

      const summary1 = [
        "Report Generated",
        new Date().toLocaleString(),

        "Expected Source",
        "Engineering / CAD",

        "Validation Target",
        "PLM Target",

        "Validation Mode",
        "Engineering-to-PLM Comparison",
      ];

      const summary2 = [
        "Parts Checked",
        summary.partsChecked,

        "Passed Parts",
        summary.passedParts,

        "Failed Parts",
        summary.failedParts,

        "Pass Percentage",
        `${summary.passRate}%`,
      ];

      [
        [summaryRow1, summary1],
        [summaryRow2, summary2],
      ].forEach(([row, values]) => {
        values.forEach(
          (value, index) => {
            const cell =
              row.getCell(index + 1);

            cell.value = value;
            cell.border =
              borderStyle();

            cell.alignment = {
              vertical: "middle",
              horizontal: "left",
              wrapText: true,
            };

            if (index % 2 === 0) {
              cell.font = {
                name: "Arial",
                size: 10,
                bold: true,
              };

              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                  argb: "FFE1E4E6",
                },
              };
            } else {
              cell.font = {
                name: "Arial",
                size: 10,
              };

              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                  argb: "FFFFFFFF",
                },
              };
            }
          }
        );

        row.height = 26;
      });

      const percentCell =
        sheet.getCell("H24");

      percentCell.font = {
        name: "Arial",
        size: 11,
        bold: true,

        color: {
          argb:
            summary.passRate >= 80
              ? "FF167548"
              : summary.passRate >= 50
              ? "FFB07816"
              : "FFA31C1B",
        },
      };

      styleSectionTitle(
        sheet,
        27,
        "VALIDATION COMPARISON RESULTS"
      );

      const comparisonHeader =
        sheet.getRow(28);

      [
        "Part Number",
        "Part Name",
        "Status",
        "Validation Check",
        "Expected",
        "Actual",
        "Severity",
        "Disposition",
      ].forEach(
        (value, index) => {
          comparisonHeader.getCell(
            index + 1
          ).value = value;
        }
      );

      styleHeader(
        comparisonHeader
      );

      let rowNumber = 29;

      results.forEach((item) => {
        const row =
          sheet.getRow(rowNumber);

        const isPass =
          item.status === "PASS";

        [
          item.partNumber,
          item.partName,
          item.status ||
            (isPass
              ? "PASS"
              : "FAIL"),

          item.issueType ||
            (isPass
              ? "Aligned"
              : "Mismatch"),

          item.expected,
          item.actual,

          item.severity ||
            (isPass
              ? "PASS"
              : ""),

          isPass
            ? "Aligned — no action required"
            : "Investigate, correct and revalidate",
        ].forEach(
          (value, index) => {
            row.getCell(
              index + 1
            ).value = value;
          }
        );

        styleDataRow(row);

        row.getCell(5).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FFE1E4E6",
          },
        };

        row.getCell(6).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FFE1E4E6",
          },
        };

        row.getCell(3).font = {
          name: "Arial",
          size: 10,
          bold: true,

          color: {
            argb: isPass
              ? "FF167548"
              : "FFA31C1B",
          },
        };

        rowNumber += 1;
      });

      rowNumber += 2;

      styleSectionTitle(
        sheet,
        rowNumber,
        "ENGINEERING / CAD INPUT"
      );

      rowNumber += 1;

      const engineeringHeader =
        sheet.getRow(rowNumber);

      [
        "Part Number",
        "Name",
        "Revision",
        "Quantity",
        "Lifecycle",
        "Source",
        "",
        "",
      ].forEach(
        (value, index) => {
          engineeringHeader.getCell(
            index + 1
          ).value = value;
        }
      );

      styleHeader(
        engineeringHeader
      );

      rowNumber += 1;

      inputs.engineering.forEach(
        (part) => {
          const row =
            sheet.getRow(
              rowNumber
            );

          [
            getPartNumber(part),
            getPartName(part),
            getRevision(part),
            getQuantity(part),
            getLifecycle(part),
            "Engineering / CAD",
            "",
            "",
          ].forEach(
            (value, index) => {
              row.getCell(
                index + 1
              ).value = value;
            }
          );

          styleDataRow(row);

          rowNumber += 1;
        }
      );

      rowNumber += 2;

      styleSectionTitle(
        sheet,
        rowNumber,
        "PLM TARGET INPUT"
      );

      rowNumber += 1;

      const plmHeader =
        sheet.getRow(rowNumber);

      [
        "Part Number",
        "Name",
        "Revision",
        "Quantity",
        "Lifecycle",
        "Target",
        "",
        "",
      ].forEach(
        (value, index) => {
          plmHeader.getCell(
            index + 1
          ).value = value;
        }
      );

      styleHeader(plmHeader);

      rowNumber += 1;

      inputs.plm.forEach(
        (part) => {
          const row =
            sheet.getRow(
              rowNumber
            );

          [
            getPartNumber(part),
            getPartName(part),
            getRevision(part),
            getQuantity(part),
            getLifecycle(part),
            "PLM Target",
            "",
            "",
          ].forEach(
            (value, index) => {
              row.getCell(
                index + 1
              ).value = value;
            }
          );

          styleDataRow(row);

          rowNumber += 1;
        }
      );

      rowNumber += 2;

      styleSectionTitle(
        sheet,
        rowNumber,
        "DEFECT REGISTER"
      );

      rowNumber += 1;

      const defectHeader =
        sheet.getRow(rowNumber);

      [
        "Defect ID",
        "Part Number",
        "Issue",
        "Status",
        "Expected",
        "Actual",
        "Severity",
        "Disposition",
      ].forEach(
        (value, index) => {
          defectHeader.getCell(
            index + 1
          ).value = value;
        }
      );

      styleHeader(defectHeader);

      rowNumber += 1;

      if (defects.length) {
        defects.forEach(
          (item) => {
            const row =
              sheet.getRow(
                rowNumber
              );

            [
              item.id,
              item.partNumber,
              item.issueType,
              item.status,
              item.expected,
              item.actual,
              item.severity,
              item.status === "CLOSED"
                ? "Verified and closed"
                : "Investigate, correct and revalidate",
            ].forEach(
              (value, index) => {
                row.getCell(
                  index + 1
                ).value = value;
              }
            );

            styleDataRow(row);

            row.getCell(5).fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: {
                argb: "FFE1E4E6",
              },
            };

            row.getCell(6).fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: {
                argb: "FFE1E4E6",
              },
            };

            rowNumber += 1;
          }
        );
      } else {
        const row =
          sheet.getRow(rowNumber);

        row.getCell(1).value =
          "No validation defects were identified.";

        sheet.mergeCells(
          rowNumber,
          1,
          rowNumber,
          8
        );

        styleDataRow(row);
      }

      sheet.headerFooter.oddFooter =
        "Digital Twin Validation Lab — Engineering/CAD to PLM Validation Report";

      const buffer =
        await workbook.xlsx.writeBuffer();

      const blob =
        new Blob(
          [buffer],
          {
            type:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }
        );

      downloadBlob(
        "digital-twin-validation-report.xlsx",
        blob
      );
    } catch (error) {
      console.error(
        "Report generation failed:",
        error
      );

      window.alert(
        `Report generation failed: ${
          error?.message ||
          error
        }`
      );
    }
  };

  return (
    <div className="validation-export-bar">
      <div className="validation-export-copy">
        <span>EXPORT</span>

        <strong>
          Download validation data
        </strong>
      </div>

      <div className="validation-export-actions">
        <button
          type="button"
          onClick={
            downloadInputCsv
          }
        >
          Input CSV
        </button>

        <button
          type="button"
          onClick={
            downloadResultCsv
          }
        >
          Result CSV
        </button>

        <button
          type="button"
          onClick={
            downloadReport
          }
        >
          Report
        </button>
      </div>
    </div>
  );
}
