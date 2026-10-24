#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/vedha/Vedha/App/digital-twin-validation-platform"
cd "$ROOT"

if [ ! -f "frontend/src/App.jsx" ] || [ ! -f "backend/app/main.py" ]; then
  echo "ERROR: Project files not found under $ROOT"
  exit 1
fi

cp frontend/src/App.jsx frontend/src/App.jsx.pre-api.backup

cat > frontend/src/api.js <<'JS'
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`API ${response.status}: ${detail || response.statusText}`);
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

function normalizeChange(change) {
  if (!change) return null;
  return {
    id: change.change_number,
    partNumber: change.part_number,
    fromRevision: change.from_revision,
    toRevision: change.to_revision,
    reason: change.reason,
    status: change.status,
  };
}

export async function initializeDemo() {
  const seed = await request("/seed", { method: "POST" });
  const detail = await request(`/products/${seed.product_id}`);

  return {
    productId: seed.product_id,
    product: {
      code: detail.product.code,
      name: detail.product.name,
      description: detail.product.description,
    },
    engineeringParts: detail.engineering_parts.map(normalizePart),
    plmParts: detail.plm_parts.map(normalizePart),
    engineeringChange: normalizeChange(detail.engineering_changes?.[0]),
  };
}

export async function executeValidation(productId) {
  const summary = await request(`/validate/${productId}`, { method: "POST" });
  const [results, defects] = await Promise.all([
    request("/validation-results"),
    request("/defects"),
  ]);

  return {
    summary: {
      partsChecked: summary.parts_checked,
      passedParts: summary.passed_parts,
      failedParts: summary.failed_parts,
      passRate: summary.pass_rate,
    },
    results: results
      .filter((x) => x.product_id === productId)
      .map((x) => ({
        partNumber: x.part_number,
        partName: "",
        status: x.status,
        issueType: x.issue_type,
        expected: x.expected,
        actual: x.actual,
        severity: x.severity,
      })),
    defects: defects
      .filter((x) => x.product_id === productId)
      .map((x) => ({
        id: x.id,
        partNumber: x.part_number,
        title: x.title,
        issueType: x.issue_type,
        severity: x.severity,
        status: x.status,
        expected: x.expected,
        actual: x.actual,
      })),
  };
}
JS

python3 - <<'PY'
from pathlib import Path
p = Path('frontend/src/App.jsx')
s = p.read_text()

s = s.replace('import React, { useMemo, useState } from "react";', 'import React, { useEffect, useMemo, useState } from "react";')

old_import = '''import {
  engineeringChange,
  engineeringParts,
  plmParts,
  product,
} from "./demoData";
import { humanize } from "./validation";'''
new_import = '''import {
  engineeringChange as demoEngineeringChange,
  engineeringParts as demoEngineeringParts,
  plmParts as demoPlmParts,
  product as demoProduct,
} from "./demoData";
import { humanize } from "./validation";
import { executeValidation, initializeDemo } from "./api";'''

if old_import not in s:
    raise SystemExit('Could not find demoData import block')
s = s.replace(old_import, new_import)

old_logic = '''  const [validation, setValidation] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [running, setRunning] = useState(false);

  const plmMap = useMemo(
    () => new Map(plmParts.map((part) => [part.partNumber, part])),
    []
  );

  const runValidation = () => {
    setRunning(true);
    window.setTimeout(() => {
      setValidation(validateProduct(engineeringParts, plmParts));
      setActiveTab("validation");
      setRunning(false);
    }, 650);
  };

  const resetDemo = () => {
    setValidation(null);
    setActiveTab("overview");
  };'''

new_logic = '''  const [validation, setValidation] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [running, setRunning] = useState(false);
  const [productId, setProductId] = useState(null);
  const [product, setProduct] = useState(demoProduct);
  const [engineeringParts, setEngineeringParts] = useState(demoEngineeringParts);
  const [plmParts, setPlmParts] = useState(demoPlmParts);
  const [engineeringChange, setEngineeringChange] = useState(demoEngineeringChange);
  const [apiStatus, setApiStatus] = useState("connecting");
  const [apiError, setApiError] = useState("");

  const plmMap = useMemo(
    () => new Map(plmParts.map((part) => [part.partNumber, part])),
    [plmParts]
  );

  useEffect(() => {
    let cancelled = false;

    async function connectBackend() {
      try {
        const data = await initializeDemo();
        if (cancelled) return;
        setProductId(data.productId);
        setProduct(data.product);
        setEngineeringParts(data.engineeringParts);
        setPlmParts(data.plmParts);
        setEngineeringChange(data.engineeringChange || demoEngineeringChange);
        setApiStatus("connected");
        setApiError("");
      } catch (error) {
        if (cancelled) return;
        setApiStatus("offline");
        setApiError(error.message);
      }
    }

    connectBackend();
    return () => { cancelled = true; };
  }, []);

  const runValidation = async () => {
    if (!productId) {
      setApiError("Backend is not connected yet.");
      return;
    }

    setRunning(true);
    setApiError("");

    try {
      const data = await executeValidation(productId);
      setValidation(data);
      setActiveTab("validation");
      setApiStatus("connected");
    } catch (error) {
      setApiStatus("offline");
      setApiError(error.message);
    } finally {
      setRunning(false);
    }
  };

  const resetDemo = () => {
    setValidation(null);
    setActiveTab("overview");
  };'''

if old_logic not in s:
    raise SystemExit('Could not find old validation logic block')
s = s.replace(old_logic, new_logic)

anchor = '''            <div className="hero-note">\n              <ShieldCheck size={18} />'''
replacement = '''            <div className="connection-row">\n              <span className={`connection-status ${apiStatus}`}>\n                <span className="connection-dot" />\n                {apiStatus === "connected" ? "FASTAPI CONNECTED" : apiStatus === "connecting" ? "CONNECTING TO FASTAPI" : "FASTAPI OFFLINE"}\n              </span>\n              {apiError && <span className="connection-error">{apiError}</span>}\n            </div>\n\n            <div className="hero-note">\n              <ShieldCheck size={18} />'''
if anchor not in s:
    raise SystemExit('Could not find hero-note anchor')
s = s.replace(anchor, replacement, 1)

s = s.replace('<Overview validation={validation} runValidation={runValidation} />', '<Overview validation={validation} runValidation={runValidation} product={product} engineeringParts={engineeringParts} engineeringChange={engineeringChange} />')
s = s.replace('<BomComparison plmMap={plmMap} />', '<BomComparison plmMap={plmMap} engineeringParts={engineeringParts} />')
s = s.replace('function Overview({ validation, runValidation }) {', 'function Overview({ validation, runValidation, product, engineeringParts, engineeringChange }) {')
s = s.replace('function BomComparison({ plmMap }) {', 'function BomComparison({ plmMap, engineeringParts }) {')

p.write_text(s)
print('App.jsx patched')
PY

cat >> frontend/src/styles.css <<'CSS'

.connection-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}
.connection-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .06em;
}
.connection-status.connected { border-color:#365f48; color:#8fc49a; background:#15271c; }
.connection-status.connecting { border-color:#5b482d; color:#d2a35d; background:#211b13; }
.connection-status.offline { border-color:#66403e; color:#d9837f; background:#2b1919; }
.connection-dot { width:6px; height:6px; border-radius:50%; background:currentColor; box-shadow:0 0 8px currentColor; }
.connection-error { max-width:520px; color:#b98582; font-size:10px; line-height:1.4; }
CSS

cat > frontend/.env.example <<'ENV'
VITE_API_BASE_URL=http://127.0.0.1:8000
ENV

echo "SUCCESS: React is now wired to FastAPI."
