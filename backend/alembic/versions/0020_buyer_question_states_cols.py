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

from alembic import op
import sqlalchemy as sa

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "buyer_question_states",
        sa.Column("answer_draft", sa.Text(), nullable=True),
    )
    op.add_column(
        "buyer_question_states",
        sa.Column("ai_draft_generated_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "buyer_question_states",
        sa.Column("reviewed_by", sa.String(256), nullable=True),
    )


def downgrade():
    op.drop_column("buyer_question_states", "reviewed_by")
    op.drop_column("buyer_question_states", "ai_draft_generated_at")
    op.drop_column("buyer_question_states", "answer_draft")
