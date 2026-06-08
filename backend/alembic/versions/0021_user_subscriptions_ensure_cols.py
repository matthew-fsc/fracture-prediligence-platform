"""Ensure user_subscriptions has all required columns.

Revision ID: 0021
Revises: 0020
Create Date: 2026-06-08

Problem: migration 0015 creates user_subscriptions only if the table does not
already exist.  If the table was bootstrapped via SQLAlchemy create_all() before
billing_interval, max_companies, or updated_at were added to the ORM model, the
production table will be missing those columns.  Any route that queries
UserSubscription (including POST /api/companies/ which gates engagement creation)
raises a 500 because SQLAlchemy's SELECT includes every mapped column.

Fix: idempotent add_column guarded by existing-column inspection.
"""

import sqlalchemy as sa
from alembic import op


revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Guard: table might not exist at all on a clean install that ran 0015 (it creates
    # the full table).  Only patch if the table exists but columns are missing.
    tables = inspector.get_table_names()
    if "user_subscriptions" not in tables:
        return  # 0015 will create it with all columns on a fresh schema

    existing_cols = {col["name"] for col in inspector.get_columns("user_subscriptions")}

    if "billing_interval" not in existing_cols:
        op.add_column(
            "user_subscriptions",
            sa.Column("billing_interval", sa.String(16), nullable=False, server_default="monthly"),
        )

    if "max_companies" not in existing_cols:
        op.add_column(
            "user_subscriptions",
            sa.Column("max_companies", sa.Integer, nullable=False, server_default="10"),
        )

    if "updated_at" not in existing_cols:
        op.add_column(
            "user_subscriptions",
            sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = {col["name"] for col in inspector.get_columns("user_subscriptions")}

    for col in ("updated_at", "max_companies", "billing_interval"):
        if col in existing_cols:
            op.drop_column("user_subscriptions", col)
