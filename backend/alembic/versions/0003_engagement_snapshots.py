"""Add engagement_snapshots table for EBITDA & EV timeline tracking.

Revision ID: 0003
Revises: 0002
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if "engagement_snapshots" in insp.get_table_names():
        idx_names = {i["name"] for i in insp.get_indexes("engagement_snapshots")}
        if "ix_engagement_snapshots_company_id" not in idx_names:
            op.create_index(
                "ix_engagement_snapshots_company_id",
                "engagement_snapshots",
                ["company_id"],
                if_not_exists=True,
            )
        return

    # No index=True on company_id — avoids duplicate ix_* when create_table + implicit index races IF NOT EXISTS.
    op.create_table(
        "engagement_snapshots",
        sa.Column("id",               sa.Integer(),      primary_key=True, autoincrement=True),
        sa.Column("company_id",       sa.Integer(),      sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("milestone",        sa.String(256),    nullable=False),
        sa.Column("date",             sa.String(64),     nullable=False),
        sa.Column("stage",            sa.String(64),     nullable=False),
        sa.Column("status",           sa.String(32),     nullable=False),
        sa.Column("drs",              sa.Numeric(6, 2),  nullable=True),
        sa.Column("drs_tier",         sa.String(32),     nullable=True),
        sa.Column("ebitda",           sa.Numeric(14, 2), nullable=True),
        sa.Column("ev_floor",         sa.Numeric(14, 2), nullable=True),
        sa.Column("ev_ceiling",       sa.Numeric(14, 2), nullable=True),
        sa.Column("ev_midpoint",      sa.Numeric(14, 2), nullable=True),
        sa.Column("multiple_floor",   sa.Numeric(6, 3),  nullable=True),
        sa.Column("multiple_ceiling", sa.Numeric(6, 3),  nullable=True),
        sa.Column("notes",            sa.Text(),         nullable=True),
        sa.Column("sort_order",       sa.Integer(),      nullable=False, server_default="0"),
        sa.Column("created_at",       sa.DateTime(),     server_default=sa.func.now()),
        if_not_exists=True,
    )
    op.create_index(
        "ix_engagement_snapshots_company_id",
        "engagement_snapshots",
        ["company_id"],
        if_not_exists=True,
    )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if "engagement_snapshots" not in insp.get_table_names():
        return
    op.drop_index("ix_engagement_snapshots_company_id", table_name="engagement_snapshots", if_exists=True)
    op.drop_table("engagement_snapshots")
