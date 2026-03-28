"""
A14 - Report Generator (Blueprint II A14 Insight Package Assembly)

Generates advisor-ready PDF reports from live analytics data.
Three report types:
  - drs_summary    : DRS scorecard with category breakdown and top risks
  - value_gap      : EV bridge with per-category uplift opportunities
  - buyer_prep     : Prioritized buyer due diligence question package
"""

from __future__ import annotations
import io
from datetime import date
from typing import Optional

from fpdf import FPDF

from sqlalchemy.orm import Session

from app.analytics.a1_metric_computation import compute_metrics
from app.analytics.ebitda_basis import ebitda_basis_for_company
from app.analytics.a9_drs_composite import CategoryScores, compute_drs
from app.analytics.a10_enterprise_value import compute_enterprise_value
from app.analytics.market_benchmarks import get_market_multiple_context
from app.analytics.a11_value_gap import compute_value_gap
from app.analytics.a13_buyer_questions import generate_buyer_questions
from app.core.config import settings
from app.core.scoring_rules import SCORING_RULES
from app.ontology.models import Company
from app.services.analytics_service import compute_category_modules
from app.services.company_logo_storage import resolve_company_logo_path


# ── Color palette ──────────────────────────────────────────────────────────────
_DARK     = (18, 18, 20)        # near-black background -> use as header
_SLATE    = (30, 30, 36)
_CARD     = (245, 246, 248)
_WHITE    = (255, 255, 255)
_PRIMARY  = (99, 102, 241)      # indigo
_EMERALD  = (16, 185, 129)
_AMBER    = (245, 158, 11)
_RED      = (239, 68, 68)
_MUTED    = (120, 120, 140)
_BORDER   = (220, 220, 230)
_TEXT     = (30, 30, 40)
_SUBTEXT  = (90, 90, 110)


def _safe(text: str) -> str:
    """Replace non-latin1 characters with ASCII equivalents for FPDF core fonts."""
    return (text
        .replace('\u2014', '-').replace('\u2013', '-')  # em/en dash
        .replace('\u2018', "'").replace('\u2019', "'")  # smart quotes
        .replace('\u201c', '"').replace('\u201d', '"')
        .replace('\u00b7', '|').replace('\u00d7', 'x')
        .replace('\u2022', '*').replace('\u2026', '...')
        .encode('latin-1', errors='replace').decode('latin-1')
    )


def _fmt_m(val: float) -> str:
    """Format dollar value as $X.XXM or $XXK."""
    if val >= 1_000_000:
        return f"${val / 1_000_000:.2f}M"
    if val >= 1_000:
        return f"${val / 1_000:.0f}K"
    return f"${val:,.0f}"


def _score_color(score: float) -> tuple[int, int, int]:
    if score >= 80:
        return _EMERALD
    if score >= 65:
        return (59, 130, 246)  # blue
    if score >= 50:
        return _AMBER
    return _RED


