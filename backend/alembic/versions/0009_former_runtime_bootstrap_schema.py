"""Tables and columns that used to be applied in app startup (_bootstrap_db).

Revision ID: 0009
Revises: 0008
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    cols = {c["name"] for c in insp.get_columns("companies")}
    if "total_headcount" not in cols:
        op.add_column("companies", sa.Column("total_headcount", sa.Integer(), nullable=True))

    if "generated_reports" in insp.get_table_names():
        gr_cols = {c["name"] for c in insp.get_columns("generated_reports")}
        if "ev_at_generation" not in gr_cols:
            op.add_column(
                "generated_reports",
                sa.Column("ev_at_generation", sa.Numeric(16, 2), nullable=True),
            )

    if "engagement_profiles" in insp.get_table_names():
        ep_cols = {c["name"] for c in insp.get_columns("engagement_profiles")}
        for name, typ in (
            ("owner_motivations_json", sa.Text()),
            ("post_exit_plans", sa.String(64)),
            ("non_negotiables", sa.Text()),
            ("engagement_start_date", sa.String(32)),
        ):
            if name not in ep_cols:
                op.add_column("engagement_profiles", sa.Column(name, typ, nullable=True))

    insp = sa.inspect(conn)
    if "score_snapshots" not in insp.get_table_names():
        op.create_table(
            "score_snapshots",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
            sa.Column("drs_score", sa.Numeric(6, 2), nullable=False),
            sa.Column("ev_estimate", sa.Numeric(16, 2), nullable=True),
            sa.Column("trigger", sa.String(64), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            if_not_exists=True,
        )
        op.create_index(
            "ix_score_snapshots_company_id",
            "score_snapshots",
            ["company_id"],
            if_not_exists=True,
        )
        op.create_index(
            "ix_score_snapshots_created_at",
            "score_snapshots",
            ["created_at"],
            if_not_exists=True,
        )

    insp = sa.inspect(conn)
    _qi_columns = (
        ("owner_hours_per_week", sa.Numeric(5, 1)),
        ("sop_pct", sa.Numeric(5, 1)),
        ("automation_pct", sa.Numeric(5, 1)),
        ("mgmt_qualified", sa.Integer()),
        ("mgmt_total_functions", sa.Integer()),
        ("pipeline_value", sa.Numeric(14, 2)),
        ("market_positioning", sa.String(32)),
        ("repeatability_pct", sa.Numeric(5, 1)),
        ("contract_pct", sa.Numeric(5, 1)),
        ("customer_contract_type", sa.String(32)),
        ("key_person_revenue_pct", sa.Numeric(5, 1)),
        ("mgmt_covered_functions", sa.String(256)),
    )
    if "qualitative_inputs" not in insp.get_table_names():
        op.create_table(
            "qualitative_inputs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "company_id",
                sa.Integer(),
                sa.ForeignKey("companies.id"),
                nullable=False,
                unique=True,
            ),
            *[sa.Column(name, typ, nullable=True) for name, typ in _qi_columns],
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
            if_not_exists=True,
        )
    else:
        q_cols = {c["name"] for c in insp.get_columns("qualitative_inputs")}
        for name, typ in _qi_columns:
            if name not in q_cols:
                op.add_column("qualitative_inputs", sa.Column(name, typ, nullable=True))
        if "updated_at" not in q_cols:
            op.add_column(
                "qualitative_inputs",
                sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
            )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if "qualitative_inputs" in insp.get_table_names():
        op.drop_table("qualitative_inputs")

    if "score_snapshots" in insp.get_table_names():
        op.drop_index("ix_score_snapshots_created_at", table_name="score_snapshots", if_exists=True)
        op.drop_index("ix_score_snapshots_company_id", table_name="score_snapshots", if_exists=True)
        op.drop_table("score_snapshots")

    if "engagement_profiles" in insp.get_table_names():
        ep_cols = {c["name"] for c in insp.get_columns("engagement_profiles")}
        for name in ("engagement_start_date", "non_negotiables", "post_exit_plans", "owner_motivations_json"):
            if name in ep_cols:
                op.drop_column("engagement_profiles", name)

    if "generated_reports" in insp.get_table_names():
        gr_cols = {c["name"] for c in insp.get_columns("generated_reports")}
        if "ev_at_generation" in gr_cols:
            op.drop_column("generated_reports", "ev_at_generation")

    cols = {c["name"] for c in insp.get_columns("companies")}
    if "total_headcount" in cols:
        op.drop_column("companies", "total_headcount")
