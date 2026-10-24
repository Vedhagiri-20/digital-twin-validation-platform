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
