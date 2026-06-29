# Questionnaire Audit — Categories, Effects, and Outcomes

The platform has two distinct questionnaire surfaces. This document maps every question to its DRS category, scoring weight, and the outcome each answer produces.

---

## Part 1 — Qualitative Inputs (Advisor Input Form)

**Source:** `frontend/src/pages/QualitativeInputs.jsx`

14 fields across 4 sections. When a section is fully complete, the DRS automatically recomputes using qualitative sub-scores instead of conservative defaults. Each section is gated — all fields in a section must be set before the section's qualitative scores activate.

---

### Section A — Revenue Contracts & Key Person Risk

**Maps to:** Revenue Quality · 25% of default DRS  
**Activates when:** A1 + A2 + A3 are all set  
**Backend functions:** `_qual_contract_score()`, `_qual_key_person_score()`

| # | Field | Question | Scoring Logic | Outcome Bands |
|---|-------|----------|---------------|---------------|
| A1 | `contract_pct` | What percentage of active customers have a signed contract, MSA, or retainer agreement in place? | Combined with A2 via `_qual_contract_score()` | ≥80% → "Strong — buyers will view revenue as secured"; 50–79% → "Moderate — formalize remaining relationships before sale"; <50% → "Weak — high-priority initiative" |
| A2 | `customer_contract_type` | How is most revenue structured with customers? | Adds quality multiplier to A1 score | MSA/Annual = highest buyer confidence; Retainer/Subscription = strong recurring signal; Project-Based = lower predictability; Mix = document each relationship |
| A3 | `key_person_revenue_pct` | Approximately what percentage of revenue is attributable to the owner's personal relationships — customers who would follow the owner if they left? | Inverse score: lower dependency = higher points | ≤10% → Low risk (institutionalized relationships); ≤20% → Manageable (introduce key account managers); ≤50% → Moderate risk (transition plan needed); >50% → High risk (major valuation discount; buyer will escrow or reduce offer) |

**DRS impact:** A complete Section A replaces the default revenue quality sub-score. Owner revenue dependency >50% will also trigger CRITICAL buyer questions.

---

### Section B — Operational Independence

**Maps to:** Operational Independence · 20% of default DRS  
**Sub-score weights:** B1 = 35%, B2 = 30%, B3 = 15%, B4 = 20%  
**Activates when:** B1 + B2 + B3 are all set (B4 enriches further when set)  
**Backend functions:** `_qual_owner_hours_score()`, `_qual_sop_score()`, `_qual_automation_score()`, `_qual_mgmt_depth_score()`

| # | Field | Sub-weight | Question | Scoring Logic | Outcome Bands |
|---|-------|-----------|----------|---------------|---------------|
| B1 | `owner_hours_per_week` | 35% | On average, how many hours per week does the owner spend in day-to-day operations — not strategy, not external? | Step function from `scoring_rules.py` `qual_owner_hours_thresholds` | ≤5h → 90 pts (owner not needed); ≤15h → 75 pts (low dependency); ≤25h → 55 pts (moderate dependency); ≤40h → 35 pts (high dependency); >40h → 10 pts (critical dependency) |
| B2 | `sop_pct` | 30% | What percentage of core operational processes have written SOPs? (onboarding, service delivery, account management, billing) | Linear scale 10–90 pts | ≥80% → strong (buyers see a transferable business); <30% → weak (execution risk without the owner) |
| B3 | `automation_pct` | 15% | What percentage of repetitive operational tasks (invoicing, reporting, scheduling) are handled by a system rather than a person? | Linear scale 10–90 pts | Higher automation = lower labor dependency = higher score |
| B4 | `mgmt_qualified` / `mgmt_total_functions` | 20% | How many of the company's core business functions (sales, delivery, finance, operations) have a qualified manager who could run that function without the owner? | Ratio: qualified ÷ total functions | ≥75% coverage → 90 pts; ≥50% → 70 pts; ≥25% → 45 pts; <25% → 15 pts |

**DRS impact:** This is the highest-weight category for PE buyers (25%). Owner hours >40h/week will fire CRITICAL buyer questions about business continuity and transition plan.

---

### Section C — Growth Drivers

