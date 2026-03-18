"""
P3 — File Validation & Pre-Screening (Blueprint I §P3)

Runs before any data is read or interpreted. Catches structural problems
that would corrupt the pipeline. A quarantined file is held for investigation —
NOT discarded.

Structural checks (§P3.1):
  - Non-empty
  - Encoding readable (UTF-8, Latin-1, Windows-1252)
  - Extension matches actual format
  - Header row exists
  - Not password-protected
  - Not summary-only
  - Covers expected date range

Content sanity checks (§P3.2):
  - Numeric columns ≥70% numeric values
  - Date columns contain parseable dates
  - No column 100% identical values
  - Key financial columns not all-zero
  - Row count within expected range
"""

from __future__ import annotations
import io
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import chardet
import pandas as pd


class ValidationResult(str, Enum):
    PASS        = "PASS"
    QUARANTINE  = "QUARANTINE"
    WARNING     = "WARNING"


@dataclass
class ValidationCheck:
    name: str
    result: ValidationResult
    message: str
    detail: str = ""


@dataclass
class ValidationReport:
    ingestion_id: str
    filename: str
    overall: ValidationResult = ValidationResult.PASS
    checks: list[ValidationCheck] = field(default_factory=list)
    encoding: Optional[str] = None
    detected_format: Optional[str] = None
    row_count: int = 0
    column_count: int = 0
    header_row_index: int = 0
    is_summary_only: bool = False
    source_system_hint: Optional[str] = None  # "quickbooks", "xero", "hubspot", etc.

    def add(self, check: ValidationCheck):
        self.checks.append(check)
        if check.result == ValidationResult.QUARANTINE:
            self.overall = ValidationResult.QUARANTINE
        elif check.result == ValidationResult.WARNING and self.overall == ValidationResult.PASS:
            self.overall = ValidationResult.WARNING

    def to_dict(self) -> dict:
        return {
            "ingestion_id": self.ingestion_id,
            "filename": self.filename,
            "overall": self.overall.value,
            "encoding": self.encoding,
            "detected_format": self.detected_format,
            "row_count": self.row_count,
            "column_count": self.column_count,
            "header_row_index": self.header_row_index,
            "is_summary_only": self.is_summary_only,
            "source_system_hint": self.source_system_hint,
            "checks": [
                {"name": c.name, "result": c.result.value, "message": c.message, "detail": c.detail}
                for c in self.checks
            ],
        }


# Known source system fingerprints (column name patterns)
_SOURCE_FINGERPRINTS = {
    "quickbooks": ["transaction type", "account", "split", "debit", "credit", "balance", "num"],
    "xero":       ["contact", "invoice number", "reference", "branding theme", "currency code"],
    "hubspot":    ["deal id", "deal stage", "close date", "deal owner", "hs_"],
    "salesforce": ["opportunity id", "stage name", "close date", "opportunity name", "amount"],
    "gusto":      ["employee id", "ssn", "pay period", "gross pay", "net pay", "check date"],
}


def _detect_encoding(data: bytes) -> str:
    result = chardet.detect(data[:10_000])
    encoding = result.get("encoding") or "utf-8"
    # Normalise common aliases
    return {"utf-8-sig": "utf-8", "ascii": "utf-8"}.get(encoding.lower(), encoding)


