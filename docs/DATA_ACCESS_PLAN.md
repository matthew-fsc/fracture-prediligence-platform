# Data Access Plan — Calculation Coverage by Data Source

> **Purpose:** Defines exactly which calculations are live, estimated, or locked
> based on what data has been ingested for a company. Drives both the analytics
> engine logic and the user-facing coverage indicators in the UI.

---

## 1. Data Sources → Ontology Entities

Each file a user can upload populates a specific subset of the six core ontology
entity types. The mapping is fixed by the P5 column-mapping registry.

| Source system / file type | Ontology entities populated |
|---|---|
| QuickBooks / Xero P&L export | `RevenueStream`, `Expense` |
| QuickBooks / CRM customer list | `Customer` |
| Gusto / ADP payroll report | `Employee` |
| HubSpot / Salesforce deals / contract CSV | `Contract` |
| Advisor qualitative interview (UI form) | `QualitativeInputs` |
| Curated market benchmarks (seeded) | `MarketBenchmarkRelease`, `MarketSegmentMetric` |
| Advisor manual overrides (UI fields) | `Company.{market_rate_replacement_annual, depreciation_amortization_ttm, interest_expense_ttm, income_tax_expense_ttm, total_headcount}` |

---

## 2. Analytics Modules — Input Requirements

Each A1–A11 module lists the ontology entities it reads, and the fallback
behaviour when data is absent.

### A1 — Metric Computation

| Metric group | Requires | Fallback when absent |
|---|---|---|
| TTM revenue, CAGR, recurring %, HHI | `RevenueStream` | All zero / null |
| Gross profit, EBITDA proxy, OpEx | `Expense` (COGS + OPEX) | EBITDA estimated from employee comp (`comp_annual` sum) |
| Owner comp total | `Expense` (OWNER/PERSONAL) or `Employee.is_owner` | Zero |
| Active customers, avg tenure | `Customer` | Inferred from revenue `customer_id` linkage only |
| Churn rate | `Customer.is_active` | Zero (not computed) |
| Contract coverage %, revenue at risk | `Contract` | Zero / not computed |
| Revenue per employee, management layers | `Employee` | Uses `Company.total_headcount` override if set |

### A2 — EBITDA Recast

| Component | Requires | Fallback when absent |
|---|---|---|
| Reported net income | Advisor-entered `net_income` field | Uses `ebitda_ttm` proxy from A1 (skips the full NI→EBITDA bridge) |
| D&A addback | `Company.depreciation_amortization_ttm` | Zero (EBITDA proxy = unadjusted) |
| Interest addback | `Company.interest_expense_ttm` | Zero |
| Tax addback | `Company.income_tax_expense_ttm` | Zero |
| Owner comp normalization | `Employee` (is_owner) + `Company.market_rate_replacement_annual` | Addback line omitted entirely |
| Additional addbacks | `Expense` (OWNER / PERSONAL / RELATED_PARTY) or `AddbackOverride` rows | No addbacks; defensible EBITDA = reported EBITDA proxy |

**EBITDA certainty levels:**
- **Full recast** — net income + D&A + interest + taxes all entered; addbacks documented → high buyer credibility
- **Partial recast** — some bridge components entered; some addbacks present → medium
- **Proxy only** — revenue − COGS − OPEX from expense records only → low; clearly labelled in UI

### A3 — Revenue Quality Score (DRS weight: 25%)

| Sub-dimension (weight) | Requires | Fallback score |
|---|---|---|
| Recurring rate (30%) | `RevenueStream.recurring_flag / revenue_type` | Behavioral detection from `customer_id` repeat months; if no customer_id → 50.0 |
| Customer concentration / HHI (25%) | `RevenueStream.customer_id` or description | 50.0 if no customer linkage |
| Contract durability (20%) | `Contract` records with `end_date` and `annual_value` | **40.0 flat** (no contracts ingested) |
| Revenue consistency / CV (15%) | `RevenueStream` with `revenue_period` | 50.0 if < 3 months of data |
| Recurring revenue growth / NRR proxy (10%) | ≥ 2 years of `RevenueStream` | 65.0 (neutral assumption) |

