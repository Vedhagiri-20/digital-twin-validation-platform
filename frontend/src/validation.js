export function validateProduct(engineeringParts, plmParts) {
  const plmMap = new Map(plmParts.map((part) => [part.partNumber, part]));
  const results = [];
  const defects = [];

  for (const source of engineeringParts) {
    const target = plmMap.get(source.partNumber);

    if (!target) {
      const issue = {
        partNumber: source.partNumber,
        partName: source.name,
        status: "FAIL",
        issueType: "MISSING_IN_PLM",
        expected: "Part exists in PLM",
        actual: "Part missing",
        severity: "HIGH",
      };
      results.push(issue);
      defects.push(toDefect(issue, defects.length + 1));
      continue;
    }

    const issues = [];
    if (source.revision !== target.revision) {
      issues.push({ issueType: "REVISION_MISMATCH", expected: source.revision, actual: target.revision, severity: "HIGH" });
    }
    if (source.quantity !== target.quantity) {
      issues.push({ issueType: "QUANTITY_MISMATCH", expected: String(source.quantity), actual: String(target.quantity), severity: "MEDIUM" });
    }
    if (source.lifecycle !== target.lifecycle) {
      issues.push({ issueType: "LIFECYCLE_MISMATCH", expected: source.lifecycle, actual: target.lifecycle, severity: "MEDIUM" });
    }

    if (issues.length === 0) {
      results.push({
        partNumber: source.partNumber,
        partName: source.name,
        status: "PASS",
        issueType: "",
        expected: "",
        actual: "",
        severity: "LOW",
      });
    } else {
      for (const detail of issues) {
        const issue = { partNumber: source.partNumber, partName: source.name, status: "FAIL", ...detail };
        results.push(issue);
        defects.push(toDefect(issue, defects.length + 1));
      }
    }
  }

  const passedParts = new Set(results.filter((r) => r.status === "PASS").map((r) => r.partNumber)).size;
  const failedParts = new Set(results.filter((r) => r.status === "FAIL").map((r) => r.partNumber)).size;

  return {
    results,
    defects,
    summary: {
      partsChecked: engineeringParts.length,
      passedParts,
      failedParts,
      passRate: engineeringParts.length === 0 ? 0 : Math.round((passedParts / engineeringParts.length) * 100),
    },
  };
}

function toDefect(issue, index) {
  return {
    id: `DEF-${String(1000 + index)}`,
    partNumber: issue.partNumber,
    title: humanize(issue.issueType),
    issueType: issue.issueType,
    severity: issue.severity,
    status: "OPEN",
    expected: issue.expected,
    actual: issue.actual,
  };
}

export function humanize(value) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
