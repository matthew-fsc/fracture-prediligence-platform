"""Add NAICS/SIC codes to companies and WACC + NAICS index to market_segment_metrics.

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-21

Changes:
- companies.naics_code        — 6-digit NAICS code (advisor-entered)
- companies.sic_code          — 4-digit SIC code (advisor-entered)
- market_benchmark_releases   — create if missing (was never added to migrations)
- market_segment_metrics      — create if missing (was never added to migrations)
- market_benchmark_cache      — create if missing (was never added to migrations)
- market_segment_metrics.wacc_estimate_pct  — estimated WACC for this segment
- market_segment_metrics.naics_codes        — comma-separated NAICS prefixes for auto-resolution
"""

from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = set(insp.get_table_names())

    # Create market_benchmark_releases if it was never migrated
    if "market_benchmark_releases" not in tables:
        op.create_table(
            "market_benchmark_releases",
            sa.Column("id",          sa.Integer,     primary_key=True, autoincrement=True),
            sa.Column("source_type", sa.String(32),  nullable=False),
            sa.Column("label",       sa.String(256), nullable=False),
            sa.Column("as_of_date",  sa.Date,        nullable=True),
            sa.Column("doc_ref",     sa.String(256), nullable=True),
            sa.Column("created_at",  sa.DateTime,    server_default=sa.func.now()),
        )

    # Create market_segment_metrics with all columns (including new ones) if missing
    if "market_segment_metrics" not in tables:
        op.create_table(
            "market_segment_metrics",
            sa.Column("id",                            sa.Integer,      primary_key=True, autoincrement=True),
            sa.Column("release_id",                    sa.Integer,      sa.ForeignKey("market_benchmark_releases.id"), nullable=False, index=True),
            sa.Column("industry_slug",                 sa.String(64),   nullable=False, index=True),
            sa.Column("industry_display_name",         sa.String(128),  nullable=False),
            sa.Column("ebitda_band_label",             sa.String(64),   nullable=False),
            sa.Column("ebitda_band_min",               sa.Numeric(14, 2), nullable=True),
            sa.Column("ebitda_band_max",               sa.Numeric(14, 2), nullable=True),
            sa.Column("peer_count",                    sa.Integer,      nullable=True),
            sa.Column("revenue_growth_median_pct",     sa.Numeric(6, 2), nullable=True),
            sa.Column("ebitda_margin_median_pct",      sa.Numeric(6, 2), nullable=True),
            sa.Column("payroll_ratio_median_pct",      sa.Numeric(6, 2), nullable=True),
            sa.Column("recurring_rev_median_pct",      sa.Numeric(6, 2), nullable=True),
            sa.Column("top_customer_conc_median_pct",  sa.Numeric(6, 2), nullable=True),
            sa.Column("market_ebitda_multiple_floor",  sa.Numeric(6, 2), nullable=True),
            sa.Column("market_ebitda_multiple_ceiling", sa.Numeric(6, 2), nullable=True),
            sa.Column("wacc_estimate_pct",             sa.Numeric(5, 2), nullable=True),
            sa.Column("naics_codes",                   sa.String(256),  nullable=True),
        )
    else:
        # Table already exists — add only the new columns from this migration
        existing_cols = {c["name"] for c in insp.get_columns("market_segment_metrics")}
        if "wacc_estimate_pct" not in existing_cols:
            op.add_column("market_segment_metrics", sa.Column("wacc_estimate_pct", sa.Numeric(5, 2), nullable=True))
        if "naics_codes" not in existing_cols:
            op.add_column("market_segment_metrics", sa.Column("naics_codes", sa.String(256), nullable=True))

    # Create market_benchmark_cache if it was never migrated
    if "market_benchmark_cache" not in tables:
        op.create_table(
            "market_benchmark_cache",
            sa.Column("id",           sa.Integer,     primary_key=True, autoincrement=True),
            sa.Column("cache_key",    sa.String(512), nullable=False, unique=True, index=True),
            sa.Column("payload_json", sa.Text,        nullable=False),
            sa.Column("expires_at",   sa.DateTime,    nullable=False, index=True),
            sa.Column("created_at",   sa.DateTime,    server_default=sa.func.now()),
        )

    # NAICS/SIC on companies
    companies_cols = {c["name"] for c in insp.get_columns("companies")}
    if "naics_code" not in companies_cols:
        op.add_column("companies", sa.Column("naics_code", sa.String(8), nullable=True))
    if "sic_code" not in companies_cols:
        op.add_column("companies", sa.Column("sic_code", sa.String(4), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = set(insp.get_table_names())

    if "market_segment_metrics" in tables:
        existing_cols = {c["name"] for c in insp.get_columns("market_segment_metrics")}
        if "naics_codes" in existing_cols:
            op.drop_column("market_segment_metrics", "naics_codes")
        if "wacc_estimate_pct" in existing_cols:
            op.drop_column("market_segment_metrics", "wacc_estimate_pct")

    companies_cols = {c["name"] for c in insp.get_columns("companies")}
    if "sic_code" in companies_cols:
        op.drop_column("companies", "sic_code")
    if "naics_code" in companies_cols:
        op.drop_column("companies", "naics_code")