### A4 — Operational Independence Score (DRS weight: 20%)

| Sub-dimension (weight) | Requires | Fallback score |
|---|---|---|
| Owner comp concentration (35%) | `Employee` (is_owner, comp_annual) | **50.0** (no payroll data) |
| Key person count (25%) | `Employee` (is_key_person, is_owner) | **50.0** |
| Management depth (25%) | `Employee.management_level` | **50.0** |
| Staff stability (15%) | `Employee.status` ACTIVE vs TERMINATED | **50.0** |

Without payroll: all four sub-scores default to 50.0, composite = **50.0 (LOW confidence)**.

### A5 — Customer Risk Score (DRS weight: 15%)

| Sub-dimension (weight) | Requires | Fallback score |
|---|---|---|
| Top-customer concentration (35%) | `RevenueStream.customer_id` | 50.0 |
| Customer count & diversification (25%) | `Customer` records | 50.0 |
| Churn / inactive rate (25%) | `Customer.is_active` | 50.0 |
| Average tenure (15%) | `Customer.tenure_start` | 50.0 |

With P&L + customer list (linked): all four sub-dimensions are live. With P&L only (no
customer list), concentration can be computed if `customer_id` is present on revenue rows,
but churn and tenure require `Customer` records.

### A6 — Management & Team Score (DRS weight: 10%)

| Sub-dimension (weight) | Requires | Fallback score |
|---|---|---|
| Management completeness (30%) | `Employee.role` + management regex | **50.0** (data gap flag) |
| Team size adequacy (25%) | `Employee` records or `Company.total_headcount` | 50.0 if no rev; computed if headcount override set |
| Ownership concentration (25%) | `Employee.is_owner` count | **80.0** (positive assumption: no data → no known sole-founder risk) |
| Key role coverage (20%) | `Employee.role` | **50.0** (data gap flag) |

Without payroll: composite ≈ **57.5 (LOW confidence)** due to data-gap neutrals.

### A7 — Growth Drivers Score (DRS weight: 10%)

| Sub-dimension (weight) | Requires | Fallback score |
|---|---|---|
| Revenue CAGR (40%) | ≥ 2 years of `RevenueStream` | 45.0 (0% growth assumed) |
| New customer acquisition (30%) | `Customer.tenure_start` | 0% new customers → score near 0 |
| Contract pipeline (30%) | `Contract` with `annual_value` and `end_date` | **30.0 flat** (no pipeline data) |

### A8 — Financial Integrity Score (DRS weight: 20%)

| Sub-dimension (weight) | Requires | Fallback score |
|---|---|---|
| Addback exposure (35%) | `Expense` (OWNER / PERSONAL / RELATED_PARTY) | 95.0 if no addback expenses present |
| Expense category completeness (25%) | `Expense` records | 100.0 if no expenses (vacuously complete) |
| Revenue completeness (20%) | `RevenueStream.revenue_period` + `revenue_type` | 100.0 if no revenue |
| Data coverage / months (20%) | `RevenueStream.revenue_period` + `Expense.period` | Scores based on actual months present |

A8 is fully driven by whatever financial data is ingested; it is not blocked by payroll or contracts.

### A9 — DRS Composite

Weighted sum of A3–A8. Score is computable at any data level; confidence band
widens when category scores default to 50.0.

### A10 — Enterprise Value

Requires `defensible_ebitda` (from A2) and `drs_tier` (from A9).
- If A2 only produced an EBITDA proxy, EV is labelled **"proxy basis"**.
- If `MarketBenchmarkRelease` records exist and industry is set, the multiple is blended 50/50 with curated market data.
- Without market benchmarks: DRS-tier-only multiple table is used.

### A11 — Value Gap Analysis

Requires only current category scores and EBITDA. Fully operational at any data
level; locked categories show lower potential uplift because their scores are
pinned at 50 (neutral default) with no room to improve via the platform.

---

## 3. Baseline: P&L Only + Customer Profile

This is the minimum recommended starting configuration. It provides a meaningful,
defensible first pass at all six DRS dimensions.

### What is fully computed

