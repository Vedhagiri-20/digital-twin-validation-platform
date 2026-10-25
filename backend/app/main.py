import os
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from .database import Base, engine, get_db
from .models import Defect, EngineeringChange, EngineeringPart, PLMPart, Product, ValidationResult
from .seed import seed_demo_data
from .services.validation import validate_product

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Digital Twin Engineering Validation API",
    version="0.2.0",
    description="Educational Digital Twin / PLM validation API for BOM integrity, revision consistency, lifecycle validation, engineering changes and automated defect generation.",
)

frontend_origin = os.getenv("FRONTEND_ORIGIN", "").strip()

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://digital-twin-validation-platform.onrender.com",
]

if frontend_origin:
    allowed_origins.append(frontend_origin.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"name": "Digital Twin Engineering Validation Platform", "status": "active-development", "version": "0.2.0"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/seed")
def seed(db: Session = Depends(get_db)):
    return seed_demo_data(db)

@app.get("/products")
def list_products(db: Session = Depends(get_db)):
    rows = db.query(Product).order_by(Product.id).all()
    return [{"id": x.id, "code": x.code, "name": x.name, "description": x.description} for x in rows]

@app.get("/products/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    engineering = db.query(EngineeringPart).filter(EngineeringPart.product_id == product_id).order_by(EngineeringPart.id).all()
    plm = db.query(PLMPart).filter(PLMPart.product_id == product_id).order_by(PLMPart.id).all()
    changes = db.query(EngineeringChange).filter(EngineeringChange.product_id == product_id).order_by(EngineeringChange.id).all()

    return {
        "product": {"id": product.id, "code": product.code, "name": product.name, "description": product.description},
        "engineering_parts": [{"part_number": x.part_number, "name": x.name, "revision": x.revision, "quantity": x.quantity, "lifecycle": x.lifecycle} for x in engineering],
        "plm_parts": [{"part_number": x.part_number, "name": x.name, "revision": x.revision, "quantity": x.quantity, "lifecycle": x.lifecycle} for x in plm],
        "engineering_changes": [{"change_number": x.change_number, "part_number": x.part_number, "from_revision": x.from_revision, "to_revision": x.to_revision, "reason": x.reason, "status": x.status} for x in changes],
    }

@app.post("/validate/{product_id}")
def run_validation(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return validate_product(db, product_id)

@app.get("/validation-results")
def validation_results(db: Session = Depends(get_db)):
    rows = db.query(ValidationResult).order_by(ValidationResult.created_at.desc(), ValidationResult.id.desc()).all()
    return [{
        "id": x.id, "product_id": x.product_id, "part_number": x.part_number,
        "status": x.status, "issue_type": x.issue_type, "expected": x.expected,
        "actual": x.actual, "severity": x.severity, "created_at": x.created_at.isoformat()
    } for x in rows]

@app.get("/defects")
def defects(db: Session = Depends(get_db)):
    rows = db.query(Defect).order_by(Defect.created_at.desc(), Defect.id.desc()).all()
    return [{
        "id": f"DEF-{1000 + x.id}", "database_id": x.id, "product_id": x.product_id,
        "part_number": x.part_number, "title": x.title, "issue_type": x.issue_type,
        "severity": x.severity, "status": x.status, "expected": x.expected,
        "actual": x.actual, "created_at": x.created_at.isoformat()
    } for x in rows]

@app.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    checks = db.query(ValidationResult).count()
    passed = db.query(ValidationResult).filter(ValidationResult.status == "PASS").count()
    failed = db.query(ValidationResult).filter(ValidationResult.status == "FAIL").count()
    open_defects = db.query(Defect).filter(Defect.status == "OPEN").count()
    return {
        "products": db.query(Product).count(),
        "validation_checks": checks,
        "passed_checks": passed,
        "failed_checks": failed,
        "open_defects": open_defects,
    }


# === CUSTOM VALIDATION WORKSPACE ===

class CustomPartInput(BaseModel):
    part_number: str = Field(min_length=1, max_length=80)
    name: str = Field(default="", max_length=200)
    revision: str = Field(min_length=1, max_length=20)
    quantity: int = Field(ge=0)
    lifecycle: str = Field(min_length=1, max_length=40)


class CustomValidationRequest(BaseModel):
    engineering_parts: list[CustomPartInput]
    plm_parts: list[CustomPartInput]


@app.post("/custom-validation")
def validate_custom(payload: CustomValidationRequest):
    plm_map = {
        part.part_number.strip().upper(): part
        for part in payload.plm_parts
    }

    results = []
    defects = []
    passed_parts = 0
    failed_parts = 0
    defect_number = 1

    def fail(part, issue_type, expected, actual, severity):
        nonlocal defect_number

        results.append({
            "part_number": part.part_number,
            "part_name": part.name,
            "status": "FAIL",
            "issue_type": issue_type,
            "expected": str(expected),
            "actual": str(actual),
            "severity": severity,
        })

        defects.append({
            "id": f"TEST-DEF-{1000 + defect_number}",
            "part_number": part.part_number,
            "title": f"{issue_type.replace('_', ' ').title()}: {part.part_number}",
            "issue_type": issue_type,
            "severity": severity,
            "status": "OPEN",
            "expected": str(expected),
            "actual": str(actual),
        })

        defect_number += 1

    for engineering in payload.engineering_parts:
        key = engineering.part_number.strip().upper()
        plm = plm_map.get(key)
        part_failed = False

        if plm is None:
            fail(
                engineering,
                "MISSING_IN_PLM",
                "Part exists in PLM",
                "Part missing",
                "HIGH",
            )
            failed_parts += 1
            continue

        if engineering.revision.strip().upper() != plm.revision.strip().upper():
            part_failed = True
            fail(
                engineering,
                "REVISION_MISMATCH",
                engineering.revision,
                plm.revision,
                "HIGH",
            )

        if engineering.quantity != plm.quantity:
            part_failed = True
            fail(
                engineering,
                "QUANTITY_MISMATCH",
                engineering.quantity,
                plm.quantity,
                "MEDIUM",
            )

        if engineering.lifecycle.strip().upper() != plm.lifecycle.strip().upper():
            part_failed = True
            fail(
                engineering,
                "LIFECYCLE_MISMATCH",
                engineering.lifecycle,
                plm.lifecycle,
                "MEDIUM",
            )

        if part_failed:
            failed_parts += 1
        else:
            passed_parts += 1
            results.append({
                "part_number": engineering.part_number,
                "part_name": engineering.name,
                "status": "PASS",
                "issue_type": "",
                "expected": "",
                "actual": "",
                "severity": "LOW",
            })

    parts_checked = len(payload.engineering_parts)

    return {
        "parts_checked": parts_checked,
        "passed_parts": passed_parts,
        "failed_parts": failed_parts,
        "pass_rate": round((passed_parts / parts_checked) * 100, 1)
        if parts_checked
        else 0.0,
        "results": results,
        "defects": defects,
    }
