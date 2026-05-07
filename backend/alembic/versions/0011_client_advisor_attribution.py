"""Add advisor attribution columns to qualitative_input_audits and engagement_profiles.

Revision ID: 0011_attr
Revises: 0011
Create Date: 2026-03-31

Changes:
- qualitative_input_audits.advisor_id  — Clerk sub of the advisor who saved the snapshot
- engagement_profiles.advisor_id       — Clerk sub of the advisor who created the engagement profile
"""

from alembic import op
import sqlalchemy as sa

revision = "0011_attr"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "qualitative_input_audits",
        sa.Column("advisor_id", sa.String(256), nullable=True),
    )
    op.add_column(
        "engagement_profiles",
        sa.Column("advisor_id", sa.String(256), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("engagement_profiles", "advisor_id")
    op.drop_column("qualitative_input_audits", "advisor_id")
