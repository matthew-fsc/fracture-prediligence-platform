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
    owner_user_id: Mapped[Optional[str]] = mapped_column(String(256), nullable=True, index=True)  # Clerk sub
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


# ---------------------------------------------------------------------------
# Demo link tracking
# ---------------------------------------------------------------------------

class DemoLink(Base):
    __tablename__ = "demo_links"

    id:               Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug:             Mapped[str]            = mapped_column(String(128), unique=True, index=True)
    recipient_name:   Mapped[str]            = mapped_column(String(256))
    recipient_firm:   Mapped[str]            = mapped_column(String(256))
    recipient_email:  Mapped[str]            = mapped_column(String(256))
    sender_note:      Mapped[Optional[str]]  = mapped_column(Text)
    created_at:       Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)
    visit_count:      Mapped[int]            = mapped_column(Integer, default=0)
    first_visited_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_visited_at:  Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    converted:        Mapped[bool]           = mapped_column(Boolean, default=False)
    ref_code:         Mapped[Optional[str]]  = mapped_column(String(128), nullable=True)
    sections_viewed:  Mapped[Optional[str]]  = mapped_column(Text, nullable=True)  # JSON array of section names


# ---------------------------------------------------------------------------
# User subscriptions (Clerk user ID → Stripe subscription)
# ---------------------------------------------------------------------------

class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id:                     Mapped[int]            = mapped_column(Integer, primary_key=True)
    user_id:                Mapped[str]            = mapped_column(String(256), unique=True, index=True)  # Clerk sub
    stripe_customer_id:     Mapped[Optional[str]]  = mapped_column(String(256), nullable=True)
    stripe_subscription_id: Mapped[Optional[str]]  = mapped_column(String(256), nullable=True)
    tier:                   Mapped[Optional[str]]  = mapped_column(String(64), nullable=True)    # founding | pro | team
    # status: active | cancelled | inactive | past_due | paused (Stripe webhooks)
    status:                 Mapped[str]            = mapped_column(String(64), default="inactive")
    created_at:             Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:             Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ---------------------------------------------------------------------------
# App-wide settings key/value store (for spots_remaining etc.)
# ---------------------------------------------------------------------------

class AppSetting(Base):
    __tablename__ = "app_settings"

    key:        Mapped[str] = mapped_column(String(128), primary_key=True)
    value:      Mapped[str] = mapped_column(Text)


# ---------------------------------------------------------------------------
# Advisor override layer (Blueprint II §A9 override audit trail)
# ---------------------------------------------------------------------------

class AdvisorOverride(Base):
    __tablename__ = "advisor_overrides"

    id:          Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id:  Mapped[int]            = mapped_column(ForeignKey("companies.id"), index=True)
    category:    Mapped[str]            = mapped_column(String(64))   # e.g. "revenue_quality"
    adjustment:  Mapped[float]          = mapped_column(Numeric(6, 2))  # -20 to +20
    rationale:   Mapped[str]            = mapped_column(Text)
    advisor_id:  Mapped[Optional[str]]  = mapped_column(String(256), nullable=True)
    created_at:  Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:  Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ---------------------------------------------------------------------------
# Qualitative inputs (Blueprint II §A4 / A7 sub-scores from advisor interview)
# ---------------------------------------------------------------------------

