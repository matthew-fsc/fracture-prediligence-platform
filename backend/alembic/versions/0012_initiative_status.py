"""Add status column to company_initiatives.

Revision ID: 0012
Revises: 0011_attr
Create Date: 2026-04-14

Changes:
- company_initiatives.status  — workflow state: planned | in_progress | complete
"""

from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011_attr"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "company_initiatives",
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="planned",
        ),
    )


def downgrade() -> None:
    op.drop_column("company_initiatives", "status")
