"""Add answer_draft, ai_draft_generated_at, reviewed_by to buyer_question_states.

Revision ID: 0020
Revises: 0019
Create Date: 2026-06-02

Changes:
- buyer_question_states: add answer_draft (Text, nullable)
- buyer_question_states: add ai_draft_generated_at (DateTime, nullable)
- buyer_question_states: add reviewed_by (String(256), nullable)

These columns were added to the ORM model (BuyerQuestionState) but never
migrated, causing advisory-workflow and buyer-questions endpoints to crash
with 'no such column: buyer_question_states.answer_draft'.
"""

import sqlalchemy as sa
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    tables = sa.inspect(conn).get_table_names()
    if "buyer_question_states" not in tables:
        return  # table doesn't exist yet — nothing to patch

    existing_cols = {col["name"] for col in sa.inspect(conn).get_columns("buyer_question_states")}

    if "answer_draft" not in existing_cols:
        op.add_column("buyer_question_states", sa.Column("answer_draft", sa.Text(), nullable=True))
    if "ai_draft_generated_at" not in existing_cols:
        op.add_column("buyer_question_states", sa.Column("ai_draft_generated_at", sa.DateTime(), nullable=True))
    if "reviewed_by" not in existing_cols:
        op.add_column("buyer_question_states", sa.Column("reviewed_by", sa.String(256), nullable=True))


def downgrade():
    conn = op.get_bind()
    tables = sa.inspect(conn).get_table_names()
    if "buyer_question_states" not in tables:
        return
    existing_cols = {col["name"] for col in sa.inspect(conn).get_columns("buyer_question_states")}
    for col in ("reviewed_by", "ai_draft_generated_at", "answer_draft"):
        if col in existing_cols:
            op.drop_column("buyer_question_states", col)
