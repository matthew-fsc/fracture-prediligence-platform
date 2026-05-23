"""Add user_profiles and client_access tables for role-based advisor/client separation.

Revision ID: 0010
Revises: 0009
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    existing = insp.get_table_names()

    if "user_profiles" not in existing:
        op.create_table(
            "user_profiles",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.String(256), nullable=False, unique=True),
            sa.Column("role", sa.String(32), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        )
        op.create_index("ix_user_profiles_user_id", "user_profiles", ["user_id"])

    if "client_access" not in existing:
        op.create_table(
            "client_access",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id"), nullable=False),
            sa.Column("invited_by_user_id", sa.String(256), nullable=False),
            sa.Column("invite_email", sa.String(256), nullable=False),
            sa.Column("invite_token", sa.String(128), nullable=False, unique=True),
            sa.Column("client_user_id", sa.String(256), nullable=True),
            sa.Column("status", sa.String(32), nullable=False, server_default="PENDING"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("accepted_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_client_access_company_id", "client_access", ["company_id"])
        op.create_index("ix_client_access_invite_email", "client_access", ["invite_email"])
        op.create_index("ix_client_access_invite_token", "client_access", ["invite_token"])
        op.create_index("ix_client_access_client_user_id", "client_access", ["client_user_id"])


def downgrade() -> None:
    op.drop_table("client_access")
    op.drop_table("user_profiles")
