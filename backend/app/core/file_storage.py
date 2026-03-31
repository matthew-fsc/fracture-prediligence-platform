"""
File storage abstraction layer (3A).

Provides a unified interface over local filesystem and S3-compatible storage.
Controlled by USE_S3_STORAGE in settings — flip one env var to migrate without
changing calling code.

Usage:
    from app.core.file_storage import get_storage
    storage = get_storage()
    key = storage.store_file("company/1/raw/file.csv", data)
    url  = storage.get_signed_url(key, expires_in=3600)
    data = storage.read_file(key)
    storage.delete_file(key)
"""

from __future__ import annotations

import hashlib
import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from app.core.config import settings


class FileStorage(ABC):
    @abstractmethod
    def store_file(self, key: str, data: bytes, *, read_only: bool = False) -> str:
        """Persist data at the given key. Returns the storage key."""

    @abstractmethod
    def read_file(self, key: str) -> bytes:
        """Read and return file content by key."""

    @abstractmethod
    def delete_file(self, key: str) -> None:
        """Delete a file. Silently ignores missing keys."""

    @abstractmethod
    def file_exists(self, key: str) -> bool:
        """Return True if the key exists in storage."""

    @abstractmethod
    def get_signed_url(self, key: str, expires_in: int = 3600) -> str:
        """
        Return a pre-signed URL for direct download.
        For local storage this returns a path hint; callers should serve via API instead.
        """

    def sha256(self, data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------------------
# Local filesystem implementation
# ---------------------------------------------------------------------------

class LocalFileStorage(FileStorage):
    def __init__(self, base_dir: Optional[str] = None):
        self._base = Path(base_dir or ".").resolve()

    def _abs(self, key: str) -> Path:
        # Prevent path traversal
        p = (self._base / key).resolve()
        if not str(p).startswith(str(self._base)):
            raise ValueError(f"Invalid storage key: {key}")
        p.parent.mkdir(parents=True, exist_ok=True)
        return p

    def store_file(self, key: str, data: bytes, *, read_only: bool = False) -> str:
        p = self._abs(key)
        p.write_bytes(data)
        if read_only:
            p.chmod(0o444)
        return key

    def read_file(self, key: str) -> bytes:
        return self._abs(key).read_bytes()

    def delete_file(self, key: str) -> None:
        p = self._abs(key)
        if p.exists():
            try:
                p.chmod(0o644)
            except Exception:
                pass
            p.unlink(missing_ok=True)

    def file_exists(self, key: str) -> bool:
        return self._abs(key).is_file()

    def get_signed_url(self, key: str, expires_in: int = 3600) -> str:
        # Local storage has no signed URLs — callers must serve via API route
        return f"/api/files/{key}"

    def list_keys_with_prefix(self, prefix: str) -> list[str]:
        """List all keys under a prefix (relative to base dir). Local-only helper."""
        root = self._abs(prefix) if self.file_exists(prefix) else (self._base / prefix)
        if not root.exists():
            return []
        return [str(p.relative_to(self._base)) for p in root.rglob("*") if p.is_file()]


# ---------------------------------------------------------------------------
# S3-compatible implementation
# ---------------------------------------------------------------------------

class S3FileStorage(FileStorage):
    def __init__(self):
        import boto3
        self._bucket = settings.S3_BUCKET
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL or None,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
            region_name=settings.AWS_REGION,
        )

    def store_file(self, key: str, data: bytes, *, read_only: bool = False) -> str:
        self._client.put_object(Bucket=self._bucket, Key=key, Body=data)
        return key

    def read_file(self, key: str) -> bytes:
        response = self._client.get_object(Bucket=self._bucket, Key=key)
        return response["Body"].read()

    def delete_file(self, key: str) -> None:
        try:
            self._client.delete_object(Bucket=self._bucket, Key=key)
        except Exception:
            pass

    def file_exists(self, key: str) -> bool:
        try:
            self._client.head_object(Bucket=self._bucket, Key=key)
            return True
        except Exception:
            return False

    def get_signed_url(self, key: str, expires_in: int = 3600) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires_in,
        )


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

_storage_instance: Optional[FileStorage] = None


def get_storage() -> FileStorage:
    """
    Return the configured storage backend.
    Uses S3FileStorage when USE_S3_STORAGE=True, otherwise LocalFileStorage.
    Singleton per process — safe for FastAPI workers.
    """
    global _storage_instance
    if _storage_instance is not None:
        return _storage_instance

    if settings.USE_S3_STORAGE:
        if not settings.S3_BUCKET:
            raise RuntimeError("USE_S3_STORAGE=True but S3_BUCKET is not set")
        _storage_instance = S3FileStorage()
    else:
        _storage_instance = LocalFileStorage(base_dir=".")

    return _storage_instance
