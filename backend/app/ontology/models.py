"""
Ontology data models — the canonical output of Blueprint I (P11 Ontology Commit).

Six entity types matching the ontology field registry in Blueprint I §P5.1:
  - Company
  - RevenueStream
  - Customer
  - Employee
  - Expense
  - Contract

All records carry lineage metadata: source_file, ingestion_id, confidence_level,
ingested_at, reviewer_sign_off — per Blueprint I §P11.
"""

from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Integer, Numeric,
    String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ConfidenceLevel(str, Enum):
    HIGH   = "HIGH"
    MEDIUM = "MEDIUM"
    LOW    = "LOW"

class RevenueType(str, Enum):
    RECURRING     = "RECURRING"
    SUBSCRIPTION  = "SUBSCRIPTION"
    PROJECT       = "PROJECT"
    TRANSACTIONAL = "TRANSACTIONAL"
    OTHER         = "OTHER"

class ExpenseCategory(str, Enum):
    COGS        = "COGS"
    OPEX        = "OPEX"
    OWNER       = "OWNER"
    PERSONAL    = "PERSONAL"
    ONE_TIME    = "ONE_TIME"
    RELATED_PARTY = "RELATED_PARTY"

class EmployeeStatus(str, Enum):
    ACTIVE     = "ACTIVE"
    TERMINATED = "TERMINATED"
    CONTRACTOR = "CONTRACTOR"


# ---------------------------------------------------------------------------
# Lineage mixin
# ---------------------------------------------------------------------------

class LineageMixin:
    source_file:      Mapped[Optional[str]] = mapped_column(String(512))
    ingestion_id:     Mapped[Optional[str]] = mapped_column(String(128))
    confidence_level: Mapped[ConfidenceLevel] = mapped_column(String(16), default=ConfidenceLevel.MEDIUM)
    ingested_at:      Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    reviewer_sign_off: Mapped[Optional[str]] = mapped_column(String(128))


# ---------------------------------------------------------------------------
# Entity models
# ---------------------------------------------------------------------------

class Company(Base):
    __tablename__ = "companies"

    id:       Mapped[int]         = mapped_column(Integer, primary_key=True)
    name:     Mapped[str]         = mapped_column(String(256))
    industry: Mapped[Optional[str]] = mapped_column(String(128))
    founded:  Mapped[Optional[int]] = mapped_column(Integer)
    ein:      Mapped[Optional[str]] = mapped_column(String(32))
    state:    Mapped[Optional[str]] = mapped_column(String(2))
    entity_type: Mapped[Optional[str]] = mapped_column(String(32))  # LLC, S-Corp, C-Corp

    revenue_streams: Mapped[list[RevenueStream]] = relationship(back_populates="company")
    customers:       Mapped[list[Customer]]       = relationship(back_populates="company")
    employees:       Mapped[list[Employee]]        = relationship(back_populates="company")
    expenses:        Mapped[list[Expense]]         = relationship(back_populates="company")
    contracts:       Mapped[list[Contract]]        = relationship(back_populates="company")


class RevenueStream(Base, LineageMixin):
    __tablename__ = "revenue_streams"

    id:                  Mapped[int]            = mapped_column(Integer, primary_key=True)
    company_id:          Mapped[int]            = mapped_column(ForeignKey("companies.id"))
    customer_id:         Mapped[Optional[int]]  = mapped_column(ForeignKey("customers.id"))
    revenue_gross:       Mapped[Decimal]         = mapped_column(Numeric(14, 2))
    revenue_type:        Mapped[RevenueType]     = mapped_column(String(32))
    recurring_flag:      Mapped[bool]            = mapped_column(Boolean, default=False)
    revenue_period:      Mapped[date]            = mapped_column(Date)
    description:         Mapped[Optional[str]]  = mapped_column(Text)

    company:  Mapped[Company]           = relationship(back_populates="revenue_streams")
    customer: Mapped[Optional[Customer]] = relationship(back_populates="revenue_streams")


class Customer(Base, LineageMixin):
    __tablename__ = "customers"

    id:             Mapped[int]           = mapped_column(Integer, primary_key=True)
    company_id:     Mapped[int]           = mapped_column(ForeignKey("companies.id"))
    name:           Mapped[str]           = mapped_column(String(256))
    tenure_start:   Mapped[Optional[date]] = mapped_column(Date)
    industry:       Mapped[Optional[str]] = mapped_column(String(128))
    owner_contact:  Mapped[Optional[str]] = mapped_column(String(256))
    is_active:      Mapped[bool]          = mapped_column(Boolean, default=True)

    company:         Mapped[Company]          = relationship(back_populates="customers")
    revenue_streams: Mapped[list[RevenueStream]] = relationship(back_populates="customer")
    contracts:       Mapped[list[Contract]]       = relationship(back_populates="customer")


class Employee(Base, LineageMixin):
    __tablename__ = "employees"

    id:              Mapped[int]           = mapped_column(Integer, primary_key=True)
    company_id:      Mapped[int]           = mapped_column(ForeignKey("companies.id"))
    name:            Mapped[str]           = mapped_column(String(256))
    role:            Mapped[Optional[str]] = mapped_column(String(128))
    department:      Mapped[Optional[str]] = mapped_column(String(128))
    hire_date:       Mapped[Optional[date]] = mapped_column(Date)
    status:          Mapped[EmployeeStatus] = mapped_column(String(16), default=EmployeeStatus.ACTIVE)
    comp_annual:     Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    is_owner:        Mapped[bool]          = mapped_column(Boolean, default=False)
    is_key_person:   Mapped[bool]          = mapped_column(Boolean, default=False)
    management_level: Mapped[Optional[int]] = mapped_column(Integer)  # 0=owner, 1=VP, 2=manager

    company: Mapped[Company] = relationship(back_populates="employees")


class Expense(Base, LineageMixin):
    __tablename__ = "expenses"

    id:          Mapped[int]             = mapped_column(Integer, primary_key=True)
    company_id:  Mapped[int]             = mapped_column(ForeignKey("companies.id"))
    amount:      Mapped[Decimal]          = mapped_column(Numeric(14, 2))
    category:    Mapped[ExpenseCategory]  = mapped_column(String(32))
    description: Mapped[Optional[str]]   = mapped_column(Text)
    period:      Mapped[date]             = mapped_column(Date)
    vendor:      Mapped[Optional[str]]   = mapped_column(String(256))
    is_recurring: Mapped[bool]           = mapped_column(Boolean, default=True)

    company: Mapped[Company] = relationship(back_populates="expenses")


class Contract(Base, LineageMixin):
    __tablename__ = "contracts"

    id:           Mapped[int]            = mapped_column(Integer, primary_key=True)
    company_id:   Mapped[int]            = mapped_column(ForeignKey("companies.id"))
    customer_id:  Mapped[Optional[int]]  = mapped_column(ForeignKey("customers.id"))
    start_date:   Mapped[Optional[date]] = mapped_column(Date)
    end_date:     Mapped[Optional[date]] = mapped_column(Date)
    annual_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    contract_type: Mapped[Optional[str]] = mapped_column(String(64))
    is_active:    Mapped[bool]           = mapped_column(Boolean, default=True)
    renewal_confirmed: Mapped[bool]      = mapped_column(Boolean, default=False)
    document_path: Mapped[Optional[str]] = mapped_column(String(512))

    company:  Mapped[Company]           = relationship(back_populates="contracts")
    customer: Mapped[Optional[Customer]] = relationship(back_populates="contracts")
