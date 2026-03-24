"""
P4 — Schema Profiling (Blueprint I §P4)

Generates a statistical description of every column. This profile is the input
to the column classification engine (P5). Mapping decisions made without profiling
are guesses; with profiling they are informed.

Profile attributes per column (§P4.1):
  - Raw header / normalized header
  - Inferred data type (numeric, text, date, boolean, mixed)
  - Null rate
  - Unique value count
  - Value range (numeric: min/max/mean/median/stdev)
  - Sample values (top 5 most frequent)
  - Date range (earliest/latest for date columns)
  - Currency detection ($ , () formatting)
  - Pattern detection (email, phone, ZIP, account codes)
"""

from __future__ import annotations
import re
import statistics
from dataclasses import dataclass, field
from typing import Any, Optional

import pandas as pd


class InferredType(str):
    NUMERIC  = "numeric"
    TEXT     = "text"
    DATE     = "date"
    BOOLEAN  = "boolean"
    MIXED    = "mixed"
    EMPTY    = "empty"


@dataclass
class ColumnProfile:
    raw_header: str
    normalized_header: str
    inferred_type: str
    null_rate: float            # 0.0–1.0
    unique_count: int
    total_count: int
    # Numeric
    value_min: Optional[float]  = None
    value_max: Optional[float]  = None
    value_mean: Optional[float] = None
    value_median: Optional[float] = None
    value_stdev: Optional[float] = None
    # Date
    date_min: Optional[str]    = None
    date_max: Optional[str]    = None
    date_year_distribution: dict[int, int] = field(default_factory=dict)
    # Samples
    sample_values: list[Any]   = field(default_factory=list)  # top 5 most frequent
    # Flags
    is_currency: bool          = False
    is_id_like: bool           = False    # high cardinality → likely an ID / name column
    patterns_detected: list[str] = field(default_factory=list)  # email, phone, zip, account_code

    def to_dict(self) -> dict:
        return {
            "raw_header": self.raw_header,
            "normalized_header": self.normalized_header,
            "inferred_type": self.inferred_type,
            "null_rate": round(self.null_rate, 4),
            "unique_count": self.unique_count,
            "total_count": self.total_count,
            "value_min": self.value_min,
            "value_max": self.value_max,
            "value_mean": self.value_mean,
            "value_median": self.value_median,
            "value_stdev": self.value_stdev,
            "date_min": self.date_min,
            "date_max": self.date_max,
            "date_year_distribution": self.date_year_distribution,
            "sample_values": [str(v) for v in self.sample_values],
            "is_currency": self.is_currency,
            "is_id_like": self.is_id_like,
            "patterns_detected": self.patterns_detected,
        }


@dataclass
class SchemaProfile:
    ingestion_id: str
    filename: str
    row_count: int
    column_count: int
    columns: list[ColumnProfile] = field(default_factory=list)
    source_system_hint: Optional[str] = None
    estimated_record_type: Optional[str] = None  # transaction, account, summary, mixed
    date_coverage_earliest: Optional[str] = None
    date_coverage_latest: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "ingestion_id": self.ingestion_id,
            "filename": self.filename,
            "row_count": self.row_count,
            "column_count": self.column_count,
            "source_system_hint": self.source_system_hint,
            "estimated_record_type": self.estimated_record_type,
            "date_coverage_earliest": self.date_coverage_earliest,
            "date_coverage_latest": self.date_coverage_latest,
            "columns": [c.to_dict() for c in self.columns],
        }


# ── Patterns ──────────────────────────────────────────────────────────────────
_RE_EMAIL     = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_RE_PHONE     = re.compile(r"^\+?[\d\s\-().]{7,15}$")
_RE_ZIP       = re.compile(r"^\d{5}(-\d{4})?$")
_RE_ACCT_CODE = re.compile(r"^\d{4,6}$")  # 4–6 digit GL account codes
_RE_CURRENCY  = re.compile(r"[\$,]|\(\d")  # $, commas in numbers, (123
_RE_DATE_PATTERNS = [
    re.compile(r"\d{1,2}/\d{1,2}/\d{2,4}"),
    re.compile(r"\d{4}-\d{2}-\d{2}"),
    re.compile(r"[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}"),
    re.compile(r"\d{1,2}-[A-Za-z]{3}-\d{4}"),
    re.compile(r"Q[1-4]\s+\d{4}"),
    re.compile(r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}", re.I),
]


