"""Extend qualitative_inputs with A6 advisory form fields.

Revision ID: 0017
Revises: 0016
Create Date: 2026-04-14

Changes (all nullable — safe to add to existing rows):
- qualitative_inputs.has_crm_pipeline   BOOLEAN  — formal CRM pipeline present (Q5)
- qualitative_inputs.non_compete_pct    VARCHAR  — % key employees with non-competes (Q8)
- qualitative_inputs.voluntary_turnover VARCHAR  — 3-yr voluntary turnover band (Q9)
- qualitative_inputs.comp_vs_market     VARCHAR  — avg comp vs. market rate band (Q10)
"""

from alembic import op
import sqlalchemy as sa

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("qualitative_inputs", sa.Column("has_crm_pipeline",   sa.Boolean(),    nullable=True))
    op.add_column("qualitative_inputs", sa.Column("non_compete_pct",    sa.String(32),   nullable=True))
    op.add_column("qualitative_inputs", sa.Column("voluntary_turnover", sa.String(32),   nullable=True))
    op.add_column("qualitative_inputs", sa.Column("comp_vs_market",     sa.String(32),   nullable=True))


def downgrade() -> None:
    op.drop_column("qualitative_inputs", "comp_vs_market")
    op.drop_column("qualitative_inputs", "voluntary_turnover")
    op.drop_column("qualitative_inputs", "non_compete_pct")
    op.drop_column("qualitative_inputs", "has_crm_pipeline")