class _BasePDF(FPDF):
    """Shared header/footer for all report types."""

    _company_name = "ABC Company Inc"
    _report_title = "Advisory Report"
    _report_date  = ""
    _brand_primary = "FRACTURE SYSTEMS"
    _brand_sub = "Pre-Diligence Platform"
    _logo_path: Optional[str] = None

    def header(self):
        # Dark header bar
        self.set_fill_color(*_DARK)
        self.rect(0, 0, 210, 18, "F")
        x_text = 10
        lp = getattr(self, "_logo_path", None)
        if lp:
            try:
                self.image(lp, x=10, y=3, h=12)
                x_text = 24
            except Exception:
                pass
        self.set_text_color(*_WHITE)
        self.set_font("Helvetica", "B", 10)
        self.set_xy(x_text, 4)
        self.cell(0, 5, _safe(f"{self._brand_primary} | {self._brand_sub}"), ln=False)
        self.set_font("Helvetica", "", 8)
        self.set_xy(x_text, 10)
        self.set_text_color(160, 160, 180)
        self.cell(0, 5, _safe(f"{self._report_title}  |  {self._company_name}  |  {self._report_date}"), ln=False)
        self.set_y(22)

    def footer(self):
        self.set_y(-12)
        self.set_draw_color(*_BORDER)
        self.set_line_width(0.2)
        self.line(10, self.get_y(), 200, self.get_y())
        self.set_y(-10)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*_MUTED)
        self.cell(0, 5, f"CONFIDENTIAL - Pre-Diligence Advisory  |  Page {self.page_no()}", align="C")

    def section_title(self, text: str):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*_TEXT)
        self.set_fill_color(*_CARD)
        self.set_draw_color(*_BORDER)
        self.set_line_width(0.2)
        self.cell(0, 8, f"  {text}", ln=True, fill=True, border="B")
        self.ln(3)

    def kpi_box(self, x: float, y: float, w: float, h: float,
                label: str, value: str, sub: str = "",
                color: tuple = _PRIMARY):
        self.set_xy(x, y)
        self.set_fill_color(*_CARD)
        self.set_draw_color(*_BORDER)
        self.set_line_width(0.3)
        self.rect(x, y, w, h, "FD")
        # Color accent bar on left
        self.set_fill_color(*color)
        self.rect(x, y, 2.5, h, "F")
        # Label
        self.set_xy(x + 5, y + 3)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*_MUTED)
        self.cell(w - 7, 4, label.upper())
        # Value
        self.set_xy(x + 5, y + 7)
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(*_TEXT)
        self.cell(w - 7, 7, value)
        # Sub
        if sub:
            self.set_xy(x + 5, y + 14)
            self.set_font("Helvetica", "", 7)
            self.set_text_color(*_MUTED)
            self.cell(w - 7, 4, sub)

    def score_bar(self, x: float, y: float, w: float, score: float, label: str, score_label: Optional[str] = None):
        bar_w = w * 0.45
        # Label
        self.set_xy(x, y)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*_TEXT)
        self.cell(w * 0.42, 5, label)
        # Score value
        self.set_xy(x + w * 0.42, y)
        self.set_font("Helvetica", "B", 8)
        clr = _score_color(score)
        self.set_text_color(*clr)
        self.cell(12, 5, score_label or f"{score:.0f}", align="R")
        # Bar background
        bx = x + w * 0.42 + 14
        self.set_fill_color(*_BORDER)
        self.rect(bx, y + 1, bar_w, 3, "F")
        # Bar fill
        self.set_fill_color(*clr)
        self.rect(bx, y + 1, bar_w * score / 100, 3, "F")
        self.ln(0)

    def tag(self, text: str, color: tuple, bg: tuple):
        self.set_font("Helvetica", "B", 7)
        self.set_text_color(*color)
        self.set_fill_color(*bg)
        self.cell(0, 5, f"  {text}  ", ln=True, fill=True)


# ── Report: DRS Summary ────────────────────────────────────────────────────────

