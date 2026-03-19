"""
P7 — Business Rule Validation (Blueprint I §P7)

Applies domain-specific rules to extracted records before normalization.
Rules flag records as WARN or REJECT with structured reasons.
Rejected records are excluded from ontology commit; warned records pass with flags.

Rule categories:
  - Numeric bounds (revenue must be positive, compensation > 0)
  - Date coherence (start < end, period not > 1yr in future)
  - Required field presence per entity type
  - Enum validity checks
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Optional


# ── Severity levels ──────────────────────────────────────────────────────────

class RuleSeverity:
    WARN   = "WARN"    # record passes with flag
    REJECT = "REJECT"  # record excluded from ontology commit


@dataclass
class RuleViolation:
    row_index: int
    field: str
    rule: str
    severity: str
    message: str
    value: Any = None

    def to_dict(self) -> dict:
        return {
            "row_index": self.row_index,
            "field":     self.field,
            "rule":      self.rule,
            "severity":  self.severity,
            "message":   self.message,
            "value":     str(self.value) if self.value is not None else None,
        }


@dataclass
class BusinessRuleResult:
    ingestion_id: str
    entity_type: str
    total_records: int = 0
    passed_records: int = 0
    warned_records: int = 0
    rejected_records: int = 0
    violations: list[RuleViolation] = field(default_factory=list)
    clean_records: list[dict] = field(default_factory=list)   # records that pass (incl. warns)

    def to_dict(self) -> dict:
        return {
            "ingestion_id":    self.ingestion_id,
            "entity_type":     self.entity_type,
            "total_records":   self.total_records,
            "passed_records":  self.passed_records,
            "warned_records":  self.warned_records,
            "rejected_records": self.rejected_records,
            "violation_count": len(self.violations),
            "violations":      [v.to_dict() for v in self.violations[:100]],
        }


# ── Rule helpers ─────────────────────────────────────────────────────────────

def _parse_numeric(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _parse_date(val: Any) -> Optional[date]:
    if val is None:
        return None
    if isinstance(val, date):
        return val
    try:
        from datetime import datetime
        return datetime.fromisoformat(str(val)).date()
    except Exception:
        return None


# ── Per-entity rule sets ──────────────────────────────────────────────────────

def _check_revenue(record: dict, row_idx: int) -> list[RuleViolation]:
    violations = []

    amount = _parse_numeric(record.get("REVENUE_GROSS"))
    if amount is None:
        violations.append(RuleViolation(
            row_index=row_idx, field="REVENUE_GROSS", rule="required",
            severity=RuleSeverity.REJECT,
            message="REVENUE_GROSS is missing or unparseable — record cannot be committed.",
        ))
    elif amount < 0:
        violations.append(RuleViolation(
            row_index=row_idx, field="REVENUE_GROSS", rule="non_negative",
            severity=RuleSeverity.WARN,
            message=f"REVENUE_GROSS is negative ({amount:.2f}); flagged as a credit/reversal.",
            value=amount,
        ))
    elif amount == 0:
        violations.append(RuleViolation(
            row_index=row_idx, field="REVENUE_GROSS", rule="non_zero",
            severity=RuleSeverity.WARN,
            message="REVENUE_GROSS is zero — may be a placeholder row.",
            value=0,
        ))

    period = _parse_date(record.get("REVENUE_PERIOD"))
    if period is None and record.get("REVENUE_PERIOD") is not None:
        violations.append(RuleViolation(
            row_index=row_idx, field="REVENUE_PERIOD", rule="valid_date",
            severity=RuleSeverity.WARN,
            message=f"REVENUE_PERIOD could not be parsed as a date: '{record.get('REVENUE_PERIOD')}'.",
        ))
    elif period and period > date.today().replace(year=date.today().year + 1):
        violations.append(RuleViolation(
            row_index=row_idx, field="REVENUE_PERIOD", rule="future_date",
            severity=RuleSeverity.WARN,
            message=f"REVENUE_PERIOD is more than 1 year in the future ({period}); verify this is intentional.",
            value=str(period),
        ))

    return violations


def _check_expense(record: dict, row_idx: int) -> list[RuleViolation]:
    violations = []

    amount = _parse_numeric(record.get("EXPENSE_AMOUNT"))
    if amount is None:
        violations.append(RuleViolation(
            row_index=row_idx, field="EXPENSE_AMOUNT", rule="required",
            severity=RuleSeverity.REJECT,
            message="EXPENSE_AMOUNT is missing or unparseable — record cannot be committed.",
        ))
    elif amount < 0:
        violations.append(RuleViolation(
            row_index=row_idx, field="EXPENSE_AMOUNT", rule="non_negative",
            severity=RuleSeverity.WARN,
            message=f"EXPENSE_AMOUNT is negative ({amount:.2f}); treated as a credit/refund.",
            value=amount,
        ))

    period = _parse_date(record.get("EXPENSE_PERIOD"))
    if period is None and record.get("EXPENSE_PERIOD") is not None:
        violations.append(RuleViolation(
            row_index=row_idx, field="EXPENSE_PERIOD", rule="valid_date",
            severity=RuleSeverity.WARN,
            message=f"EXPENSE_PERIOD could not be parsed: '{record.get('EXPENSE_PERIOD')}'.",
        ))

    return violations


def _check_employee(record: dict, row_idx: int) -> list[RuleViolation]:
    violations = []

    name = record.get("EMPLOYEE_NAME")
    if not name or str(name).strip() == "":
        violations.append(RuleViolation(
            row_index=row_idx, field="EMPLOYEE_NAME", rule="required",
            severity=RuleSeverity.REJECT,
            message="EMPLOYEE_NAME is required — record cannot be committed.",
        ))

    comp = _parse_numeric(record.get("EMPLOYEE_COMP_ANNUAL"))
    if comp is not None and comp < 0:
        violations.append(RuleViolation(
            row_index=row_idx, field="EMPLOYEE_COMP_ANNUAL", rule="non_negative",
            severity=RuleSeverity.WARN,
            message=f"EMPLOYEE_COMP_ANNUAL is negative ({comp:.2f}); verify payroll data.",
            value=comp,
        ))
    elif comp is not None and comp > 10_000_000:
        violations.append(RuleViolation(
            row_index=row_idx, field="EMPLOYEE_COMP_ANNUAL", rule="plausible_range",
            severity=RuleSeverity.WARN,
            message=f"EMPLOYEE_COMP_ANNUAL of ${comp:,.0f} is unusually high; confirm this is an annual figure.",
            value=comp,
        ))

    hire = _parse_date(record.get("EMPLOYEE_HIRE_DATE"))
    if hire and hire > date.today():
        violations.append(RuleViolation(
            row_index=row_idx, field="EMPLOYEE_HIRE_DATE", rule="future_date",
            severity=RuleSeverity.WARN,
            message=f"EMPLOYEE_HIRE_DATE is in the future ({hire}); may be a planned hire.",
            value=str(hire),
        ))

    return violations


def _check_contract(record: dict, row_idx: int) -> list[RuleViolation]:
    violations = []

    start = _parse_date(record.get("CONTRACT_START_DATE"))
    end   = _parse_date(record.get("CONTRACT_END_DATE"))

    if start and end and start >= end:
        violations.append(RuleViolation(
            row_index=row_idx, field="CONTRACT_END_DATE", rule="start_before_end",
            severity=RuleSeverity.WARN,
            message=f"CONTRACT_START_DATE ({start}) is not before CONTRACT_END_DATE ({end}).",
            value=f"{start} → {end}",
        ))

    value = _parse_numeric(record.get("CONTRACT_ANNUAL_VALUE"))
    if value is not None and value < 0:
        violations.append(RuleViolation(
            row_index=row_idx, field="CONTRACT_ANNUAL_VALUE", rule="non_negative",
            severity=RuleSeverity.WARN,
            message=f"CONTRACT_ANNUAL_VALUE is negative ({value:.2f}).",
            value=value,
        ))

    return violations


def _check_customer(record: dict, row_idx: int) -> list[RuleViolation]:
    violations = []

    name = record.get("CUSTOMER_NAME")
    if not name or str(name).strip() == "":
        violations.append(RuleViolation(
            row_index=row_idx, field="CUSTOMER_NAME", rule="required",
            severity=RuleSeverity.REJECT,
            message="CUSTOMER_NAME is required — record cannot be committed.",
        ))

    return violations


# ── Entity type detector ──────────────────────────────────────────────────────

_ENTITY_FIELD_MAP = {
    "revenue":  {"REVENUE_GROSS", "REVENUE_TYPE", "REVENUE_PERIOD", "REVENUE_RECURRING_FLAG"},
    "expense":  {"EXPENSE_AMOUNT", "EXPENSE_CATEGORY", "EXPENSE_PERIOD"},
    "employee": {"EMPLOYEE_NAME", "EMPLOYEE_COMP_ANNUAL", "EMPLOYEE_ROLE"},
    "contract": {"CONTRACT_START_DATE", "CONTRACT_END_DATE", "CONTRACT_ANNUAL_VALUE"},
    "customer": {"CUSTOMER_NAME", "CUSTOMER_TENURE_START", "CUSTOMER_IS_ACTIVE"},
}

def _detect_entity_type(records: list[dict]) -> str:
    """Infer the entity type from which ontology fields are present."""
    if not records:
        return "unknown"
    sample_keys = set()
    for r in records[:10]:
        sample_keys.update(k for k in r.keys() if not k.startswith("_"))

    best, best_score = "unknown", 0
    for entity, fields in _ENTITY_FIELD_MAP.items():
        score = len(fields & sample_keys)
        if score > best_score:
            best, best_score = entity, score
    return best


_RULE_FUNCTIONS = {
    "revenue":  _check_revenue,
    "expense":  _check_expense,
    "employee": _check_employee,
    "contract": _check_contract,
    "customer": _check_customer,
}


# ── Public API ────────────────────────────────────────────────────────────────

def apply_business_rules(
    records: list[dict],
    ingestion_id: str,
    entity_type: Optional[str] = None,
) -> BusinessRuleResult:
    """
    Run business rules on extracted records.
    entity_type is auto-detected from the field names if not supplied.
    Returns BusinessRuleResult with clean_records (passed + warned) and violations.
    """
    if entity_type is None:
        entity_type = _detect_entity_type(records)

    rule_fn = _RULE_FUNCTIONS.get(entity_type)
    result = BusinessRuleResult(
        ingestion_id=ingestion_id,
        entity_type=entity_type,
        total_records=len(records),
    )

    for record in records:
        row_idx = record.get("_row_index", 0)

        if rule_fn:
            violations = rule_fn(record, row_idx)
        else:
            violations = []

        has_rejection = any(v.severity == RuleSeverity.REJECT for v in violations)
        result.violations.extend(violations)

        if has_rejection:
            result.rejected_records += 1
        elif violations:
            result.warned_records += 1
            record["_rule_warnings"] = [v.rule for v in violations]
            result.clean_records.append(record)
        else:
            result.passed_records += 1
            result.clean_records.append(record)

    return result
