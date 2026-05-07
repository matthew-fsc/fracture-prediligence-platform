"""Add ON DELETE CASCADE to company_engagement_billing.company_id FK.

Without CASCADE, deleting a Company orphans its billing record and causes
constraint violations if the company ID is ever reused.

Revision ID: 0011
Revises: 0010
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # company_engagement_billing is created in 0015 on fresh installs (with CASCADE already set).
    # This migration only applies on databases that had the table before 0015 was added.
    conn = op.get_bind()
    if "company_engagement_billing" not in sa.inspect(conn).get_table_names():
        return
    with op.batch_alter_table("company_engagement_billing") as batch_op:
        batch_op.drop_constraint(
            "company_engagement_billing_company_id_fkey",
            type_="foreignkey",
        )
        batch_op.create_foreign_key(
            "company_engagement_billing_company_id_fkey",
            "companies",
            ["company_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    with op.batch_alter_table("company_engagement_billing") as batch_op:
        batch_op.drop_constraint(
            "company_engagement_billing_company_id_fkey",
            type_="foreignkey",
        )
        batch_op.create_foreign_key(
            "company_engagement_billing_company_id_fkey",
            "companies",
            ["company_id"],
            ["id"],
        )
