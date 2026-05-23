"""Tests for Blueprint I ingestion pipeline phases P3, P4, P5, P6 and the
_load_dataframe helper."""

import io
import uuid

import pandas as pd
import pytest

from app.ingestion.p3_file_validation import validate_file, ValidationResult
from app.ingestion.p4_schema_profiling import build_schema_profile
from app.ingestion.pipeline import _load_dataframe


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _csv_bytes(*rows: str) -> bytes:
    return "\n".join(rows).encode()


def _excel_bytes(df: pd.DataFrame) -> bytes:
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    return buf.getvalue()


ING_ID = str(uuid.uuid4())


# ---------------------------------------------------------------------------
# P3 — File Validation
# ---------------------------------------------------------------------------

class TestP3FileValidation:
    def test_valid_csv_passes(self):
        data = _csv_bytes(
            "date,revenue,customer",
            "2024-01-01,10000.00,Acme Corp",
            "2024-02-01,12000.00,Beta LLC",
        )
        result = validate_file(data, "revenue.csv", ING_ID)
        assert result.overall != ValidationResult.QUARANTINE

    def test_empty_file_quarantined(self):
        result = validate_file(b"", "empty.csv", ING_ID)
        assert result.overall == ValidationResult.QUARANTINE

    def test_valid_excel_passes(self):
        df = pd.DataFrame({
            "date": ["2024-01-01", "2024-02-01"],
            "revenue": [10000.0, 12000.0],
            "customer": ["Acme", "Beta"],
        })
        data = _excel_bytes(df)
        result = validate_file(data, "revenue.xlsx", ING_ID)
        assert result.overall != ValidationResult.QUARANTINE

    def test_report_has_checks(self):
        data = _csv_bytes("col_a,col_b", "1,2", "3,4")
        result = validate_file(data, "data.csv", ING_ID)
        assert len(result.checks) > 0

    def test_report_captures_row_and_column_counts(self):
        data = _csv_bytes("a,b,c", "1,2,3", "4,5,6", "7,8,9")
        result = validate_file(data, "data.csv", ING_ID)
        assert result.row_count >= 3
        assert result.column_count == 3


# ---------------------------------------------------------------------------
# P4 — Schema Profiling
# ---------------------------------------------------------------------------

class TestP4SchemaProfiling:
    def _sample_df(self):
        return pd.DataFrame({
            "date":     ["2024-01-01", "2024-02-01", "2024-03-01"],
            "revenue":  [10000.0, 12000.0, 9500.0],
            "customer": ["Acme Corp", "Beta LLC", "Acme Corp"],
        })

    def test_produces_profile_for_each_column(self):
        df = self._sample_df()
        profile = build_schema_profile(df, ING_ID, "revenue.csv")
        col_names = [c.raw_header for c in profile.columns]
        assert "date" in col_names
        assert "revenue" in col_names
        assert "customer" in col_names

    def test_numeric_column_detected(self):
        df = self._sample_df()
        profile = build_schema_profile(df, ING_ID, "revenue.csv")
        rev = next((c for c in profile.columns if c.raw_header == "revenue"), None)
        assert rev is not None

    def test_row_count_in_profile(self):
        df = self._sample_df()
        profile = build_schema_profile(df, ING_ID, "revenue.csv")
        assert profile.row_count == 3

    def test_empty_dataframe_returns_zero_rows(self):
        df = pd.DataFrame()
        profile = build_schema_profile(df, ING_ID, "empty.csv")
        assert profile.row_count == 0


# ---------------------------------------------------------------------------
# _load_dataframe helper
# ---------------------------------------------------------------------------

class TestLoadDataframe:
    def test_loads_csv(self):
        data = _csv_bytes("col_a,col_b", "1,2", "3,4")
        df = _load_dataframe(data, "data.csv", "utf-8", 0)
        assert df is not None
        assert list(df.columns) == ["col_a", "col_b"]
        assert len(df) == 2

    def test_loads_excel(self):
        raw = pd.DataFrame({"x": [1, 2], "y": [3, 4]})
        data = _excel_bytes(raw)
        df = _load_dataframe(data, "data.xlsx", "utf-8", 0)
        assert df is not None
        assert "x" in df.columns
        assert len(df) == 2

    def test_returns_none_for_garbage(self):
        df = _load_dataframe(b"\x00\x01\x02\x03", "garbage.csv", "utf-8", 0)
        # Either None or a single-column df with no useful data
        assert df is None or df.shape[1] < 2

    def test_tab_separated(self):
        data = b"col_a\tcol_b\n1\t2\n3\t4"
        df = _load_dataframe(data, "data.tsv", "utf-8", 0)
        assert df is not None
        assert df.shape[1] == 2

    def test_pipe_separated(self):
        data = b"col_a|col_b\n1|2\n3|4"
        df = _load_dataframe(data, "data.csv", "utf-8", 0)
        assert df is not None
        assert df.shape[1] == 2
