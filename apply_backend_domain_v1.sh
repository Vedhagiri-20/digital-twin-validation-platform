#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "backend/app/main.py" ] || [ ! -f "backend/app/database.py" ]; then
  echo "ERROR: Run this from the repository root:"
  echo "/Users/vedha/Vedha/App/digital-twin-validation-platform"
  exit 1
fi

mkdir -p backend/app/services
cp backend/app/main.py backend/app/main.py.pre-domain.backup

cat > backend/app/models.py <<'EOF'
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(String(500), default="")

class EngineeringPart(Base):
    __tablename__ = "engineering_parts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    part_number: Mapped[str] = mapped_column(String(80), index=True)
    name: Mapped[str] = mapped_column(String(200))
    revision: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[int] = mapped_column(Integer)
    lifecycle: Mapped[str] = mapped_column(String(40))

class PLMPart(Base):
    __tablename__ = "plm_parts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    part_number: Mapped[str] = mapped_column(String(80), index=True)
    name: Mapped[str] = mapped_column(String(200))
    revision: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[int] = mapped_column(Integer)
    lifecycle: Mapped[str] = mapped_column(String(40))

class EngineeringChange(Base):
    __tablename__ = "engineering_changes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    change_number: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    part_number: Mapped[str] = mapped_column(String(80))
    from_revision: Mapped[str] = mapped_column(String(20))
    to_revision: Mapped[str] = mapped_column(String(20))
    reason: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(40), default="APPROVED")

class ValidationResult(Base):
    __tablename__ = "validation_results"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    part_number: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20))
    issue_type: Mapped[str] = mapped_column(String(80), default="")
    expected: Mapped[str] = mapped_column(String(200), default="")
    actual: Mapped[str] = mapped_column(String(200), default="")
    severity: Mapped[str] = mapped_column(String(20), default="LOW")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Defect(Base):
    __tablename__ = "defects"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    part_number: Mapped[str] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(250))
    issue_type: Mapped[str] = mapped_column(String(80))
    severity: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(30), default="OPEN")
    expected: Mapped[str] = mapped_column(String(200), default="")
    actual: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
EOF

cat > backend/app/seed.py <<'EOF'
from sqlalchemy.orm import Session
from .models import EngineeringChange, EngineeringPart, PLMPart, Product

def seed_demo_data(db: Session):
    existing = db.query(Product).filter(Product.code == "DT-100").first()
    if existing:
        return {"message": "Demo data already exists.", "product_id": existing.id, "product_code": existing.code}

    product = Product(
        code="DT-100",
        name="Precision Motion Stage Assembly",
        description="Educational electromechanical product used to demonstrate Engineering-to-PLM validation.",
    )
    db.add(product)
    db.flush()

    db.add_all([
        EngineeringPart(product_id=product.id, part_number="MOTOR-001", name="Servo Motor", revision="C", quantity=1, lifecycle="RELEASED"),
        EngineeringPart(product_id=product.id, part_number="STAGE-002", name="Linear Stage", revision="B", quantity=1, lifecycle="RELEASED"),
        EngineeringPart(product_id=product.id, part_number="BEARING-004", name="Precision Bearing", revision="B", quantity=2, lifecycle="RELEASED"),
        EngineeringPart(product_id=product.id, part_number="SENSOR-007", name="Position Sensor", revision="A", quantity=1, lifecycle="RELEASED"),
        EngineeringPart(product_id=product.id, part_number="CABLE-011", name="Feedback Cable", revision="A", quantity=1, lifecycle="RELEASED"),
    ])

    db.add_all([
        PLMPart(product_id=product.id, part_number="MOTOR-001", name="Servo Motor", revision="B", quantity=1, lifecycle="RELEASED"),
        PLMPart(product_id=product.id, part_number="STAGE-002", name="Linear Stage", revision="B", quantity=1, lifecycle="RELEASED"),
        PLMPart(product_id=product.id, part_number="BEARING-004", name="Precision Bearing", revision="B", quantity=1, lifecycle="RELEASED"),
        PLMPart(product_id=product.id, part_number="SENSOR-007", name="Position Sensor", revision="A", quantity=1, lifecycle="IN_REVIEW"),
    ])

    db.add(EngineeringChange(
        product_id=product.id,
        change_number="ECO-1024",
        part_number="MOTOR-001",
        from_revision="B",
        to_revision="C",
        reason="Thermal performance improvement",
        status="APPROVED",
    ))

    db.commit()
    return {"message": "Demo data created.", "product_id": product.id, "product_code": product.code}
