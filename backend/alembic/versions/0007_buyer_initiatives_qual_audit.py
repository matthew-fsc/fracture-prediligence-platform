"""Buyer question tracking, custom initiatives, qualitative audit log.

Revision ID: 0007
Revises: 0006
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "buyer_question_states",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False, index=True),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="open"),
        sa.Column("response_text", sa.Text(), nullable=True),
        sa.Column("mitigating_initiative_id", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint("company_id", "question_id", name="uq_buyer_q_company_question"),
    )

    op.create_table(
        "company_initiatives",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False, index=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("category", sa.String(64), nullable=True),
        sa.Column("timeline", sa.String(128), nullable=True),
        sa.Column("cost_estimate", sa.Numeric(14, 2), nullable=True),
        sa.Column("ev_impact_estimate", sa.Numeric(14, 2), nullable=True),
        sa.Column("advisor_ev_override", sa.Numeric(14, 2), nullable=True),
        sa.Column("depends_on_initiative_id", sa.Integer(), sa.ForeignKey("company_initiatives.id"), nullable=True),
        sa.Column("source", sa.String(32), nullable=False, server_default="custom"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "qualitative_input_audits",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False, index=True),
        sa.Column("snapshot_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("qualitative_input_audits")
    op.drop_table("company_initiatives")
    op.drop_table("buyer_question_states")