| Module / metric | Coverage |
|---|---|
| A1 TTM revenue, CAGR, recurring %, HHI | Live if `customer_id` present on revenue rows |
| A1 EBITDA proxy (revenue − COGS − OPEX) | Live |
| A3 Recurring rate | Live (explicit tags + behavioral fallback) |
| A3 HHI / concentration | Live if revenue rows have customer linkage |
| A3 Revenue consistency (CV) | Live |
| A3 NRR proxy | Live (requires ≥ 2 years of data) |
| A5 Top-customer concentration | Live |
| A5 Customer diversification, churn, tenure | Live |
| A7 Revenue CAGR | Live (requires ≥ 2 years) |
| A7 New customer acquisition rate | Live if `Customer.tenure_start` present |
| A8 All four sub-dimensions | Live |

### What is estimated (neutral default)

| Module / sub-score | Default value | Notes |
|---|---|---|
| A3 Contract durability | **40.0** | No contracts ingested; shown as "No contract data" |
| A4 All sub-scores | **50.0** | No payroll; entire module pinned at LOW confidence |
| A6 Completeness, role coverage | **50.0** | No payroll; data-gap flags raised |
| A6 Ownership concentration | **80.0** | Positive assumption (no sole-founder confirmed) |
| A7 Contract pipeline | **30.0** | No contracts; shown as "No pipeline data" |

### Composite DRS range at baseline

With typical SMB P&L + customer data and all neutral defaults, the DRS calculation
will be based on about **65% of total DRS weight** from live data (A3 25% + A5 15%
+ A8 20% + partial A7 10% = ~60–70%) and ~30–35% pinned at 50.0 neutral defaults.

The conservative–optimistic band will be wide — roughly ±8–12 DRS points —
because the large neutral-default blocks contribute full score uncertainty.

### EBITDA basis at baseline

Without D&A, interest, and taxes entered by the advisor, A2 produces an
**EBITDA proxy**: revenue − COGS − OPEX from expense records. The recast table
shows no addback schedule unless OWNER/PERSONAL expenses are present in the P&L.

---

## 4. Unlock Chain — What Each Additional Source Adds

### Unlock 1: Payroll data (Gusto / ADP CSV)

**Ontology populated:** `Employee` — name, role, comp_annual, hire_date, status,
is_owner, is_key_person, management_level.

| What changes | Before | After |
|---|---|---|
| A4 Operational Independence (20% DRS) | 50.0 flat / LOW | Live computed score |
| A6 Management & Team (10% DRS) | ~57.5 / LOW | Live computed score |
| A2 Owner comp addback | Absent | Owner comp vs market rate addback appears |
| A1 revenue_per_employee | Uses Company.total_headcount or 0 | Uses actual active employee count |
| A1 management_layer_count | 0 | Actual count from management_level field |
| EBITDA addback schedule | Incomplete | Owner comp normalization line added |

**DRS weight unblocked:** up to **30 points** of DRS weight (A4 + A6) move from
neutral-50 to actual measured values. If the business is genuinely owner-independent,
this will lift DRS; if highly owner-dependent, it will lower it — either outcome
improves investor credibility.

**Confidence band:** Conservative–optimistic spread typically narrows by 4–8 points.

---

### Unlock 2: Contract data (HubSpot deals / contract CSV)

**Ontology populated:** `Contract` — start_date, end_date, annual_value,
is_active, renewal_confirmed, customer_id.

| What changes | Before | After |
|---|---|---|
| A3 Contract durability (20% of A3 = 5% DRS) | 40.0 flat | Computed durable value ÷ TTM revenue |
| A7 Contract pipeline (30% of A7 = 3% DRS) | 30.0 flat | Computed pipeline ÷ trailing revenue |
| A1 pct_customers_with_active_contracts | 0% | Live |
| A1 revenue_at_risk_6mo | $0 | Live (expiring without renewal confirmed) |
| A10 EV risk flags | None | Revenue at risk visible in report |

**DRS weight unblocked:** ~5–6% of DRS weight from neutral/penalised defaults
to computed values. For businesses with strong contract coverage (>70% of revenue
under durable MSAs), this can add 3–6 DRS points.

---

### Unlock 3: Advisor qualitative inputs (UI form)

