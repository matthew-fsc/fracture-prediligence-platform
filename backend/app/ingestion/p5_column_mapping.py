"""
P5 — Column Classification & Mapping (Blueprint I §P5)

The core IP. Every column gets assigned to an ontology field — or explicitly excluded.
Uses a layered matching process:
  1. Exact normalized header match against synonym library
  2. Fuzzy match (difflib sequence matching) against synonyms
  3. Value-pattern inference (type + range + sample-based)
  4. Cardinality-based inference (high cardinality → ID/name; low → category)

Every mapping gets a confidence score (0–100). Below 80 → flagged for human review.
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Optional

from app.ingestion.p4_schema_profiling import ColumnProfile, InferredType


# ── Ontology Field Registry (Blueprint I §P5.1) ────────────────────────────
# Format: ontology_field → (entity, expected_type, synonyms)
ONTOLOGY_REGISTRY: dict[str, tuple[str, str, list[str]]] = {

    # Revenue Stream
    "REVENUE_GROSS": (
        "revenue_stream", "numeric",
        ["sales", "revenue", "net sales", "gross revenue", "billing", "invoiced amount",
         "total revenue", "gross sales", "billings", "fees", "service revenue",
         "consulting fees", "project revenue", "total income", "net revenue"],
    ),
    "REVENUE_TYPE": (
        "revenue_stream", "categorical",
        ["type", "category", "service type", "revenue category", "billing type",
         "project type", "revenue type", "income type"],
    ),
    "REVENUE_RECURRING_FLAG": (
        "revenue_stream", "boolean",
        ["recurring", "subscription", "retainer", "contract type", "billing model",
         "is recurring", "recurrence", "subscription type"],
    ),
    "REVENUE_PERIOD": (
        "revenue_stream", "date",
        ["period", "month", "year", "date", "invoice date", "billing period",
         "fiscal period", "service period", "transaction date", "posting date",
         "close date", "bill date", "as of"],
    ),
    "REVENUE_CUSTOMER_ID": (
        "revenue_stream", "text",
        ["customer", "client", "account", "customer name", "client name", "account name",
         "bill to", "sold to", "customer id", "client id", "account id", "contact"],
    ),
    "REVENUE_DESCRIPTION": (
        "revenue_stream", "text",
        ["description", "memo", "note", "item", "product", "service", "detail",
         "narration", "line item", "product code", "item name"],
    ),

    # Customer
    "CUSTOMER_NAME": (
        "customer", "text",
        ["customer name", "client name", "account name", "company name", "client",
         "customer", "account", "name", "business name", "organization"],
    ),
    "CUSTOMER_TENURE_START": (
        "customer", "date",
        ["start date", "since", "customer since", "first purchase", "acquisition date",
         "onboard date", "first invoice date", "relationship start", "contract start",
         "client since", "first order date"],
    ),
    "CUSTOMER_INDUSTRY": (
        "customer", "categorical",
        ["industry", "sector", "vertical", "market", "segment", "niche"],
    ),
    "CUSTOMER_IS_ACTIVE": (
        "customer", "boolean",
        ["active", "status", "is active", "account status", "customer status",
         "active customer", "current"],
    ),
    "CUSTOMER_OWNER_CONTACT": (
        "customer", "text",
        ["owner", "contact", "account owner", "relationship owner", "account manager",
         "sales rep", "assigned to", "rep"],
    ),

    # Employee
    "EMPLOYEE_NAME": (
        "employee", "text",
        ["employee name", "name", "full name", "staff name", "worker name",
         "employee", "staff", "personnel", "person",
         "first name", "last name", "given name", "surname", "worker"],
    ),
    "EMPLOYEE_ROLE": (
        "employee", "categorical",
        ["title", "role", "job title", "position", "function", "job role",
         "designation", "job function", "occupation", "classification"],
    ),
    "EMPLOYEE_DEPARTMENT": (
        "employee", "categorical",
        ["department", "team", "division", "group", "cost center", "dept",
         "business unit", "practice area", "office"],
    ),
    "EMPLOYEE_HIRE_DATE": (
        "employee", "date",
        ["hire date", "start date", "date of hire", "employment start",
         "join date", "onboard date", "date hired", "employment date"],
    ),
    "EMPLOYEE_STATUS": (
        "employee", "categorical",
        ["status", "employment status", "active", "is active", "employment type",
         "worker type", "staff type", "employment status"],
    ),
    "EMPLOYEE_COMP_ANNUAL": (
        "employee", "numeric",
        ["salary", "compensation", "annual pay", "base pay", "annual salary",
         "gross pay", "annual compensation", "base salary", "wages", "pay rate",
         "annual wages", "total compensation"],
    ),
    "EMPLOYEE_IS_OWNER": (
        "employee", "boolean",
        ["owner", "is owner", "ownership", "principal", "partner", "shareholder"],
    ),
    "EMPLOYEE_MANAGEMENT_LEVEL": (
        "employee", "numeric",
        ["level", "management level", "grade", "band", "tier", "seniority level",
         "job level", "pay grade"],
    ),

    # Expense
    "EXPENSE_AMOUNT": (
        "expense", "numeric",
        ["amount", "cost", "expense", "total", "debit", "net amount", "value",
         "charge", "expenditure", "payment", "disbursement", "spend"],
    ),
    "EXPENSE_CATEGORY": (
        "expense", "categorical",
        ["category", "type", "account", "gl account", "account code", "expense type",
         "expense category", "cost category", "class", "expense class", "classification"],
    ),
    "EXPENSE_DESCRIPTION": (
        "expense", "text",
        ["description", "memo", "note", "detail", "narration", "comment",
         "particulars", "notes", "line description"],
    ),
    "EXPENSE_PERIOD": (
        "expense", "date",
        ["date", "period", "month", "transaction date", "post date", "payment date",
         "expense date", "invoice date", "bill date"],
    ),
    "EXPENSE_VENDOR": (
        "expense", "text",
        ["vendor", "supplier", "payee", "merchant", "vendor name", "paid to",
         "supplier name", "counterparty", "service provider"],
    ),

    # Contract
    "CONTRACT_START_DATE": (
        "contract", "date",
        ["start date", "contract start", "effective date", "agreement date",
         "commencement date", "contract effective", "term start"],
    ),
    "CONTRACT_END_DATE": (
        "contract", "date",
        ["end date", "contract end", "expiry date", "expiration", "renewal date",
         "termination date", "term end", "expires", "expiration date"],
    ),
    "CONTRACT_ANNUAL_VALUE": (
        "contract", "numeric",
        ["value", "amount", "annual value", "contract value", "arr",
         "annual contract value", "acv", "contract amount", "deal value", "mrr"],
    ),
    "CONTRACT_TYPE": (
        "contract", "categorical",
        ["type", "contract type", "agreement type", "service type", "contract category",
         "engagement type", "deal type"],
    ),
    "CONTRACT_CUSTOMER_ID": (
        "contract", "text",
        ["customer", "client", "account", "customer name", "client name",
         "party", "counterparty"],
    ),
    "CONTRACT_IS_ACTIVE": (
        "contract", "boolean",
        ["active", "status", "is active", "contract status", "current"],
    ),
}

# Fields that should NEVER be mapped (administrative / system columns)
_EXCLUDE_PATTERNS = [
    "row number", "id", "record id", "uuid", "guid", "primary key",
    "created by", "modified by", "created at", "modified at", "last updated",
    "import id", "sync status", "internal id",
]


@dataclass
class ColumnMapping:
    source_column: str
    ontology_field: Optional[str]          # None = excluded
    entity_type: Optional[str]
    confidence: int                         # 0–100
    match_method: str                       # "exact", "fuzzy", "value_inference", "manual", "excluded"
    match_detail: str                       # human-readable reason
    requires_review: bool                   # confidence < 80 → needs advisor sign-off
    alternative_fields: list[tuple[str, int]] = field(default_factory=list)  # (field, confidence)

    def to_dict(self) -> dict:
        return {
            "source_column": self.source_column,
            "ontology_field": self.ontology_field,
            "entity_type": self.entity_type,
            "confidence": self.confidence,
            "match_method": self.match_method,
            "match_detail": self.match_detail,
            "requires_review": self.requires_review,
            "alternative_fields": [{"field": f, "confidence": c} for f, c in self.alternative_fields],
        }


@dataclass
class ColumnMappingResult:
    ingestion_id: str
    mappings: list[ColumnMapping] = field(default_factory=list)
    auto_mapped: int = 0
    review_required: int = 0
    excluded: int = 0

    def to_dict(self) -> dict:
        return {
            "ingestion_id": self.ingestion_id,
            "auto_mapped": self.auto_mapped,
            "review_required": self.review_required,
            "excluded": self.excluded,
            "mappings": [m.to_dict() for m in self.mappings],
        }


def _normalize(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", str(s).lower()).strip()


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _score_field_match(norm_header: str, synonyms: list[str]) -> tuple[int, str]:
    """Returns (confidence 0-100, match_detail)."""
    # Exact match
    if norm_header in [_normalize(s) for s in synonyms]:
        return 97, f"Exact synonym match: '{norm_header}'"

    # Contains exact synonym
    for syn in synonyms:
        if _normalize(syn) == norm_header:
            return 97, f"Exact match: '{syn}'"
        if _normalize(syn) in norm_header or norm_header in _normalize(syn):
            return 88, f"Substring match: header contains '{syn}'"

    # Fuzzy match (threshold 0.75)
    best_sim, best_syn = 0.0, ""
    for syn in synonyms:
        sim = _similarity(norm_header, _normalize(syn))
        if sim > best_sim:
            best_sim = sim
            best_syn = syn

    if best_sim >= 0.85:
        return int(best_sim * 90), f"Fuzzy match to '{best_syn}' ({best_sim:.0%})"
    if best_sim >= 0.70:
        return int(best_sim * 75), f"Weak fuzzy match to '{best_syn}' ({best_sim:.0%})"

    return 0, ""


def _infer_from_profile(profile: ColumnProfile) -> list[tuple[str, int, str]]:
    """
    Value-based inference when header matching is weak.
    Returns list of (ontology_field, confidence, detail).
    """
    candidates = []

    # Date columns with financial context → REVENUE_PERIOD or EXPENSE_PERIOD
    if profile.inferred_type == InferredType.DATE:
        if profile.date_year_distribution:
            candidates.append(("REVENUE_PERIOD", 55, "Date column inferred as period field"))
            candidates.append(("EXPENSE_PERIOD", 50, "Date column inferred as period field"))

    # Numeric + currency → financial amount
    if profile.inferred_type == InferredType.NUMERIC and profile.is_currency:
        if profile.value_min is not None and profile.value_min >= 0:
            candidates.append(("REVENUE_GROSS", 60, "Positive numeric currency column"))
        candidates.append(("EXPENSE_AMOUNT", 55, "Numeric currency column"))

    # High-cardinality text → customer/employee name or ID
    if profile.inferred_type == InferredType.TEXT and profile.is_id_like:
        candidates.append(("CUSTOMER_NAME", 45, "High-cardinality text — likely entity name or ID"))

    # Account code pattern → expense category
    if "account_code" in profile.patterns_detected:
        candidates.append(("EXPENSE_CATEGORY", 65, "Account code pattern detected"))

    return sorted(candidates, key=lambda x: -x[1])


def classify_columns(
    profiles: list[ColumnProfile],
    ingestion_id: str,
    source_system_hint: Optional[str] = None,
) -> ColumnMappingResult:
    result = ColumnMappingResult(ingestion_id=ingestion_id)

    for profile in profiles:
        norm = profile.normalized_header

        # Exclude obviously administrative columns
        if any(excl in norm for excl in _EXCLUDE_PATTERNS):
            result.mappings.append(ColumnMapping(
                source_column=profile.raw_header,
                ontology_field=None,
                entity_type=None,
                confidence=0,
                match_method="excluded",
                match_detail="Administrative column excluded from ontology mapping.",
                requires_review=False,
            ))
            result.excluded += 1
            continue

        # Score every ontology field
        scored: list[tuple[str, int, str]] = []
        for field_name, (entity, expected_type, synonyms) in ONTOLOGY_REGISTRY.items():
            score, detail = _score_field_match(norm, synonyms)
            if score > 0:
                # Boost if inferred type matches expected type
                if (
                    (expected_type == "numeric"      and profile.inferred_type == InferredType.NUMERIC) or
                    (expected_type == "date"         and profile.inferred_type == InferredType.DATE) or
                    (expected_type == "boolean"      and profile.inferred_type == InferredType.BOOLEAN) or
                    (expected_type == "categorical"  and profile.inferred_type == InferredType.TEXT and not profile.is_id_like) or
                    (expected_type == "text"         and profile.inferred_type == InferredType.TEXT)
                ):
                    score = min(100, score + 5)
                scored.append((field_name, score, detail))

        scored.sort(key=lambda x: -x[1])

        if scored and scored[0][1] >= 40:
            best_field, best_score, best_detail = scored[0]
            entity_type = ONTOLOGY_REGISTRY[best_field][0]
            method = "exact" if best_score >= 95 else ("fuzzy" if best_score >= 70 else "value_inference")
            alternatives = [(f, s) for f, s, _ in scored[1:4] if s >= 30]
            requires_review = best_score < 80

            result.mappings.append(ColumnMapping(
                source_column=profile.raw_header,
                ontology_field=best_field,
                entity_type=entity_type,
                confidence=best_score,
                match_method=method,
                match_detail=best_detail,
                requires_review=requires_review,
                alternative_fields=alternatives,
            ))
            if requires_review:
                result.review_required += 1
            else:
                result.auto_mapped += 1

        else:
            # Try value-based inference
            inferred = _infer_from_profile(profile)
            if inferred:
                best_field, best_score, best_detail = inferred[0]
                entity_type = ONTOLOGY_REGISTRY[best_field][0]
                result.mappings.append(ColumnMapping(
                    source_column=profile.raw_header,
                    ontology_field=best_field,
                    entity_type=entity_type,
                    confidence=best_score,
                    match_method="value_inference",
                    match_detail=best_detail,
                    requires_review=True,
                    alternative_fields=[(f, s) for f, s, _ in inferred[1:3]],
                ))
                result.review_required += 1
            else:
                # Could not map — flag for manual assignment
                result.mappings.append(ColumnMapping(
                    source_column=profile.raw_header,
                    ontology_field=None,
                    entity_type=None,
                    confidence=0,
                    match_method="unmatched",
                    match_detail="No ontology field matched. Manual assignment required.",
                    requires_review=True,
                ))
                result.review_required += 1

    return result
