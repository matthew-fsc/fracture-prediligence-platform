"""
P2 — Raw Extraction & Storage (Blueprint I §P2)

Receives a file and stores it immutably with SHA-256 integrity hash.
The raw file is NEVER modified after this point — it is a legal/audit artifact.

Storage backend is controlled by USE_S3_STORAGE in settings:
  - False (default): local filesystem under RAW_DATA_DIR
  - True: S3-compatible object storage via get_storage()
"""

from __future__ import annotations
import hashlib
import uuid
from datetime import date

from app.core.file_storage import get_storage


def store_raw_file(company_id: int, filename: str, data: bytes, source_type: str = "unknown") -> dict:
    """
    Store raw file immutably. Returns metadata dict including ingestion_id, storage_key, and file_hash.

    Storage key convention: raw/{company_id}/{ingestion_id}__{safe_filename}
    """
    today = date.today().strftime("%Y%m%d")
    sequence = str(uuid.uuid4())[:8]
    ingestion_id = f"{company_id}-{source_type.upper()}-{today}-{sequence}"

    safe_name = "".join(c if c.isalnum() or c in "._- " else "_" for c in filename)
    storage_key = f"raw/{company_id}/{ingestion_id}__{safe_name}"

    storage = get_storage()
    storage.store_file(storage_key, data, read_only=True)

    file_hash = hashlib.sha256(data).hexdigest()

    return {
        "ingestion_id": ingestion_id,
        "filename": filename,
        "file_path": storage_key,   # storage key (S3 key or relative local path)
        "storage_key": storage_key,
        "file_hash": file_hash,
        "file_size": len(data),
        "source_type": source_type,
    }
