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

    # Advisor-entered business facts (override ingested data when missing/unreliable)
    total_headcount: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Advisor-entered normalization (TTM); null = use defaults in analytics
    market_rate_replacement_annual: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    depreciation_amortization_ttm: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    interest_expense_ttm: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    income_tax_expense_ttm: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)

    report_firm_name: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    report_cover_blurb: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    report_logo_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

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
    # billing_interval: monthly | annual
    billing_interval:       Mapped[str]            = mapped_column(String(16), default="monthly")
    # max active company engagements included in plan (overage billed separately)
    max_companies:          Mapped[int]            = mapped_column(Integer, default=10)
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
    mgmt_covered_functions: Mapped[Optional[str]]   = mapped_column(String(256), nullable=True)      # comma-separated function IDs with qualified manager
    # A6 qualitative fields (migration 0014)
    has_crm_pipeline:       Mapped[Optional[bool]]  = mapped_column(Boolean, nullable=True)          # formal CRM pipeline present
    non_compete_pct:        Mapped[Optional[str]]   = mapped_column(String(32), nullable=True)       # 0|1-50|51-75|76-99|100
    voluntary_turnover:     Mapped[Optional[str]]   = mapped_column(String(32), nullable=True)       # <10|10-15|15-25|>25
    comp_vs_market:         Mapped[Optional[str]]   = mapped_column(String(32), nullable=True)       # below_25|below_15|within_15|above
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
# Engagement timeline snapshots (EBITDA & EV checkpoints per company)
# ---------------------------------------------------------------------------

class EngagementSnapshot(Base):
    __tablename__ = "engagement_snapshots"

    id:               Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id:       Mapped[int]            = mapped_column(ForeignKey("companies.id"), index=True)
    milestone:        Mapped[str]            = mapped_column(String(256))
    date:             Mapped[str]            = mapped_column(String(64))    # display string, e.g. "Mar 27, 2025"
    stage:            Mapped[str]            = mapped_column(String(64))    # onboarding|data_collection|baseline|…
    status:           Mapped[str]            = mapped_column(String(32))    # complete|current|projected
    drs:              Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    drs_tier:         Mapped[Optional[str]]  = mapped_column(String(32), nullable=True)
    ebitda:           Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    ev_floor:         Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    ev_ceiling:       Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    ev_midpoint:      Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    multiple_floor:   Mapped[Optional[float]] = mapped_column(Numeric(6, 3), nullable=True)
    multiple_ceiling: Mapped[Optional[float]] = mapped_column(Numeric(6, 3), nullable=True)
    notes:            Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    sort_order:       Mapped[int]            = mapped_column(Integer, default=0)
    created_at:       Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)

    company: Mapped[Company] = relationship("Company")


class GeneratedReport(Base):
    __tablename__ = "generated_reports"

    id:                 Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id:         Mapped[int]            = mapped_column(ForeignKey("companies.id"), index=True)
    template_id:        Mapped[str]            = mapped_column(String(64))
    drs_score:          Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    ev_at_generation:   Mapped[Optional[float]] = mapped_column(Numeric(16, 2), nullable=True)
    created_at:         Mapped[datetime]       = mapped_column(DateTime, server_default=func.now())

    company: Mapped[Company] = relationship("Company")


class BuyerQuestionState(Base):
    __tablename__ = "buyer_question_states"

    id:                         Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id:                 Mapped[int]             = mapped_column(ForeignKey("companies.id"), index=True)
    question_id:                Mapped[int]             = mapped_column(Integer, nullable=False)
    status:                     Mapped[str]             = mapped_column(String(32), default="open")
    response_text:              Mapped[Optional[str]]   = mapped_column(Text, nullable=True)
    # Structured answer drafting (2E)
    answer_draft:               Mapped[Optional[str]]   = mapped_column(Text, nullable=True)
    ai_draft_generated_at:      Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reviewed_by:                Mapped[Optional[str]]   = mapped_column(String(256), nullable=True)  # advisor user_id
    mitigating_initiative_id:   Mapped[Optional[int]]   = mapped_column(Integer, nullable=True)
    updated_at:                 Mapped[datetime]        = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    company: Mapped[Company] = relationship("Company")