def _build_drs_summary(pdf: _BasePDF, company_id: int, db: Session):
    modules = compute_category_modules(company_id, db)
    rev = modules["revenue_quality"]
    ops = modules["operational_independence"]
    cust = modules["customer_risk"]
    mgmt = modules["management_team"]
    growth = modules["growth_drivers"]
    fin = modules["financial_integrity"]
    metrics = compute_metrics(company_id, db)
    basis = ebitda_basis_for_company(company_id, db)

    cat = CategoryScores(
        revenue_quality=rev.composite,
        financial_integrity=fin.composite,
        operational_independence=ops.composite,
        customer_risk=cust.composite,
        management_team=mgmt.composite,
        growth_drivers=growth.composite,
    )
    drs = compute_drs(cat)

    from decimal import Decimal as _D
    ebitda_f = float(basis["ebitda_normalized_ttm"])
    mctx = get_market_multiple_context(db, company_id, ebitda_f)
    ev = compute_enterprise_value(_D(str(round(ebitda_f, 2))), drs.tier, market_context=mctx)

    tier_color = _EMERALD if drs.tier.value == "Investment Grade" else _AMBER

    # ── Page 1: Score Overview ─────────────────────────────────────────────────
    pdf.add_page()

    # Title block
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*_TEXT)
    pdf.set_xy(10, 24)
    pdf.cell(0, 10, "Diligence Readiness Score", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*_SUBTEXT)
    pdf.cell(0, 5, "Weighted composite across 6 diligence categories - Investment Grade threshold: 70/100", ln=True)
    pdf.ln(3)

    # DRS Score hero + KPIs
    pdf.kpi_box(10,  50, 55, 26, "DRS SCORE", f"{drs.base_drs:.1f} / 100", f"Range: {drs.conservative_drs:.1f}-{drs.optimistic_drs:.1f}", tier_color)
    pdf.kpi_box(70,  50, 55, 26, "TIER",       drs.tier.value,             f"EBITDA multiple: {ev.multiple_floor}-{ev.multiple_ceiling}x", tier_color)
    pdf.kpi_box(130, 50, 70, 26, "ENTERPRISE VALUE (MID)", _fmt_m(float(ev.ev_midpoint)), f"Floor {_fmt_m(float(ev.ev_floor))}  |  Ceiling {_fmt_m(float(ev.ev_ceiling))}", _PRIMARY)

    pdf.set_y(84)
    pdf.ln(4)

    # Category scores
    pdf.section_title("Category Scores")

    cats = [
        ("Revenue Quality",          rev.composite,    rev.data_confidence),
        ("Financial Integrity",      fin.composite,    fin.data_confidence),
        ("Operational Independence", ops.composite,    ops.data_confidence),
        ("Customer Risk",            cust.composite,   cust.data_confidence),
        ("Management & Team",        mgmt.composite,   mgmt.data_confidence),
        ("Growth Drivers",           growth.composite, growth.data_confidence),
    ]
    weights = [
        SCORING_RULES.category_weights["revenue_quality"],
        SCORING_RULES.category_weights["financial_integrity"],
        SCORING_RULES.category_weights["operational_independence"],
        SCORING_RULES.category_weights["customer_risk"],
        SCORING_RULES.category_weights["management_team"],
        SCORING_RULES.category_weights["growth_drivers"],
    ]

    for i, ((label, score, conf), w) in enumerate(zip(cats, weights)):
        y = pdf.get_y()
        # Alternate row background
        if i % 2 == 0:
            pdf.set_fill_color(250, 250, 252)
            pdf.rect(10, y, 190, 8, "F")
        pdf.score_bar(12, y + 1.5, 140, score, f"{label}  ({int(w*100)}%)", f"{score:.1f}")
        # Confidence badge
        conf_clr = _EMERALD if conf == "HIGH" else _AMBER if conf == "MEDIUM" else _RED
        pdf.set_xy(160, y + 1.5)
        pdf.set_font("Helvetica", "B", 6)
        pdf.set_text_color(*conf_clr)
        pdf.cell(40, 5, conf, align="R")
        pdf.ln(8)

    pdf.ln(4)

    # Buyer risk questions
    questions = generate_buyer_questions({
        "revenue_quality":          rev.composite,
        "financial_integrity":      fin.composite,
        "operational_independence": ops.composite,
        "customer_risk":            cust.composite,
        "management_team":          mgmt.composite,
        "growth_drivers":           growth.composite,
    })
    critical = [q for q in questions if q.severity == "CRITICAL"][: settings.REPORT_TOP_CRITICAL_COUNT]
    high = [q for q in questions if q.severity == "HIGH"][: settings.REPORT_TOP_HIGH_COUNT]

    if critical or high:
        pdf.section_title("Top Due Diligence Risks")
        for q in (critical + high):
            sev_clr = _RED if q.severity == "CRITICAL" else _AMBER
            y = pdf.get_y()
            pdf.set_fill_color(*sev_clr)
            pdf.rect(10, y, 2.5, 11, "F")
            pdf.set_xy(14, y + 1)
            pdf.set_font("Helvetica", "B", 7)
            pdf.set_text_color(*sev_clr)
            pdf.cell(30, 4, q.severity)
            pdf.set_xy(14, y + 5)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*_TEXT)
            pdf.multi_cell(180, 4, _safe(q.question))
            pdf.ln(2)

    # Immediate actions
    pdf.add_page()
    pdf.section_title("Immediate Action Items")

    gaps_result = compute_value_gap(
        company_id,
        {"revenue_quality": rev.composite, "financial_integrity": fin.composite,
         "operational_independence": ops.composite, "customer_risk": cust.composite,
         "management_team": mgmt.composite, "growth_drivers": growth.composite},
        float(basis["ebitda_normalized_ttm"]),
    )

    for i, gap in enumerate(gaps_result.gaps[: settings.REPORT_IMMEDIATE_ACTION_COUNT], 1):
        y = pdf.get_y()
        if i % 2 == 1:
            pdf.set_fill_color(250, 250, 252)
            pdf.rect(10, y, 190, 14, "F")
        pdf.set_xy(14, y + 2)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*_PRIMARY)
        pdf.cell(10, 5, f"{i}.")
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*_TEXT)
        pdf.cell(80, 5, gap.label)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*_SUBTEXT)
        pdf.cell(60, 5, f"Score gap: {gap.score_gap:.0f} pts  ->  +{gap.drs_uplift:.1f} DRS pts")
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*_EMERALD)
        pdf.cell(0, 5, f"+{_fmt_m(gap.ev_uplift)} EV", align="R")
        pdf.set_xy(24, y + 7)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(*_SUBTEXT)
        pdf.cell(0, 4, f"Resolve to score 80+ to unlock value uplift")
        pdf.ln(14)