def _normalize_header(raw: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", str(raw).lower()).strip()


def _infer_type(series: pd.Series) -> str:
    non_null = series.dropna().astype(str)
    if len(non_null) == 0:
        return InferredType.EMPTY

    numeric_count = 0
    date_count = 0
    bool_count = 0
    total = len(non_null)

    for val in non_null.sample(min(200, total)):
        v = str(val).strip()
        # Boolean
        if v.lower() in ("yes", "no", "true", "false", "y", "n", "1", "0"):
            bool_count += 1
            continue
        # Numeric (strip currency formatting)
        try:
            float(re.sub(r"[$,%]", "", v).replace("(", "-").replace(")", "").replace(",", ""))
            numeric_count += 1
            continue
        except ValueError:
            pass
        # Date
        if any(p.search(v) for p in _RE_DATE_PATTERNS):
            date_count += 1

    numeric_pct = numeric_count / total
    date_pct    = date_count    / total
    bool_pct    = bool_count    / total

    if numeric_pct >= 0.75:  return InferredType.NUMERIC
    if date_pct    >= 0.70:  return InferredType.DATE
    if bool_pct    >= 0.80:  return InferredType.BOOLEAN
    if numeric_pct + date_pct + bool_pct < 0.15:  return InferredType.TEXT
    return InferredType.MIXED


def _parse_numeric_series(series: pd.Series) -> Optional[pd.Series]:
    """Strip currency formatting and return numeric Series, or None if fails."""
    try:
        cleaned = series.astype(str).str.replace(r"[$,%\s]", "", regex=True)
        cleaned = cleaned.str.replace(r"^\((.+)\)$", r"-\1", regex=True)  # (1234) → -1234
        cleaned = cleaned.str.replace(",", "", regex=False)
        return pd.to_numeric(cleaned, errors="coerce").dropna()
    except Exception:
        return None


def _parse_date_series(series: pd.Series) -> Optional[pd.Series]:
    try:
        return pd.to_datetime(series, infer_datetime_format=True, errors="coerce").dropna()
    except Exception:
        return None


def _detect_patterns(series: pd.Series) -> list[str]:
    patterns = []
    sample = series.dropna().astype(str).sample(min(50, len(series.dropna())))
    email_count = sum(1 for v in sample if _RE_EMAIL.match(v.strip()))
    phone_count = sum(1 for v in sample if _RE_PHONE.match(v.strip()))
    zip_count   = sum(1 for v in sample if _RE_ZIP.match(v.strip()))
    acct_count  = sum(1 for v in sample if _RE_ACCT_CODE.match(v.strip()))
    n = max(len(sample), 1)
    if email_count / n >= 0.5: patterns.append("email")
    if phone_count / n >= 0.5: patterns.append("phone")
    if zip_count   / n >= 0.5: patterns.append("zip_code")
    if acct_count  / n >= 0.5: patterns.append("account_code")
    return patterns


def profile_column(raw_header: str, series: pd.Series) -> ColumnProfile:
    norm = _normalize_header(raw_header)
    total = len(series)
    null_count = int(series.isna().sum()) + int((series.astype(str).str.strip() == "").sum())
    null_rate = null_count / max(total, 1)
    non_null = series.dropna()
    unique_count = int(non_null.nunique())

    inferred_type = _infer_type(series)

    # Sample values — top 5 most frequent
    try:
        top5 = non_null.value_counts().head(5).index.tolist()
    except Exception:
        top5 = []

    # Currency flag
    sample_str = " ".join(str(v) for v in top5)
    is_currency = bool(_RE_CURRENCY.search(sample_str)) or inferred_type == InferredType.NUMERIC and any(
        kw in norm for kw in ("revenue", "sales", "amount", "total", "cost", "expense", "price", "pay", "comp")
    )

    # ID-like (high cardinality text column)
    is_id_like = inferred_type == InferredType.TEXT and unique_count / max(total - null_count, 1) > 0.8

    prof = ColumnProfile(
        raw_header=raw_header,
        normalized_header=norm,
        inferred_type=inferred_type,
        null_rate=float(null_rate),
        unique_count=int(unique_count),
        total_count=int(total),
        sample_values=top5,
        is_currency=bool(is_currency),
        is_id_like=bool(is_id_like),
    )

    # Numeric stats
    if inferred_type == InferredType.NUMERIC:
        nums = _parse_numeric_series(series)
        if nums is not None and len(nums) > 0:
            vals = nums.tolist()
            prof.value_min    = round(float(nums.min()), 2)
            prof.value_max    = round(float(nums.max()), 2)
            prof.value_mean   = round(float(nums.mean()), 2)
            prof.value_median = round(float(nums.median()), 2)
            prof.value_stdev  = round(float(statistics.stdev(vals)) if len(vals) > 1 else 0.0, 2)

    # Date stats
    if inferred_type == InferredType.DATE:
        dates = _parse_date_series(series)
        if dates is not None and len(dates) > 0:
            prof.date_min = str(dates.min().date())
            prof.date_max = str(dates.max().date())
            year_dist = dates.dt.year.value_counts().to_dict()
            prof.date_year_distribution = {int(k): int(v) for k, v in year_dist.items()}

    # Patterns
    prof.patterns_detected = _detect_patterns(series)

    return prof


def build_schema_profile(
    df: pd.DataFrame,
    ingestion_id: str,
    filename: str,
    source_system_hint: Optional[str] = None,
) -> SchemaProfile:
    profile = SchemaProfile(
        ingestion_id=ingestion_id,
        filename=filename,
        row_count=len(df),
        column_count=len(df.columns),
        source_system_hint=source_system_hint,
    )

    all_dates = []
    for col in df.columns:
        cp = profile_column(str(col), df[col])
        profile.columns.append(cp)
        if cp.date_min: all_dates.append(cp.date_min)
        if cp.date_max: all_dates.append(cp.date_max)

    if all_dates:
        profile.date_coverage_earliest = min(all_dates)
        profile.date_coverage_latest   = max(all_dates)

    # Estimate record type
    col_names = " ".join(c.normalized_header for c in profile.columns)
    if any(kw in col_names for kw in ("transaction type", "num", "debit", "credit")):
        profile.estimated_record_type = "transaction"
    elif any(kw in col_names for kw in ("account", "total", "subtotal")):
        profile.estimated_record_type = "account_summary"
    elif profile.row_count < 30:
        profile.estimated_record_type = "summary"
    else:
        profile.estimated_record_type = "detail"

    return profile
