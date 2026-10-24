const API_BASE = "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`API ${response.status}: ${detail}`);
  }

  return response.json();
}

export async function executeValidation() {
  // Make sure demo product exists first.
  const seed = await request("/seed", {
    method: "POST",
  });

  const productId = seed.product_id;

  // Run backend validation.
  const summary = await request(`/validate/${productId}`, {
    method: "POST",
  });

  // Load backend-generated results and defects.
  const results = await request("/validation-results");
  const defects = await request("/defects");

  return {
    summary: {
      partsChecked: summary.parts_checked,
      passedParts: summary.passed_parts,
      failedParts: summary.failed_parts,
      passRate: summary.pass_rate,
    },

    results: results
      .filter((item) => item.product_id === productId)
      .map((item) => ({
        partNumber: item.part_number,
        partName: "",
        status: item.status,
        issueType: item.issue_type,
        expected: item.expected,
        actual: item.actual,
        severity: item.severity,
      })),

    defects: defects
      .filter((item) => item.product_id === productId)
      .map((item) => ({
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
