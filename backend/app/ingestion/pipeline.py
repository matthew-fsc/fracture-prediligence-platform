"""
Ingestion Pipeline Orchestrator — runs P2 through P11 in sequence.

P2  Raw Storage         → store file immutably with SHA-256
P3  File Validation     → structural + content checks; quarantine on failure
P4  Schema Profiling    → column profiles for every field
P5  Column Mapping      → assign ontology fields with confidence scores
P6  Row Extraction      → parse each row into typed ontology records
P7  Business Rules      → domain validation (required fields, bounds, date coherence)
P8  Normalization       → canonical formats, enum mapping, inferred values
P9  Entity Resolution   → deduplication within batch (name fuzzy match + hash)
P10 Relationship Mapping→ link revenue/contracts to customers
P11 Ontology Commit     → write to ontology tables with full lineage
"""

from __future__ import annotations
import io
import uuid
from datetime import datetime
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.ingestion.p2_raw_storage     import store_raw_file
from app.ingestion.p3_file_validation  import validate_file, ValidationResult
from app.ingestion.p4_schema_profiling import build_schema_profile
from app.ingestion.p5_column_mapping   import classify_columns
from app.ingestion.p6_row_extraction   import extract_rows
from app.ingestion.p7_business_rules   import apply_business_rules
from app.ingestion.p8_normalization    import normalize_records
from app.ingestion.p9_entity_resolution import resolve_entities
from app.ingestion.p10_relationship_mapping import map_relationships
from app.ingestion.p11_ontology_commit import commit_to_ontology
from app.ontology.ingestion_models import IngestionJob, PipelinePhase, PhaseStatus
from app.ontology.models import Company


def _load_dataframe(data: bytes, filename: str, encoding: str, header_row: int) -> Optional[pd.DataFrame]:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("xlsx", "xls", "xlsm"):
        try:
            return pd.read_excel(io.BytesIO(data), header=header_row)
        except Exception:
            pass
    for sep in (",", "\t", ";", "|"):
        try:
            text = data.decode(encoding, errors="replace")
            df = pd.read_csv(io.StringIO(text), sep=sep, header=header_row, low_memory=False)
            if df.shape[1] >= 2:
                return df
        except Exception:
            continue
    return None


