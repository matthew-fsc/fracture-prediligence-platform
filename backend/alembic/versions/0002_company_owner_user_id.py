"""Add companies.owner_user_id for multi-tenant scoping.

Revision ID: 0002
Revises: 0001
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = {c["name"] for c in insp.get_columns("companies")}
    if "owner_user_id" not in cols:
        op.add_column(
            "companies",
            sa.Column("owner_user_id", sa.String(256), nullable=True),
        )
    insp = sa.inspect(conn)
    indexes = {i["name"] for i in insp.get_indexes("companies")}
    if "ix_companies_owner_user_id" not in indexes:
        op.create_index("ix_companies_owner_user_id", "companies", ["owner_user_id"])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    indexes = {i["name"] for i in insp.get_indexes("companies")}
    if "ix_companies_owner_user_id" in indexes:
        op.drop_index("ix_companies_owner_user_id", table_name="companies")
    cols = {c["name"] for c in insp.get_columns("companies")}
    if "owner_user_id" in cols:
        op.drop_column("companies", "owner_user_id")
