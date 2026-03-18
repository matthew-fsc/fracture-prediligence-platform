"""
Ingestion pipeline job tracking models.
Tracks each file through P1–P11 with phase status, errors, and lineage.
"""

from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PipelinePhase(str, Enum):
    P1_INTAKE      = "P1_INTAKE"
    P2_EXTRACTION  = "P2_EXTRACTION"
    P3_VALIDATION  = "P3_VALIDATION"
    P4_PROFILING   = "P4_PROFILING"
    P5_MAPPING     = "P5_MAPPING"
    P6_EXTRACTION  = "P6_EXTRACTION"
    P7_RULES       = "P7_RULES"
    P8_NORMALIZE   = "P8_NORMALIZE"
    P9_ENTITY_RES  = "P9_ENTITY_RES"
    P10_RELATIONS  = "P10_RELATIONS"
    P11_COMMIT     = "P11_COMMIT"


class PhaseStatus(str, Enum):
    PENDING     = "PENDING"
    RUNNING     = "RUNNING"
    COMPLETE    = "COMPLETE"
    FAILED      = "FAILED"
    QUARANTINED = "QUARANTINED"
    AWAITING_REVIEW = "AWAITING_REVIEW"  # human review required (low-confidence mappings)


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id:           Mapped[int]           = mapped_column(Integer, primary_key=True)
    company_id:   Mapped[int]           = mapped_column(ForeignKey("companies.id"))
    ingestion_id: Mapped[str]           = mapped_column(String(128), unique=True, index=True)
    filename:     Mapped[str]           = mapped_column(String(512))
    source_type:  Mapped[Optional[str]] = mapped_column(String(64))   # quickbooks_pl, crm_export, payroll, etc.
    file_path:    Mapped[Optional[str]] = mapped_column(String(1024))
    file_hash:    Mapped[Optional[str]] = mapped_column(String(64))   # SHA-256
    file_size:    Mapped[Optional[int]] = mapped_column(Integer)

    current_phase:  Mapped[PipelinePhase] = mapped_column(String(32), default=PipelinePhase.P1_INTAKE)
    current_status: Mapped[PhaseStatus]   = mapped_column(String(32), default=PhaseStatus.PENDING)

    # JSON blobs — phase outputs stored here until committed to ontology
    validation_report: Mapped[Optional[dict]] = mapped_column(JSON)   # P3 output
    schema_profile:    Mapped[Optional[dict]] = mapped_column(JSON)   # P4 output
    column_mappings:   Mapped[Optional[dict]] = mapped_column(JSON)   # P5 output
    extraction_errors: Mapped[Optional[dict]] = mapped_column(JSON)   # P6 parse errors
    row_count:         Mapped[Optional[int]]  = mapped_column(Integer)
    mapped_count:      Mapped[Optional[int]]  = mapped_column(Integer)
    error_count:       Mapped[Optional[int]]  = mapped_column(Integer)

    created_at:   Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at:   Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