def run_pipeline(
    company_id: int,
    filename: str,
    file_data: bytes,
    source_type: str,
    db: Session,
) -> IngestionJob:
    """
    Execute P2–P11. Returns the IngestionJob record with all phase outputs.
    Caller should commit the session after this returns.
    """
    job = IngestionJob(
        company_id=company_id,
        ingestion_id=str(uuid.uuid4()),
        filename=filename,
        source_type=source_type,
        current_phase=PipelinePhase.P2_EXTRACTION,
        current_status=PhaseStatus.RUNNING,
    )
    db.add(job)
    db.flush()

    # ── P2: Raw Storage ──────────────────────────────────────────────────────
    try:
        raw_meta = store_raw_file(company_id, filename, file_data, source_type)
        job.ingestion_id = raw_meta["ingestion_id"]
        job.file_path    = raw_meta["file_path"]
        job.file_hash    = raw_meta["file_hash"]
        job.file_size    = raw_meta["file_size"]
    except Exception as e:
        job.current_phase  = PipelinePhase.P2_EXTRACTION
        job.current_status = PhaseStatus.FAILED
        job.validation_report = {"error": str(e)}
        return job

    # ── P3: File Validation ──────────────────────────────────────────────────
    job.current_phase  = PipelinePhase.P3_VALIDATION
    job.current_status = PhaseStatus.RUNNING
    db.flush()

    validation = validate_file(file_data, filename, job.ingestion_id)
    job.validation_report = validation.to_dict()

    if validation.overall == ValidationResult.QUARANTINE:
        job.current_status = PhaseStatus.QUARANTINED
        return job

    encoding   = validation.encoding or "utf-8"
    header_row = validation.header_row_index

    # ── P4: Schema Profiling ─────────────────────────────────────────────────
    job.current_phase  = PipelinePhase.P4_PROFILING
    job.current_status = PhaseStatus.RUNNING
    db.flush()

    df = _load_dataframe(file_data, filename, encoding, header_row)
    if df is None:
        job.current_status = PhaseStatus.FAILED
        return job

    schema = build_schema_profile(
        df, job.ingestion_id, filename, validation.source_system_hint
    )
    job.schema_profile = schema.to_dict()
    job.row_count = schema.row_count

    # ── P5: Column Mapping ───────────────────────────────────────────────────
    job.current_phase  = PipelinePhase.P5_MAPPING
    job.current_status = PhaseStatus.RUNNING
    db.flush()

    mapping_result = classify_columns(
        schema.columns, job.ingestion_id, validation.source_system_hint
    )
    job.column_mappings = mapping_result.to_dict()
    job.mapped_count = mapping_result.auto_mapped

    total_cols = len(schema.columns)
    if total_cols > 0 and mapping_result.review_required / total_cols > 0.5:
        job.current_status = PhaseStatus.AWAITING_REVIEW
        return job

    # ── P6: Row Extraction ───────────────────────────────────────────────────
    job.current_phase  = PipelinePhase.P6_EXTRACTION
    job.current_status = PhaseStatus.RUNNING
    db.flush()

    extraction = extract_rows(df, mapping_result.mappings, job.ingestion_id)
    job.extraction_errors = {
        "row_count":    extraction.row_count,
        "error_count":  extraction.error_count,
        "skipped_count": extraction.skipped_count,
        "errors":       [e.to_dict() for e in extraction.errors[:200]],
    }
    job.error_count = extraction.error_count

    # ── P7: Business Rule Validation ─────────────────────────────────────────
    job.current_phase  = PipelinePhase.P7_RULES
    job.current_status = PhaseStatus.RUNNING
    db.flush()

    rule_result = apply_business_rules(extraction.records, job.ingestion_id)
    entity_type = rule_result.entity_type

    if rule_result.rejected_records == rule_result.total_records and rule_result.total_records > 0:
        job.current_status = PhaseStatus.QUARANTINED
        return job

    # ── P8: Normalization ────────────────────────────────────────────────────
    job.current_phase  = PipelinePhase.P8_NORMALIZE
    job.current_status = PhaseStatus.RUNNING
    db.flush()

    norm_result = normalize_records(rule_result.clean_records, job.ingestion_id, entity_type)

    # ── P9: Entity Resolution ────────────────────────────────────────────────
    job.current_phase  = PipelinePhase.P9_ENTITY_RES
    job.current_status = PhaseStatus.RUNNING
    db.flush()

    res_result = resolve_entities(norm_result.normalized_records, job.ingestion_id, entity_type)

    # ── P10: Relationship Mapping ─────────────────────────────────────────────
    job.current_phase  = PipelinePhase.P10_RELATIONS
    job.current_status = PhaseStatus.RUNNING
    db.flush()

    # Build per-type record lists for relationship mapping
    revenue_recs   = res_result.resolved_records if entity_type == "revenue"  else []
    expense_recs   = res_result.resolved_records if entity_type == "expense"  else []
    employee_recs  = res_result.resolved_records if entity_type == "employee" else []
    customer_recs  = res_result.resolved_records if entity_type == "customer" else []
    contract_recs  = res_result.resolved_records if entity_type == "contract" else []

    rel_result = map_relationships(
        revenue_recs, expense_recs, employee_recs, customer_recs, contract_recs,
        job.ingestion_id,
    )

    # Use relationship-annotated records where available
    final_records = res_result.resolved_records
    if entity_type == "revenue" and rel_result.revenue_records:
        final_records = rel_result.revenue_records
    elif entity_type == "contract" and rel_result.contract_records:
        final_records = rel_result.contract_records

    # ── P11: Ontology Commit ─────────────────────────────────────────────────
    job.current_phase  = PipelinePhase.P11_COMMIT
    job.current_status = PhaseStatus.RUNNING
    db.flush()

    commit_result = commit_to_ontology(
        records=final_records,
        entity_type=entity_type,
        company_id=company_id,
        source_file=filename,
        ingestion_id=job.ingestion_id,
        db=db,
    )

    # ── Complete ─────────────────────────────────────────────────────────────
    job.current_phase  = PipelinePhase.P11_COMMIT
    job.current_status = PhaseStatus.COMPLETE
    job.completed_at   = datetime.utcnow()

    return job
