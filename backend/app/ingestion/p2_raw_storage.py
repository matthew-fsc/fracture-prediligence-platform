"""
P2 — Raw Extraction & Storage (Blueprint I §P2)

Receives a file and stores it immutably with SHA-256 integrity hash.
The raw file is NEVER modified after this point — it is a legal/audit artifact.
"""

from __future__ import annotations
import hashlib
import os
import uuid
from datetime import date
from pathlib import Path

from app.core.config import settings


def _raw_dir(company_id: int) -> Path:
    p = Path(settings.RAW_DATA_DIR) / str(company_id)
    p.mkdir(parents=True, exist_ok=True)
    return p


def store_raw_file(company_id: int, filename: str, data: bytes, source_type: str = "unknown") -> dict:
    """
    Store raw file immutably. Returns metadata dict including ingestion_id and file_hash.

    Naming convention: {CompanyID}-{SourceType}-{Date}-{Sequence}
    """
    today = date.today().strftime("%Y%m%d")
    sequence = str(uuid.uuid4())[:8]
    ingestion_id = f"{company_id}-{source_type.upper()}-{today}-{sequence}"

    raw_dir = _raw_dir(company_id)
    # Preserve original filename but prefix with ingestion_id for uniqueness
    safe_name = "".join(c if c.isalnum() or c in "._- " else "_" for c in filename)
    dest_path = raw_dir / f"{ingestion_id}__{safe_name}"

    # Write as read-only
    dest_path.write_bytes(data)
    dest_path.chmod(0o444)

    file_hash = hashlib.sha256(data).hexdigest()

    return {
        "ingestion_id": ingestion_id,
        "filename": filename,
        "file_path": str(dest_path),
        "file_hash": file_hash,
        "file_size": len(data),
        "source_type": source_type,
    }