# ── Report: Value Gap ──────────────────────────────────────────────────────────

def _build_value_gap(pdf: _BasePDF, company_id: int, db: Session):
    modules = compute_category_modules(company_id, db)
    rev = modules["revenue_quality"]
    ops = modules["operational_independence"]
    cust = modules["customer_risk"]
    mgmt = modules["management_team"]
    growth = modules["growth_drivers"]
    fin = modules["financial_integrity"]
    metrics = compute_metrics(company_id, db)
    basis = ebitda_basis_for_company(company_id, db)

    cat_scores = {
        "revenue_quality":          rev.composite,
        "financial_integrity":      fin.composite,
        "operational_independence": ops.composite,
        "customer_risk":            cust.composite,
        "management_team":          mgmt.composite,
        "growth_drivers":           growth.composite,
    }
    ebitda = float(basis["ebitda_normalized_ttm"])
    vg = compute_value_gap(company_id, cat_scores, ebitda)

    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*_TEXT)
    pdf.set_xy(10, 24)
    pdf.cell(0, 10, "Value Gap Analysis", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*_SUBTEXT)
    pdf.cell(0, 5, "Difference between current enterprise value and achievable EV with targeted improvements", ln=True)
    pdf.ln(3)

    # KPI row
    pdf.kpi_box(10,  50, 58, 26, "CURRENT EV (MID)",   _fmt_m(vg.current_ev_midpoint),   f"DRS {vg.current_drs:.1f}", _PRIMARY)
    pdf.kpi_box(73,  50, 58, 26, "TOTAL VALUE GAP",    f"+{_fmt_m(vg.total_value_gap)}",  "If all gaps resolved to 80+", _EMERALD)
    pdf.kpi_box(136, 50, 64, 26, "POTENTIAL EV (MID)", _fmt_m(vg.potential_ev_midpoint),  f"DRS {vg.potential_drs:.1f}", _AMBER)

    pdf.set_y(84)
    pdf.ln(6)

    # Gap table
    pdf.section_title("Value Creation Opportunities by Category")

    # Table header
    cols = [55, 22, 22, 22, 35, 30]
    headers = ["Category", "Current", "Target", "Score Gap", "DRS Uplift", "EV Uplift"]
    pdf.set_fill_color(*_DARK)
    pdf.set_text_color(*_WHITE)
    pdf.set_font("Helvetica", "B", 8)
    x = 10
    for c, h in zip(cols, headers):
        pdf.set_xy(x, pdf.get_y())
        pdf.cell(c, 7, f"  {h}", fill=True)
        x += c
    pdf.ln(7)

    for i, gap in enumerate(vg.gaps):
        y = pdf.get_y()
        fill = i % 2 == 0
        if fill:
            pdf.set_fill_color(*_CARD)
        else:
            pdf.set_fill_color(*_WHITE)
        x = 10
        vals = [
            gap.label,
            f"{gap.current_score:.0f}",
            f"{gap.target_score:.0f}",
            f"{gap.score_gap:.0f} pts",
            f"+{gap.drs_uplift:.2f} pts",
            f"+{_fmt_m(gap.ev_uplift)}",
        ]
        pdf.set_text_color(*_TEXT)
        pdf.set_font("Helvetica", "", 8)
        for c, v in zip(cols, vals):
            pdf.set_xy(x, y)
            if v.startswith("+") and c == cols[-1]:
                pdf.set_font("Helvetica", "B", 8)
                pdf.set_text_color(*_EMERALD)
            else:
                pdf.set_font("Helvetica", "", 8)
                pdf.set_text_color(*_TEXT)
            pdf.cell(c, 7, f"  {v}", fill=True)
            x += c
        pdf.ln(7)

    pdf.ln(8)
    pdf.section_title("Initiative Roadmap")

    timeline = [
        ("0-30 days",   "Gather missing HR documentation, classify management roles"),
        ("30-90 days",  "Implement recurring revenue contracts for key customer relationships"),
        ("90-180 days", "Establish growth metrics tracking, document customer acquisition process"),
        ("6-18 months", "Improve revenue quality: diversify customer base, reduce concentration"),
    ]
    for phase, action in timeline:
        y = pdf.get_y()
        pdf.set_fill_color(*_PRIMARY)
        pdf.rect(10, y, 2.5, 10, "F")
        pdf.set_xy(15, y + 1.5)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*_PRIMARY)
        pdf.cell(40, 4, phase)
        pdf.set_xy(55, y + 1.5)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*_TEXT)
        pdf.multi_cell(145, 4, action)
        pdf.ln(4)


