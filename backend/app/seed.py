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