**Ontology populated:** `QualitativeInputs` — owner_hours_per_week, sop_pct,
automation_pct, pipeline_value, mgmt_qualified, mgmt_total_functions,
key_person_revenue_pct.

| What changes | Mechanism |
|---|---|
| A4 owner dependency (qualitative overlay) | `owner_hours_per_week` maps to scoring band via `qual_owner_hours_thresholds` |
| A7 pipeline (if no contract data) | `pipeline_value ÷ TTM_revenue` fills the pipeline sub-score when no contracts ingested |
| A6 management depth (qualitative) | `mgmt_qualified / mgmt_total_functions` provides an alternative to payroll role-regex |
| A2 custom addbacks | Advisor can add non-recurring items not present in the P&L export |

These inputs do not block any scores but refine them. They are most impactful when
payroll and contract data are absent, acting as lightweight substitutes.

---

### Unlock 4: Market benchmark data (curated IBBA-style, seeded)

**Ontology populated:** `MarketBenchmarkRelease` + `MarketSegmentMetric` (already
seeded on app startup from `market_benchmarks_curated.json`).

| What changes | Before | After |
|---|---|---|
| A10 multiple basis | DRS-tier heuristic only | Blended 50/50 with curated segment multiple |
| EV range | Single-source band | Blended band with provenance label |
| Market comparison table | Empty | Revenue growth / EBITDA margin / payroll ratio / recurring % vs peers |

**Requirement:** `Company.industry` must be set. Without it the system defaults to
`business_services` slug, reducing comparability. Set industry at company creation.

---

### Unlock 5: Advisor EBITDA override inputs (UI fields on Company)

**Fields:** `market_rate_replacement_annual`, `depreciation_amortization_ttm`,
`interest_expense_ttm`, `income_tax_expense_ttm`.

| What changes | Before | After |
|---|---|---|
| A2 EBITDA bridge | Proxy only | Full net income → EBITDA → recast bridge |
| Reported EBITDA | Estimated | Computed (NI + D&A + interest + taxes) |
| EBITDA certainty label | "Proxy" | "Full recast" |
| Owner comp addback | Absent or partial | Owner comp delta vs market rate computed |

This is the single highest-leverage manual input for EV credibility. Even without
payroll data, entering the market rate replacement cost unlocks the owner comp
addback calculation from OWNER/PERSONAL expense records.

---

## 5. Full Coverage — All Sources Ingested

When all five unlocks are active, the following is true:

- **All A3–A8 sub-scores** are computed from live data (no neutral defaults).
- **A2 EBITDA** is a full recast with documented addback schedule.
- **Conservative–optimistic DRS band** is tight (±2–4 points) because every sub-score has real data behind it.
- **EV range** is blended with curated market data and shows peer comparison.
- **A11 Value Gap** reflects meaningful uplift potential because locked categories now have real room to move.

---

## 6. User-Facing Representation

### 6.1 Data Coverage Indicator (per DRS category)

Each category card should show a coverage state badge alongside the score:

| Badge | Meaning | Trigger condition |
|---|---|---|
| **Live** (green) | All sub-scores computed from ingested data | No sub-score defaulting to neutral |
| **Partial** (amber) | Some sub-scores live, some estimated | ≥1 sub-score at neutral default |
| **Estimated** (grey) | All sub-scores at neutral default (50.0) | Entire module missing required entity type |

For scores in "Estimated" state, the numeric score should be visually de-emphasised
(e.g. greyed-out or shown with a `~` prefix) to signal it is a placeholder, not a measurement.

### 6.2 EBITDA Certainty Label

The EBITDA figure in the A2 recast and on the EV card should carry an explicit label:

| Label | Condition |
|---|---|
| **Full Recast** | Net income, D&A, interest, taxes all provided; ≥1 documented addback |
| **Partial Recast** | At least one bridge component provided; some addbacks present |
| **Proxy** | Revenue − COGS − OPEX only; no bridge components entered |

### 6.3 "Add Data to Unlock" Prompts

The UI should surface a ranked list of missing data sources sorted by DRS weight
impact. The ranking order at baseline (P&L + customers only) is:

