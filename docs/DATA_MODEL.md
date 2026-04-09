# Data Model Reference

This document is the readable extraction of the platform's ontology layer (`backend/app/ontology/models.py`). It covers every SQLAlchemy model, its columns, relationships, and purpose. Use it to understand what data is available before writing queries, migrations, or analytics code.

The ontology is the canonical output of **Blueprint I** (the ingestion pipeline). Analytics in Blueprint II read exclusively from these tables.

---

## Entity Relationship Overview

```
Company
  ├── RevenueStream  (many)  → links to Customer
  ├── Customer       (many)  → links to RevenueStream, Contract
  ├── Employee       (many)
  ├── Expense        (many)
  └── Contract       (many)  → links to Customer

Supporting tables (per company):
  ├── QualitativeInputs      (one)   — advisor-entered scores
  ├── AdvisorOverride        (many)  — DRS category adjustments
  ├── AddbackOverride        (many)  — EBITDA addback edits
  ├── EngagementSnapshot     (many)  — timeline checkpoints
  ├── EngagementProfile      (one)   — exit goals and buyer prefs
  ├── ScoreSnapshot          (many)  — historical DRS captures
  ├── BuyerQuestionState     (many)  — PE diligence Q prep
  └── CompanyInitiative      (many)  — value creation roadmap items

Platform tables (cross-company):
  ├── UserProfile            — Clerk user → ADVISOR | CLIENT role
  ├── UserSubscription       — Clerk user → Stripe subscription
  ├── ClientAccess           — invite-based company access
  ├── CompanyAccessGrant     — explicit access grants (client | associate)
  ├── CompanyEngagementBilling
  ├── DemoLink               — personalized demo link tracking
  ├── AppSetting             — key/value store (e.g. spots_remaining)
  ├── AICopilotUsage         — monthly token budgets per user
  ├── AdvisoryLibraryItem    — global catalog of questions/initiatives
  ├── MarketBenchmarkRelease — versioned peer benchmark data drops
  ├── MarketSegmentMetric    — industry × size segment medians
  └── MarketBenchmarkCache   — optional external API response cache
```

---

## Lineage mixin

All core entity tables (`RevenueStream`, `Customer`, `Employee`, `Expense`, `Contract`) inherit `LineageMixin`. These columns are on every such table:

| Column | Type | Description |
|--------|------|-------------|
| `source_file` | String(512) | Original filename that produced this row |
| `ingestion_id` | String(128) | UUID of the parent IngestionJob |
| `confidence_level` | Enum: HIGH \| MEDIUM \| LOW | P5 column mapping confidence |
| `ingested_at` | DateTime | Server timestamp of P11 commit |
| `reviewer_sign_off` | String(128) | Advisor user_id if manually reviewed |

---

## Enums

### `ConfidenceLevel`
`HIGH` · `MEDIUM` · `LOW`

### `RevenueType`
`RECURRING` · `SUBSCRIPTION` · `PROJECT` · `TRANSACTIONAL` · `OTHER`

### `ExpenseCategory`
`COGS` · `OPEX` · `OWNER` · `PERSONAL` · `ONE_TIME` · `RELATED_PARTY`

### `EmployeeStatus`
`ACTIVE` · `TERMINATED` · `CONTRACTOR`

### `UserRole`
`ADVISOR` · `CLIENT`

### `ClientAccessStatus`
`PENDING` · `ACCEPTED` · `REVOKED`

---

## Core entities

### Company

Table: `companies`