# ── Report: Buyer Preparation Package ─────────────────────────────────────────

def _build_buyer_prep(pdf: _BasePDF, company_id: int, db: Session):
    modules = compute_category_modules(company_id, db)
    rev = modules["revenue_quality"]
    ops = modules["operational_independence"]
    cust = modules["customer_risk"]
    mgmt = modules["management_team"]
    growth = modules["growth_drivers"]
    fin = modules["financial_integrity"]

    cat_scores = {
        "revenue_quality":          rev.composite,
        "financial_integrity":      fin.composite,
        "operational_independence": ops.composite,
        "customer_risk":            cust.composite,
        "management_team":          mgmt.composite,
        "growth_drivers":           growth.composite,
    }
    questions = generate_buyer_questions(cat_scores)
    critical  = [q for q in questions if q.severity == "CRITICAL"]
    high      = [q for q in questions if q.severity == "HIGH"]
    medium    = [q for q in questions if q.severity == "MEDIUM"]

    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*_TEXT)
    pdf.set_xy(10, 24)
    pdf.cell(0, 10, "Buyer Preparation Package", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*_SUBTEXT)
    pdf.cell(0, 5, "Anticipated due diligence questions ranked by severity - prepare responses before buyer engagement", ln=True)
    pdf.ln(3)

    # Summary KPIs
    pdf.kpi_box(10,  50, 58, 22, "CRITICAL FLAGS",  str(len(critical)), "Require immediate action",  _RED)
    pdf.kpi_box(73,  50, 58, 22, "HIGH FLAGS",      str(len(high)),     "Prepare strong responses",  _AMBER)
    pdf.kpi_box(136, 50, 64, 22, "TOTAL QUESTIONS", str(len(questions)), "Across all categories",    _PRIMARY)
    pdf.set_y(80)
    pdf.ln(6)

    def _question_block(q, idx: int):
        sev_clr = _RED if q.severity == "CRITICAL" else _AMBER if q.severity == "HIGH" else _PRIMARY
        y = pdf.get_y()
        if pdf.get_y() > 255:
            pdf.add_page()
            y = pdf.get_y()
        # Severity bar
        pdf.set_fill_color(*sev_clr)
        pdf.rect(10, y, 2.5, 22, "F")
        # Number
        pdf.set_xy(14, y + 1)
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(*_MUTED)
        pdf.cell(10, 4, f"Q{idx:02d}")
        # Severity tag
        pdf.set_xy(22, y + 1)
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(*sev_clr)
        pdf.cell(30, 4, q.severity)
        # Category
        pdf.set_xy(55, y + 1)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(*_MUTED)
        pdf.cell(0, 4, _safe(q.category.replace("_", " ").title()))
        # Question
        pdf.set_xy(14, y + 6)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.set_text_color(*_TEXT)
        pdf.multi_cell(185, 4.5, _safe(q.question))
        # Data needed
        if q.data_needed:
            pdf.set_xy(14, pdf.get_y() + 1)
            pdf.set_font("Helvetica", "I", 7.5)
            pdf.set_text_color(*_SUBTEXT)
            pdf.multi_cell(185, 4, f"Data needed: {_safe(q.data_needed)}")
        pdf.ln(5)

    if critical:
        pdf.section_title(f"Critical Flags  ({len(critical)})")
        for i, q in enumerate(critical, 1):
            _question_block(q, i)

    if high:
        pdf.section_title(f"High Priority  ({len(high)})")
        for i, q in enumerate(high, len(critical) + 1):
            _question_block(q, i)

    if medium:
        pdf.section_title(f"Medium Priority  ({len(medium)})")
        for i, q in enumerate(medium, len(critical) + len(high) + 1):
            _question_block(q, i)