1. **Payroll data** — unlocks 30% of DRS weight (A4 + A6) from neutral defaults
2. **EBITDA advisor inputs** — upgrades EBITDA from proxy to full recast; improves EV credibility
3. **Contract data** — unlocks durability and pipeline sub-scores (~5–6% DRS weight)
4. **Qualitative interview** — refines owner dependency and pipeline without file upload

Each prompt should quantify the potential impact: e.g. *"Adding payroll data will
activate Operational Independence (20% of DRS) and Management & Team (10% of DRS),
currently estimated at 50.0."*

### 6.4 Confidence Band Visibility

The DRS result always exposes `conservative_drs`, `base_drs`, and `optimistic_drs`.

| Coverage level | Typical band width | Display recommendation |
|---|---|---|
| P&L + customers only | ±8–12 pts | Show full range prominently |
| + Payroll | ±5–8 pts | Show range with "improving" label |
| + Contracts + Qualitative | ±3–5 pts | Show range, de-emphasise if tight |
| Full coverage | ±1–3 pts | Show midpoint; range collapsible |

When the band is wide (>8 pts), the UI should communicate that more data will
narrow the range, not just improve the score.

### 6.5 Sub-Score Tooltips

Every sub-score in the breakdown panel should show:
- The input value used (e.g. "HHI 2,340 — TTM revenue across 7 customers")
- The data source it came from (e.g. "From QuickBooks P&L export · 36 months")
- If defaulted: "Estimated — no payroll data ingested"

---

## 7. Calculation Flow Diagram (text form)

```
DATA INGESTED
    │
    ├── RevenueStream + Expense  ──────────────────────────────────┐
    │   (from P&L export)                                          │
    │                                                              ▼
    ├── Customer                 ──────────────────────── A1 Metric Registry
    │   (from customer list)                              (40+ foundational metrics)
    │                                                              │
    ├── Employee                 ────────────────────────          │
    │   (from payroll)                                   │         │
    │                                                    │         │
    ├── Contract                 ────────────────────────┼─────────┤
    │   (from CRM / CSV)                                 │         │
    │                                                    │         │
    ├── QualitativeInputs        ────────────────────────┤         │
    │   (from advisor form)                              │         │
    │                                                    │         │
    └── Company advisor fields   ────────────────────────┘         │
        (market rate, D&A, etc.)                                   │
                                                                   │
                              ┌────────────────────────────────────┘
                              │
                              ├──► A2  EBITDA Recast
                              │        (reported + addbacks → defensible EBITDA)
                              │
                              ├──► A3  Revenue Quality Score       (25% DRS)
                              │
                              ├──► A4  Operational Independence    (20% DRS)
                              │
                              ├──► A5  Customer Risk               (15% DRS)
                              │
                              ├──► A6  Management & Team           (10% DRS)
                              │
                              ├──► A7  Growth Drivers              (10% DRS)
                              │
                              └──► A8  Financial Integrity         (20% DRS)
                                          │
                                          ▼
                                   A9  DRS Composite Score (0–100)
                                   + Conservative / Optimistic bands
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                              ▼                       ▼
                       A10  Enterprise Value    A11  Value Gap
                       (EBITDA × multiple)      (per-category
                       + market blend           uplift ranking)
```

---

## 8. Coverage State Summary Table

Quick-reference for what is live vs estimated at each data combination.

| Data combination | A3 | A4 | A5 | A6 | A7 | A8 | DRS quality |
|---|---|---|---|---|---|---|---|
| P&L only | Partial (no durability) | Estimated | Partial (no churn/tenure) | Estimated | Partial (CAGR only) | Live | Low-medium |
| P&L + Customers | Partial (no durability) | Estimated | **Live** | Estimated | Partial (no pipeline) | Live | Medium |
| + Payroll | Partial | **Live** | Live | **Live** | Partial | Live | **Medium-high** |
| + Contracts | **Live** | Live | Live | Live | **Live** | Live | **High** |
| + Advisor inputs | Live | Live+ | Live | Live+ | Live+ | Live | **High** |
| All sources | Live | Live | Live | Live | Live | Live | **Full** |