class QualitativeInputs(Base):
    __tablename__ = "qualitative_inputs"

    id:                    Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id:            Mapped[int]            = mapped_column(ForeignKey("companies.id"), unique=True, index=True)
    owner_hours_per_week:   Mapped[Optional[float]] = mapped_column(Numeric(5, 1), nullable=True)   # 0–80
    sop_pct:                Mapped[Optional[float]] = mapped_column(Numeric(5, 1), nullable=True)   # 0–100
    automation_pct:         Mapped[Optional[float]] = mapped_column(Numeric(5, 1), nullable=True)   # 0–100
    mgmt_qualified:         Mapped[Optional[int]]   = mapped_column(Integer, nullable=True)          # qualified managers
    mgmt_total_functions:   Mapped[Optional[int]]   = mapped_column(Integer, nullable=True)          # total core functions
    pipeline_value:         Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)  # $ qualified pipeline
    market_positioning:     Mapped[Optional[str]]   = mapped_column(String(32), nullable=True)       # defined|moderate|undifferentiated
    repeatability_pct:      Mapped[Optional[float]] = mapped_column(Numeric(5, 1), nullable=True)   # 0–100
    # Revenue quality qualitative fields
    contract_pct:           Mapped[Optional[float]] = mapped_column(Numeric(5, 1), nullable=True)   # % customers with formal MSA/contract
    customer_contract_type: Mapped[Optional[str]]   = mapped_column(String(32), nullable=True)       # project|retainer|msa|mix
    key_person_revenue_pct: Mapped[Optional[float]] = mapped_column(Numeric(5, 1), nullable=True)   # % revenue tied to owner relationships
    updated_at:             Mapped[datetime]        = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ---------------------------------------------------------------------------
# Addback overrides (advisor challenge-rate edits + custom addbacks)
# ---------------------------------------------------------------------------

class AddbackOverride(Base):
    __tablename__ = "addback_overrides"

    id:           Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id:   Mapped[int]            = mapped_column(ForeignKey("companies.id"), index=True)
    addback_key:  Mapped[str]            = mapped_column(String(128))   # e.g. "owner_comp", "custom_abc"
    description:  Mapped[str]            = mapped_column(String(256))
    amount:       Mapped[float]          = mapped_column(Numeric(14, 2))
    challenge:    Mapped[str]            = mapped_column(String(32))    # LOW|MEDIUM|HIGH|NOT_DEFENSIBLE
    category:     Mapped[str]            = mapped_column(String(64))
    documented:   Mapped[bool]           = mapped_column(Boolean, default=False)
    notes:        Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    rationale:    Mapped[Optional[str]]  = mapped_column(Text, nullable=True)   # advisor's reason for override
    advisor_id:   Mapped[Optional[str]]  = mapped_column(String(256), nullable=True)
    is_custom:    Mapped[bool]           = mapped_column(Boolean, default=False)  # True = advisor-added line
    updated_at:   Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ---------------------------------------------------------------------------
# Market benchmarks (IBBA-style curated aggregates, PitchBook aggregates, etc.)
# ---------------------------------------------------------------------------

class MarketBenchmarkRelease(Base):
    """Versioned drop of market / peer benchmark data."""

    __tablename__ = "market_benchmark_releases"

    id:           Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_type:  Mapped[str]            = mapped_column(String(32))   # ibba_curated | pitchbook | internal_curated
    label:        Mapped[str]            = mapped_column(String(256))
    as_of_date:   Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    doc_ref:      Mapped[Optional[str]]  = mapped_column(String(256), nullable=True)
    created_at:   Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)


class MarketSegmentMetric(Base):
    """Peer medians and market EBITDA multiple band for one industry × size segment."""

    __tablename__ = "market_segment_metrics"

    id:                            Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    release_id:                    Mapped[int]             = mapped_column(ForeignKey("market_benchmark_releases.id"), index=True)
    industry_slug:                 Mapped[str]             = mapped_column(String(64), index=True)
    industry_display_name:         Mapped[str]             = mapped_column(String(128))
    ebitda_band_label:             Mapped[str]             = mapped_column(String(64))
    ebitda_band_min:               Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    ebitda_band_max:               Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    peer_count:                    Mapped[Optional[int]]   = mapped_column(Integer, nullable=True)
    revenue_growth_median_pct:     Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    ebitda_margin_median_pct:      Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    payroll_ratio_median_pct:      Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    recurring_rev_median_pct:       Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    top_customer_conc_median_pct:   Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    market_ebitda_multiple_floor:  Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    market_ebitda_multiple_ceiling: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)


class MarketBenchmarkCache(Base):
    """Optional server-side cache for external API responses (e.g. PitchBook)."""

    __tablename__ = "market_benchmark_cache"

    id:         Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_key:  Mapped[str]            = mapped_column(String(512), unique=True, index=True)
    payload_json: Mapped[str]          = mapped_column(Text)
    expires_at: Mapped[datetime]       = mapped_column(DateTime, index=True)
    created_at: Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)
