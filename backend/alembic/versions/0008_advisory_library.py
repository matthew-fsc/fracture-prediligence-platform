"""Advisory library — unified catalog for buyer questions, initiatives, risk flags.

Revision ID: 0008
Revises: 0007
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "advisory_library_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("item_type", sa.String(32), nullable=False, index=True),
        sa.Column("title", sa.String(1024), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(64), nullable=True, index=True),
        sa.Column("severity", sa.String(16), nullable=True),
        sa.Column("buyer_type", sa.String(32), nullable=True),
        sa.Column("tags_json", sa.Text(), nullable=True),
        sa.Column("data_needed", sa.Text(), nullable=True),
        sa.Column("score_trigger", sa.Numeric(6, 2), nullable=True),
        sa.Column("effort", sa.String(32), nullable=True),
        sa.Column("timeline", sa.String(128), nullable=True),
        sa.Column("ev_impact", sa.String(32), nullable=True),
        sa.Column("source", sa.String(32), nullable=False, server_default="system"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("advisory_library_items")
