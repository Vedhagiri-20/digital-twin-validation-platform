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