class CompanyInitiative(Base):
    __tablename__ = "company_initiatives"

    id:                         Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id:                 Mapped[int]             = mapped_column(ForeignKey("companies.id"), index=True)
    title:                      Mapped[str]             = mapped_column(String(512))
    category:                   Mapped[Optional[str]]   = mapped_column(String(64), nullable=True)
    status:                     Mapped[str]             = mapped_column(String(32), default="planned")
    timeline:                   Mapped[Optional[str]]   = mapped_column(String(128), nullable=True)
    cost_estimate:              Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    ev_impact_estimate:         Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    advisor_ev_override:        Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    depends_on_initiative_id:   Mapped[Optional[int]]   = mapped_column(ForeignKey("company_initiatives.id"), nullable=True)
    source:                     Mapped[str]             = mapped_column(String(32), default="custom")
    created_at:                 Mapped[datetime]        = mapped_column(DateTime, server_default=func.now())
    # Engagement plan fields (migration 0015)
    phase:                      Mapped[Optional[int]]    = mapped_column(Integer, nullable=True)           # 1=Risk / 2=Structural / 3=Value
    estimated_drs_impact:       Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)   # DRS point lift
    target_completion_date:     Mapped[Optional[date]]   = mapped_column(Date, nullable=True)
    actual_completion_date:     Mapped[Optional[date]]   = mapped_column(Date, nullable=True)
    drs_category_key:           Mapped[Optional[str]]    = mapped_column(String(64), nullable=True)       # e.g. "operational_independence"

    company: Mapped[Company] = relationship("Company")


class QualitativeInputAudit(Base):
    __tablename__ = "qualitative_input_audits"

    id:            Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id:    Mapped[int]            = mapped_column(ForeignKey("companies.id"), index=True)
    advisor_id:    Mapped[Optional[str]]  = mapped_column(String(256), nullable=True)  # Clerk sub of advisor who saved
    snapshot_json: Mapped[str]            = mapped_column(Text)
    created_at:    Mapped[datetime]       = mapped_column(DateTime, server_default=func.now())

    company: Mapped[Company] = relationship("Company")


class EngagementProfile(Base):
    """Advisor + owner intake: goals, exit horizon, valuation targets, buyer preferences."""

    __tablename__ = "engagement_profiles"

    id:                         Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id:                 Mapped[int]             = mapped_column(ForeignKey("companies.id"), unique=True, index=True)
    owner_goals_narrative:      Mapped[Optional[str]]   = mapped_column(Text, nullable=True)
    exit_timeline:              Mapped[Optional[str]]   = mapped_column(String(256), nullable=True)
    target_valuation:           Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 2), nullable=True)
    personal_financial_gap:     Mapped[Optional[Decimal]] = mapped_column(Numeric(16, 2), nullable=True)
    transaction_type:           Mapped[Optional[str]]   = mapped_column(String(64), nullable=True)
    buyer_universe_notes:       Mapped[Optional[str]]   = mapped_column(Text, nullable=True)
    preferred_buyer_types_json: Mapped[Optional[str]]   = mapped_column(Text, nullable=True)
    owner_motivations_json:     Mapped[Optional[str]]   = mapped_column(Text, nullable=True)
    post_exit_plans:            Mapped[Optional[str]]   = mapped_column(String(64), nullable=True)
    non_negotiables:            Mapped[Optional[str]]   = mapped_column(Text, nullable=True)
    engagement_start_date:      Mapped[Optional[str]]   = mapped_column(String(32), nullable=True)
    advisor_id:                 Mapped[Optional[str]]   = mapped_column(String(256), nullable=True)  # Clerk sub of advisor who set up the engagement
    updated_at:                 Mapped[datetime]        = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    company: Mapped[Company] = relationship("Company")


# ---------------------------------------------------------------------------
# Score Snapshots — historical DRS captures for trend tracking
# ---------------------------------------------------------------------------