**Maps to:** Growth Drivers · 10% of default DRS  
**Sub-score weights:** C1 = 30%, C2 = 20%, C3 = 15% (remaining 35% comes from financial CAGR data automatically)  
**Activates when:** C1 + C2 + C3 are all set  
**Backend functions:** `_qual_pipeline_ratio_score()`, market positioning lookup, `_qual_repeatability_score()`

| # | Field | Sub-weight | Question | Scoring Logic | Outcome Bands |
|---|-------|-----------|----------|---------------|---------------|
| C1 | `pipeline_value` | 30% | What is the estimated dollar value of qualified pipeline (prospects with identified need, budget, and timeline)? | Pipeline ÷ annual revenue ratio, from `qual_pipeline_ratio_thresholds` | Ratio ≥1.5× → 95 pts; ≥1.0× → 80 pts; ≥0.5× → 60 pts; ≥0.25× → 40 pts; <0.25× → 20 pts |
| C2 | `market_positioning` | 20% | How would you characterize the company's market positioning? | Direct score lookup | Defined ICP + clear differentiation + repeatable sales motion → 80 pts; Moderate positioning / inconsistent execution → 45 pts; Undifferentiated / competing on price → 10 pts |
| C3 | `repeatability_pct` | 15% | What percentage of revenue comes from standardized, repeatable offerings vs. fully custom work? | Linear scale | Higher standardization → higher score; fully custom work signals execution risk and margin compression |

**DRS impact:** Growth Drivers is weighted lowest (10% default, 5% for PE). However, low pipeline or undifferentiated positioning will still trigger HIGH buyer questions about sales process and expansion strategy.

---

### Section D — Management & Team

**Maps to:** Management Team · 10% of default DRS  
**Blending:** 60% financial data (A6 module) / 40% qualitative when D1 + D2 + D3 are all set  
**Backend functions:** `_qual_non_compete_score()`, `_qual_voluntary_turnover_score()`, `_qual_comp_vs_market_score()`

| # | Field | Sub-weight | Question | Scoring Logic | Outcome Bands |
|---|-------|-----------|----------|---------------|---------------|
| D1 | `non_compete_pct` | 15% of A6 | What percentage of key employees (those who would materially impact revenue or operations if they left) have signed non-compete or non-solicitation agreements? | Band lookup | 0% → 20 pts (no protection); 1–50% → partial; 51–75% → moderate; 76–99% → strong; 100% → 95 pts (fully protected) |
| D2 | `voluntary_turnover` | 15% of A6 | Over the last 12 months, what was the annual voluntary turnover rate for non-owner employees? (voluntary departures ÷ average headcount) | Band lookup | <10% → 90 pts (excellent retention); 10–15% → industry average; 15–25% → elevated — investigate; >25% → 20 pts (high risk signal) |
| D3 | `comp_vs_market` | 10% of A6 | How does total compensation (salary + benefits + incentives) for key roles compare to market rates in the company's geography and industry? | Band lookup | >25% below market → 25 pts (high flight risk); 15–25% below → moderate risk; within ±15% → competitive (retentive); above market → 90 pts (strong retention signal) |
| D4 | `has_crm_pipeline` | Optional | Does the sales team actively maintain a CRM pipeline with deal stages, estimated values, and expected close dates? | Enrichment signal only — does not block section completion | Yes → positive growth signal; No/Unknown → noted gap; does not affect DRS calculation |

**DRS impact:** PE buyers weight management team at 15% (vs. 10% default). Completing D1–D3 pre-answers most of the management team buyer questions and removes the conservative default assumption.

---

## Part 2 — Buyer Question Simulation Library

**Source:** `backend/app/analytics/a13_buyer_questions.py`

31 template questions generated dynamically based on DRS category scores. A question fires only when the category score is at or below its `score_trigger`. The system returns up to 20 questions per engagement, sorted CRITICAL first, then by how far the score is below the trigger.

Questions are tracked in `buyer_question_states` (status: open → in_progress → answered/mitigated/waived) and can receive AI-generated draft answers.

**Buyer type definitions:**

