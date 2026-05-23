from datetime import datetime
import json
import random
import string

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.ontology.models import DemoLink


def generate_slug(recipient_name: str) -> str:
    name_part = recipient_name.lower().replace(" ", "-")[:20]
    rand_part = "".join(random.choices(string.ascii_lowercase + string.digits, k=5))
    return f"{name_part}-{rand_part}"


def create_demo_link(db: Session, recipient_name: str, recipient_firm: str, recipient_email: str, sender_note: str | None):
    slug = generate_slug(recipient_name)
    for _ in range(settings.DEMO_SLUG_RETRY_COUNT):
        existing = db.query(DemoLink).filter(DemoLink.slug == slug).first()
        if not existing:
            break
        slug = generate_slug(recipient_name)

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
    return link


def get_personalized_demo(db: Session, slug: str):
    link = db.query(DemoLink).filter(DemoLink.slug == slug).first()
    if not link:
        raise HTTPException(status_code=404, detail="Demo link not found")
    now = datetime.utcnow()
    link.visit_count = (link.visit_count or 0) + 1
    if link.first_visited_at is None:
        link.first_visited_at = now
    link.last_visited_at = now
    db.commit()
    return link


def track_section_view(db: Session, slug: str, section: str):
    link = db.query(DemoLink).filter(DemoLink.slug == slug).first()
    if not link or not section:
        return
    existing: list = json.loads(link.sections_viewed or "[]")
    if section not in existing:
        existing.append(section)
        link.sections_viewed = json.dumps(existing)
    link.last_visited_at = datetime.utcnow()
    db.commit()


def mark_demo_converted(db: Session, slug: str) -> None:
    """Set converted=True when a visitor takes the conversion CTA (e.g. requests Founding license)."""
    link = db.query(DemoLink).filter(DemoLink.slug == slug).first()
    if not link:
        return
    link.converted = True
    link.last_visited_at = datetime.utcnow()
    db.commit()


def list_demo_links(db: Session):
    return db.query(DemoLink).order_by(DemoLink.created_at.desc()).all()
