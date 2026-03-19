"""
A13 — Buyer Question Simulation (Blueprint II §A13)

Generates a prioritized list of due diligence questions a sophisticated buyer
(PE, strategic, or financial) would ask based on identified DRS weaknesses.

Each question is tagged by:
  - category: which DRS dimension it targets
  - severity: CRITICAL / HIGH / MEDIUM (based on score)
  - buyer_type: PE / Strategic / Financial / All
  - question_text: the actual question
  - data_needed: what the advisor needs to prepare

No AI call required — questions are drawn from a template library keyed by
category and severity band.
"""

from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class BuyerQuestion:
    id: int
    category: str
    severity: str          # CRITICAL | HIGH | MEDIUM
    buyer_type: str        # PE | Strategic | Financial | All
    question: str
    data_needed: str
    score_trigger: float   # question fires when score ≤ this value

    def to_dict(self) -> dict:
        return {
            "id":           self.id,
            "category":     self.category,
            "severity":     self.severity,
            "buyer_type":   self.buyer_type,
            "question":     self.question,
            "data_needed":  self.data_needed,
        }


# ── Question library ──────────────────────────────────────────────────────────
# Format: (score_trigger, severity, buyer_type, question, data_needed)

_LIBRARY: dict[str, list[tuple]] = {
    "revenue_quality": [
        (50, "CRITICAL", "All",
         "What percentage of revenue is contractually recurring, and what are the renewal terms?",
         "Contract schedule with ARR, renewal dates, auto-renewal clauses"),
        (65, "HIGH", "PE",
         "Walk us through your top 3 revenue streams — how stable is each, and what would cause them to decline?",
         "Revenue waterfall by stream for LTM + 2 prior years"),
        (65, "HIGH", "Financial",
         "What is your net revenue retention rate for the past 3 years?",
         "Annual cohort revenue data, churn/expansion breakdown"),
        (75, "MEDIUM", "All",
         "How would revenue be impacted if you raised prices by 10–15%?",
         "Customer price sensitivity analysis, competitive pricing data"),
        (50, "CRITICAL", "Strategic",
         "Which revenue streams are dependent on the founder's personal relationships?",
         "Customer relationship map, sales process documentation"),
        (65, "HIGH", "All",
         "Do you have any customers representing more than 20% of total revenue?",
         "Customer revenue concentration report by customer for LTM"),
    ],
    "financial_integrity": [
        (50, "CRITICAL", "All",
         "Have these financials been reviewed or audited by an independent CPA?",
         "CPA review or audit letters for most recent 3 fiscal years"),
        (65, "HIGH", "PE",
         "What owner-related expenses are running through the P&L that would not be present post-acquisition?",
         "Complete add-back schedule with documentation for each item"),
        (65, "HIGH", "Financial",
         "Are there any related-party transactions — purchases from, or sales to, owner-affiliated entities?",
         "Related party disclosure, vendor register flagged for related parties"),
        (75, "MEDIUM", "All",
         "How are revenue and expenses recognized — cash or accrual basis?",
         "Accounting policy documentation, sample recognition examples"),
        (50, "CRITICAL", "All",
         "We only see 12 months of data. Can you provide 36 months of financial history?",
         "P&L and balance sheet for fiscal years 2022, 2023, 2024"),
        (65, "HIGH", "PE",
         "Have there been any one-time revenue items or non-recurring expenses in the reported period?",
         "Normalized EBITDA bridge with each adjustment itemized"),
    ],
    "operational_independence": [
        (50, "CRITICAL", "All",
         "What happens to the business if the owner is unavailable for 90 days?",
         "Org chart, documented processes, delegation matrix"),
        (65, "HIGH", "PE",
         "Which client relationships are personally owned by the founder vs. institutionally managed?",
         "CRM data, client communication logs, relationship ownership map"),
        (65, "HIGH", "All",
         "What management team would remain post-acquisition, and under what retention terms?",
         "Employment agreements, non-compete terms, retention plan"),
        (75, "MEDIUM", "Strategic",
         "How are operational decisions currently made? Is there a management team or does everything go through the owner?",
         "Decision-making framework, escalation procedures, SOPs"),
        (50, "CRITICAL", "PE",
         "What is the owner's intended role post-close? Is there a transition plan?",
         "Transition plan document, consulting agreement terms"),
        (65, "HIGH", "Financial",
         "What is the total cost to replace the owner's operational responsibilities with a professional manager?",
         "Job descriptions, market comp benchmarks, replacement cost model"),
    ],
    "customer_risk": [
        (50, "CRITICAL", "All",
         "What are the top-5 customers by revenue, and what are your contract terms with each?",
         "Customer contract schedule: name, ARR, contract end date, renewal terms"),
        (65, "HIGH", "PE",
         "What is your customer churn rate for the past 3 years, and what were the primary reasons for churn?",
         "Cohort churn analysis by year, exit interview data"),
        (65, "HIGH", "All",
         "Have any customers given notice they are evaluating alternatives or reducing scope?",
         "At-risk account list with status, account manager notes"),
        (75, "MEDIUM", "Strategic",
         "What is the average length of a customer relationship, and how does lifetime value trend over time?",
         "Customer tenure distribution, LTV model by cohort"),
        (50, "CRITICAL", "All",
         "Are there any contracts with termination-for-convenience clauses or key-person clauses that could be triggered by a change of control?",
         "Contract review — change of control, assignment, and termination clauses"),
        (65, "HIGH", "PE",
         "What percentage of customers are on month-to-month vs. annual vs. multi-year agreements?",
         "Contract duration mix breakdown by ARR"),
    ],
    "management_team": [
        (50, "CRITICAL", "All",
         "Who are the key members of your management team and what are their backgrounds?",
         "Team bios, org chart, tenure by role"),
        (65, "HIGH", "PE",
         "Do you have a CFO or equivalent financial leadership? Who is responsible for the numbers?",
         "Finance org chart, CFO/Controller background, accounting team structure"),
        (65, "HIGH", "All",
         "What non-compete and non-solicitation agreements are in place with key employees?",
         "Employment agreements for all VP+ level employees"),
        (75, "MEDIUM", "Strategic",
         "How is compensation structured — base vs. variable — and are there equity participation plans?",
         "Compensation plan documentation, equity/bonus schedules"),
        (50, "CRITICAL", "PE",
         "Has any key manager indicated they would leave in the event of an acquisition?",
         "Retention risk assessment, conversations with key managers"),
    ],
    "growth_drivers": [
        (50, "CRITICAL", "All",
         "What is your revenue growth rate for the past 3 years, and what are the primary drivers?",
         "Revenue bridge by year, growth attribution by segment/channel"),
        (65, "HIGH", "PE",
         "What is your sales pipeline today, and how does it compare to this time last year?",
         "Current pipeline report, pipeline velocity metrics, close rate history"),
        (65, "HIGH", "Strategic",
         "Are there untapped markets or geographies you have not yet entered? What is limiting expansion?",
         "TAM analysis, competitive landscape, go-to-market strategy document"),
        (75, "MEDIUM", "All",
         "What is your average sales cycle length, and how many leads are required to close one new customer?",
         "Sales funnel metrics, CRM data, conversion rates by stage"),
        (50, "CRITICAL", "Financial",
         "What investments are required to sustain current growth — headcount, marketing, technology?",
         "Growth investment model, headcount plan, marketing budget"),
    ],
}


def generate_buyer_questions(
    category_scores: dict[str, float],
    max_questions: int = 20,
) -> list[BuyerQuestion]:
    """
    Generate a prioritized list of buyer questions based on DRS category scores.
    Questions are filtered by score_trigger: only fired when score ≤ trigger.
    """
    questions: list[BuyerQuestion] = []
    qid = 1

    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}

    for category, templates in _LIBRARY.items():
        score = category_scores.get(category, 50.0)
        for trigger, severity, buyer_type, question, data_needed in templates:
            if score <= trigger:
                questions.append(BuyerQuestion(
                    id=qid,
                    category=category,
                    severity=severity,
                    buyer_type=buyer_type,
                    question=question,
                    data_needed=data_needed,
                    score_trigger=trigger,
                ))
                qid += 1

    # Sort: CRITICAL first, then by how far below threshold the score is
    questions.sort(key=lambda q: (
        severity_order.get(q.severity, 3),
        -(q.score_trigger - category_scores.get(q.category, 50.0)),
    ))

    return questions[:max_questions]
