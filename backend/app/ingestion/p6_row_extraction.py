"""
P6 — Row-Level Extraction & Parsing (Blueprint I §P6)

Parses each row using the column mappings from P5. Handles:
  - Multi-format date parsing (12 formats including QuickBooks, Xero, payroll)
  - Currency parsing ($1,234.56, (1,234.56), 1,234.56-)
  - Boolean normalization (Yes/No/Y/N/True/False/1/0)
  - Name / text normalization
  - Per-row error logging with row reference

Output: list of extracted records keyed by ontology field, plus an error log.
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

import pandas as pd

from app.ingestion.p5_column_mapping import ColumnMapping


# ── Date format library ─────────────────────────────────────────────────────
_DATE_FORMATS = [
    "%m/%d/%Y",    # 01/31/2024
    "%m/%d/%y",    # 01/31/24
    "%d/%m/%Y",    # 31/01/2024
    "%Y-%m-%d",    # 2024-01-31  (ISO 8601)
    "%d-%b-%Y",    # 31-Jan-2024
    "%b %d, %Y",   # Jan 31, 2024
    "%B %d, %Y",   # January 31, 2024
    "%d %b %Y",    # 31 Jan 2024
    "%Y/%m/%d",    # 2024/01/31
    "%m-%d-%Y",    # 01-31-2024
    "%b-%d-%Y",    # Jan-31-2024
    "%Y%m%d",      # 20240131
]

_MONTH_ABBR = {
    "jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,
    "jul":7,"aug":8,"sep":9,"oct":10,"nov":11,"dec":12,
}

_RE_QUARTER    = re.compile(r"Q([1-4])\s+(\d{4})", re.I)
_RE_MONTH_YEAR = re.compile(r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+(\d{4})", re.I)
_RE_YEAR_ONLY  = re.compile(r"^(20\d{2}|19\d{2})$")
_RE_CURRENCY   = re.compile(r"[^\d.\-+eE()]")


@dataclass
class ParseError:
    row_index: int
    source_column: str
    raw_value: str
    error_type: str      # "date_parse", "numeric_parse", "required_missing"
    message: str

    def to_dict(self) -> dict:
        return {
            "row_index": self.row_index,
            "source_column": self.source_column,
            "raw_value": self.raw_value,
            "error_type": self.error_type,
            "message": self.message,
        }


@dataclass
class ExtractionResult:
    ingestion_id: str
    records: list[dict[str, Any]] = field(default_factory=list)   # list of {ontology_field: parsed_value}
    errors: list[ParseError]       = field(default_factory=list)
    row_count: int = 0
    error_count: int = 0
    skipped_count: int = 0   # rows skipped due to fatal parse errors

    def to_dict(self) -> dict:
        return {
            "ingestion_id": self.ingestion_id,
            "row_count": self.row_count,
            "error_count": self.error_count,
            "skipped_count": self.skipped_count,
            "records": self.records,
            "errors": [e.to_dict() for e in self.errors],
        }


# ── Parsers ──────────────────────────────────────────────────────────────────

def parse_date(raw: str) -> Optional[date]:
    """Try all known date formats. Returns None if unparseable."""
    s = str(raw).strip()
    if not s or s.lower() in ("nan", "none", "nat", ""):
        return None

    # Quarter → first day of first month
    m = _RE_QUARTER.match(s)
    if m:
        q, yr = int(m.group(1)), int(m.group(2))
        month = (q - 1) * 3 + 1
        return date(yr, month, 1)

    # "Jan 2024" or "January, 2024"
    m = _RE_MONTH_YEAR.match(s)
    if m:
        mo = _MONTH_ABBR.get(m.group(1)[:3].lower(), 1)
        return date(int(m.group(2)), mo, 1)

    # Year only → Jan 1 of that year
    m = _RE_YEAR_ONLY.match(s)
    if m:
        return date(int(m.group(1)), 1, 1)

    # Try explicit formats
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except (ValueError, TypeError):
            continue

    # Last resort: pandas
    try:
        return pd.to_datetime(s, infer_datetime_format=True).date()
    except Exception:
        return None


def parse_currency(raw: str) -> Optional[Decimal]:
    """
    Parse currency strings:
      $1,234.56 → 1234.56
      (1,234.56) → -1234.56  (accounting negative)
      1,234.56-  → -1234.56
      1234       → 1234.00
    """
    s = str(raw).strip()
    if not s or s.lower() in ("nan", "none", ""):
        return None

    # Accounting negative: (1234.56)
    negative = s.startswith("(") and s.endswith(")")
    if negative:
        s = s[1:-1]

    # Strip currency symbols and commas
    s = _RE_CURRENCY.sub("", s)
    # Trailing minus (some exports: 1234-)
    if s.endswith("-"):
        negative = True
        s = s[:-1]

    try:
        value = Decimal(s)
        return -value if negative else value
    except InvalidOperation:
        return None


def parse_boolean(raw: str) -> Optional[bool]:
    s = str(raw).strip().lower()
    if s in ("yes", "y", "true", "1", "x", "✓", "active"):
        return True
    if s in ("no", "n", "false", "0", "", "inactive"):
        return False
    return None


def parse_text(raw: Any) -> Optional[str]:
    if raw is None or str(raw).strip().lower() in ("nan", "none", ""):
        return None
    return str(raw).strip()


# ── Main extraction ───────────────────────────────────────────────────────────

def _get_field_type(ontology_field: str) -> str:
    from app.ingestion.p5_column_mapping import ONTOLOGY_REGISTRY
    if ontology_field in ONTOLOGY_REGISTRY:
        return ONTOLOGY_REGISTRY[ontology_field][1]
    return "text"


def extract_rows(
    df: pd.DataFrame,
    mappings: list[ColumnMapping],
    ingestion_id: str,
) -> ExtractionResult:
    result = ExtractionResult(ingestion_id=ingestion_id)

    # Only mapped columns (skip excluded / unmatched)
    active = [m for m in mappings if m.ontology_field and m.match_method != "excluded"]

    for row_idx, row in df.iterrows():
        record: dict[str, Any] = {"_row_index": int(row_idx)}
        row_errors = 0

        for mapping in active:
            src_col = mapping.source_column
            if src_col not in df.columns:
                continue

            raw = row[src_col]
            expected_type = _get_field_type(mapping.ontology_field)

            parsed: Any = None
            parse_ok = True

            if expected_type == "numeric":
                parsed = parse_currency(str(raw))
                if parsed is None and str(raw).strip() not in ("", "nan", "None"):
                    result.errors.append(ParseError(
                        row_index=int(row_idx),
                        source_column=src_col,
                        raw_value=str(raw),
                        error_type="numeric_parse",
                        message=f"Could not parse '{raw}' as a numeric/currency value.",
                    ))
                    row_errors += 1
                    parse_ok = False

            elif expected_type == "date":
                parsed = parse_date(str(raw))
                if parsed is None and str(raw).strip() not in ("", "nan", "None"):
                    result.errors.append(ParseError(
                        row_index=int(row_idx),
                        source_column=src_col,
                        raw_value=str(raw),
                        error_type="date_parse",
                        message=f"Could not parse '{raw}' as a date.",
                    ))
                    row_errors += 1
                    parse_ok = False

            elif expected_type == "boolean":
                parsed = parse_boolean(str(raw))

            else:  # text / categorical / id
                parsed = parse_text(raw)

            if parse_ok and parsed is not None:
                # Convert date to ISO string for JSON serialization
                if isinstance(parsed, date):
                    record[mapping.ontology_field] = parsed.isoformat()
                elif isinstance(parsed, Decimal):
                    record[mapping.ontology_field] = float(parsed)
                else:
                    record[mapping.ontology_field] = parsed

        # Include row even with errors (for partial data)
        result.records.append(record)
        result.row_count += 1
        result.error_count += row_errors

    return result