The root entity. Every other record is scoped by `company_id`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer PK | Auto-increment |
| `name` | String(256) | Company display name |
| `owner_user_id` | String(256) nullable | Clerk `sub` of the advisor who owns this engagement |
| `industry` | String(128) nullable | Industry label (e.g. "Field Services — Traffic Management") |
| `founded` | Integer nullable | Year founded |
| `ein` | String(32) nullable | EIN / tax ID |
| `state` | String(2) nullable | US state abbreviation |
| `entity_type` | String(32) nullable | LLC · S-Corp · C-Corp |
| `total_headcount` | Integer nullable | Advisor-entered override; used when payroll data is absent |
| `market_rate_replacement_annual` | Numeric(14,2) nullable | Market-rate owner replacement salary (A2 addback) |
| `depreciation_amortization_ttm` | Numeric(14,2) nullable | Advisor-entered D&A (A2 addback) |
| `interest_expense_ttm` | Numeric(14,2) nullable | Advisor-entered interest (A2 addback) |
| `income_tax_expense_ttm` | Numeric(14,2) nullable | Advisor-entered taxes (A2 addback) |
| `report_firm_name` | String(256) nullable | Advisor firm name for report branding |
| `report_cover_blurb` | Text nullable | Custom cover page text |
| `report_logo_url` | String(512) nullable | URL of firm logo |

Relationships: `revenue_streams`, `customers`, `employees`, `expenses`, `contracts`

---

### RevenueStream

Table: `revenue_streams`

One row per revenue recognition event (monthly or annual, depending on source data granularity).

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer PK | |
| `company_id` | FK → companies | |
| `customer_id` | FK → customers nullable | Linked customer entity |
| `revenue_gross` | Numeric(14,2) | Gross revenue amount |
| `revenue_type` | RevenueType | Classification (RECURRING, PROJECT, etc.) |
| `recurring_flag` | Boolean | True if contractually recurring |
| `revenue_period` | Date | Period this revenue belongs to (first day of month) |
| `description` | Text nullable | Line item description from source data |
| + LineageMixin columns | | |

Used by: A1 (metric computation), A3 (revenue quality), A5 (customer risk/concentration).

---

### Customer

Table: `customers`

Deduplicated customer entity (output of P9 entity resolution).

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer PK | |
| `company_id` | FK → companies | |
| `name` | String(256) | Resolved customer name |
| `tenure_start` | Date nullable | Earliest revenue date with this customer |
| `industry` | String(128) nullable | Customer's industry (if known) |
| `owner_contact` | String(256) nullable | Key relationship contact name |
| `is_active` | Boolean | False if churned |
| + LineageMixin columns | | |

Relationships: `revenue_streams`, `contracts`

---

### Employee

Table: `employees`

One row per person on payroll or roster.

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer PK | |
| `company_id` | FK → companies | |
| `name` | String(256) | |
| `role` | String(128) nullable | Job title |
| `department` | String(128) nullable | |
| `hire_date` | Date nullable | |
| `status` | EmployeeStatus | ACTIVE · TERMINATED · CONTRACTOR |
| `comp_annual` | Numeric(12,2) nullable | Total annual compensation |
| `is_owner` | Boolean | Owner / founder flag |
| `is_key_person` | Boolean | Key person dependency flag (A4) |
| `management_level` | Integer nullable | 0=owner, 1=VP/director, 2=manager |
| + LineageMixin columns | | |

Used by: A4 (operational independence), A6 (management & team).

---

### Expense

Table: `expenses`

One row per expense line item from the P&L.

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer PK | |
| `company_id` | FK → companies | |
| `amount` | Numeric(14,2) | Positive dollar amount |
| `category` | ExpenseCategory | COGS · OPEX · OWNER · PERSONAL · ONE_TIME · RELATED_PARTY |
| `description` | Text nullable | Vendor/memo from source data |
| `period` | Date | Expense period (first day of month) |
| `vendor` | String(256) nullable | Payee / vendor name |
| `is_recurring` | Boolean | False for one-time items |
| + LineageMixin columns | | |

Used by: A2 (EBITDA recast — `OWNER`, `PERSONAL`, `ONE_TIME`, `RELATED_PARTY` are addback candidates), A8 (financial integrity).

---

### Contract

Table: `contracts`

