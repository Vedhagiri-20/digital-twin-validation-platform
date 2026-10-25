import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Boxes, CheckCircle2, ChevronRight,
  CircleDot, Code2, Database, GitCompareArrows, Github, Layers3, Play,
  RefreshCcw, ShieldCheck, Workflow, XCircle
} from "lucide-react";
import { engineeringChange, engineeringParts, plmParts, product } from "./demoData";
import { humanize } from "./validation";
import { executeValidation, loadProductData } from "./api";

import ValidationInputLab from "./components/ValidationInputLab";
import ValidationExports from "./components/ValidationExports";
import LiveBomComparison from "./components/LiveBomComparison";
import ValidationFlowCarousel from "./components/ValidationFlowCarousel";


function normalizeValidationResponse(payload) {
  const source =
    payload?.validation ??
    payload?.validationResult ??
    payload?.validation_result ??
    payload?.result ??
    payload?.data ??
    payload ??
    {};

  const results =
    source?.results ??
    source?.validationResults ??
    source?.validation_results ??
    source?.checks ??
    [];

  const defects =
    source?.defects ??
    payload?.defects ??
    [];

  const oldSummary =
    source?.summary ??
    payload?.summary ??
    {};

  const isPassed = (row) => {
    const status = String(
      row?.status ??
      row?.result ??
      row?.dataState ??
      row?.data_state ??
      ""
    ).toLowerCase();

    return (
      row?.aligned === true ||
      row?.passed === true ||
      status === "pass" ||
      status === "passed" ||
      status === "aligned" ||
      status === "success"
    );
  };

  const partsChecked = Number(
    oldSummary?.partsChecked ??
    oldSummary?.parts_checked ??
    source?.partsChecked ??
    source?.parts_checked ??
    source?.totalParts ??
    source?.total_parts ??
    results.length ??
    0
  );

  const calculatedPassed = Array.isArray(results)
    ? results.filter(isPassed).length
    : 0;

  const passedParts = Number(
    oldSummary?.passedParts ??
    oldSummary?.passed_parts ??
    source?.passedParts ??
    source?.passed_parts ??
    calculatedPassed
  );

  const failedParts = Number(
    oldSummary?.failedParts ??
    oldSummary?.failed_parts ??
    source?.failedParts ??
    source?.failed_parts ??
    Math.max(partsChecked - passedParts, 0)
  );


  const rawPassRate =
    oldSummary?.passRate ??
    oldSummary?.pass_rate ??
    oldSummary?.passPercentage ??
    oldSummary?.pass_percentage ??
    source?.passRate ??
    source?.pass_rate ??
    source?.passPercentage ??
    source?.pass_percentage;

  const parsedPassRate = Number(
    String(rawPassRate ?? "").replace("%", "").trim()
  );

  const normalizedPassRate =
    Number.isFinite(parsedPassRate)
      ? parsedPassRate
      : partsChecked > 0
      ? Math.round((passedParts / partsChecked) * 100)
      : 0;


  return {
    ...source,

    results,
    validationResults: results,
    validation_results: results,

    defects,

    partsChecked,
    passedParts,
    failedParts,

    summary: {
      ...oldSummary,

      partsChecked,
      passedParts,
      failedParts,

      // keep snake_case too in case another component needs it
      parts_checked: partsChecked,
      passed_parts: passedParts,
      failed_parts: failedParts,

      passRate: normalizedPassRate,
      pass_rate: normalizedPassRate,
      passPercentage: normalizedPassRate,
      pass_percentage: normalizedPassRate,
    },
  };
}


const steps = [
  [Boxes, "Engineering Source", "The latest product structure, part revisions, quantities and lifecycle state."],
  [Workflow, "Integration / Sync", "Product data moves to PLM through APIs, integrations or scheduled synchronization."],
  [Database, "PLM Representation", "PLM maintains the controlled digital product definition used across engineering workflows."],
  [GitCompareArrows, "Validation Engine", "The platform compares both representations and detects inconsistent engineering data."],
];

