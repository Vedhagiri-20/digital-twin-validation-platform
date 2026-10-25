# Digital Twin Engineering Validation Platform

A full-stack engineering validation application that demonstrates how product data can be compared and validated across an **Engineering/CAD source** and a downstream **Product Lifecycle Management (PLM) system**.

The platform models a simplified digital-continuity workflow in which engineering product structures, revisions, quantities, lifecycle states, and related metadata are synchronized with PLM and automatically checked for inconsistencies.

The project is designed as a hands-on demonstration of **Digital Twin, PLM, BOM validation, engineering-data synchronization, defect analysis, and automated validation workflows**.

---

## Project Status

**Functional MVP — Deployment Ready**

Core application functionality is implemented and working locally.

Current capabilities include:

- Engineering/CAD and PLM test-data workspaces
- Preloaded demonstration data
- Bill of Materials comparison
- Revision validation
- Quantity validation
- Lifecycle-state validation
- Missing-part detection
- Automated validation results
- Pass/fail percentage calculation
- Defect identification and severity classification
- CSV input and result exports
- Detailed Excel validation report
- Engineering-to-PLM visualization
- Interactive validation workflow
- FastAPI backend
- React frontend

---

## Why This Project

Engineering organizations often maintain product information across multiple systems such as:

- CAD platforms
- PLM/PDM systems
- Engineering databases
- Manufacturing systems
- Requirements-management systems
- Simulation environments

When engineering information changes, downstream systems must remain synchronized.

A revision mismatch, missing component, incorrect quantity, or lifecycle inconsistency can create problems across manufacturing, testing, sourcing, and product release.

This project demonstrates a simplified validation workflow for identifying those inconsistencies before they propagate further downstream.

---

## Engineering Validation Workflow

The application models four major stages of an engineering-data validation lifecycle.

### Engineering Definition

The Engineering/CAD dataset represents the expected product definition.

Typical information includes:

- Part number
- Part name
- Revision
- Quantity
- Lifecycle state

This dataset acts as the source of truth for validation.

### PLM Synchronization

Engineering information is represented inside a downstream PLM environment.

The PLM dataset may contain:

- Correct synchronized data
- Older revisions
- Incorrect quantities
- Lifecycle differences
- Missing components

These differences simulate real integration and synchronization issues.

### Automated Validation

The validation engine compares Engineering/CAD data against PLM data.

Current validation checks include:

- Part existence
- Revision consistency
- Quantity consistency
- Lifecycle-state consistency
- Missing Engineering or PLM components

Each part receives a validation result.

### Validation Analysis & Decision

Detected discrepancies are converted into validation findings.

The application presents:

- Passed parts
- Failed parts
- Validation percentage
- Expected values
- Actual PLM values
- Validation check type
- Severity
- Defect information

The results can then be exported for investigation and corrective action.

---

## Example Validation Scenario

The default demo intentionally includes both synchronized and mismatched engineering data.

For example:

| Part | Engineering/CAD | PLM Target | Result |
|---|---|---|---|
| MOTOR-001 | Revision C | Revision B | Revision mismatch |
| STAGE-002 | Revision B | Revision B | Aligned |

Running the validation engine produces:

**2 engineering parts checked**

**1 aligned**

**1 mismatch**

**50% pass**

This allows visitors to immediately understand the validation workflow without manually entering data.

---

## Key Features

### Engineering / CAD Workspace

Users can work with Engineering/CAD source data containing:

- Part numbers
- Part names
- Revisions
- Quantities
- Lifecycle states

The application includes preloaded sample data so the validation workflow can be tested immediately.

---

### PLM Target Workspace

The PLM workspace represents the downstream product definition.

Users can modify PLM data to simulate:

- Stale revisions
- Quantity discrepancies
- Lifecycle mismatches
- Missing components

---

### BOM Comparison

The Bill of Materials comparison view provides a side-by-side representation of:

**Engineering/CAD**

versus

**PLM Target**

Each part is classified as either:

- **Aligned**
- **Mismatch**

The comparison reflects the current test data rather than a static dataset.

---

### Automated Validation Engine

The application evaluates Engineering/CAD and PLM data and identifies inconsistencies automatically.

Validation checks currently include:

- Revision mismatch
- Quantity mismatch
- Lifecycle mismatch
- Missing PLM part
- Missing Engineering part
- Fully aligned component

---

### Validation Results

The validation dashboard provides a clear summary of validation execution.

It displays:

- Total engineering parts checked
- Passed parts
- Failed parts
- Pass percentage
- Part-level validation status
- Expected value
- Actual value
- Severity

---

### Defect Register

Failed validation checks are represented as traceable engineering validation defects.

Each finding can include:

- Defect identifier
- Part number
- Validation issue
- Expected value
- Actual value
- Severity
- Status

This demonstrates how automated validation can feed an engineering defect-management workflow.

---

## Validation Reports

The platform supports downloadable validation artifacts.

### Input CSV

Exports the Engineering/CAD and PLM input datasets used for validation.

