"""
P11 — Ontology Commit & Lineage Tagging (Blueprint I §P11)

Writes normalized, deduplicated, relationship-linked records into the six
ontology tables. Every record is stamped with full lineage:
  - source_file, ingestion_id, confidence_level, ingested_at

The commit is transactional: all-or-nothing per entity type.
Returns a CommitResult with counts per entity and any commit errors.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.ontology.models import (
    RevenueStream, Customer, Employee, Expense, Contract,
    ConfidenceLevel, RevenueType, ExpenseCategory, EmployeeStatus,
)


# ── Lineage helpers ───────────────────────────────────────────────────────────

def _confidence(record: dict) -> str:
    warnings = record.get("_rule_warnings", [])
    if not warnings:
        return ConfidenceLevel.HIGH
    if len(warnings) <= 1:
        return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.LOW


def _safe_date(val: Any) -> Optional[date]:
    if val is None:
        return None
    if isinstance(val, date):
        return val
    try:
        return datetime.fromisoformat(str(val)).date()
    except Exception:
        return None


def _safe_decimal(val: Any) -> Optional[Decimal]:
    if val is None:
        return None
    try:
        return Decimal(str(round(float(val), 2)))
    except Exception:
        return None


def _safe_bool(val: Any, default: bool = False) -> bool:
    if isinstance(val, bool):
        return val
    if val is None:
        return default
    return str(val).lower() in ("true", "yes", "1", "active")


def _safe_int(val: Any) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(float(str(val)))
    except (TypeError, ValueError):
        return None


def _safe_str(val: Any, max_len: int = 256) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("nan", "none", ""):
        return None
    return s[:max_len]


# ── Commit functions ──────────────────────────────────────────────────────────

def _commit_customers(
    records: list[dict],
    company_id: int,
    source_file: str,
    ingestion_id: str,
    db: Session,
) -> tuple[int, list[str]]:
    committed, errors = 0, []
    for rec in records:
        try:
            obj = Customer(
                company_id=company_id,
                name=_safe_str(rec.get("CUSTOMER_NAME")) or "Unknown",
                tenure_start=_safe_date(rec.get("CUSTOMER_TENURE_START")),
                industry=_safe_str(rec.get("CUSTOMER_INDUSTRY"), 128),
                owner_contact=_safe_str(rec.get("CUSTOMER_OWNER_CONTACT")),
                is_active=_safe_bool(rec.get("CUSTOMER_IS_ACTIVE"), True),
                source_file=source_file,
                ingestion_id=ingestion_id,
                confidence_level=_confidence(rec),
            )
            db.add(obj)
            committed += 1
        except Exception as e:
            errors.append(f"Row {rec.get('_row_index','?')}: {e}")
    return committed, errors


def _commit_employees(
    records: list[dict],
    company_id: int,
    source_file: str,
    ingestion_id: str,
    db: Session,
) -> tuple[int, list[str]]:
    committed, errors = 0, []
    for rec in records:
        try:
            status_raw = rec.get("EMPLOYEE_STATUS", "ACTIVE")
            try:
                status = EmployeeStatus(status_raw)
            except ValueError:
                status = EmployeeStatus.ACTIVE

            obj = Employee(
                company_id=company_id,
                name=_safe_str(rec.get("EMPLOYEE_NAME")) or "Unknown",
                role=_safe_str(rec.get("EMPLOYEE_ROLE"), 128),
                department=_safe_str(rec.get("EMPLOYEE_DEPARTMENT"), 128),
                hire_date=_safe_date(rec.get("EMPLOYEE_HIRE_DATE")),
                status=status,
                comp_annual=_safe_decimal(rec.get("EMPLOYEE_COMP_ANNUAL")),
                is_owner=_safe_bool(rec.get("EMPLOYEE_IS_OWNER")),
                management_level=_safe_int(rec.get("EMPLOYEE_MANAGEMENT_LEVEL")),
                source_file=source_file,
                ingestion_id=ingestion_id,
                confidence_level=_confidence(rec),
            )
            db.add(obj)
            committed += 1
        except Exception as e:
            errors.append(f"Row {rec.get('_row_index','?')}: {e}")
    return committed, errors


def _commit_revenue_streams(
    records: list[dict],
    company_id: int,
    source_file: str,
    ingestion_id: str,
    db: Session,
) -> tuple[int, list[str]]:
    # Pre-build a name→id lookup for customers already in the DB for this company.
    # P10 resolves REVENUE_CUSTOMER_ID/NAME to a customer name (_resolved_customer_name);
    # here we convert that name back to the internal customer PK.
    from app.ontology.models import Customer as _Customer
    existing_customers = db.query(_Customer.name, _Customer.id).filter(
        _Customer.company_id == company_id
    ).all()
    customer_name_to_id: dict[str, int] = {name: cid for name, cid in existing_customers}

    committed, errors = 0, []
    for rec in records:
        try:
            amount = _safe_decimal(rec.get("REVENUE_GROSS"))
            if amount is None:
                continue  # skip unresolvable amounts

            rev_type_raw = rec.get("REVENUE_TYPE", "OTHER")
            try:
                rev_type = RevenueType(rev_type_raw)
            except ValueError:
                rev_type = RevenueType.OTHER

            period = _safe_date(rec.get("REVENUE_PERIOD"))
            if period is None:
                period = date.today().replace(day=1)  # fallback to current month

            # Resolve customer FK from the name resolved by P10
            resolved_name = _safe_str(rec.get("_resolved_customer_name"))
            customer_id: Optional[int] = customer_name_to_id.get(resolved_name) if resolved_name else None

            obj = RevenueStream(
                company_id=company_id,
                customer_id=customer_id,
                revenue_gross=amount,
                revenue_type=rev_type,
                recurring_flag=_safe_bool(rec.get("REVENUE_RECURRING_FLAG")),
                revenue_period=period,
                description=_safe_str(rec.get("REVENUE_DESCRIPTION"), 1024),
                source_file=source_file,
                ingestion_id=ingestion_id,
                confidence_level=_confidence(rec),
            )
            db.add(obj)
            committed += 1
        except Exception as e:
            errors.append(f"Row {rec.get('_row_index','?')}: {e}")
    return committed, errors


def _commit_expenses(
    records: list[dict],
    company_id: int,
    source_file: str,
    ingestion_id: str,
    db: Session,
) -> tuple[int, list[str]]:
    committed, errors = 0, []
    for rec in records:
        try:
            amount = _safe_decimal(rec.get("EXPENSE_AMOUNT"))
            if amount is None:
                continue

            cat_raw = rec.get("EXPENSE_CATEGORY", "OPEX")
            try:
                category = ExpenseCategory(cat_raw)
            except ValueError:
                category = ExpenseCategory.OPEX

            period = _safe_date(rec.get("EXPENSE_PERIOD"))
            if period is None:
                period = date.today().replace(day=1)

            obj = Expense(
                company_id=company_id,
                amount=amount,
                category=category,
                description=_safe_str(rec.get("EXPENSE_DESCRIPTION"), 1024),
                period=period,
                vendor=_safe_str(rec.get("EXPENSE_VENDOR"), 256),
                source_file=source_file,
                ingestion_id=ingestion_id,
                confidence_level=_confidence(rec),
            )
            db.add(obj)
            committed += 1
        except Exception as e:
            errors.append(f"Row {rec.get('_row_index','?')}: {e}")
    return committed, errors


def _commit_contracts(
    records: list[dict],
    company_id: int,
    source_file: str,
    ingestion_id: str,
    db: Session,
) -> tuple[int, list[str]]:
    committed, errors = 0, []
    for rec in records:
        try:
            obj = Contract(
                company_id=company_id,
                start_date=_safe_date(rec.get("CONTRACT_START_DATE")),
                end_date=_safe_date(rec.get("CONTRACT_END_DATE")),
                annual_value=_safe_decimal(rec.get("CONTRACT_ANNUAL_VALUE")),
                contract_type=_safe_str(rec.get("CONTRACT_TYPE"), 64),
                is_active=_safe_bool(rec.get("CONTRACT_IS_ACTIVE"), True),
                source_file=source_file,
                ingestion_id=ingestion_id,
                confidence_level=_confidence(rec),
            )
            db.add(obj)
            committed += 1
        except Exception as e:
            errors.append(f"Row {rec.get('_row_index','?')}: {e}")
    return committed, errors


# ── Result ────────────────────────────────────────────────────────────────────

@dataclass
class CommitResult:
    ingestion_id: str
    entity_type: str
    committed: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "ingestion_id": self.ingestion_id,
            "entity_type":  self.entity_type,
            "committed":    self.committed,
            "skipped":      self.skipped,
            "errors":       self.errors[:20],
        }


# ── Public API ────────────────────────────────────────────────────────────────

_COMMITTERS = {
    "customer": _commit_customers,
    "employee": _commit_employees,
    "revenue":  _commit_revenue_streams,
    "expense":  _commit_expenses,
    "contract": _commit_contracts,
}


def commit_to_ontology(
    records: list[dict],
    entity_type: str,
    company_id: int,
    source_file: str,
    ingestion_id: str,
    db: Session,
) -> CommitResult:
    """
    Write normalized, resolved records into the ontology tables.
    The session is flushed but not committed — caller owns the transaction.
    """
    result = CommitResult(ingestion_id=ingestion_id, entity_type=entity_type)

    committer = _COMMITTERS.get(entity_type)
    if not committer:
        result.errors.append(f"No committer defined for entity type '{entity_type}'.")
        return result

    try:
        committed, errors = committer(
            records, company_id, source_file, ingestion_id, db
        )
        result.committed = committed
        result.skipped   = len(records) - committed
        result.errors    = errors
        db.flush()
    except Exception as e:
        result.errors.append(str(e))

    return result
