const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

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

function normalizePart(part) {
  return {
    partNumber: part.part_number,
    name: part.name,
    revision: part.revision,
    quantity: part.quantity,
    lifecycle: part.lifecycle,
  };
}

export async function loadProductData() {
  const seed = await request("/seed", {
    method: "POST",
  });

  const data = await request(`/products/${seed.product_id}`);

  const change = data.engineering_changes?.[0];

  return {
    productId: seed.product_id,

    product: {
      code: data.product.code,
      name: data.product.name,
      description: data.product.description,
    },

    engineeringParts: data.engineering_parts.map(normalizePart),

    plmParts: data.plm_parts.map(normalizePart),

    engineeringChange: change
      ? {
          id: change.change_number,
          partNumber: change.part_number,
          fromRevision: change.from_revision,
          toRevision: change.to_revision,
          reason: change.reason,
          status: change.status,
        }
      : null,
  };
}

export async function executeValidation(productId = 1) {
  const summary = await request(`/validate/${productId}`, {
    method: "POST",
  });

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