EOF

cat > backend/app/services/__init__.py <<'EOF'
EOF

cat > backend/app/services/validation.py <<'EOF'
from sqlalchemy.orm import Session
from ..models import Defect, EngineeringPart, PLMPart, ValidationResult

def _add_failure(db, product_id, part_number, issue_type, expected, actual, severity):
    db.add(ValidationResult(
        product_id=product_id, part_number=part_number, status="FAIL",
        issue_type=issue_type, expected=expected, actual=actual, severity=severity
    ))
    db.add(Defect(
        product_id=product_id, part_number=part_number,
        title=f"{issue_type.replace('_', ' ').title()}: {part_number}",
        issue_type=issue_type, severity=severity, status="OPEN",
        expected=expected, actual=actual
    ))

def validate_product(db: Session, product_id: int):
    engineering_parts = db.query(EngineeringPart).filter(EngineeringPart.product_id == product_id).all()
    plm_parts = db.query(PLMPart).filter(PLMPart.product_id == product_id).all()
    plm_map = {p.part_number: p for p in plm_parts}

    db.query(ValidationResult).filter(ValidationResult.product_id == product_id).delete()
    db.query(Defect).filter(Defect.product_id == product_id).delete()

    output = {"product_id": product_id, "parts_checked": len(engineering_parts), "passed_parts": 0, "failed_parts": 0, "results": []}

    for eng in engineering_parts:
        plm = plm_map.get(eng.part_number)

        if not plm:
            _add_failure(db, product_id, eng.part_number, "MISSING_IN_PLM", "Part exists in PLM", "Part missing", "HIGH")
            output["failed_parts"] += 1
            output["results"].append({"part_number": eng.part_number, "part_name": eng.name, "status": "FAIL", "issues": ["MISSING_IN_PLM"]})
            continue

        failures = []
        if eng.revision != plm.revision:
            failures.append(("REVISION_MISMATCH", eng.revision, plm.revision, "HIGH"))
        if eng.quantity != plm.quantity:
            failures.append(("QUANTITY_MISMATCH", str(eng.quantity), str(plm.quantity), "MEDIUM"))
        if eng.lifecycle != plm.lifecycle:
            failures.append(("LIFECYCLE_MISMATCH", eng.lifecycle, plm.lifecycle, "MEDIUM"))

        if failures:
            output["failed_parts"] += 1
            for issue_type, expected, actual, severity in failures:
                _add_failure(db, product_id, eng.part_number, issue_type, expected, actual, severity)
            output["results"].append({"part_number": eng.part_number, "part_name": eng.name, "status": "FAIL", "issues": [x[0] for x in failures]})
        else:
            db.add(ValidationResult(
                product_id=product_id, part_number=eng.part_number, status="PASS",
                issue_type="", expected="", actual="", severity="LOW"
            ))
            output["passed_parts"] += 1
            output["results"].append({"part_number": eng.part_number, "part_name": eng.name, "status": "PASS", "issues": []})

    output["pass_rate"] = round((output["passed_parts"] / output["parts_checked"]) * 100, 1) if output["parts_checked"] else 0.0
    db.commit()
    return output
EOF

cat > backend/app/main.py <<'EOF'
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
EOF

echo "Backend domain layer created successfully."
