"""Add NAICS/SIC codes to companies and WACC + NAICS index to market_segment_metrics.

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-21

Changes:
- companies.naics_code        — 6-digit NAICS code (advisor-entered)
- companies.sic_code          — 4-digit SIC code (advisor-entered)
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
    op.add_column("companies", sa.Column("naics_code", sa.String(8), nullable=True))
    op.add_column("companies", sa.Column("sic_code",   sa.String(4), nullable=True))
    op.add_column("market_segment_metrics", sa.Column("wacc_estimate_pct", sa.Numeric(5, 2), nullable=True))
    op.add_column("market_segment_metrics", sa.Column("naics_codes",       sa.String(256),   nullable=True))


def downgrade() -> None:
    op.drop_column("market_segment_metrics", "naics_codes")
    op.drop_column("market_segment_metrics", "wacc_estimate_pct")
    op.drop_column("companies", "sic_code")
    op.drop_column("companies", "naics_code")
