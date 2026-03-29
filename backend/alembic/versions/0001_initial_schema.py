"""Initial schema — all ontology and ingestion job tables.

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── companies ──────────────────────────────────────────────────────────
    op.create_table(
        "companies",
        sa.Column("id",          sa.Integer,      primary_key=True),
        sa.Column("name",        sa.String(256),  nullable=False),
        sa.Column("industry",    sa.String(128)),
        sa.Column("founded",     sa.Integer),
        sa.Column("ein",         sa.String(32)),
        sa.Column("state",       sa.String(2)),
        sa.Column("entity_type", sa.String(32)),
        if_not_exists=True,
    )

    # ── customers ──────────────────────────────────────────────────────────
    op.create_table(
        "customers",
        sa.Column("id",               sa.Integer,      primary_key=True),
        sa.Column("company_id",       sa.Integer,      sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("name",             sa.String(256),  nullable=False),
        sa.Column("tenure_start",     sa.Date),
        sa.Column("industry",         sa.String(128)),
        sa.Column("owner_contact",    sa.String(256)),
        sa.Column("is_active",        sa.Boolean,      server_default="true"),
        # lineage
        sa.Column("source_file",      sa.String(512)),
        sa.Column("ingestion_id",     sa.String(128)),
        sa.Column("confidence_level", sa.String(16),   server_default="MEDIUM"),
        sa.Column("ingested_at",      sa.DateTime,     server_default=sa.text("now()")),
        sa.Column("reviewer_sign_off",sa.String(128)),
        if_not_exists=True,
    )

    # ── employees ──────────────────────────────────────────────────────────
    op.create_table(
        "employees",
        sa.Column("id",               sa.Integer,      primary_key=True),
        sa.Column("company_id",       sa.Integer,      sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("name",             sa.String(256),  nullable=False),
        sa.Column("role",             sa.String(128)),
        sa.Column("department",       sa.String(128)),
        sa.Column("hire_date",        sa.Date),
        sa.Column("status",           sa.String(16),   server_default="ACTIVE"),
        sa.Column("comp_annual",      sa.Numeric(12, 2)),
        sa.Column("is_owner",         sa.Boolean,      server_default="false"),
        sa.Column("is_key_person",    sa.Boolean,      server_default="false"),
        sa.Column("management_level", sa.Integer),
        # lineage
        sa.Column("source_file",      sa.String(512)),
        sa.Column("ingestion_id",     sa.String(128)),
        sa.Column("confidence_level", sa.String(16),   server_default="MEDIUM"),
        sa.Column("ingested_at",      sa.DateTime,     server_default=sa.text("now()")),
        sa.Column("reviewer_sign_off",sa.String(128)),
        if_not_exists=True,
    )

    # ── revenue_streams ────────────────────────────────────────────────────
    op.create_table(
        "revenue_streams",
        sa.Column("id",               sa.Integer,      primary_key=True),
        sa.Column("company_id",       sa.Integer,      sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("customer_id",      sa.Integer,      sa.ForeignKey("customers.id")),
        sa.Column("revenue_gross",    sa.Numeric(14, 2), nullable=False),
        sa.Column("revenue_type",     sa.String(32),   nullable=False),
        sa.Column("recurring_flag",   sa.Boolean,      server_default="false"),
        sa.Column("revenue_period",   sa.Date,         nullable=False),
        sa.Column("description",      sa.Text),
        # lineage
        sa.Column("source_file",      sa.String(512)),
        sa.Column("ingestion_id",     sa.String(128)),
        sa.Column("confidence_level", sa.String(16),   server_default="MEDIUM"),
        sa.Column("ingested_at",      sa.DateTime,     server_default=sa.text("now()")),
        sa.Column("reviewer_sign_off",sa.String(128)),
        if_not_exists=True,
    )

    # ── expenses ───────────────────────────────────────────────────────────
    op.create_table(
        "expenses",
        sa.Column("id",               sa.Integer,      primary_key=True),
        sa.Column("company_id",       sa.Integer,      sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("amount",           sa.Numeric(14, 2), nullable=False),
        sa.Column("category",         sa.String(32),   nullable=False),
        sa.Column("description",      sa.Text),
        sa.Column("period",           sa.Date,         nullable=False),
        sa.Column("vendor",           sa.String(256)),
        sa.Column("is_recurring",     sa.Boolean,      server_default="true"),
        # lineage
        sa.Column("source_file",      sa.String(512)),
        sa.Column("ingestion_id",     sa.String(128)),
        sa.Column("confidence_level", sa.String(16),   server_default="MEDIUM"),
        sa.Column("ingested_at",      sa.DateTime,     server_default=sa.text("now()")),
        sa.Column("reviewer_sign_off",sa.String(128)),
        if_not_exists=True,
    )

    # ── contracts ──────────────────────────────────────────────────────────
    op.create_table(
        "contracts",
        sa.Column("id",                sa.Integer,      primary_key=True),
        sa.Column("company_id",        sa.Integer,      sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("customer_id",       sa.Integer,      sa.ForeignKey("customers.id")),
        sa.Column("start_date",        sa.Date),
        sa.Column("end_date",          sa.Date),
        sa.Column("annual_value",      sa.Numeric(14, 2)),
        sa.Column("contract_type",     sa.String(64)),
        sa.Column("is_active",         sa.Boolean,      server_default="true"),
        sa.Column("renewal_confirmed", sa.Boolean,      server_default="false"),
        sa.Column("document_path",     sa.String(512)),
        # lineage
        sa.Column("source_file",       sa.String(512)),
        sa.Column("ingestion_id",      sa.String(128)),
        sa.Column("confidence_level",  sa.String(16),   server_default="MEDIUM"),
        sa.Column("ingested_at",       sa.DateTime,     server_default=sa.text("now()")),
        sa.Column("reviewer_sign_off", sa.String(128)),
        if_not_exists=True,
    )

    # ── ingestion_jobs ─────────────────────────────────────────────────────
    op.create_table(
        "ingestion_jobs",
        sa.Column("id",               sa.Integer,      primary_key=True),
        sa.Column("company_id",       sa.Integer,      sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("ingestion_id",     sa.String(128),  nullable=False),
        sa.Column("filename",         sa.String(512),  nullable=False),
        sa.Column("source_type",      sa.String(64)),
        sa.Column("file_path",        sa.String(1024)),
        sa.Column("file_hash",        sa.String(64)),
        sa.Column("file_size",        sa.Integer),
        sa.Column("current_phase",    sa.String(32),   server_default="P1_INTAKE"),
        sa.Column("current_status",   sa.String(32),   server_default="PENDING"),
        sa.Column("validation_report",sa.JSON),
        sa.Column("schema_profile",   sa.JSON),
        sa.Column("column_mappings",  sa.JSON),
        sa.Column("extraction_errors",sa.JSON),
        sa.Column("row_count",        sa.Integer),
        sa.Column("mapped_count",     sa.Integer),
        sa.Column("error_count",      sa.Integer),
        sa.Column("created_at",       sa.DateTime,     server_default=sa.text("now()")),
        sa.Column("updated_at",       sa.DateTime,     server_default=sa.text("now()")),
        sa.Column("completed_at",     sa.DateTime),
        if_not_exists=True,
    )

    # ── ingestion_jobs indexes ─────────────────────────────────────────────
    op.create_index(
        "ix_ingestion_jobs_ingestion_id",
        "ingestion_jobs",
        ["ingestion_id"],
        unique=True,
        if_not_exists=True,
    )

    # ── seed a default company (idempotent — DB may already have id=1 from bootstrap or a retry)
    op.execute(
        """
        INSERT INTO companies (id, name, industry, entity_type)
        VALUES (1, 'Demo Company', 'Technology', 'LLC')
        ON CONFLICT (id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_table("ingestion_jobs")
    op.drop_table("contracts")
    op.drop_table("expenses")
    op.drop_table("revenue_streams")
    op.drop_table("employees")
    op.drop_table("customers")
    op.drop_table("companies")