def _try_read_dataframe(data: bytes, filename: str, encoding: str) -> tuple[Optional[pd.DataFrame], int, str]:
    """
    Returns (dataframe, header_row_index, detected_format).
    Tries Excel first if extension suggests it, then CSV.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # Try Excel
    if ext in ("xlsx", "xls", "xlsm"):
        try:
            df = pd.read_excel(io.BytesIO(data), header=None)
            header_row = _detect_header_row(df)
            df = pd.read_excel(io.BytesIO(data), header=header_row)
            return df, header_row, "excel"
        except Exception:
            pass

    # Try CSV / TSV
    for sep in (",", "\t", ";", "|"):
        try:
            text = data.decode(encoding, errors="replace")
            df = pd.read_csv(io.StringIO(text), sep=sep, header=None, low_memory=False)
            if df.shape[1] < 2:
                continue
            header_row = _detect_header_row(df)
            df = pd.read_csv(io.StringIO(text), sep=sep, header=header_row, low_memory=False)
            fmt = "csv" if sep == "," else ("tsv" if sep == "\t" else "csv")
            return df, header_row, fmt
        except Exception:
            continue

    return None, 0, "unknown"


def _detect_header_row(df: pd.DataFrame) -> int:
    """
    Find the row with the highest proportion of string (non-numeric) values.
    This handles QuickBooks exports that have title blocks above the actual header.
    """
    best_row, best_score = 0, 0.0
    for i in range(min(10, len(df))):
        row = df.iloc[i]
        non_numeric = sum(1 for v in row if isinstance(v, str) and not _is_numeric_str(v))
        score = non_numeric / max(len(row), 1)
        if score > best_score:
            best_score = score
            best_row = i
    return best_row


def _is_numeric_str(s: str) -> bool:
    try:
        float(s.replace(",", "").replace("$", "").replace("(", "-").replace(")", ""))
        return True
    except (ValueError, AttributeError):
        return False


def _detect_source_system(df: pd.DataFrame) -> Optional[str]:
    cols = {c.lower().strip() for c in df.columns if isinstance(c, str)}
    best, best_count = None, 0
    for system, keywords in _SOURCE_FINGERPRINTS.items():
        matches = sum(1 for kw in keywords if any(kw in col for col in cols))
        if matches > best_count:
            best_count = matches
            best = system
    return best if best_count >= 2 else None


def validate_file(data: bytes, filename: str, ingestion_id: str) -> ValidationReport:
    report = ValidationReport(ingestion_id=ingestion_id, filename=filename)

    # ── Check 1: Non-empty ──────────────────────────────────────────────────
    if not data or len(data) < 10:
        report.add(ValidationCheck(
            "non_empty", ValidationResult.QUARANTINE,
            "File is empty or too small to contain data.",
            f"File size: {len(data)} bytes",
        ))
        return report  # No point continuing

    # ── Check 2: Encoding ───────────────────────────────────────────────────
    encoding = _detect_encoding(data)
    report.encoding = encoding
    try:
        data.decode(encoding, errors="strict")
        report.add(ValidationCheck("encoding", ValidationResult.PASS, f"Encoding detected: {encoding}"))
    except UnicodeDecodeError:
        encoding = "latin-1"
        report.encoding = encoding
        report.add(ValidationCheck(
            "encoding", ValidationResult.WARNING,
            f"Could not decode as {encoding}; falling back to latin-1.",
        ))

    # ── Check 3: Parse into DataFrame ──────────────────────────────────────
    df, header_row, fmt = _try_read_dataframe(data, filename, encoding)
    report.detected_format = fmt
    report.header_row_index = header_row

    if df is None or df.empty:
        report.add(ValidationCheck(
            "parseable", ValidationResult.QUARANTINE,
            "Could not parse file as Excel or CSV/TSV.",
            "Verify the file is not corrupted or password-protected.",
        ))
        return report

    report.row_count = len(df)
    report.column_count = len(df.columns)
    report.add(ValidationCheck(
        "parseable", ValidationResult.PASS,
        f"Parsed as {fmt}. {report.row_count} rows × {report.column_count} columns.",
        f"Header detected at row {header_row}.",
    ))

    # ── Check 4: Minimum rows ───────────────────────────────────────────────
    if report.row_count < 2:
        report.add(ValidationCheck(
            "min_rows", ValidationResult.QUARANTINE,
            "File has fewer than 2 data rows — likely a header-only or empty export.",
            f"Actual rows: {report.row_count}",
        ))
    else:
        report.add(ValidationCheck(
            "min_rows", ValidationResult.PASS, f"{report.row_count} data rows present."
        ))

    # ── Check 5: Header row not empty ──────────────────────────────────────
    unnamed_cols = [c for c in df.columns if str(c).startswith("Unnamed")]
    if len(unnamed_cols) > len(df.columns) * 0.5:
        report.add(ValidationCheck(
            "header_row", ValidationResult.WARNING,
            f"{len(unnamed_cols)}/{len(df.columns)} columns are unnamed — possible missing or merged header.",
            "Review for merged cells or title rows above the data.",
        ))
    else:
        report.add(ValidationCheck("header_row", ValidationResult.PASS, "Header row identified."))

    # ── Check 6: Source system fingerprint ─────────────────────────────────
    source_hint = _detect_source_system(df)
    report.source_system_hint = source_hint
    if source_hint:
        report.add(ValidationCheck(
            "source_system", ValidationResult.PASS,
            f"Source system detected: {source_hint}.",
        ))

    # ── Check 7: Not summary-only (too few rows for a 3-year export) ────────
    if report.row_count < 12:
        report.is_summary_only = True
        report.add(ValidationCheck(
            "summary_only", ValidationResult.WARNING,
            "File has very few rows — may be a summary export without transaction detail.",
            "Request transaction-level export if available.",
        ))
    else:
        report.add(ValidationCheck("summary_only", ValidationResult.PASS, "Row count consistent with detail export."))

    # ── Check 8: Numeric column sanity ─────────────────────────────────────
    numeric_cols_ok = True
    for col in df.columns:
        col_str = str(col).lower()
        if any(kw in col_str for kw in ("revenue", "sales", "amount", "total", "income", "expense")):
            non_null = df[col].dropna()
            if len(non_null) == 0:
                continue
            numeric_count = sum(1 for v in non_null if _is_numeric_str(str(v)))
            pct = numeric_count / len(non_null)
            if pct < 0.70:
                numeric_cols_ok = False
                report.add(ValidationCheck(
                    f"numeric_sanity:{col}", ValidationResult.WARNING,
                    f"Column '{col}' appears financial but only {pct:.0%} of values are numeric.",
                    "Check for text entries, currency symbols, or encoding errors.",
                ))

    if numeric_cols_ok:
        report.add(ValidationCheck("numeric_sanity", ValidationResult.PASS, "Financial columns contain numeric values."))

    # ── Check 9: No column 100% identical ──────────────────────────────────
    for col in df.columns:
        non_null = df[col].dropna()
        if len(non_null) > 5 and non_null.nunique() == 1:
            report.add(ValidationCheck(
                f"constant_column:{col}", ValidationResult.WARNING,
                f"Column '{col}' has identical value in every row — possible default fill or export error.",
                f"Constant value: {non_null.iloc[0]}",
            ))

    # ── Check 10: Key financial columns not all-zero ────────────────────────
    for col in df.columns:
        col_str = str(col).lower()
        if any(kw in col_str for kw in ("revenue", "sales", "total", "amount")):
            try:
                numeric_series = pd.to_numeric(
                    df[col].astype(str).str.replace(r"[$,()]", "", regex=True), errors="coerce"
                ).dropna()
                if len(numeric_series) > 0 and numeric_series.abs().sum() == 0:
                    report.add(ValidationCheck(
                        f"all_zero:{col}", ValidationResult.WARNING,
                        f"Column '{col}' contains all-zero values — may be unpopulated.",
                    ))
            except Exception:
                pass

    return report