| Type | Primary concerns | Category weight emphasis |
|------|-----------------|--------------------------|
| PE | Ops independence, management team | Operational Independence 25%, Management Team 15% |
| Strategic | Customer book, revenue streams | Revenue Quality 30%, Customer Risk 20% |
| Financial | Clean books, debt serviceability | Financial Integrity 25%, Revenue Quality 25% |
| All | Universal — every buyer type | Fires regardless of buyer profile |

---

### Revenue Quality (6 questions)

**DRS weight:** 25% default · 30% Strategic · 20% PE · 25% Financial

| Severity | Buyer | Score Trigger | Question | Documentation Needed |
|----------|-------|---------------|----------|----------------------|
| CRITICAL | All | ≤50 | What percentage of revenue is contractually recurring, and what are the renewal terms? | Contract schedule with ARR, renewal dates, auto-renewal clauses |
| CRITICAL | Strategic | ≤50 | Which revenue streams are dependent on the founder's personal relationships? | Customer relationship map, sales process documentation |
| HIGH | All | ≤65 | Do you have any customers representing more than 20% of total revenue? | Customer revenue concentration report by customer for LTM |
| HIGH | PE | ≤65 | Walk us through your top 3 revenue streams — how stable is each, and what would cause them to decline? | Revenue waterfall by stream for LTM + 2 prior years |
| HIGH | Financial | ≤65 | What is your net revenue retention rate for the past 3 years? | Annual cohort revenue data, churn/expansion breakdown |
| MEDIUM | All | ≤75 | How would revenue be impacted if you raised prices by 10–15%? | Customer price sensitivity analysis, competitive pricing data |

**Outcome:** Answering these questions builds the data room and supports qualitative A3 sub-score completion. CRITICAL questions fire when revenue quality score ≤50 — typically when contract coverage is low or owner dependency is high.

---

### Financial Integrity (8 questions)

**DRS weight:** 20% default · 25% Financial · 20% PE/Strategic

| Severity | Buyer | Score Trigger | Question | Documentation Needed |
|----------|-------|---------------|----------|----------------------|
| CRITICAL | All | ≤50 | Have these financials been reviewed or audited by an independent CPA? | CPA review or audit letters for most recent 3 fiscal years |
| CRITICAL | All | ≤50 | We only see 12 months of data. Can you provide 36 months of financial history? | P&L and balance sheet for fiscal years 2022, 2023, 2024 |
| HIGH | PE | ≤65 | What owner-related expenses are running through the P&L that would not be present post-acquisition? | Complete add-back schedule with documentation for each item |
| HIGH | Financial | ≤65 | Are there any related-party transactions — purchases from, or sales to, owner-affiliated entities? | Related party disclosure, vendor register flagged for related parties |
| HIGH | PE | ≤65 | Have there been any one-time revenue items or non-recurring expenses in the reported period? | Normalized EBITDA bridge with each adjustment itemized |
| HIGH | PE | ≤95 | Revenue declined from 2023 to 2024 before recovering in 2025 — can you explain the net loss year and what changed operationally? | 2024 P&L detail, explanation of revenue decline drivers, corrective actions taken |
| HIGH | All | ≤95 | What is the basis for the officers' salary addback in your EBITDA recast — what is the documented market rate for a replacement operations director? | Officers' salary documentation, market comp benchmarks, addback methodology |
| MEDIUM | All | ≤75 | How are revenue and expenses recognized — cash or accrual basis? | Accounting policy documentation, sample recognition examples |

**Outcome:** Preparing answers to these questions populates the EBITDA addback schedule and supports `a2_ebitda_recast`. The two CRITICAL questions (audit trail and data history) will fire for almost any company without 3 years of audited financials — resolving them is the fastest path to improving financial integrity score.

---

### Operational Independence (6 questions)

**DRS weight:** 20% default · 25% PE · 15% Strategic/Financial