class ScoreSnapshot(Base):
    """Point-in-time DRS and EV capture for a company. Written on DRS fetch and override changes."""
    __tablename__ = "score_snapshots"

    id:          Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id:  Mapped[int]            = mapped_column(ForeignKey("companies.id"), index=True)
    drs_score:   Mapped[float]          = mapped_column(Numeric(6, 2), nullable=False)
    ev_estimate: Mapped[Optional[float]] = mapped_column(Numeric(16, 2), nullable=True)
    trigger:     Mapped[Optional[str]]  = mapped_column(String(64), nullable=True)  # 'manual', 'override', 'report'
    created_at:  Mapped[datetime]       = mapped_column(DateTime, server_default=func.now(), index=True)

    company: Mapped[Company] = relationship("Company")


# ---------------------------------------------------------------------------
# Advisory Library — unified catalog of buyer questions, initiatives, risk flags
# ---------------------------------------------------------------------------

class AdvisoryLibraryItem(Base):
    """
    Global reusable catalog item.  item_type determines which UI surface it
    appears on (buyer_question → BuyerLens, initiative → InitiativeImpact,
    risk_flag → RiskHeatmap).  Tags drive how the item is filtered and surfaced.
    """
    __tablename__ = "advisory_library_items"

    id:                 Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_type:          Mapped[str]             = mapped_column(String(32), nullable=False, index=True)  # buyer_question | initiative | risk_flag
    title:              Mapped[str]             = mapped_column(String(1024), nullable=False)
    description:        Mapped[Optional[str]]   = mapped_column(Text, nullable=True)

    # Tagging — DRS category, severity, buyer type, plus a free-form JSON tags array
    category:           Mapped[Optional[str]]   = mapped_column(String(64), nullable=True, index=True)   # DRS category key
    severity:           Mapped[Optional[str]]   = mapped_column(String(16), nullable=True)               # CRITICAL | HIGH | MEDIUM
    buyer_type:         Mapped[Optional[str]]   = mapped_column(String(32), nullable=True)               # PE | Strategic | Financial | All
    tags_json:          Mapped[Optional[str]]   = mapped_column(Text, nullable=True)                     # JSON array of custom string tags

    # For buyer questions
    data_needed:        Mapped[Optional[str]]   = mapped_column(Text, nullable=True)
    score_trigger:      Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)

    # For initiatives
    effort:             Mapped[Optional[str]]   = mapped_column(String(32), nullable=True)               # Low | Medium | High
    timeline:           Mapped[Optional[str]]   = mapped_column(String(128), nullable=True)
    ev_impact:          Mapped[Optional[str]]   = mapped_column(String(32), nullable=True)               # Low | Medium | High | Critical

    source:             Mapped[str]             = mapped_column(String(32), default="system")            # system | advisor
    is_active:          Mapped[bool]            = mapped_column(Boolean, default=True, index=True)
    created_at:         Mapped[datetime]        = mapped_column(DateTime, server_default=func.now())
    updated_at:         Mapped[datetime]        = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


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


# ---------------------------------------------------------------------------
# User profiles — role assignments (ADVISOR vs CLIENT)
# ---------------------------------------------------------------------------

class UserRole(str, Enum):
    ADVISOR = "ADVISOR"
    CLIENT  = "CLIENT"


class UserProfile(Base):
    """Links a Clerk user_id to an application role (ADVISOR or CLIENT)."""

    __tablename__ = "user_profiles"

    id:         Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id:    Mapped[str]            = mapped_column(String(256), unique=True, index=True)  # Clerk sub
    role:       Mapped[str]            = mapped_column(String(32))  # ADVISOR | CLIENT
    created_at: Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ---------------------------------------------------------------------------
# Client access — invite-based linking of CLIENT users to companies
# ---------------------------------------------------------------------------

class ClientAccessStatus(str, Enum):
    PENDING  = "PENDING"
    ACCEPTED = "ACCEPTED"
    REVOKED  = "REVOKED"


