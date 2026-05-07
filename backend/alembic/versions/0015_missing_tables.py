"""Create tables that were defined in models but never added to migrations.

Revision ID: 0015
Revises: 0014
Create Date: 2026-04-21

Creates (all idempotent — skipped if table already exists):
- demo_links
- user_subscriptions
- app_settings
- advisor_overrides
- addback_overrides
- ai_copilot_usage
- company_engagement_billing
- company_access_grants
- referral_codes
- referral_conversions
- advisor_firms
- channel_partners
"""

from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = set(insp.get_table_names())

    if "demo_links" not in tables:
        op.create_table(
            "demo_links",
            sa.Column("id",               sa.Integer,     primary_key=True, autoincrement=True),
            sa.Column("slug",             sa.String(128), nullable=False, unique=True, index=True),
            sa.Column("recipient_name",   sa.String(256), nullable=False),
            sa.Column("recipient_firm",   sa.String(256), nullable=False),
            sa.Column("recipient_email",  sa.String(256), nullable=False),
            sa.Column("sender_note",      sa.Text,        nullable=True),
            sa.Column("created_at",       sa.DateTime,    server_default=sa.func.now()),
            sa.Column("visit_count",      sa.Integer,     nullable=False, server_default="0"),
            sa.Column("first_visited_at", sa.DateTime,    nullable=True),
            sa.Column("last_visited_at",  sa.DateTime,    nullable=True),
            sa.Column("converted",        sa.Boolean,     nullable=False, server_default="0"),
            sa.Column("ref_code",         sa.String(128), nullable=True),
            sa.Column("sections_viewed",  sa.Text,        nullable=True),
        )

    if "user_subscriptions" not in tables:
        op.create_table(
            "user_subscriptions",
            sa.Column("id",                     sa.Integer,     primary_key=True, autoincrement=True),
            sa.Column("user_id",                sa.String(256), nullable=False, unique=True, index=True),
            sa.Column("stripe_customer_id",     sa.String(256), nullable=True),
            sa.Column("stripe_subscription_id", sa.String(256), nullable=True),
            sa.Column("tier",                   sa.String(64),  nullable=True),
            sa.Column("status",                 sa.String(64),  nullable=False, server_default="inactive"),
            sa.Column("billing_interval",       sa.String(16),  nullable=False, server_default="monthly"),
            sa.Column("max_companies",          sa.Integer,     nullable=False, server_default="10"),
            sa.Column("created_at",             sa.DateTime,    server_default=sa.func.now()),
            sa.Column("updated_at",             sa.DateTime,    server_default=sa.func.now()),
        )

    if "app_settings" not in tables:
        op.create_table(
            "app_settings",
            sa.Column("key",   sa.String(128), primary_key=True),
            sa.Column("value", sa.Text,        nullable=False),
        )

    if "advisor_overrides" not in tables:
        op.create_table(
            "advisor_overrides",
            sa.Column("id",          sa.Integer,      primary_key=True, autoincrement=True),
            sa.Column("company_id",  sa.Integer,      sa.ForeignKey("companies.id"), nullable=False, index=True),
            sa.Column("category",    sa.String(64),   nullable=False),
            sa.Column("adjustment",  sa.Numeric(6, 2), nullable=False),
            sa.Column("rationale",   sa.Text,         nullable=False),
            sa.Column("advisor_id",  sa.String(256),  nullable=True),
            sa.Column("created_at",  sa.DateTime,     server_default=sa.func.now()),
            sa.Column("updated_at",  sa.DateTime,     server_default=sa.func.now()),
        )

    if "addback_overrides" not in tables:
        op.create_table(
            "addback_overrides",
            sa.Column("id",           sa.Integer,      primary_key=True, autoincrement=True),
            sa.Column("company_id",   sa.Integer,      sa.ForeignKey("companies.id"), nullable=False, index=True),
            sa.Column("addback_key",  sa.String(128),  nullable=False),
            sa.Column("description",  sa.String(256),  nullable=False),
            sa.Column("amount",       sa.Numeric(14, 2), nullable=False),
            sa.Column("challenge",    sa.String(32),   nullable=False),
            sa.Column("category",     sa.String(64),   nullable=False),
            sa.Column("documented",   sa.Boolean,      nullable=False, server_default="0"),
            sa.Column("notes",        sa.Text,         nullable=True),
            sa.Column("rationale",    sa.Text,         nullable=True),
            sa.Column("advisor_id",   sa.String(256),  nullable=True),
            sa.Column("is_custom",    sa.Boolean,      nullable=False, server_default="0"),
            sa.Column("updated_at",   sa.DateTime,     server_default=sa.func.now()),
        )

    if "ai_copilot_usage" not in tables:
        op.create_table(
            "ai_copilot_usage",
            sa.Column("user_id",        sa.String(256), primary_key=True),
            sa.Column("month",          sa.String(7),   primary_key=True),
            sa.Column("tokens_input",   sa.Integer,     nullable=False, server_default="0"),
            sa.Column("tokens_output",  sa.Integer,     nullable=False, server_default="0"),
            sa.Column("request_count",  sa.Integer,     nullable=False, server_default="0"),
            sa.Column("last_request_at", sa.DateTime,   nullable=True),
        )

    if "company_engagement_billing" not in tables:
        op.create_table(
            "company_engagement_billing",
            sa.Column("id",                          sa.Integer,     primary_key=True, autoincrement=True),
            sa.Column("company_id",                  sa.Integer,     sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
            sa.Column("user_id",                     sa.String(256), nullable=False, index=True),
            sa.Column("billing_status",              sa.String(16),  nullable=False, server_default="included"),
            sa.Column("stripe_subscription_item_id", sa.String(256), nullable=True),
            sa.Column("created_at",                  sa.DateTime,    server_default=sa.func.now()),
        )

    if "company_access_grants" not in tables:
        op.create_table(
            "company_access_grants",
            sa.Column("id",          sa.Integer,     primary_key=True, autoincrement=True),
            sa.Column("company_id",  sa.Integer,     sa.ForeignKey("companies.id"), nullable=False, index=True),
            sa.Column("user_id",     sa.String(256), nullable=False, index=True),
            sa.Column("role",        sa.String(32),  nullable=False),
            sa.Column("granted_by",  sa.String(256), nullable=False),
            sa.Column("is_active",   sa.Boolean,     nullable=False, server_default="1"),
            sa.Column("granted_at",  sa.DateTime,    server_default=sa.func.now()),
        )

    if "referral_codes" not in tables:
        op.create_table(
            "referral_codes",
            sa.Column("id",                   sa.Integer,     primary_key=True, autoincrement=True),
            sa.Column("code",                 sa.String(64),  nullable=False, unique=True, index=True),
            sa.Column("owner_user_id",        sa.String(256), nullable=False, unique=True, index=True),
            sa.Column("total_clicks",         sa.Integer,     nullable=False, server_default="0"),
            sa.Column("total_conversions",    sa.Integer,     nullable=False, server_default="0"),
            sa.Column("credit_balance_cents", sa.Integer,     nullable=False, server_default="0"),
            sa.Column("created_at",           sa.DateTime,    server_default=sa.func.now()),
        )

    if "referral_conversions" not in tables:
        op.create_table(
            "referral_conversions",
            sa.Column("id",                    sa.Integer,     primary_key=True, autoincrement=True),
            sa.Column("referral_code",         sa.String(64),  nullable=False, index=True),
            sa.Column("converted_user_id",     sa.String(256), nullable=False, index=True),
            sa.Column("converted_at",          sa.DateTime,    server_default=sa.func.now()),
            sa.Column("credited_amount_cents", sa.Integer,     nullable=False, server_default="0"),
            sa.Column("stripe_credit_applied", sa.Boolean,     nullable=False, server_default="0"),
        )

    if "advisor_firms" not in tables:
        op.create_table(
            "advisor_firms",
            sa.Column("id",                   sa.Integer,     primary_key=True, autoincrement=True),
            sa.Column("name",                 sa.String(256), nullable=False),
            sa.Column("owner_user_id",        sa.String(256), nullable=False, unique=True, index=True),
            sa.Column("subscription_user_id", sa.String(256), nullable=False, index=True),
            sa.Column("max_seats",            sa.Integer,     nullable=False, server_default="5"),
            sa.Column("created_at",           sa.DateTime,    server_default=sa.func.now()),
        )

    if "channel_partners" not in tables:
        op.create_table(
            "channel_partners",
            sa.Column("id",               sa.Integer,     primary_key=True, autoincrement=True),
            sa.Column("slug",             sa.String(64),  nullable=False, unique=True, index=True),
            sa.Column("name",             sa.String(256), nullable=False),
            sa.Column("logo_url",         sa.String(512), nullable=True),
            sa.Column("discount_pct",     sa.Integer,     nullable=False, server_default="0"),
            sa.Column("stripe_coupon_id", sa.String(256), nullable=True),
            sa.Column("is_active",        sa.Boolean,     nullable=False, server_default="1"),
        )


def downgrade() -> None:
    for table in [
        "channel_partners", "advisor_firms", "referral_conversions", "referral_codes",
        "company_access_grants", "company_engagement_billing", "ai_copilot_usage",
        "addback_overrides", "advisor_overrides", "app_settings",
        "user_subscriptions", "demo_links",
    ]:
        conn = op.get_bind()
        insp = sa.inspect(conn)
        if table in insp.get_table_names():
            op.drop_table(table)