| Severity | Buyer | Score Trigger | Question | Documentation Needed |
|----------|-------|---------------|----------|----------------------|
| CRITICAL | All | ≤50 | What happens to the business if the owner is unavailable for 90 days? | Org chart, documented processes, delegation matrix |
| CRITICAL | PE | ≤50 | What is the owner's intended role post-close? Is there a transition plan? | Transition plan document, consulting agreement terms |
| HIGH | All | ≤65 | What management team would remain post-acquisition, and under what retention terms? | Employment agreements, non-compete terms, retention plan |
| HIGH | PE | ≤65 | Which client relationships are personally owned by the founder vs. institutionally managed? | CRM data, client communication logs, relationship ownership map |
| HIGH | Financial | ≤65 | What is the total cost to replace the owner's operational responsibilities with a professional manager? | Job descriptions, market comp benchmarks, replacement cost model |
| MEDIUM | Strategic | ≤75 | How are operational decisions currently made? Is there a management team or does everything go through the owner? | Decision-making framework, escalation procedures, SOPs |

**Outcome:** These buyer questions mirror Section B qualitative inputs exactly. Completing Section B (owner hours, SOPs, automation, management depth) and answering these questions together drive the operational independence score up. PE buyers will ask CRITICAL questions here any time the score is below 50.

---

### Customer Risk (9 questions)

**DRS weight:** 15% default · 20% Strategic · 15% PE/Financial

| Severity | Buyer | Score Trigger | Question | Documentation Needed |
|----------|-------|---------------|----------|----------------------|
| CRITICAL | All | ≤50 | What are the top-5 customers by revenue, and what are your contract terms with each? | Customer contract schedule: name, ARR, contract end date, renewal terms |
| CRITICAL | All | ≤50 | Are there any contracts with termination-for-convenience clauses or key-person clauses that could be triggered by a change of control? | Contract review — change of control, assignment, and termination clauses |
| CRITICAL | All | ≤80 | What happens to your revenue if your largest customer does not renew — they represent the single largest customer relationship? | Contract, renewal history, relationship ownership, notice period |
| CRITICAL | All | ≤80 | Your top 2 customers represent a significant portion of revenue. What is your strategy to mitigate this concentration risk before a transaction? | Customer diversification plan, pipeline of new customer prospects, timeline to reduce concentration |
| CRITICAL | All | ≤80 | What contracts govern your customer relationships — are they purchase orders, master service agreements, or verbal commitments? | Full contract register with type, term, value, and renewal provisions for all active customers |
| HIGH | All | ≤65 | Have any customers given notice they are evaluating alternatives or reducing scope? | At-risk account list with status, account manager notes |
| HIGH | PE | ≤65 | What is your customer churn rate for the past 3 years, and what were the primary reasons for churn? | Cohort churn analysis by year, exit interview data |
| HIGH | PE | ≤65 | What percentage of customers are on month-to-month vs. annual vs. multi-year agreements? | Contract duration mix breakdown by ARR |
| MEDIUM | Strategic | ≤75 | What is the average length of a customer relationship, and how does lifetime value trend over time? | Customer tenure distribution, LTV model by cohort |

**Outcome:** Customer risk has the most CRITICAL questions (5) and the broadest trigger threshold (≤80), meaning they fire for most companies. High concentration is the primary driver. Strategic buyers weight this category at 20% — concentration risk directly reduces their willingness to pay. Resolving concentration questions requires either a diversification plan or mitigating initiative linked in the platform.

---

### Management Team (5 questions)

**DRS weight:** 10% default · 15% PE · 10% Strategic/Financial

| Severity | Buyer | Score Trigger | Question | Documentation Needed |
|----------|-------|---------------|----------|----------------------|
| CRITICAL | All | ≤50 | Who are the key members of your management team and what are their backgrounds? | Team bios, org chart, tenure by role |
| CRITICAL | PE | ≤50 | Has any key manager indicated they would leave in the event of an acquisition? | Retention risk assessment, conversations with key managers |
| HIGH | All | ≤65 | What non-compete and non-solicitation agreements are in place with key employees? | Employment agreements for all VP+ level employees |
| HIGH | PE | ≤65 | Do you have a CFO or equivalent financial leadership? Who is responsible for the numbers? | Finance org chart, CFO/Controller background, accounting team structure |
| MEDIUM | Strategic | ≤75 | How is compensation structured — base vs. variable — and are there equity participation plans? | Compensation plan documentation, equity/bonus schedules |

