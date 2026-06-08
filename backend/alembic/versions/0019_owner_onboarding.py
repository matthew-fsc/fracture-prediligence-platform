"""Add owner_onboarding_completed_at to companies.

Revision ID: 0019
Revises: 0018
Create Date: 2026-06-02

Changes:
- companies: add owner_onboarding_completed_at (TIMESTAMP, nullable)
  Tracks when the business owner completed the self-service onboarding wizard.
  NULL = not yet completed.
"""

import sqlalchemy as sa
from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    existing_cols = {col["name"] for col in sa.inspect(conn).get_columns("companies")}
    if "owner_onboarding_completed_at" not in existing_cols:
        op.add_column(
            "companies",
            sa.Column("owner_onboarding_completed_at", sa.DateTime(), nullable=True),
        )


def downgrade():
    conn = op.get_bind()
    existing_cols = {col["name"] for col in sa.inspect(conn).get_columns("companies")}
    if "owner_onboarding_completed_at" in existing_cols:
        op.drop_column("companies", "owner_onboarding_completed_at")
