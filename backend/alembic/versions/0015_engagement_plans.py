"""Add engagement_plans table and extend company_initiatives.

Revision ID: 0015
Revises: 0014
Create Date: 2026-04-14

Changes:
- New table engagement_plans: per-company exit engagement plan
  Columns: id, company_id, target_exit_date, target_drs, current_phase, created_at, updated_at

- Extend company_initiatives (all new columns are nullable):
  - phase               INTEGER  — engagement phase (1 = Risk, 2 = Structural, 3 = Value)
  - estimated_drs_impact NUMERIC — expected DRS point lift from completing this initiative
  - target_completion_date DATE  — advisor-set target
  - actual_completion_date DATE  — populated when status = 'complete'
  - drs_category_key    VARCHAR  — which DRS category this initiative affects
"""

from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- New engagement_plans table ------------------------------------------
    op.create_table(
        "engagement_plans",
        sa.Column("id",               sa.Integer(),     primary_key=True, autoincrement=True),
        sa.Column("company_id",       sa.Integer(),     sa.ForeignKey("companies.id"), nullable=False, unique=True, index=True),
        sa.Column("target_exit_date", sa.Date(),        nullable=True),
        sa.Column("target_drs",       sa.Numeric(6, 2), nullable=True),
        sa.Column("current_phase",    sa.Integer(),     nullable=True, server_default="1"),
        sa.Column("created_at",       sa.DateTime(),    server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",       sa.DateTime(),    server_default=sa.func.now(), nullable=False),
    )

    # -- Extend company_initiatives ------------------------------------------
    op.add_column("company_initiatives", sa.Column("phase",                 sa.Integer(),     nullable=True))
    op.add_column("company_initiatives", sa.Column("estimated_drs_impact",  sa.Numeric(6, 2), nullable=True))
    op.add_column("company_initiatives", sa.Column("target_completion_date",sa.Date(),        nullable=True))
    op.add_column("company_initiatives", sa.Column("actual_completion_date",sa.Date(),        nullable=True))
    op.add_column("company_initiatives", sa.Column("drs_category_key",      sa.String(64),    nullable=True))


def downgrade() -> None:
    op.drop_column("company_initiatives", "drs_category_key")
    op.drop_column("company_initiatives", "actual_completion_date")
    op.drop_column("company_initiatives", "target_completion_date")
    op.drop_column("company_initiatives", "estimated_drs_impact")
    op.drop_column("company_initiatives", "phase")
    op.drop_table("engagement_plans")
