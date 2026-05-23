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
    conn = op.get_bind()
    cols = {c["name"] for c in sa.inspect(conn).get_columns("companies")}
    adds = [
        ("market_rate_replacement_annual", sa.Numeric(14, 2)),
        ("depreciation_amortization_ttm", sa.Numeric(14, 2)),
        ("interest_expense_ttm", sa.Numeric(14, 2)),
        ("income_tax_expense_ttm", sa.Numeric(14, 2)),
    ]
    for name, typ in adds:
        if name not in cols:
            op.add_column("companies", sa.Column(name, typ, nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    cols = {c["name"] for c in sa.inspect(conn).get_columns("companies")}
    for name in (
        "income_tax_expense_ttm",
        "interest_expense_ttm",
        "depreciation_amortization_ttm",
        "market_rate_replacement_annual",
    ):
        if name in cols:
            op.drop_column("companies", name)