export default function App() {
  const [validation, setValidationState] = useState(null);

  const setValidation = (value) => {
    if (typeof value === "function") {
      setValidationState((previous) =>
        normalizeValidationResponse(
          value(previous)
        )
      );
      return;
    }

    setValidationState(
      value == null
        ? value
        : normalizeValidationResponse(value)
    );
  };
  const [activeTab, setActiveTab] = useState("overview");
  const [running, setRunning] = useState(false);
  const [productId, setProductId] = useState(1);
  const [liveProduct, setLiveProduct] = useState(product);
  const [liveEngineeringParts, setLiveEngineeringParts] = useState(engineeringParts);
  const [livePlmParts, setLivePlmParts] = useState(plmParts);
  const [liveEngineeringChange, setLiveEngineeringChange] = useState(engineeringChange);

  const plmMap = useMemo(
    () => new Map(livePlmParts.map((p) => [p.partNumber, p])),
    [livePlmParts]
  );
  useEffect(() => {
    loadProductData()
      .then((data) => {
        setProductId(data.productId);
        setLiveProduct(data.product);
        setLiveEngineeringParts(data.engineeringParts);
        setLivePlmParts(data.plmParts);

        if (data.engineeringChange) {
          setLiveEngineeringChange(data.engineeringChange);
        }
      })
      .catch((error) => {
        console.error("Unable to load backend product data:", error);
      });
  }, []);


  const runValidation = async () => {
    setRunning(true);

    try {
      const data = await executeValidation(productId);
      const passPercentage =
                      data?.passPercentage ??
                      data?.pass_percentage ??
                      data?.passPercent ??
                      data?.passRate ??
                      data?.summary?.passPercentage ??
                      data?.summary?.pass_percentage ??
                      (
                        Number(data?.partsChecked) > 0
                          ? Math.round(
                              (Number(data?.passedParts ?? 0) /
                                Number(data.partsChecked)) *
                                100
                            )
                          : 0
                      );

                    const validationWithUiFields = {
                      ...data,

                      passPercentage,
                      pass_percentage: passPercentage,
                      passPercent: passPercentage,
                      passRate: passPercentage,
                      passPct: passPercentage,
                      percentage: passPercentage,

                      summary: {
                        ...(data?.summary ?? {}),

                        partsChecked:
                          data?.partsChecked ??
                          data?.summary?.partsChecked ??
                          0,

                        passedParts:
                          data?.passedParts ??
                          data?.summary?.passedParts ??
                          0,

                        failedParts:
                          data?.failedParts ??
                          data?.summary?.failedParts ??
                          0,

                        passPercentage,
                        pass_percentage: passPercentage,
                        passPercent: passPercentage,
                        passRate: passPercentage,
                        passPct: passPercentage,
                        percentage: passPercentage,
                      },
                    };

                    setValidation(validationWithUiFields);
                    setActiveTab("validation");
    } catch (error) {
      console.error("FastAPI validation error:", error);
      alert("Could not connect to the FastAPI backend.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark"><Layers3 size={20} /></span>
          <span><strong>Digital Twin</strong><small>Validation Lab</small></span>
        </a>
        <nav className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#demo">Live demo</a>
          <button
              type="button"
              className="nav-link-button"
              onClick={() =>
                window.alert(`SYSTEM ARCHITECTURE

React Frontend
→ FastAPI Validation Service
→ PostgreSQL / Neon

Engineering/CAD and PLM inputs are compared for missing parts, revision, quantity, and lifecycle mismatches.`)
              }
            >
              Architecture
            </button>
          <a className="github-link" href="https://github.com/Vedhagiri-20/digital-twin-validation-platform" target="_blank" rel="noreferrer"><Github size={17}/>GitHub</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><CircleDot size={15}/> ENGINEERING VALIDATION ENVIRONMENT</div>
            <h1 className="industrial-hero-title">
  <span className="hero-green">See how</span>{" "}
  <span className="hero-white">
    engineering data stays consistent across a
  </span>{" "}
  <span className="hero-red">
    Digital Twin / PLM workflow.
  </span>
</h1>
            <p className="hero-lead">A lightweight hands-on model that compares Engineering/CAD source data with its PLM representation, validates BOM information, and exposes revision, quantity, lifecycle and synchronization defects.</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={runValidation}><Play size={17} fill="currentColor"/>Execute validation</button>
              <a className="secondary-button" href="#how-it-works">View validation flow <ArrowRight size={17}/></a>
            </div>
            <div className="hero-note"><ShieldCheck size={18}/><span>Built for learning and demonstration. This project does not represent any company's proprietary implementation.</span></div>
          </div>

          <div className="cad-plm-image-panel">
  <img
    src="/images/cad-plm-comparison.png"
    alt="3D Engineering CAD and PLM digital twin comparison"
  />
  <div className="cad-plm-image-caption">
    <span>ENGINEERING CAD</span>
    <span className="comparison-arrow">↔</span>
    <span>PLM DIGITAL TWIN</span>
  </div>
</div>
        </section>

        
      <ValidationFlowCarousel />


        <section className="section demo-section" id="demo">
          <div className="demo-top">
            <div><span className="kicker">VALIDATION WORKSPACE</span><h2>Engineering data validation console</h2><p>The source intentionally contains newer engineering information than PLM so visitors can see the validation process in action.</p></div>
            <div className="demo-actions">
              <button className="primary-button compact" onClick={runValidation} disabled={running}>{running ? <RefreshCcw className="spin" size={16}/> : <Play size={16}/>} {running ? "Validating..." : "Run validation"}</button>
              <button className="ghost-button" onClick={() => {setValidation(null);setActiveTab("overview");}}>Reset</button>
            </div>
          </div>

          <div className="workspace">
            <aside className="workspace-nav">
              {[["overview",Activity,"Overview"],["bom",Boxes,"BOM comparison"],["validation",GitCompareArrows,"Validation"],["defects",AlertTriangle,"Defects"]].map(([id,Icon,label]) => (
                <button key={id} className={activeTab===id?"active":""} onClick={() => setActiveTab(id)}><Icon size={17}/>{label}</button>
              ))}
            </aside>
            <div className="workspace-content">
              {activeTab === "overview" && (
                <>
                  <Overview validation={validation} runValidation={runValidation} productData={liveProduct} engineeringPartsData={liveEngineeringParts} engineeringChangeData={liveEngineeringChange}/>
                  <ValidationInputLab
                  initialEngineering={liveEngineeringParts}
                  initialPlm={livePlmParts}
                  onValidated={(data) => {
                    setValidation(data);
                    setActiveTab("validation");
                  }}
                />
                </>
              )} 
              {activeTab === "bom" && (
                <LiveBomComparison
                  engineeringParts={liveEngineeringParts}
                  plmParts={livePlmParts}
                />
              )} 
              {activeTab === "validation" && (
                <>
                  <ValidationView validation={validation} runValidation={runValidation}/>
                  <ValidationExports validation={validation} />
                </>
              )}
              {activeTab === "defects" && <DefectsView validation={validation} runValidation={runValidation}/>} 
            </div>
          </div>
        </section>

        <section className="section" id="architecture">
          <div className="section-heading narrow"><span className="kicker">SYSTEM ARCHITECTURE</span><h2>A lightweight three-tier validation architecture.</h2><p>The public demo starts with browser-side sample data. The next phase connects this interface to the FastAPI validation service and persistent database.</p></div>
          <div className="architecture-flow">
            <ArchitectureBox icon={Code2} title="React Frontend" detail="Educational UI + validation dashboard"/><ArrowRight size={22}/>
            <ArchitectureBox icon={Workflow} title="FastAPI" detail="REST APIs + validation service"/><ArrowRight size={22}/>
            <ArchitectureBox icon={Database} title="Database" detail="Products, BOM, PLM, defects"/>
          </div>
        </section>

        <section className="section learning-section">
          <div><span className="kicker">ENGINEERING LEARNING OBJECTIVE</span><h2>Learning Digital Twin and PLM validation through implementation.</h2></div>
          <p>Rather than studying engineering-data validation only as theory, this project models product structures, engineering changes, system synchronization, automated comparison, regression-style validation, and defect reporting in a working application.</p>
        </section>
      </main>

      <footer><div><strong>Digital Twin Engineering Validation Console</strong><span>Educational project by Vedhagiri Sabanayagam</span></div><a href="https://github.com/Vedhagiri-20/digital-twin-validation-platform" target="_blank" rel="noreferrer"><Github size={17}/>View source</a></footer>
    </div>
  );
}

function SystemCard({label,motor,bearing,warning=false,productData}) {
  return <div className="system-card"><span className="system-label">{label}</span><strong>{productData.code}</strong><p>{productData.name}</p><div className={`mini-row ${warning?"warning":""}`}><span>MOTOR-001</span><b>{motor}</b></div><div className={`mini-row ${warning?"warning":""}`}><span>BEARING-004</span><b>{bearing}</b></div></div>;
}

function Overview({validation,runValidation,productData,engineeringPartsData,engineeringChangeData}) {
  return null;
}

function BomComparison({plmMap,engineeringPartsData}) {
  return <div><div className="workspace-title"><div><span>BILL OF MATERIALS</span><h3>Engineering vs. PLM comparison</h3><p>The Engineering source is treated as the expected product definition for this educational validation scenario.</p></div></div><div className="table-wrap"><table><thead><tr><th>Part</th><th>Engineering</th><th>PLM</th><th>Data state</th></tr></thead><tbody>{engineeringPartsData.map((part)=>{const plm=plmMap.get(part.partNumber);const mismatch=!plm||part.revision!==plm.revision||part.quantity!==plm.quantity||part.lifecycle!==plm.lifecycle;return <tr key={part.partNumber}><td><strong>{part.partNumber}</strong><small>{part.name}</small></td><td>Rev {part.revision} · Qty {part.quantity}<small>{part.lifecycle}</small></td><td>{plm?<><span>Rev {plm.revision} · Qty {plm.quantity}</span><small>{plm.lifecycle}</small></>:<span className="missing">Missing</span>}</td><td><span className={mismatch?"result fail":"result pass"}>{mismatch?<XCircle size={15}/>:<CheckCircle2 size={15}/>} {mismatch?"Mismatch":"Aligned"}</span></td></tr>})}</tbody></table></div></div>;
}

function ValidationView({validation,runValidation}) {
  if(!validation) return <Empty tall icon={GitCompareArrows} title="No validation run yet" text="Run the sample comparison to generate validation results." action={runValidation}/>;
  return <div><div className="workspace-title"><div><span>VALIDATION RESULTS</span><h3>{validation?.summary?.partsChecked ?? 0} engineering parts checked</h3><p>{(validation?.summary?.passedParts ?? validation?.passedParts ?? 0)} aligned · {validation.summary?.failedParts} parts contain one or more mismatches.</p></div><span className="pass-rate">{validation.summary.passRate}% PASS</span></div><div className="results-list">{validation.results.map((item,index)=><div className="validation-row" key={`${item.partNumber}-${item.issueType}-${index}`}><div className={`result-icon ${item.status.toLowerCase()}`}>{item.status==="PASS"?<CheckCircle2 size={19}/>:<XCircle size={19}/>}</div><div><strong>{item.partNumber}</strong><span>{item.partName}</span></div><div className="validation-issue">{item.status==="PASS"?<span>Engineering and PLM data aligned</span>:<><strong>{humanize(item.issueType)}</strong><span>Expected {item.expected} · PLM has {item.actual}</span></>}</div><span className={`severity ${item.severity.toLowerCase()}`}>{item.status==="PASS"?"PASS":item.severity}</span></div>)}</div></div>;
}

function DefectsView({validation,runValidation}) {
  if(!validation) return <Empty tall icon={AlertTriangle} title="No defects generated yet" text="Defects are generated from failed validation checks." action={runValidation}/>;
  return <div><div className="workspace-title"><div><span>DEFECT REGISTER</span><h3>{validation.defects.length} validation defects</h3><p>Each failed deterministic check becomes a traceable issue for investigation and fix validation.</p></div></div><div className="defect-grid">{validation.defects.map((d)=><article className="defect-card" key={d.id}><div className="defect-top"><span>{d.id}</span><span className={`severity ${d.severity.toLowerCase()}`}>{d.severity}</span></div><h4>{d.title}</h4><p>{d.partNumber}</p><dl><div><dt>Expected</dt><dd>{d.expected}</dd></div><div><dt>Actual</dt><dd>{d.actual}</dd></div></dl><span className="status-chip open">{d.status}</span></article>)}</div></div>;
}

function Empty({icon:Icon,title,text,action,tall=false}) {return <div className={`empty-panel ${tall?"tall":""}`}><Icon size={34}/><h3>{title}</h3><p>{text}</p><button className="primary-button compact" onClick={action}><Play size={16}/>Run validation</button></div>}
function ArchitectureBox({icon:Icon,title,detail}) {return <div className="architecture-box"><Icon size={26}/><strong>{title}</strong><span>{detail}</span></div>}