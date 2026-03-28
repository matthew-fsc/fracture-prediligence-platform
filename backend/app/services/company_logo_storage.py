"""Persist per-company report logos as files (uploaded images for PDF branding)."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from app.core.config import settings

_EXT_BY_CT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
_ALL_EXT = (".png", ".jpg", ".jpeg", ".webp", ".gif")


def _backend_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def company_logo_dir() -> Path:
    p = Path(settings.COMPANY_LOGO_DIR)
    if not p.is_absolute():
        p = _backend_root() / p
    p.mkdir(parents=True, exist_ok=True)
    return p


def resolve_company_logo_path(company_id: int) -> Optional[Path]:
    root = company_logo_dir()
    for ext in _ALL_EXT:
        candidate = root / f"{company_id}{ext}"
        if candidate.is_file():
            return candidate
    return None


def has_uploaded_company_logo(company_id: int) -> bool:
    return resolve_company_logo_path(company_id) is not None


def delete_company_logo_files(company_id: int) -> None:
    root = company_logo_dir()
    for ext in _ALL_EXT:
        p = root / f"{company_id}{ext}"
        if p.is_file():
            p.unlink()


def save_company_logo_upload(company_id: int, raw: bytes, content_type: str) -> Path:
    ct = (content_type or "").split(";")[0].strip().lower()
    ext = _EXT_BY_CT.get(ct)
    if not ext:
        raise ValueError("Unsupported image type; use PNG, JPEG, WebP, or GIF.")
    max_b = settings.COMPANY_LOGO_MAX_BYTES
    if len(raw) > max_b:
        raise ValueError(f"Logo must be under {max_b // (1024 * 1024)} MB.")
    delete_company_logo_files(company_id)
    dest = company_logo_dir() / f"{company_id}{ext}"
    dest.write_bytes(raw)
    return dest
