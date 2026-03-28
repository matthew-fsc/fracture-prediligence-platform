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
    op.create_table(
        "engagement_snapshots",
        sa.Column("id",               sa.Integer(),      primary_key=True, autoincrement=True),
        sa.Column("company_id",       sa.Integer(),      sa.ForeignKey("companies.id"), nullable=False, index=True),
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


def downgrade() -> None:
    op.drop_table("engagement_snapshots")
