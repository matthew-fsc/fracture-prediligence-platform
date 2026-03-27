"""
Standalone database helper functions used by route handlers.

All functions accept a SQLAlchemy Session and return plain dicts or primitives
so they can be tested independently of FastAPI.
"""

import json
import random
import string
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.ontology.models import AppSetting, DemoLink, UserSubscription

_SPOTS_TOTAL = 20
_SPOTS_SETTING_KEY = "spots_remaining"


# ---------------------------------------------------------------------------
# User subscriptions
# ---------------------------------------------------------------------------

def update_user_subscription(
    db: Session,
    user_id: str,
    stripe_customer_id: Optional[str],
    stripe_subscription_id: Optional[str],
    tier: Optional[str],
    status: str,
) -> dict:
    """Upsert the subscription record for a Clerk user."""
    sub = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).first()
    if sub is None:
        sub = UserSubscription(user_id=user_id)
        db.add(sub)

    sub.stripe_customer_id = stripe_customer_id
    sub.stripe_subscription_id = stripe_subscription_id
    sub.tier = tier
    sub.status = status
    sub.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(sub)
    return {
        "user_id": sub.user_id,
        "tier": sub.tier,
        "status": sub.status,
        "stripe_customer_id": sub.stripe_customer_id,
        "stripe_subscription_id": sub.stripe_subscription_id,
    }


def get_user_subscription(db: Session, user_id: str) -> Optional[dict]:
    """Return tier and status for a user, or None if no subscription exists."""
    sub = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).first()
    if sub is None:
        return None
    return {
        "user_id": sub.user_id,
        "tier": sub.tier,
        "status": sub.status,
        "stripe_customer_id": sub.stripe_customer_id,
        "stripe_subscription_id": sub.stripe_subscription_id,
    }


# ---------------------------------------------------------------------------
# Demo links
# ---------------------------------------------------------------------------

def _generate_slug(recipient_name: str) -> str:
    name_part = recipient_name.lower().replace(" ", "-")[:20]
    rand_part = "".join(random.choices(string.ascii_lowercase + string.digits, k=5))
    return f"{name_part}-{rand_part}"


def create_demo_link(
    db: Session,
    recipient_name: str,
    recipient_firm: str,
    recipient_email: str,
    sender_note: Optional[str] = None,
) -> dict:
    """Create a new personalized demo link. Returns the created record."""
    slug = _generate_slug(recipient_name)
    for _ in range(5):
        if not db.query(DemoLink).filter(DemoLink.slug == slug).first():
            break
        slug = _generate_slug(recipient_name)

    link = DemoLink(
        slug=slug,
        recipient_name=recipient_name,
        recipient_firm=recipient_firm,
        recipient_email=recipient_email,
        sender_note=sender_note,
        created_at=datetime.utcnow(),
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return {
        "id": link.id,
        "slug": link.slug,
        "recipient_name": link.recipient_name,
        "recipient_firm": link.recipient_firm,
        "recipient_email": link.recipient_email,
        "sender_note": link.sender_note,
        "created_at": link.created_at.isoformat(),
        "demo_url": f"/demo/{link.slug}",
    }


def get_demo_link(db: Session, slug: str) -> Optional[dict]:
    """Return recipient data for a demo link slug."""
    link = db.query(DemoLink).filter(DemoLink.slug == slug).first()
    if link is None:
        return None
    return {
        "recipient_name": link.recipient_name,
        "recipient_firm": link.recipient_firm,
        "recipient_email": link.recipient_email,
        "slug": link.slug,
    }


def track_demo_visit(db: Session, slug: str, section: Optional[str] = None) -> None:
    """Increment visit count and record viewed section for a demo link."""
    link = db.query(DemoLink).filter(DemoLink.slug == slug).first()
    if link is None:
        return

    now = datetime.utcnow()
    link.visit_count = (link.visit_count or 0) + 1
    if link.first_visited_at is None:
        link.first_visited_at = now
    link.last_visited_at = now

    if section:
        existing: list = json.loads(link.sections_viewed or "[]")
        if section not in existing:
            existing.append(section)
            link.sections_viewed = json.dumps(existing)

    db.commit()


# ---------------------------------------------------------------------------
# Spots remaining
# ---------------------------------------------------------------------------

def get_spots_remaining(db: Session) -> int:
    """Return remaining founding advisor spots from app_settings table."""
    setting = db.query(AppSetting).filter(AppSetting.key == _SPOTS_SETTING_KEY).first()
    if setting is None:
        return _SPOTS_TOTAL
    try:
        return int(setting.value)
    except (ValueError, TypeError):
        return _SPOTS_TOTAL


def try_decrement_founding_spot(db: Session) -> bool:
    """
    Decrement spots_remaining if > 0. Call after a founding-tier payment succeeds (e.g. Stripe webhook).
    Returns True if a spot was consumed. For strict concurrency, run against Postgres with row locks.
    """
    setting = db.query(AppSetting).filter(AppSetting.key == _SPOTS_SETTING_KEY).first()
    if setting is None:
        return False
    try:
        n = int(setting.value)
    except (ValueError, TypeError):
        n = 0
    if n <= 0:
        return False
    setting.value = str(n - 1)
    db.commit()
    return True


def _ensure_spots_setting(db: Session) -> None:
    """Seed the spots_remaining setting if it doesn't exist."""
    if not db.query(AppSetting).filter(AppSetting.key == _SPOTS_SETTING_KEY).first():
        db.add(AppSetting(key=_SPOTS_SETTING_KEY, value="18"))
        db.commit()


# ---------------------------------------------------------------------------
# Admin — all demo links
# ---------------------------------------------------------------------------

def get_all_demo_links(db: Session) -> list:
    """Return all demo links ordered by created_at descending."""
    links = db.query(DemoLink).order_by(DemoLink.created_at.desc()).all()
    return [
        {
            "id": lnk.id,
            "slug": lnk.slug,
            "recipient_name": lnk.recipient_name,
            "recipient_firm": lnk.recipient_firm,
            "recipient_email": lnk.recipient_email,
            "sender_note": lnk.sender_note,
            "created_at": lnk.created_at.isoformat() if lnk.created_at else None,
            "visit_count": lnk.visit_count or 0,
            "first_visited_at": lnk.first_visited_at.isoformat() if lnk.first_visited_at else None,
            "last_visited_at": lnk.last_visited_at.isoformat() if lnk.last_visited_at else None,
            "converted": lnk.converted,
            "ref_code": lnk.ref_code,
            "sections_viewed": json.loads(lnk.sections_viewed or "[]"),
            "demo_url": f"/demo/{lnk.slug}",
        }
        for lnk in links
    ]