Formal agreements between the company and a customer.

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer PK | |
| `company_id` | FK → companies | |
| `customer_id` | FK → customers nullable | |
| `start_date` | Date nullable | |
| `end_date` | Date nullable | |
| `annual_value` | Numeric(14,2) nullable | Contracted annual revenue |
| `contract_type` | String(64) nullable | e.g. MSA, retainer, project |
| `is_active` | Boolean | |
| `renewal_confirmed` | Boolean | True if renewal agreed in writing |
| `document_path` | String(512) nullable | Path to uploaded contract file |
| + LineageMixin columns | | |

Used by: A3 (revenue quality — contract coverage %), A5 (customer risk).

---

## Advisor input tables

### QualitativeInputs

Table: `qualitative_inputs` · One row per company (unique constraint)

Advisor-entered scores that supplement ingested financial data. These drive Blueprint II sub-scores that cannot be computed from numbers alone.

| Column | Type | Range | Used by |
|--------|------|-------|---------|
| `owner_hours_per_week` | Numeric(5,1) | 0–80 | A4 operational independence |
| `sop_pct` | Numeric(5,1) | 0–100% | A4 |
| `automation_pct` | Numeric(5,1) | 0–100% | A4 |
| `mgmt_qualified` | Integer | count | A6 management |
| `mgmt_total_functions` | Integer | count | A6 |
| `pipeline_value` | Numeric(14,2) | $ | A7 growth drivers |
| `market_positioning` | String(32) | defined\|moderate\|undifferentiated | A7 |
| `repeatability_pct` | Numeric(5,1) | 0–100% | A7 |
| `contract_pct` | Numeric(5,1) | 0–100% | A3 revenue quality |
| `customer_contract_type` | String(32) | project\|retainer\|msa\|mix | A3 |
| `key_person_revenue_pct` | Numeric(5,1) | 0–100% | A4 |
| `mgmt_covered_functions` | String(256) | comma-separated IDs | A6 |

---

### AdvisorOverride

Table: `advisor_overrides`

Point-in-time DRS category adjustments made by an advisor (e.g. "add 5 points to revenue quality because of verbal multi-year renewal").

| Column | Type | Description |
|--------|------|-------------|
| `company_id` | FK → companies | |
| `category` | String(64) | DRS category key (e.g. `revenue_quality`) |
| `adjustment` | Numeric(6,2) | −20 to +20 |
| `rationale` | Text | Advisor's written justification |
| `advisor_id` | String(256) nullable | Clerk sub of advisor |

---

### AddbackOverride

Table: `addback_overrides`

Advisor edits to the auto-detected EBITDA addback schedule.

| Column | Type | Description |
|--------|------|-------------|
| `addback_key` | String(128) | e.g. `owner_comp`, `custom_abc` |
| `description` | String(256) | Display label |
| `amount` | Numeric(14,2) | Dollar amount |
| `challenge` | String(32) | LOW \| MEDIUM \| HIGH \| NOT_DEFENSIBLE |
| `category` | String(64) | Addback category |
| `documented` | Boolean | Supporting documentation uploaded |
| `is_custom` | Boolean | True = advisor-added line (not from expense data) |

---

## Engagement tracking tables

### EngagementSnapshot

Table: `engagement_snapshots`

Timeline checkpoints storing DRS and EV at each engagement milestone (onboarding, data collection, baseline, etc.).

| Column | Type | Description |
|--------|------|-------------|
| `milestone` | String(256) | Display label |
| `stage` | String(64) | onboarding \| data_collection \| baseline \| optimization \| exit_ready |
| `status` | String(32) | complete \| current \| projected |
| `drs` | Numeric(6,2) nullable | |
| `ebitda` | Numeric(14,2) nullable | |
| `ev_floor` / `ev_ceiling` / `ev_midpoint` | Numeric(14,2) | |
| `multiple_floor` / `multiple_ceiling` | Numeric(6,3) | |

### EngagementProfile

Table: `engagement_profiles` · One row per company

Owner goals, exit horizon, valuation targets, and buyer preferences captured during intake.