# ── Report: EBITDA Recast ─────────────────────────────────────────────────────

def _build_ebitda_recast_pdf(pdf: _BasePDF, company_id: int, db: Session):
    from app.api.routes.analytics import _build_recast_payload

    payload = _build_recast_payload(company_id, db)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(*_TEXT)
    pdf.cell(0, 10, "EBITDA Recast Schedule", ln=True)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*_SUBTEXT)
    pdf.multi_cell(
        0, 5,
        _safe(
            f"Proxy {_fmt_m(payload.get('ebitda_proxy_ttm', 0))} + D&A -> reported "
            f"{_fmt_m(payload.get('reported_ebitda', 0))} before addbacks."
        ),
        ln=True,
    )
    pdf.ln(2)
    y0 = pdf.get_y()
    pdf.kpi_box(10, y0, 48, 22, "CONSERVATIVE", _fmt_m(payload["conservative_ebitda"]), "LOW addbacks only", _RED)
    pdf.kpi_box(60, y0, 48, 22, "BASE", _fmt_m(payload["base_ebitda"]), "Defensible case", _PRIMARY)
    pdf.kpi_box(110, y0, 48, 22, "AGGRESSIVE", _fmt_m(payload["aggressive_ebitda"]), "All qualifying addbacks", _EMERALD)
    pdf.set_y(y0 + 26)
    pdf.section_title("Data notes")
    for n in payload.get("data_notes", []):
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*_SUBTEXT)
        pdf.multi_cell(0, 4, _safe(n), ln=True)
    pdf.ln(2)
    pdf.section_title("Addback schedule")
    for ab in payload.get("addback_schedule", [])[:35]:
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*_TEXT)
        pdf.cell(0, 5, _safe(ab.get("description", "Item")), ln=True)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(*_MUTED)
        line = (
            f"Amount {_fmt_m(ab.get('amount', 0))}  |  {ab.get('challenge_label') or ab.get('challenge', '')}  |  "
            f"{_safe(ab.get('notes', '') or '')[:120]}"
        )
        pdf.multi_cell(0, 4, line, ln=True)
        pdf.ln(1)


# ── Report: Company profile teaser ────────────────────────────────────────────

