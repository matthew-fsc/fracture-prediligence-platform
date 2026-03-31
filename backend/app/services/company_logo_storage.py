"""Persist per-company report logos via the file storage abstraction (local or S3)."""

from __future__ import annotations

from typing import Optional

from app.core.config import settings
from app.core.file_storage import get_storage

_EXT_BY_CT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
_ALL_EXT = (".png", ".jpg", ".jpeg", ".webp", ".gif")


def _logo_key(company_id: int, ext: str) -> str:
    return f"logos/{company_id}{ext}"


def resolve_company_logo_path(company_id: int) -> Optional[str]:
    """
    Return the logo location for this company, or None if not uploaded.

    - Local storage: returns absolute filesystem path string
    - S3 storage: returns a pre-signed URL (valid 1 hour)

    Both strings are accepted by fpdf2's image() method and by FastAPI's
    FileResponse / RedirectResponse in the analytics logo endpoint.
    """
    storage = get_storage()
    for ext in _ALL_EXT:
        key = _logo_key(company_id, ext)
        if storage.file_exists(key):
            if settings.USE_S3_STORAGE:
                return storage.get_signed_url(key, expires_in=3600)
            else:
                from app.core.file_storage import LocalFileStorage
                assert isinstance(storage, LocalFileStorage)
                return str((storage._base / key).resolve())
    return None


def has_uploaded_company_logo(company_id: int) -> bool:
    return resolve_company_logo_path(company_id) is not None


def delete_company_logo_files(company_id: int) -> None:
    storage = get_storage()
    for ext in _ALL_EXT:
        storage.delete_file(_logo_key(company_id, ext))


def save_company_logo_upload(company_id: int, raw: bytes, content_type: str) -> str:
    """Store logo bytes via the active storage backend. Returns the storage key."""
    ct = (content_type or "").split(";")[0].strip().lower()
    ext = _EXT_BY_CT.get(ct)
    if not ext:
        raise ValueError("Unsupported image type; use PNG, JPEG, WebP, or GIF.")
    max_b = settings.COMPANY_LOGO_MAX_BYTES
    if len(raw) > max_b:
        raise ValueError(f"Logo must be under {max_b // (1024 * 1024)} MB.")
    delete_company_logo_files(company_id)
    key = _logo_key(company_id, ext)
    get_storage().store_file(key, raw)
    return key
