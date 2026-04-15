"""
QuickBooks field normalizer (Blueprint I — QB ingestion path).

Maps raw QB SDK response objects into DataFrames whose column headers match
the QB synonym entries in p5_column_mapping.ONTOLOGY_REGISTRY.

The synonym additions registered in p5_column_mapping.py are:
  TotalAmount          → REVENUE_GROSS
  CustomerRef.name     → REVENUE_CUSTOMER_ID (maps customer name on invoice row)
  TxnDate              → REVENUE_PERIOD
  FullyQualifiedName   → CUSTOMER_NAME

This module serialises each DataFrame to CSV bytes so that
``ingestion.pipeline.run_pipeline()`` receives a standard file payload —
no changes to the existing pipeline are required.
"""

from __future__ import annotations

import csv
import io
from typing import Any


def _get_attr(obj: Any, *keys: str, default: Any = None) -> Any:
    """Attribute / dict accessor with multiple key fallbacks."""
    for k in keys:
        try:
            v = getattr(obj, k, None)
            if v is None and isinstance(obj, dict):
                v = obj.get(k)
            if v is not None:
                return v
        except Exception:
            pass
    return default


def _rows_to_csv(fieldnames: list[str], rows: list[dict]) -> bytes:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


# ---------------------------------------------------------------------------
# Invoice / Revenue rows
# ---------------------------------------------------------------------------

def invoices_to_csv(invoices: list[Any]) -> bytes:
    """
    Convert a list of QB Invoice objects to a CSV matching QB synonym headers.
    Column headers intentionally use the QB field names so P5 maps them via
    the quickbooks synonyms in the ontology registry.
    """
    fieldnames = ["TxnDate", "TotalAmount", "CustomerRef.name"]
    rows = []
    for inv in invoices:
        txn_date  = _get_attr(inv, "TxnDate")
        total     = _get_attr(inv, "TotalAmt", "TotalAmount", default=0)
        cust_ref  = _get_attr(inv, "CustomerRef")
        cust_name = ""
        if cust_ref:
            cust_name = _get_attr(cust_ref, "name", "Name", default="")
        rows.append({"TxnDate": txn_date, "TotalAmount": total, "CustomerRef.name": cust_name})
    return _rows_to_csv(fieldnames, rows)


def customers_to_csv(customers: list[Any]) -> bytes:
    """
    Convert a list of QB Customer objects to a CSV matching QB synonym headers.
    """
    fieldnames = ["FullyQualifiedName", "Active"]
    rows = []
    for cust in customers:
        fqn    = _get_attr(cust, "FullyQualifiedName", default="")
        active = _get_attr(cust, "Active", default=True)
        rows.append({"FullyQualifiedName": fqn, "Active": "TRUE" if active else "FALSE"})
    return _rows_to_csv(fieldnames, rows)


def pl_report_to_csv(report: dict[str, Any]) -> bytes:
    """
    Flatten a QB P&L report dict into expense-like rows.
    Returns CSV bytes with columns: Account, Amount, Category, Period.
    """
    rows: list[dict] = []
    _flatten_pl_rows(report, rows)
    if not rows:
        return b"Account,Amount,Category,Period\n"
    fieldnames = ["Account", "Amount", "Category", "Period"]
    return _rows_to_csv(fieldnames, rows)


def _flatten_pl_rows(node: Any, out: list[dict], period: str = "") -> None:
    """Recursively walk a QB P&L report tree and emit leaf rows."""
    if isinstance(node, dict):
        row_type = node.get("type") or node.get("Type", "")
        if str(row_type).upper() == "DATA":
            cols = node.get("ColData") or []
            if len(cols) >= 2:
                account    = cols[0].get("value", "") if isinstance(cols[0], dict) else str(cols[0])
                amount_str = cols[1].get("value", "0") if isinstance(cols[1], dict) else str(cols[1])
                try:
                    amount = float(str(amount_str).replace(",", "") or 0)
                except ValueError:
                    amount = 0.0
                out.append({"Account": account, "Amount": amount, "Category": "OPEX", "Period": period})
        for v in node.values():
            _flatten_pl_rows(v, out, period)
    elif isinstance(node, list):
        for item in node:
            _flatten_pl_rows(item, out, period)
