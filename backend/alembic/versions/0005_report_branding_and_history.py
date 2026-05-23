"""Report branding on companies + generated report history.

Revision ID: 0005
Revises: 0004
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    cols = {c["name"] for c in sa.inspect(conn).get_columns("companies")}
    if "report_firm_name" not in cols:
        op.add_column("companies", sa.Column("report_firm_name", sa.String(256), nullable=True))
    if "report_cover_blurb" not in cols:
        op.add_column("companies", sa.Column("report_cover_blurb", sa.Text(), nullable=True))
    if "report_logo_url" not in cols:
        op.add_column("companies", sa.Column("report_logo_url", sa.String(512), nullable=True))

    insp = sa.inspect(conn)
    if "generated_reports" not in insp.get_table_names():
        op.create_table(
            "generated_reports",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
            sa.Column("template_id", sa.String(64), nullable=False),
            sa.Column("drs_score", sa.Numeric(6, 2), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        )
        op.create_index(
            "ix_generated_reports_company_id",
            "generated_reports",
            ["company_id"],
            if_not_exists=True,
        )
    else:
        idx_names = {i["name"] for i in insp.get_indexes("generated_reports")}
        if "ix_generated_reports_company_id" not in idx_names:
            op.create_index(
                "ix_generated_reports_company_id",
                "generated_reports",
                ["company_id"],
                if_not_exists=True,
            )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if "generated_reports" in insp.get_table_names():
        op.drop_index("ix_generated_reports_company_id", table_name="generated_reports", if_exists=True)
        op.drop_table("generated_reports")
    cols = {c["name"] for c in insp.get_columns("companies")}
    for name in ("report_logo_url", "report_cover_blurb", "report_firm_name"):
        if name in cols:
            op.drop_column("companies", name)