**Outcome:** Completing Section D qualitative inputs (non-compete coverage, turnover rate, comp vs. market) pre-answers the HIGH questions here and improves the score enough to silence them. The two CRITICAL questions require human assessment — retention risk conversations and org documentation cannot be replaced by form inputs.

---

### Growth Drivers (5 questions)

**DRS weight:** 10% default · 5% PE · 10% Strategic/Financial

| Severity | Buyer | Score Trigger | Question | Documentation Needed |
|----------|-------|---------------|----------|----------------------|
| CRITICAL | All | ≤50 | What is your revenue growth rate for the past 3 years, and what are the primary drivers? | Revenue bridge by year, growth attribution by segment/channel |
| CRITICAL | Financial | ≤50 | What investments are required to sustain current growth — headcount, marketing, technology? | Growth investment model, headcount plan, marketing budget |
| HIGH | PE | ≤65 | What is your sales pipeline today, and how does it compare to this time last year? | Current pipeline report, pipeline velocity metrics, close rate history |
| HIGH | Strategic | ≤65 | Are there untapped markets or geographies you have not yet entered? What is limiting expansion? | TAM analysis, competitive landscape, go-to-market strategy document |
| MEDIUM | All | ≤75 | What is your average sales cycle length, and how many leads are required to close one new customer? | Sales funnel metrics, CRM data, conversion rates by stage |

**Outcome:** Section C qualitative inputs (pipeline value → C1, market positioning) directly pre-answer the PE HIGH question about pipeline. Financial CAGR (calculated automatically from ingested data) contributes 35% of the Growth Drivers score, so companies with strong revenue growth may not trigger CRITICAL questions even if qualitative inputs are incomplete.

---

## DRS Category Weight Reference

| DRS Category | Default | PE | Strategic | Financial |
|---|---|---|---|---|
| Revenue Quality | 25% | 20% | **30%** | 25% |
| Financial Integrity | 20% | 20% | 15% | **25%** |
| Operational Independence | 20% | **25%** | 15% | 15% |
| Customer Risk | 15% | 15% | **20%** | 15% |
| Management Team | 10% | **15%** | 10% | 10% |
| Growth Drivers | 10% | 5% | 10% | 10% |

Weights are defined in `backend/app/core/scoring_rules.py` (`SCORING_RULES` and `BUYER_WEIGHT_PROFILES`). Change them there — never hardcode in analytics modules.

---

## DRS Tier → Enterprise Value Multiple

| Tier | Score Range | EV Multiple Range | What it means |
|------|-------------|-------------------|---------------|
| INSTITUTIONAL | 85–100 | 7.0–9.0× | Institutional-grade — ready for competitive process |
| INVESTMENT | 70–84 | 5.0–7.0× | Investment-ready — some items to address pre-LOI |
| CONDITIONAL | 55–69 | 3.5–5.0× | Conditional — requires meaningful remediation |
| HIGH_RISK | 40–54 | 2.5–3.5× | High risk — significant buyer discount expected |
| PRE_DILIGENCE | 0–39 | 2.5–3.0× | Pre-diligence — not ready for market |

---

## Cross-Reference: Qualitative Inputs → Buyer Questions Silenced

| Section Input | Buyer Questions It Pre-answers |
|---|---|
| A1 + A2 (contract coverage + type) | Revenue Quality CRITICAL: "What % of revenue is contractually recurring?" |
| A3 (owner revenue dependency) | Revenue Quality CRITICAL (Strategic): "Which revenue streams depend on founder relationships?" |
| B1 (owner hours) | Operational Independence CRITICAL: "What happens if owner is unavailable 90 days?" |
| B2 (SOP coverage) | Operational Independence MEDIUM: "How are operational decisions made?" |
| B4 (management depth) | Operational Independence HIGH: "What management team would remain post-acquisition?" |
| C1 (pipeline value) | Growth Drivers HIGH (PE): "What is your sales pipeline today?" |
| D1 (non-compete coverage) | Management Team HIGH: "What non-compete agreements are in place?" |
| D2 (voluntary turnover) | Management Team — informs retention risk context |
| D3 (comp vs. market) | Management Team MEDIUM: "How is compensation structured?" |