class ClientAccess(Base):
    """
    An advisor-created invitation that links a business-owner (CLIENT) to a specific company.

    Workflow:
      1. Advisor posts to /api/me/invite-client → record created with status=PENDING + unique token
      2. Advisor shares the invite URL to the client
      3. Client signs in, visits /client-invite/:token → POST /api/me/accept-invite/:token
      4. Server sets client_user_id, status=ACCEPTED; UserProfile.role is set to CLIENT
    """

    __tablename__ = "client_access"

    id:                   Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id:           Mapped[int]            = mapped_column(ForeignKey("companies.id"), index=True)
    invited_by_user_id:   Mapped[str]            = mapped_column(String(256))              # Clerk sub of the advisor
    invite_email:         Mapped[str]            = mapped_column(String(256), index=True)  # email the invite was sent to
    invite_token:         Mapped[str]            = mapped_column(String(128), unique=True, index=True)
    client_user_id:       Mapped[Optional[str]]  = mapped_column(String(256), nullable=True, index=True)  # set on accept
    status:               Mapped[str]            = mapped_column(String(32), default=ClientAccessStatus.PENDING)
    created_at:           Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)
    accepted_at:          Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    company: Mapped[Company] = relationship("Company")


# ---------------------------------------------------------------------------
# AI Copilot usage tracking (1B — token budget enforcement)
# ---------------------------------------------------------------------------

class AICopilotUsage(Base):
    """
    Monthly token usage per user for the AI Copilot.
    PK is (user_id, month) to allow UPSERT with ON CONFLICT DO UPDATE.
    """
    __tablename__ = "ai_copilot_usage"

    user_id:        Mapped[str] = mapped_column(String(256), primary_key=True)
    month:          Mapped[str] = mapped_column(String(7), primary_key=True)   # "YYYY-MM"
    tokens_input:   Mapped[int] = mapped_column(Integer, default=0)
    tokens_output:  Mapped[int] = mapped_column(Integer, default=0)
    request_count:  Mapped[int] = mapped_column(Integer, default=0)
    last_request_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


# ---------------------------------------------------------------------------
# Per-engagement billing (1C — overage pricing)
# ---------------------------------------------------------------------------

class CompanyEngagementBilling(Base):
    """Tracks billing status of each company engagement against a user's plan."""
    __tablename__ = "company_engagement_billing"

    id:                       Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id:               Mapped[int]           = mapped_column(ForeignKey("companies.id"), unique=True, index=True)
    user_id:                  Mapped[str]           = mapped_column(String(256), index=True)
    # included = within plan limit, add_on = overage line item
    billing_status:           Mapped[str]           = mapped_column(String(16), default="included")
    stripe_subscription_item_id: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    created_at:               Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)

    company: Mapped[Company] = relationship("Company")


# ---------------------------------------------------------------------------
# Company access grants (2D — client portal + associate seats)
# ---------------------------------------------------------------------------

class CompanyAccessGrant(Base):
    """
    Grants a non-owner user read (or associate) access to a specific company.
    role: "client" (SMB owner view-only) | "associate" (firm advisor)
    """
    __tablename__ = "company_access_grants"

    id:           Mapped[int]     = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id:   Mapped[int]     = mapped_column(ForeignKey("companies.id"), index=True)
    user_id:      Mapped[str]     = mapped_column(String(256), index=True)   # Clerk sub of grantee
    role:         Mapped[str]     = mapped_column(String(32))                # client | associate
    granted_by:   Mapped[str]     = mapped_column(String(256))               # Clerk sub of granting advisor
    is_active:    Mapped[bool]    = mapped_column(Boolean, default=True)
    granted_at:   Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    company: Mapped[Company] = relationship("Company")


# ---------------------------------------------------------------------------
# Referral program (3B)
# ---------------------------------------------------------------------------

