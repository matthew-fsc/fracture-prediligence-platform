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
    op.add_column("companies", sa.Column("report_firm_name", sa.String(256), nullable=True))
    op.add_column("companies", sa.Column("report_cover_blurb", sa.Text(), nullable=True))
    op.add_column("companies", sa.Column("report_logo_url", sa.String(512), nullable=True))

    op.create_table(
        "generated_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False, index=True),
        sa.Column("template_id", sa.String(64), nullable=False),
        sa.Column("drs_score", sa.Numeric(6, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("generated_reports")
    op.drop_column("companies", "report_logo_url")
    op.drop_column("companies", "report_cover_blurb")
    op.drop_column("companies", "report_firm_name")
