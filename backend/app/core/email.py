"""
Outbound email utility.

Priority:
  1. SendGrid HTTP API   — set SENDGRID_API_KEY
  2. Log-only fallback   — no external call; prints the link to stdout (dev / unconfigured)

Usage:
    from app.core.email import send_invite_email
    await send_invite_email(to="owner@example.com", invite_url="https://...", company_name="Acme")
"""

import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

_INVITE_SUBJECT = "You've been invited to review your exit readiness"

_INVITE_BODY_TEXT = """\
Hi,

{advisor_name_or_firm} has invited you to access your business exit-readiness report \
on the Fracture Pre-Diligence Platform.

Click the link below to get started. You'll be guided through a short onboarding \
to share your goals and key company details.

{invite_url}

This link is unique to you. If you have questions, reply to this email or contact \
your advisor directly.

— The Fracture Team
"""

_INVITE_BODY_HTML = """\
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="color:#6366f1;margin-bottom:4px">Your Exit Readiness Report is Ready</h2>
  <p style="color:#555;margin-top:0">
    <strong>{advisor_name_or_firm}</strong> has invited you to the
    <strong>Fracture Pre-Diligence Platform</strong>.
  </p>
  <p>
    You'll be guided through a short onboarding to share your goals and key company details.
    The whole thing takes about 5 minutes.
  </p>
  <p style="text-align:center;margin:32px 0">
    <a href="{invite_url}"
       style="background:#6366f1;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
      Start My Onboarding
    </a>
  </p>
  <p style="color:#888;font-size:12px">
    Or copy this link: <a href="{invite_url}" style="color:#6366f1">{invite_url}</a>
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
  <p style="color:#aaa;font-size:11px">
    This invitation was sent by your M&amp;A advisor via the Fracture Pre-Diligence Platform.
    If you received this in error, you can safely ignore it.
  </p>
</body>
</html>
"""


async def send_invite_email(
    *,
    to: str,
    invite_url: str,
    company_name: str,
    advisor_name_or_firm: str = "Your M&A advisor",
) -> bool:
    """Send a client onboarding invite email. Returns True if sent, False on failure."""
    api_key = getattr(settings, "SENDGRID_API_KEY", None)
    from_email = getattr(settings, "EMAIL_FROM_ADDRESS", "noreply@fracture.io")
    from_name = getattr(settings, "EMAIL_FROM_NAME", "Fracture Platform")

    subject = _INVITE_SUBJECT
    body_text = _INVITE_BODY_TEXT.format(
        advisor_name_or_firm=advisor_name_or_firm,
        invite_url=invite_url,
    )
    body_html = _INVITE_BODY_HTML.format(
        advisor_name_or_firm=advisor_name_or_firm,
        invite_url=invite_url,
    )

    if api_key:
        return await _send_via_sendgrid(
            api_key=api_key,
            from_email=from_email,
            from_name=from_name,
            to=to,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
        )

    # Fallback: log the invite link so devs can use it without email config
    logger.info(
        "EMAIL (no-send fallback) | to=%s | company=%s | url=%s",
        to, company_name, invite_url,
    )
    return False


async def _send_via_sendgrid(
    *,
    api_key: str,
    from_email: str,
    from_name: str,
    to: str,
    subject: str,
    body_text: str,
    body_html: str,
) -> bool:
    try:
        import httpx
        payload = {
            "personalizations": [{"to": [{"email": to}]}],
            "from": {"email": from_email, "name": from_name},
            "subject": subject,
            "content": [
                {"type": "text/plain", "value": body_text},
                {"type": "text/html",  "value": body_html},
            ],
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
        if resp.status_code in (200, 202):
            logger.info("Invite email sent via SendGrid to %s", to)
            return True
        logger.warning("SendGrid returned %s for %s: %s", resp.status_code, to, resp.text[:200])
        return False
    except Exception:
        logger.exception("Failed to send invite email via SendGrid to %s", to)
        return False
