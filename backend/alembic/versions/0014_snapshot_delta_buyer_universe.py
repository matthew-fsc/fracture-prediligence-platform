"""Snapshot delta comparison + buyer universe tables.

Revision ID: 0014
Revises: 0013
Create Date: 2026-04-21

Changes:
- score_snapshots.category_scores_json  — JSON dict of DRS category scores at snapshot time
- buyer_universe_releases table         — versioned curated acquirer list releases
- active_acquirers table                — individual active acquirer profiles
"""

from alembic import op
import sqlalchemy as sa

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Snapshot category score storage
    op.add_column(
        "score_snapshots",
        sa.Column("category_scores_json", sa.Text, nullable=True),
    )

    # Buyer universe release versioning
    op.create_table(
        "buyer_universe_releases",
        sa.Column("id",          sa.Integer,     primary_key=True, autoincrement=True),
        sa.Column("source_type", sa.String(32),  nullable=False),
        sa.Column("label",       sa.String(256), nullable=False),
        sa.Column("as_of_date",  sa.Date,        nullable=True),
        sa.Column("created_at",  sa.DateTime,    server_default=sa.func.now()),
    )

    # Active acquirer profiles
    op.create_table(
        "active_acquirers",
        sa.Column("id",                   sa.Integer,      primary_key=True, autoincrement=True),
        sa.Column("release_id",           sa.Integer,      sa.ForeignKey("buyer_universe_releases.id"), nullable=False, index=True),
        sa.Column("name",                 sa.String(256),  nullable=False),
        sa.Column("buyer_type",           sa.String(16),   nullable=False, index=True),
        sa.Column("hq_state",             sa.String(2),    nullable=True),
        sa.Column("preferred_industries", sa.String(512),  nullable=False),
        sa.Column("ebitda_min_m",         sa.Numeric(8, 2), nullable=True),
        sa.Column("ebitda_max_m",         sa.Numeric(8, 2), nullable=True),
        sa.Column("ev_min_m",             sa.Numeric(8, 2), nullable=True),
        sa.Column("ev_max_m",             sa.Numeric(8, 2), nullable=True),
        sa.Column("investment_thesis",    sa.Text,         nullable=True),
        sa.Column("hold_period_years",    sa.String(16),   nullable=True),
        sa.Column("portfolio_count",      sa.Integer,      nullable=True),
        sa.Column("notable_platforms",    sa.Text,         nullable=True),
        sa.Column("source_note",          sa.String(256),  nullable=True),
        sa.Column("is_active",            sa.Boolean,      nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_table("active_acquirers")
    op.drop_table("buyer_universe_releases")
    op.drop_column("score_snapshots", "category_scores_json")