Key fields: `owner_goals_narrative`, `exit_timeline`, `target_valuation`, `personal_financial_gap`, `transaction_type`, `preferred_buyer_types_json`, `post_exit_plans`, `non_negotiables`.

### ScoreSnapshot

Table: `score_snapshots`

Point-in-time DRS + EV captures written on each DRS fetch and on advisor override saves. Powers the DRS trend chart.

### BuyerQuestionState

Table: `buyer_question_states`

Per-company tracking of PE diligence question responses (status: open · drafted · reviewed · closed), AI-drafted answers, and mitigating initiative linkage.

### CompanyInitiative

Table: `company_initiatives`

Value creation roadmap items, either system-generated (A12) or advisor-added.

| Column | Type | Description |
|--------|------|-------------|
| `title` | String(512) | |
| `category` | String(64) nullable | DRS category this initiative addresses |
| `timeline` | String(128) nullable | e.g. "0–6 months" |
| `cost_estimate` | Numeric(14,2) nullable | |
| `ev_impact_estimate` | Numeric(14,2) nullable | System-computed EV impact |
| `advisor_ev_override` | Numeric(14,2) nullable | Advisor-adjusted EV impact |
| `source` | String(32) | `system` \| `custom` |

---

## Platform / billing tables

### UserProfile
Links Clerk `user_id` to role: `ADVISOR` or `CLIENT`.

### UserSubscription
Tracks Stripe subscription per Clerk user. Fields: `tier` (founding \| pro \| team), `status` (active \| cancelled \| inactive \| past_due \| paused), `billing_interval`, `max_companies`.

### ClientAccess
Invite-based workflow linking a business-owner (`CLIENT`) to a specific company. States: `PENDING → ACCEPTED → REVOKED`.

### CompanyAccessGrant
Explicit access grants: `client` (read-only) or `associate` (firm advisor).

### CompanyEngagementBilling
Tracks whether each company counts as `included` (within plan limit) or `add_on` (overage).

### DemoLink
Personalized demo link tracking: `slug`, `recipient_*`, `visit_count`, `sections_viewed`, `converted`.

### AppSetting
Key/value store. Current usage: `spots_remaining` (demo access gate).

### AICopilotUsage
Monthly token budget enforcement per user. PK is `(user_id, month)`.

---

## Advisory library and market data

### AdvisoryLibraryItem
Global reusable catalog. `item_type`: `buyer_question` · `initiative` · `risk_flag`.
Tagged by `category` (DRS key), `severity` (CRITICAL \| HIGH \| MEDIUM), `buyer_type` (PE \| Strategic \| Financial \| All).

### MarketBenchmarkRelease + MarketSegmentMetric
Versioned peer benchmark data (IBBA-curated, PitchBook aggregates). `MarketSegmentMetric` stores medians by `industry_slug × ebitda_band_label`:
- `revenue_growth_median_pct`
- `ebitda_margin_median_pct`
- `payroll_ratio_median_pct`
- `recurring_rev_median_pct`
- `top_customer_conc_median_pct`
- `market_ebitda_multiple_floor` / `_ceiling`

### MarketBenchmarkCache
Optional server-side cache for external API responses (PitchBook, etc.).

---

## Multi-tenancy note

Every API route uses `Depends(get_company_scope)` from `backend/app/api/deps.py`. This dependency resolves the `company_id` from the JWT and raises 403 if the requesting user does not own or have a grant to the requested company. **Never query company-scoped tables without this dependency in place.**

---

## Schema migrations

All schema changes use Alembic. Never call `Base.metadata.create_all()` directly in production code.

```bash
# Create a new migration
cd backend
alembic revision --autogenerate -m "describe the change"

# Apply migrations
alembic upgrade head

# Check for unapplied changes
alembic check
```

Current migration chain: `0001_initial_schema → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008 → 0009 → 0010_user_roles_client_access` (with `0010_client_advisor_attribution` as a parallel branch — see KI-001 in `KNOWN_ISSUES.md`).