def _build_company_profile(pdf: _BasePDF, company_id: int, db: Session):
    co = db.query(Company).filter(Company.id == company_id).first()
    metrics = compute_metrics(company_id, db)
    basis = ebitda_basis_for_company(company_id, db)
    modules = compute_category_modules(company_id, db)
    rev = modules["revenue_quality"]
    fin = modules["financial_integrity"]
    ops = modules["operational_independence"]
    cust = modules["customer_risk"]
    mgmt = modules["management_team"]
    growth = modules["growth_drivers"]
    cat = CategoryScores(
        revenue_quality=rev.composite,
        financial_integrity=fin.composite,
        operational_independence=ops.composite,
        customer_risk=cust.composite,
        management_team=mgmt.composite,
        growth_drivers=growth.composite,
    )
    drs = compute_drs(cat)
    from decimal import Decimal as _D
    ebitda_f = float(basis["ebitda_normalized_ttm"])
    mctx = get_market_multiple_context(db, company_id, ebitda_f)
    ev = compute_enterprise_value(_D(str(round(ebitda_f, 2))), drs.tier, market_context=mctx)

    pdf.add_page()
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*_TEXT)
    pdf.cell(0, 10, _safe(co.name if co else "Company Profile"), ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*_SUBTEXT)
    ind = (co.industry or "Industry TBD") if co else ""
    pdf.cell(0, 6, _safe(f"{ind}  |  Confidential teaser"), ln=True)
    pdf.ln(4)
    if co and co.report_cover_blurb:
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*_TEXT)
        pdf.multi_cell(0, 5, _safe(co.report_cover_blurb[:800]), ln=True)
        pdf.ln(3)
    pdf.section_title("Highlights")
    pdf.set_font("Helvetica", "", 9)
    rows = [
        ("TTM revenue", _fmt_m(float(metrics.total_revenue_ttm))),
        ("Reported EBITDA (normalized)", _fmt_m(ebitda_f)),
        ("DRS score", f"{drs.base_drs:.1f} / 100 ({drs.tier.value})"),
        ("Indicative EV (mid)", _fmt_m(float(ev.ev_midpoint))),
    ]
    for label, val in rows:
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*_MUTED)
        pdf.cell(70, 6, label, ln=False)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*_TEXT)
        pdf.cell(0, 6, val, ln=True)
    pdf.ln(4)
    pdf.section_title("Investment considerations")
    pdf.set_font("Helvetica", "", 8)
    pdf.multi_cell(
        0, 4,
        _safe(
            "This one-pager is illustrative and not an offering memorandum. "
            "Engage qualified M&A counsel and tax advisors before marketing the business."
        ),
        ln=True,
    )


# ── Public interface ───────────────────────────────────────────────────────────

REPORT_BUILDERS = {
    "drs_summary": (_build_drs_summary, "DRS Readiness Summary"),
    "value_gap": (_build_value_gap, "Value Gap Analysis"),
    "buyer_prep": (_build_buyer_prep, "Buyer Preparation Package"),
    "ebitda_recast": (_build_ebitda_recast_pdf, "EBITDA Recast Schedule"),
    "company_profile": (_build_company_profile, "Company Profile Teaser"),
}


def generate_report_pdf(report_type: str, company_id: int, db: Session,
                        company_name: str = "ABC Company Inc") -> bytes:
    """
    Generate a PDF report and return its bytes.
    Raises KeyError for unknown report_type.
    """
    builder_fn, title = REPORT_BUILDERS[report_type]

    co = db.query(Company).filter(Company.id == company_id).first()
    display_name = co.name if co and co.name else company_name
    firm = (co.report_firm_name or "").strip() if co else ""
    if not firm:
        firm = "FRACTURE SYSTEMS"

    pdf = _BasePDF(orientation="P", unit="mm", format="A4")
    pdf._company_name = display_name
    pdf._report_title = title
    pdf._report_date = date.today().strftime("%B %d, %Y")
    pdf._brand_primary = firm[:120]
    pdf._brand_sub = "Pre-Diligence Platform"
    logo_p = resolve_company_logo_path(company_id)
    if logo_p:
        pdf._logo_path = str(logo_p)
    elif co and (co.report_logo_url or "").strip().lower().startswith(("http://", "https://")):
        pdf._logo_path = (co.report_logo_url or "").strip()
    else:
        pdf._logo_path = None
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(10, 10, 10)

    builder_fn(pdf, company_id, db)

    return bytes(pdf.output())
