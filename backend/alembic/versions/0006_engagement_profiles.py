"""Per-company engagement intake (owner goals, exit plan).

Revision ID: 0006
Revises: 0005
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "engagement_profiles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False, unique=True, index=True),
        sa.Column("owner_goals_narrative", sa.Text(), nullable=True),
        sa.Column("exit_timeline", sa.String(256), nullable=True),
        sa.Column("target_valuation", sa.Numeric(16, 2), nullable=True),
        sa.Column("personal_financial_gap", sa.Numeric(16, 2), nullable=True),
        sa.Column("transaction_type", sa.String(64), nullable=True),
        sa.Column("buyer_universe_notes", sa.Text(), nullable=True),
        sa.Column("preferred_buyer_types_json", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("engagement_profiles")