### Result CSV

Exports validation results including:

- Part number
- Part name
- Pass/fail status
- Validation check
- Expected value
- Actual value
- Severity

### Excel Report

The generated validation report provides a more complete engineering-validation record.

The workbook includes:

- Digital Twin / PLM visualization
- Validation summary
- Parts checked
- Passed parts
- Failed parts
- Pass percentage
- Engineering/CAD input data
- PLM target data
- Detailed comparison results
- Expected versus actual values
- Severity
- Defect register
- Recommended validation disposition

This provides a structured validation artifact suitable for technical review and demonstration.

---

## Digital Twin Visualization

The interface includes a visual representation of the relationship between an engineering definition and its downstream PLM representation.

The Engineering/CAD side represents the expected design definition.

The PLM side represents the controlled downstream product structure.

The validation process compares the two representations to maintain **digital continuity** across the engineering lifecycle.

---

## Architecture

The project follows a lightweight three-tier architecture.

```text
React Frontend
      |
      | REST API
      v
FastAPI Backend
      |
      | SQLAlchemy
      v
Data / Persistence Layer
```

### Frontend

The React frontend provides:

- Engineering test-data workspace
- PLM test-data workspace
- BOM comparison
- Validation dashboard
- Defect visualization
- Validation workflow visualization
- CSV exports
- Excel reporting

### Backend

The FastAPI backend provides the application service layer for:

- Validation processing
- Engineering-data comparison
- API communication
- Data handling
- Future persistent engineering-data workflows

### Data Layer

SQLAlchemy provides the database abstraction layer, with the architecture designed to support PostgreSQL-backed persistence.

---

## Technology Stack

### Frontend

- React
- JavaScript
- Vite
- HTML
- CSS

### Backend

- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Uvicorn

### Database / Persistence

- PostgreSQL-ready architecture
- SQLAlchemy ORM

### Data & Reporting

- CSV
- JSON
- ExcelJS
- XLSX validation reports

### Engineering Concepts

- Digital Twin
- Product Lifecycle Management (PLM)
- Product Data Management (PDM)
- Bill of Materials (BOM)
- Engineering Change Management
- Revision Control
- Lifecycle Management
- Engineering Data Validation
- Digital Continuity
- Defect Analysis
- Regression Validation

---

## Project Structure

```text
digital-twin-validation-platform/
│
├── backend/
│   ├── app/
│   ├── requirements.txt
│   └── ...
│
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── styles/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── package.json
│   └── vite.config.js
│
├── README.md
└── render.yaml
```

---

## Running the Project Locally

### Terminal 1 — Frontend

```bash
cd digital-twin-validation-platform/frontend
npm install
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

### Terminal 2 — Backend

From the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The FastAPI backend will normally be available at:

```text
http://127.0.0.1:8000
```

---

## Using the Demo

1. Open the application.
2. Navigate to the validation workspace.
3. Review the preloaded Engineering/CAD data.
4. Review the corresponding PLM target data.
5. Modify values if you want to create additional discrepancies.
6. Click **Run validation**.
7. Review the BOM comparison.
8. Review validation results.
9. Inspect generated defects.
10. Export the input CSV, result CSV, or detailed validation report.

No manual data entry is required to run the default demonstration.

---

## Validation Philosophy

The project treats the Engineering/CAD definition as the expected source configuration and the PLM representation as the downstream target being validated.

Conceptually:

```text
Engineering / CAD Source
          ↓
     Synchronization
          ↓
       PLM Target
          ↓
 Automated Comparison
          ↓
 Validation Results
          ↓
 Defect Investigation
          ↓
 Corrective Action
          ↓
 Regression Validation
```

The objective is to demonstrate how engineering organizations can identify data inconsistencies while maintaining traceability across connected product-development systems.

---

## Future Enhancements

Potential extensions include:

- Persistent PostgreSQL validation history
- Engineering Change Order workflows
- Requirements traceability
- MBSE integration
- Simulation-data validation
- CAD/PDM connectors
- Automated regression test suites
- Validation history dashboards
- Defect lifecycle management
- Authentication and role-based access
- REST-based external system integrations
- Dockerized deployment
- CI/CD validation pipelines
- AI-assisted validation-rule generation
- AI-assisted requirement and test-case generation

---

## Project Purpose

This application is an **educational engineering software project** created to explore how modern enterprise applications can support:

- Digital Twin workflows
- PLM integration
- Engineering-data validation
- Product-structure comparison
- Automated defect detection
- Engineering process automation

It does not reproduce or represent any proprietary implementation from a commercial PLM, CAD, semiconductor, or engineering-software organization.

---

## Author

**Vedhagiri Sabanayagam**

M.S. Information Systems  
Virginia Commonwealth University

Software engineering interests:

- Full-Stack Engineering
- Enterprise Applications
- Backend Development
- Engineering Systems
- Digital Twin
- PLM
- Data Integration
- Validation Automation

---

## License

This project is intended for educational, portfolio, and demonstration purposes.
