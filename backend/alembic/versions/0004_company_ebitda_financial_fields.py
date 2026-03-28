"""Company-level EBITDA normalization and market-rate inputs.

Revision ID: 0004
Revises: 0003
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("market_rate_replacement_annual", sa.Numeric(14, 2), nullable=True))
    op.add_column("companies", sa.Column("depreciation_amortization_ttm", sa.Numeric(14, 2), nullable=True))
    op.add_column("companies", sa.Column("interest_expense_ttm", sa.Numeric(14, 2), nullable=True))
    op.add_column("companies", sa.Column("income_tax_expense_ttm", sa.Numeric(14, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("companies", "income_tax_expense_ttm")
    op.drop_column("companies", "interest_expense_ttm")
    op.drop_column("companies", "depreciation_amortization_ttm")
    op.drop_column("companies", "market_rate_replacement_annual")
