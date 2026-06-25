"""Add deal_outcomes table for capturing business sale outcomes.

Revision ID: 0022
Revises: 0021
Create Date: 2026-06-25

Stores actual deal close economics alongside the platform's DRS/EV predictions
so prediction accuracy can be tracked and the scoring model calibrated over time.
"""

import sqlalchemy as sa
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "deal_outcomes",
        sa.Column("id",                    sa.Integer(),       nullable=False),
        sa.Column("company_id",            sa.Integer(),       nullable=False),
        sa.Column("deal_status",           sa.String(32),      nullable=False, server_default="in_process"),
        sa.Column("close_date",            sa.Date(),          nullable=True),
        sa.Column("sale_price",            sa.Numeric(18, 2),  nullable=True),
        sa.Column("actual_ev",             sa.Numeric(18, 2),  nullable=True),
        sa.Column("ebitda_at_close",       sa.Numeric(16, 2),  nullable=True),
        sa.Column("ev_multiple",           sa.Numeric(8, 2),   nullable=True),
        sa.Column("buyer_type",            sa.String(32),      nullable=True),
        sa.Column("buyer_name",            sa.String(256),     nullable=True),
        sa.Column("deal_structure",        sa.String(64),      nullable=True),
        sa.Column("drs_at_close",          sa.Numeric(6, 2),   nullable=True),
        sa.Column("predicted_ev_floor",    sa.Numeric(18, 2),  nullable=True),
        sa.Column("predicted_ev_ceiling",  sa.Numeric(18, 2),  nullable=True),
        sa.Column("days_to_close",         sa.Integer(),       nullable=True),
        sa.Column("advisor_notes",         sa.Text(),          nullable=True),
        sa.Column("is_benchmark_eligible", sa.Boolean(),       nullable=False, server_default=sa.true()),
        sa.Column("created_at",            sa.DateTime(),      nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at",            sa.DateTime(),      nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", name="uq_deal_outcomes_company_id"),
    )
    op.create_index("ix_deal_outcomes_company_id", "deal_outcomes", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_deal_outcomes_company_id", table_name="deal_outcomes")
    op.drop_table("deal_outcomes")
