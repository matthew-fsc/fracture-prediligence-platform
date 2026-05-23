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
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if "engagement_profiles" in insp.get_table_names():
        idx_names = {i["name"] for i in insp.get_indexes("engagement_profiles")}
        if "ix_engagement_profiles_company_id" not in idx_names:
            op.create_index(
                "ix_engagement_profiles_company_id",
                "engagement_profiles",
                ["company_id"],
                unique=True,
                if_not_exists=True,
            )
        return

    op.create_table(
        "engagement_profiles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("owner_goals_narrative", sa.Text(), nullable=True),
        sa.Column("exit_timeline", sa.String(256), nullable=True),
        sa.Column("target_valuation", sa.Numeric(16, 2), nullable=True),
        sa.Column("personal_financial_gap", sa.Numeric(16, 2), nullable=True),
        sa.Column("transaction_type", sa.String(64), nullable=True),
        sa.Column("buyer_universe_notes", sa.Text(), nullable=True),
        sa.Column("preferred_buyer_types_json", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(
        "ix_engagement_profiles_company_id",
        "engagement_profiles",
        ["company_id"],
        unique=True,
        if_not_exists=True,
    )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if "engagement_profiles" not in insp.get_table_names():
        return
    op.drop_index("ix_engagement_profiles_company_id", table_name="engagement_profiles", if_exists=True)
    op.drop_table("engagement_profiles")
