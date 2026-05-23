"""Add qb_tokens table for QuickBooks OAuth integration.

Revision ID: 0016
Revises: 0015
Create Date: 2026-04-14

Changes:
- New table qb_tokens: stores per-company QB OAuth tokens
  Columns: id, company_id (FK), realm_id, access_token, refresh_token,
           expires_at, created_at, updated_at
"""

from alembic import op
import sqlalchemy as sa

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "qb_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False, unique=True, index=True),
        sa.Column("realm_id", sa.String(128), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("qb_tokens")
