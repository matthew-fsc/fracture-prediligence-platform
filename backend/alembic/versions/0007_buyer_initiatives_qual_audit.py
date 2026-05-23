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
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # buyer_question_states — no index=True on company_id (avoids duplicate ix_* with IF NOT EXISTS races)
    if "buyer_question_states" not in insp.get_table_names():
        op.create_table(
            "buyer_question_states",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
            sa.Column("question_id", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(32), nullable=False, server_default="open"),
            sa.Column("response_text", sa.Text(), nullable=True),
            sa.Column("mitigating_initiative_id", sa.Integer(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
            sa.UniqueConstraint("company_id", "question_id", name="uq_buyer_q_company_question"),
        )
        op.create_index(
            "ix_buyer_question_states_company_id",
            "buyer_question_states",
            ["company_id"],
            if_not_exists=True,
        )
    else:
        idx = {i["name"] for i in insp.get_indexes("buyer_question_states")}
        if "ix_buyer_question_states_company_id" not in idx:
            op.create_index(
                "ix_buyer_question_states_company_id",
                "buyer_question_states",
                ["company_id"],
                if_not_exists=True,
            )

    insp = sa.inspect(conn)
    if "company_initiatives" not in insp.get_table_names():
        op.create_table(
            "company_initiatives",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
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
        op.create_index(
            "ix_company_initiatives_company_id",
            "company_initiatives",
            ["company_id"],
            if_not_exists=True,
        )
    else:
        idx = {i["name"] for i in insp.get_indexes("company_initiatives")}
        if "ix_company_initiatives_company_id" not in idx:
            op.create_index(
                "ix_company_initiatives_company_id",
                "company_initiatives",
                ["company_id"],
                if_not_exists=True,
            )

    insp = sa.inspect(conn)
    if "qualitative_input_audits" not in insp.get_table_names():
        op.create_table(
            "qualitative_input_audits",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
            sa.Column("snapshot_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        )
        op.create_index(
            "ix_qualitative_input_audits_company_id",
            "qualitative_input_audits",
            ["company_id"],
            if_not_exists=True,
        )
    else:
        idx = {i["name"] for i in insp.get_indexes("qualitative_input_audits")}
        if "ix_qualitative_input_audits_company_id" not in idx:
            op.create_index(
                "ix_qualitative_input_audits_company_id",
                "qualitative_input_audits",
                ["company_id"],
                if_not_exists=True,
            )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if "qualitative_input_audits" in insp.get_table_names():
        op.drop_index("ix_qualitative_input_audits_company_id", table_name="qualitative_input_audits", if_exists=True)
        op.drop_table("qualitative_input_audits")
    if "company_initiatives" in insp.get_table_names():
        op.drop_index("ix_company_initiatives_company_id", table_name="company_initiatives", if_exists=True)
        op.drop_table("company_initiatives")
    if "buyer_question_states" in insp.get_table_names():
        op.drop_index("ix_buyer_question_states_company_id", table_name="buyer_question_states", if_exists=True)
        op.drop_table("buyer_question_states")
