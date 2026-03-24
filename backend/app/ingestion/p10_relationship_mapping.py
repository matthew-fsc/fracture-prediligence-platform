"""
P10 — Relationship Mapping (Blueprint I §P10)

Links entities to each other after deduplication:
  - RevenueStream.customer_id  ← matched from REVENUE_CUSTOMER_ID to Customer.name
  - Contract.customer_id       ← matched from CONTRACT_CUSTOMER_ID to Customer.name
  - Provides a relationship_log for lineage traceability

Resolution is done by exact match first, then fuzzy name match (≥80% threshold).
The resolved records carry a '_customer_resolved_name' annotation for audit.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Optional


@dataclass
class RelationshipLink:
    source_entity: str
    source_row_index: int
    target_entity: str
    target_name: str
    match_method: str    # "exact" | "fuzzy" | "unresolved"
    similarity: Optional[float] = None

    def to_dict(self) -> dict:
        return {
            "source":       self.source_entity,
            "row_index":    self.source_row_index,
            "target":       self.target_entity,
            "target_name":  self.target_name,
            "method":       self.match_method,
            "similarity":   round(self.similarity, 3) if self.similarity else None,
        }


@dataclass
class RelationshipMappingResult:
    ingestion_id: str
    links: list[RelationshipLink] = field(default_factory=list)
    unresolved_count: int = 0

    # Annotated records (revenue / contract rows now carry _resolved_customer_name)
    revenue_records: list[dict] = field(default_factory=list)
    contract_records: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "ingestion_id":   self.ingestion_id,
            "link_count":     len(self.links),
            "unresolved":     self.unresolved_count,
            "links":          [l.to_dict() for l in self.links[:100]],
        }


def _token_sort_ratio(a: str, b: str) -> float:
    a_sorted = " ".join(sorted(a.lower().split()))
    b_sorted = " ".join(sorted(b.lower().split()))
    return SequenceMatcher(None, a_sorted, b_sorted).ratio()


def _resolve_customer_ref(
    ref: str,
    customer_names: list[str],
    threshold: float = 0.80,
) -> tuple[Optional[str], str, Optional[float]]:
    """
    Returns (resolved_name, method, similarity) or (None, 'unresolved', None).
    """
    if not ref or not customer_names:
        return None, "unresolved", None

    # Exact match
    ref_lower = ref.strip().lower()
    for name in customer_names:
        if name.lower() == ref_lower:
            return name, "exact", 1.0

    # Fuzzy match
    best_name, best_score = None, 0.0
    for name in customer_names:
        score = _token_sort_ratio(ref, name)
        if score > best_score:
            best_name, best_score = name, score

    if best_score >= threshold:
        return best_name, "fuzzy", best_score

    return None, "unresolved", None


def map_relationships(
    revenue_records: list[dict],
    expense_records: list[dict],
    employee_records: list[dict],
    customer_records: list[dict],
    contract_records: list[dict],
    ingestion_id: str,
) -> RelationshipMappingResult:
    """
    Build cross-entity relationships.
    Modifies records in-place with _resolved_customer_name annotation.
    """
    result = RelationshipMappingResult(ingestion_id=ingestion_id)

    customer_names = [
        str(c.get("CUSTOMER_NAME", "")).strip()
        for c in customer_records
        if c.get("CUSTOMER_NAME")
    ]

    # Revenue → Customer
    for rec in revenue_records:
        ref = rec.get("REVENUE_CUSTOMER_ID") or rec.get("REVENUE_CUSTOMER_NAME")
        if ref:
            resolved, method, sim = _resolve_customer_ref(str(ref), customer_names)
            if resolved:
                rec["_resolved_customer_name"] = resolved
                result.links.append(RelationshipLink(
                    source_entity="revenue",
                    source_row_index=rec.get("_row_index", 0),
                    target_entity="customer",
                    target_name=resolved,
                    match_method=method,
                    similarity=sim,
                ))
            else:
                result.unresolved_count += 1
        result.revenue_records.append(rec)

    # Contract → Customer
    for rec in contract_records:
        ref = rec.get("CONTRACT_CUSTOMER_ID")
        if ref:
            resolved, method, sim = _resolve_customer_ref(str(ref), customer_names)
            if resolved:
                rec["_resolved_customer_name"] = resolved
                result.links.append(RelationshipLink(
                    source_entity="contract",
                    source_row_index=rec.get("_row_index", 0),
                    target_entity="customer",
                    target_name=resolved,
                    match_method=method,
                    similarity=sim,
                ))
            else:
                result.unresolved_count += 1
        result.contract_records.append(rec)

    return result
