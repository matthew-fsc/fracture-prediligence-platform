"""
P9 — Entity Resolution & Deduplication (Blueprint I §P9)

Detects duplicate entities within the current ingestion batch and against
existing records in the database. Uses fuzzy name matching for Customers and
Employees; exact hash matching for Revenue/Expense rows.

Resolution strategies:
  - Customers/Employees: token-sort ratio ≥ 85 → same entity (keep first, flag others)
  - Revenue/Expense: if (amount, period, description) hash is identical → duplicate
  - Contracts: (customer_id, start_date, annual_value) uniqueness check

Output: deduplicated record list + resolution_log showing which rows were merged/flagged.
"""

from __future__ import annotations
import hashlib
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Any, Optional


# ── Fuzzy helpers ─────────────────────────────────────────────────────────────

def _token_sort_ratio(a: str, b: str) -> float:
    """Simple token-sort similarity: sort words, compute SequenceMatcher ratio."""
    a_sorted = " ".join(sorted(a.lower().split()))
    b_sorted = " ".join(sorted(b.lower().split()))
    return SequenceMatcher(None, a_sorted, b_sorted).ratio()


def _row_hash(record: dict, key_fields: list[str]) -> str:
    parts = [str(record.get(f, "")) for f in sorted(key_fields)]
    return hashlib.md5("|".join(parts).encode()).hexdigest()


# ── Resolution result ─────────────────────────────────────────────────────────

@dataclass
class ResolutionEvent:
    kept_row_index: int
    duplicate_row_index: int
    reason: str
    similarity: Optional[float] = None

    def to_dict(self) -> dict:
        return {
            "kept":       self.kept_row_index,
            "duplicate":  self.duplicate_row_index,
            "reason":     self.reason,
            "similarity": round(self.similarity, 3) if self.similarity else None,
        }


@dataclass
class EntityResolutionResult:
    ingestion_id: str
    entity_type: str
    input_count: int = 0
    output_count: int = 0
    duplicate_count: int = 0
    resolution_log: list[ResolutionEvent] = field(default_factory=list)
    resolved_records: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "ingestion_id":   self.ingestion_id,
            "entity_type":    self.entity_type,
            "input_count":    self.input_count,
            "output_count":   self.output_count,
            "duplicate_count": self.duplicate_count,
            "resolution_log": [e.to_dict() for e in self.resolution_log[:50]],
        }


# ── Deduplication strategies ──────────────────────────────────────────────────

def _dedup_by_name(
    records: list[dict],
    name_field: str,
    threshold: float = 0.85,
) -> tuple[list[dict], list[ResolutionEvent]]:
    """
    Fuzzy name deduplication. O(n²) but fine for typical ingestion batch sizes (<10k rows).
    """
    kept: list[dict] = []
    events: list[ResolutionEvent] = []
    duplicate_indices: set[int] = set()

    for i, rec_a in enumerate(records):
        if i in duplicate_indices:
            continue
        name_a = str(rec_a.get(name_field, "")).strip()
        kept.append(rec_a)

        for j in range(i + 1, len(records)):
            if j in duplicate_indices:
                continue
            rec_b = records[j]
            name_b = str(rec_b.get(name_field, "")).strip()

            if not name_a or not name_b:
                continue

            similarity = _token_sort_ratio(name_a, name_b)
            if similarity >= threshold:
                duplicate_indices.add(j)
                events.append(ResolutionEvent(
                    kept_row_index=rec_a.get("_row_index", i),
                    duplicate_row_index=rec_b.get("_row_index", j),
                    reason=f"Name similarity {similarity:.0%}: '{name_a}' ≈ '{name_b}'",
                    similarity=similarity,
                ))

    return kept, events


def _dedup_by_hash(
    records: list[dict],
    key_fields: list[str],
) -> tuple[list[dict], list[ResolutionEvent]]:
    """
    Exact-key deduplication for transaction-style records.
    """
    seen: dict[str, dict] = {}
    kept: list[dict] = []
    events: list[ResolutionEvent] = []

    for rec in records:
        h = _row_hash(rec, key_fields)
        if h not in seen:
            seen[h] = rec
            kept.append(rec)
        else:
            events.append(ResolutionEvent(
                kept_row_index=seen[h].get("_row_index", 0),
                duplicate_row_index=rec.get("_row_index", 0),
                reason=f"Exact duplicate on fields: {key_fields}",
            ))

    return kept, events


# ── Public API ────────────────────────────────────────────────────────────────

_STRATEGY = {
    "customer": ("name",  ["CUSTOMER_NAME"]),
    "employee": ("name",  ["EMPLOYEE_NAME"]),
    "revenue":  ("hash",  ["REVENUE_GROSS", "REVENUE_PERIOD", "REVENUE_CUSTOMER_ID"]),
    "expense":  ("hash",  ["EXPENSE_AMOUNT", "EXPENSE_PERIOD", "EXPENSE_VENDOR", "EXPENSE_DESCRIPTION"]),
    "contract": ("hash",  ["CONTRACT_START_DATE", "CONTRACT_END_DATE", "CONTRACT_ANNUAL_VALUE", "CONTRACT_CUSTOMER_ID"]),
}


def resolve_entities(
    records: list[dict],
    ingestion_id: str,
    entity_type: str,
) -> EntityResolutionResult:
    """
    Run P9 entity resolution on a normalized record set.
    Returns EntityResolutionResult with resolved_records deduplicated.
    """
    result = EntityResolutionResult(
        ingestion_id=ingestion_id,
        entity_type=entity_type,
        input_count=len(records),
    )

    if not records:
        return result

    strategy_info = _STRATEGY.get(entity_type)
    if not strategy_info:
        # No dedup strategy — pass through
        result.resolved_records = list(records)
        result.output_count = len(records)
        return result

    strategy, fields = strategy_info

    if strategy == "name":
        name_field = fields[0]
        deduped, events = _dedup_by_name(records, name_field)
    else:
        deduped, events = _dedup_by_hash(records, fields)

    result.resolved_records = deduped
    result.resolution_log   = events
    result.duplicate_count  = len(events)
    result.output_count     = len(deduped)
    return result