class ReferralCode(Base):
    """One referral code per advisor. Earns Stripe credit balance on conversions."""
    __tablename__ = "referral_codes"

    id:                   Mapped[int]     = mapped_column(Integer, primary_key=True, autoincrement=True)
    code:                 Mapped[str]     = mapped_column(String(64), unique=True, index=True)
    owner_user_id:        Mapped[str]     = mapped_column(String(256), unique=True, index=True)
    total_clicks:         Mapped[int]     = mapped_column(Integer, default=0)
    total_conversions:    Mapped[int]     = mapped_column(Integer, default=0)
    credit_balance_cents: Mapped[int]     = mapped_column(Integer, default=0)
    created_at:           Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ReferralConversion(Base):
    """Records each signup that used a referral code."""
    __tablename__ = "referral_conversions"

    id:                      Mapped[int]     = mapped_column(Integer, primary_key=True, autoincrement=True)
    referral_code:           Mapped[str]     = mapped_column(String(64), index=True)
    converted_user_id:       Mapped[str]     = mapped_column(String(256), index=True)
    converted_at:            Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    credited_amount_cents:   Mapped[int]     = mapped_column(Integer, default=0)
    stripe_credit_applied:   Mapped[bool]    = mapped_column(Boolean, default=False)


# ---------------------------------------------------------------------------
# Advisor firm (3C — multi-advisor Team tier)
# ---------------------------------------------------------------------------

class AdvisorFirm(Base):
    """
    A firm groups multiple advisors under a single Team subscription.
    owner_user_id is the billing admin; associates are tracked via CompanyAccessGrant.
    """
    __tablename__ = "advisor_firms"

    id:                    Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    name:                  Mapped[str]           = mapped_column(String(256))
    owner_user_id:         Mapped[str]           = mapped_column(String(256), unique=True, index=True)
    subscription_user_id:  Mapped[str]           = mapped_column(String(256), index=True)   # FK to UserSubscription.user_id
    max_seats:             Mapped[int]           = mapped_column(Integer, default=5)
    created_at:            Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Channel partner (3D — association / whitelabel distribution)
# ---------------------------------------------------------------------------

class ChannelPartner(Base):
    """
    Distribution partners (e.g. EPI, IBBA) who co-brand pricing and apply member discounts.
    """
    __tablename__ = "channel_partners"

    id:                Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug:              Mapped[str]           = mapped_column(String(64), unique=True, index=True)
    name:              Mapped[str]           = mapped_column(String(256))
    logo_url:          Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    discount_pct:      Mapped[int]           = mapped_column(Integer, default=0)        # e.g. 15 = 15% off
    stripe_coupon_id:  Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    is_active:         Mapped[bool]          = mapped_column(Boolean, default=True)
    created_at:        Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# QuickBooks OAuth tokens (QB integration — migration 0013)
# ---------------------------------------------------------------------------

class QBToken(Base):
    """
    Per-company QuickBooks OAuth 2.0 token storage.
    One row per company; upserted on each OAuth completion / refresh.
    """
    __tablename__ = "qb_tokens"

    id:            Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id:    Mapped[int]            = mapped_column(ForeignKey("companies.id"), unique=True, index=True)
    realm_id:      Mapped[str]            = mapped_column(String(128))     # Intuit realm / company id
    access_token:  Mapped[str]            = mapped_column(Text)
    refresh_token: Mapped[str]            = mapped_column(Text)
    expires_at:    Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at:    Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:    Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company: Mapped[Company] = relationship("Company")


# ---------------------------------------------------------------------------
# Engagement plans (exit planning layer — migration 0015)
# ---------------------------------------------------------------------------

class EngagementPlan(Base):
    """
    Top-level exit engagement plan for a company.  One row per company.
    Links the target exit date, target DRS, and current phase to the
    engagement_initiatives (CompanyInitiative rows with phase set).
    """
    __tablename__ = "engagement_plans"

    id:               Mapped[int]             = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id:       Mapped[int]             = mapped_column(ForeignKey("companies.id"), unique=True, index=True)
    target_exit_date: Mapped[Optional[date]]  = mapped_column(Date, nullable=True)
    target_drs:       Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    current_phase:    Mapped[Optional[int]]   = mapped_column(Integer, nullable=True, default=1)  # 1|2|3
    created_at:       Mapped[datetime]        = mapped_column(DateTime, server_default=func.now())
    updated_at:       Mapped[datetime]        = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    company: Mapped[Company] = relationship("Company")
