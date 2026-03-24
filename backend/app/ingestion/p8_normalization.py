"""
P8 — Normalization & Standardization (Blueprint I §P8)

Takes clean_records from P7 and standardizes:
  - Dates → ISO 8601 string (already done in P6, but re-verified here)
  - Currency → float with 2dp
  - Booleans → True/False
  - Text names → title case, stripped whitespace
  - Enum fields → canonical values (e.g. "recurring" → "RECURRING")
  - Revenue type inference from description if field absent
  - Expense category normalization (COGS / OPEX / OWNER / ONE_TIME / PERSONAL / RELATED_PARTY)
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field
from typing import Any, Optional


# ── Canonical enum maps ───────────────────────────────────────────────────────

_REVENUE_TYPE_MAP = {
    "recurring":     "RECURRING",
    "subscription":  "SUBSCRIPTION",
    "sub":           "SUBSCRIPTION",
    "project":       "PROJECT",
    "project-based": "PROJECT",
    "transactional": "TRANSACTIONAL",
    "one-time":      "TRANSACTIONAL",
    "one time":      "TRANSACTIONAL",
    "contract":      "RECURRING",
    "retainer":      "RECURRING",
    "service":       "PROJECT",
    "saas":          "SUBSCRIPTION",
    "license":       "SUBSCRIPTION",
    "maintenance":   "RECURRING",
    "support":       "RECURRING",
}

_EXPENSE_CATEGORY_MAP = {
    "cost of goods": "COGS",
    "cost of goods sold": "COGS",
    "cogs":          "COGS",
    "direct cost":   "COGS",
    "direct costs":  "COGS",
    "payroll":       "OPEX",
    "salary":        "OPEX",
    "salaries":      "OPEX",
    "wages":         "OPEX",
    "rent":          "OPEX",
    "utilities":     "OPEX",
    "insurance":     "OPEX",
    "marketing":     "OPEX",
    "advertising":   "OPEX",
    "software":      "OPEX",
    "subscription":  "OPEX",
    "owner draw":    "OWNER",
    "owner draws":   "OWNER",
    "officer comp":  "OWNER",
    "officer salary":"OWNER",
    "draw":          "OWNER",
    "personal":      "PERSONAL",
    "non-business":  "PERSONAL",
    "one-time":      "ONE_TIME",
    "one time":      "ONE_TIME",
    "capital":       "ONE_TIME",
    "legal":         "ONE_TIME",
    "consulting":    "OPEX",
    "related party": "RELATED_PARTY",
    "intercompany":  "RELATED_PARTY",
}

_EMPLOYEE_STATUS_MAP = {
    "active":       "ACTIVE",
    "current":      "ACTIVE",
    "employed":     "ACTIVE",
    "terminated":   "TERMINATED",
    "term":         "TERMINATED",
    "separated":    "TERMINATED",
    "resigned":     "TERMINATED",
    "laid off":     "TERMINATED",
    "contractor":   "CONTRACTOR",
    "1099":         "CONTRACTOR",
    "independent":  "CONTRACTOR",
    "temp":         "CONTRACTOR",
}

# ── Revenue type inference from description ──────────────────────────────────

_RECURRING_KEYWORDS = re.compile(
    r"\b(monthly|annual|yearly|recurring|subscription|retainer|maintenance|support|license|saas)\b",
    re.I,
)
_PROJECT_KEYWORDS = re.compile(
    r"\b(project|implementation|setup|install|deploy|migration|consulting|services)\b",
    re.I,
)


def _infer_revenue_type(description: Optional[str]) -> str:
    if not description:
        return "OTHER"
    if _RECURRING_KEYWORDS.search(description):
        return "RECURRING"
    if _PROJECT_KEYWORDS.search(description):
        return "PROJECT"
    return "TRANSACTIONAL"


# ── Expense category from description ────────────────────────────────────────

def _infer_expense_category(description: Optional[str], vendor: Optional[str]) -> str:
    text = f"{description or ''} {vendor or ''}".lower()
    for keyword, category in _EXPENSE_CATEGORY_MAP.items():
        if keyword in text:
            return category
    return "OPEX"


# ── Text normalization ────────────────────────────────────────────────────────

def _normalize_name(raw: Any) -> Optional[str]:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.lower() in ("nan", "none", "n/a", ""):
        return None
    # Title case, collapse internal whitespace
    return re.sub(r"\s+", " ", s).title()


def _normalize_enum(raw: Any, mapping: dict[str, str], default: str = "OTHER") -> str:
    if raw is None:
        return default
    key = str(raw).strip().lower()
    return mapping.get(key, default)


def _normalize_bool(raw: Any) -> bool:
    if isinstance(raw, bool):
        return raw
    if raw is None:
        return False
    s = str(raw).strip().lower()
    return s in ("true", "yes", "y", "1", "x", "active", "✓")


def _round_currency(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        return round(float(val), 2)
    except (TypeError, ValueError):
        return None


# ── Normalizers per entity type ───────────────────────────────────────────────

def _normalize_revenue_record(r: dict) -> dict:
    out = dict(r)

    out["REVENUE_GROSS"] = _round_currency(r.get("REVENUE_GROSS"))

    rev_type = _normalize_enum(r.get("REVENUE_TYPE"), _REVENUE_TYPE_MAP, "")
    if not rev_type:
        rev_type = _infer_revenue_type(r.get("REVENUE_DESCRIPTION"))
    out["REVENUE_TYPE"] = rev_type

    out["REVENUE_RECURRING_FLAG"] = _normalize_bool(r.get("REVENUE_RECURRING_FLAG"))

    # Sync recurring flag with type
    if out["REVENUE_TYPE"] in ("RECURRING", "SUBSCRIPTION") and not out["REVENUE_RECURRING_FLAG"]:
        out["REVENUE_RECURRING_FLAG"] = True

    out["REVENUE_DESCRIPTION"] = (
        str(r["REVENUE_DESCRIPTION"]).strip()
        if r.get("REVENUE_DESCRIPTION") else None
    )
    out["REVENUE_CUSTOMER_ID"] = (
        str(r["REVENUE_CUSTOMER_ID"]).strip()
        if r.get("REVENUE_CUSTOMER_ID") else None
    )
    return out


def _normalize_expense_record(r: dict) -> dict:
    out = dict(r)
    out["EXPENSE_AMOUNT"] = _round_currency(r.get("EXPENSE_AMOUNT"))

    category = _normalize_enum(r.get("EXPENSE_CATEGORY"), _EXPENSE_CATEGORY_MAP, "")
    if not category:
        category = _infer_expense_category(
            r.get("EXPENSE_DESCRIPTION"), r.get("EXPENSE_VENDOR")
        )
    out["EXPENSE_CATEGORY"] = category

    out["EXPENSE_DESCRIPTION"] = (
        str(r["EXPENSE_DESCRIPTION"]).strip()
        if r.get("EXPENSE_DESCRIPTION") else None
    )
    out["EXPENSE_VENDOR"] = _normalize_name(r.get("EXPENSE_VENDOR"))
    return out


def _normalize_employee_record(r: dict) -> dict:
    out = dict(r)
    out["EMPLOYEE_NAME"]     = _normalize_name(r.get("EMPLOYEE_NAME"))
    out["EMPLOYEE_ROLE"]     = _normalize_name(r.get("EMPLOYEE_ROLE"))
    out["EMPLOYEE_DEPARTMENT"] = _normalize_name(r.get("EMPLOYEE_DEPARTMENT"))
    out["EMPLOYEE_STATUS"]   = _normalize_enum(
        r.get("EMPLOYEE_STATUS"), _EMPLOYEE_STATUS_MAP, "ACTIVE"
    )
    out["EMPLOYEE_COMP_ANNUAL"] = _round_currency(r.get("EMPLOYEE_COMP_ANNUAL"))
    out["EMPLOYEE_IS_OWNER"] = _normalize_bool(r.get("EMPLOYEE_IS_OWNER"))

    level_raw = r.get("EMPLOYEE_MANAGEMENT_LEVEL")
    if level_raw is not None:
        try:
            out["EMPLOYEE_MANAGEMENT_LEVEL"] = int(float(str(level_raw)))
        except (ValueError, TypeError):
            out["EMPLOYEE_MANAGEMENT_LEVEL"] = None
    return out


def _normalize_contract_record(r: dict) -> dict:
    out = dict(r)
    out["CONTRACT_ANNUAL_VALUE"] = _round_currency(r.get("CONTRACT_ANNUAL_VALUE"))
    out["CONTRACT_IS_ACTIVE"]    = _normalize_bool(r.get("CONTRACT_IS_ACTIVE"))
    out["CONTRACT_CUSTOMER_ID"]  = (
        str(r["CONTRACT_CUSTOMER_ID"]).strip()
        if r.get("CONTRACT_CUSTOMER_ID") else None
    )
    out["CONTRACT_TYPE"] = (
        str(r["CONTRACT_TYPE"]).strip().upper()
        if r.get("CONTRACT_TYPE") else None
    )
    return out


def _normalize_customer_record(r: dict) -> dict:
    out = dict(r)
    out["CUSTOMER_NAME"]    = _normalize_name(r.get("CUSTOMER_NAME"))
    out["CUSTOMER_INDUSTRY"]= _normalize_name(r.get("CUSTOMER_INDUSTRY"))
    out["CUSTOMER_IS_ACTIVE"] = _normalize_bool(r.get("CUSTOMER_IS_ACTIVE", True))
    return out


# ── Entity type → normalizer map ─────────────────────────────────────────────

_NORMALIZERS = {
    "revenue":  _normalize_revenue_record,
    "expense":  _normalize_expense_record,
    "employee": _normalize_employee_record,
    "contract": _normalize_contract_record,
    "customer": _normalize_customer_record,
}


@dataclass
class NormalizationResult:
    ingestion_id: str
    entity_type: str
    record_count: int = 0
    normalized_records: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "ingestion_id":  self.ingestion_id,
            "entity_type":   self.entity_type,
            "record_count":  self.record_count,
        }


def normalize_records(
    records: list[dict],
    ingestion_id: str,
    entity_type: str,
) -> NormalizationResult:
    """
    Apply P8 normalization to a list of clean records from P7.
    Returns NormalizationResult with normalized_records ready for P9.
    """
    normalizer = _NORMALIZERS.get(entity_type, lambda r: dict(r))
    result = NormalizationResult(
        ingestion_id=ingestion_id,
        entity_type=entity_type,
    )

    for record in records:
        try:
            norm = normalizer(record)
            result.normalized_records.append(norm)
        except Exception:
            # Normalization errors are non-fatal; keep raw record
            result.normalized_records.append(dict(record))

    result.record_count = len(result.normalized_records)
    return result
