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
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if "advisory_library_items" not in insp.get_table_names():
        op.create_table(
            "advisory_library_items",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("item_type", sa.String(32), nullable=False),
            sa.Column("title", sa.String(1024), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("category", sa.String(64), nullable=True),
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
        op.create_index(
            "ix_advisory_library_items_item_type",
            "advisory_library_items",
            ["item_type"],
            if_not_exists=True,
        )
        op.create_index(
            "ix_advisory_library_items_category",
            "advisory_library_items",
            ["category"],
            if_not_exists=True,
        )
    else:
        idx = {i["name"] for i in insp.get_indexes("advisory_library_items")}
        if "ix_advisory_library_items_item_type" not in idx:
            op.create_index(
                "ix_advisory_library_items_item_type",
                "advisory_library_items",
                ["item_type"],
                if_not_exists=True,
            )
        if "ix_advisory_library_items_category" not in idx:
            op.create_index(
                "ix_advisory_library_items_category",
                "advisory_library_items",
                ["category"],
                if_not_exists=True,
            )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if "advisory_library_items" in insp.get_table_names():
        op.drop_index("ix_advisory_library_items_category", table_name="advisory_library_items", if_exists=True)
        op.drop_index("ix_advisory_library_items_item_type", table_name="advisory_library_items", if_exists=True)
        op.drop_table("advisory_library_items")
