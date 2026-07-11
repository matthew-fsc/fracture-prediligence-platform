# Schema — Complete Data Model

**Source of truth:** SQLAlchemy models in `backend/app/ontology/models.py` and `backend/app/ontology/ingestion_models.py`, mirrored by Alembic migrations `0001…0022` (`target_metadata = Base.metadata`). Column types below are as declared in the ORM. There are **no Postgres RLS policies** (see commentary). 38 tables total.

Conventions:
- All PKs are `Integer autoincrement` unless noted.
- "Clerk sub" = external Clerk user id stored as `String(256)`.
- `LineageMixin` (on the six ontology entities) adds: `source_file String(512)`, `ingestion_id String(128)`, `confidence_level String(16)="MEDIUM"`, `ingested_at DateTime=now()`, `reviewer_sign_off String(128)`.

---

## A. Ontology entities (Blueprint I output — carry `LineageMixin`)

### `companies` — the tenant root & unit of everything
| Column | Type | Notes |
|---|---|---|
| id | Integer PK | |
| name | String(256) | |
| owner_user_id | String(256), nullable, **indexed** | Clerk sub. **NULL = unowned/demo (world-readable).** Tenant boundary. |
| industry | String(128) | |
| founded | Integer | |
| ein | String(32) | |
| state | String(2) | |
| entity_type | String(32) | LLC / S-Corp / C-Corp |
| total_headcount | Integer, nullable | advisor override |
| market_rate_replacement_annual | Numeric(14,2), nullable | normalization input |
| depreciation_amortization_ttm | Numeric(14,2), nullable | |
| interest_expense_ttm | Numeric(14,2), nullable | |
| income_tax_expense_ttm | Numeric(14,2), nullable | |
| naics_code | String(8), nullable | |
| sic_code | String(4), nullable | |
| report_firm_name | String(256), nullable | **white-label (per company)** |
| report_cover_blurb | Text, nullable | |
| report_logo_url | String(512), nullable | **white-label (per company)** |
| owner_onboarding_completed_at | DateTime, nullable | |

Relationships: `revenue_streams`, `customers`, `employees`, `expenses`, `contracts`.
**No FK to any firm/advisor/engagement.** Ownership is a bare string column.

### `revenue_streams`
`id` PK · `company_id` FK→companies · `customer_id` FK→customers (nullable) · `revenue_gross Numeric(14,2)` · `revenue_type String(32)` · `recurring_flag Boolean=false` · `revenue_period Date` · `description Text` · +lineage.

### `customers`
`id` PK · `company_id` FK→companies · `name String(256)` · `tenure_start Date` · `industry String(128)` · `owner_contact String(256)` · `is_active Boolean=true` · +lineage.

### `employees`
`id` PK · `company_id` FK→companies · `name` · `role` · `department` · `hire_date Date` · `status String(16)=ACTIVE` · `comp_annual Numeric(12,2)` · `is_owner Boolean` · `is_key_person Boolean` · `management_level Integer` (0=owner,1=VP,2=mgr) · +lineage.

### `expenses`
`id` PK · `company_id` FK→companies · `amount Numeric(14,2)` · `category String(32)` (COGS/OPEX/OWNER/PERSONAL/ONE_TIME/RELATED_PARTY) · `description Text` · `period Date` · `vendor String(256)` · `is_recurring Boolean=true` · +lineage.

### `contracts`
`id` PK · `company_id` FK→companies · `customer_id` FK→customers (nullable) · `start_date Date` · `end_date Date` · `annual_value Numeric(14,2)` · `contract_type String(64)` · `is_active Boolean=true` · `renewal_confirmed Boolean=false` · `document_path String(512)` · +lineage.

---

## B. Ingestion tracking

### `ingestion_jobs`
`id` PK · `company_id` FK→companies · `ingestion_id String(128) unique idx` · `filename String(512)` · `source_type String(64)` · `file_path String(1024)` · `file_hash String(64)` (SHA-256) · `file_size Integer` · `current_phase String(32)=P1_INTAKE` · `current_status String(32)=PENDING` · `validation_report JSON` · `schema_profile JSON` · `column_mappings JSON` · `extraction_errors JSON` · `row_count/mapped_count/error_count Integer` · `created_at/updated_at/completed_at DateTime`.

---

## C. Scoring / advisory layer (per company, 1:1 or 1:N)

### `advisor_overrides`
`id` PK · `company_id` FK (idx) · `category String(64)` · `adjustment Numeric(6,2)` (-20..+20) · `rationale Text` · `advisor_id String(256)` · `created_at/updated_at`.

### `qualitative_inputs` — **single row per company** (`company_id unique idx`)
~20 interview fields: `owner_hours_per_week`, `sop_pct`, `automation_pct`, `mgmt_qualified`, `mgmt_total_functions`, `pipeline_value`, `market_positioning`, `repeatability_pct`, `contract_pct`, `customer_contract_type`, `key_person_revenue_pct`, `mgmt_covered_functions`, `has_crm_pipeline`, `non_compete_pct`, `voluntary_turnover`, `comp_vs_market`, `updated_at`. **Overwritten in place** (no versioning here — history captured separately in `qualitative_input_audits`).

### `qualitative_input_audits` — append-only
`id` PK · `company_id` FK (idx) · `advisor_id String(256)` · `snapshot_json Text` · `created_at`.

### `addback_overrides`
`id` PK · `company_id` FK (idx) · `addback_key String(128)` · `description` · `amount Numeric(14,2)` · `challenge String(32)` (LOW/MEDIUM/HIGH/NOT_DEFENSIBLE) · `category` · `documented Boolean` · `notes/rationale Text` · `advisor_id` · `is_custom Boolean` · `updated_at`.

### `engagement_snapshots` — timeline checkpoints
`id` PK · `company_id` FK (idx) · `milestone String(256)` · `date String(64)` (display string!) · `stage String(64)` · `status String(32)` (complete/current/projected) · `drs/drs_tier` · `ebitda` · `ev_floor/ceiling/midpoint` · `multiple_floor/ceiling` · `notes` · `sort_order` · `created_at`.

### `score_snapshots` — append-only DRS/EV history
`id` PK · `company_id` FK (idx) · `drs_score Numeric(6,2)` · `ev_estimate Numeric(16,2)` · `trigger String(64)` (manual/override/report) · `category_scores_json Text` · `created_at (indexed)`.

### `generated_reports`
`id` PK · `company_id` FK (idx) · `template_id String(64)` · `drs_score` · `ev_at_generation` · `created_at`.

### `buyer_question_states`
`id` PK · `company_id` FK (idx) · `question_id Integer` · `status String(32)=open` · `response_text Text` · `answer_draft Text` · `ai_draft_generated_at` · `reviewed_by String(256)` · `mitigating_initiative_id Integer` · `updated_at`.

### `company_initiatives` — value-creation roadmap items
`id` PK · `company_id` FK (idx) · `title String(512)` · `category` · `status String(32)=planned` · `timeline` · `cost_estimate` · `ev_impact_estimate` · `advisor_ev_override` · `depends_on_initiative_id` FK→company_initiatives (self) · `source String(32)=custom` · `created_at` · `phase Integer` (1/2/3) · `estimated_drs_impact Numeric(6,2)` · `target_completion_date/actual_completion_date Date` · `drs_category_key String(64)`.

### `engagement_profiles` — intake (1:1, `company_id unique idx`)
goals narrative, exit_timeline, target_valuation, personal_financial_gap, transaction_type, buyer_universe_notes, preferred_buyer_types_json, owner_motivations_json, post_exit_plans, non_negotiables, engagement_start_date, `advisor_id String(256)`, updated_at.

### `engagement_plans` — top-level plan (1:1, `company_id unique idx`)
`target_exit_date Date` · `target_drs Numeric(6,2)` · `current_phase Integer=1` · `created_at/updated_at`.

### `deal_outcomes` — **the "outcomes" layer** (1:1, `company_id unique idx`)
`deal_status String(32)=in_process` (in_process/closed/fallen_through/on_hold) · `close_date` · `sale_price Numeric(18,2)` · `actual_ev` · `ebitda_at_close` · `ev_multiple` · `buyer_type` · `buyer_name` · `deal_structure` · `drs_at_close` · `predicted_ev_floor/ceiling` · `days_to_close` · `advisor_notes` · `is_benchmark_eligible Boolean=true` · `created_at/updated_at`.

---

## D. Reference / curated data

### `advisory_library_items`
`id` PK · `item_type String(32) idx` (buyer_question/initiative/risk_flag) · `title String(1024)` · `description` · `category String(64) idx` · `severity` · `buyer_type` · `tags_json` · `data_needed` · `score_trigger` · `effort` · `timeline` · `ev_impact` · `source String(32)=system` · `is_active Boolean idx` · `created_at/updated_at`.

### `market_benchmark_releases`
`id` PK · `source_type String(32)` · `label` · `as_of_date Date` · `doc_ref` · `created_at`.

### `market_segment_metrics`
`id` PK · `release_id` FK→market_benchmark_releases (idx) · `industry_slug idx` · `industry_display_name` · `ebitda_band_label/min/max` · `peer_count` · medians (`revenue_growth`, `ebitda_margin`, `payroll_ratio`, `recurring_rev`, `top_customer_conc`) · `market_ebitda_multiple_floor/ceiling` · `wacc_estimate_pct` · `naics_codes String(256)`.

### `market_benchmark_cache`
`id` PK · `cache_key String(512) unique idx` · `payload_json Text` · `expires_at DateTime idx` · `created_at`.

### `buyer_universe_releases`
`id` PK · `source_type String(32)` · `label` · `as_of_date` · `created_at`.

### `active_acquirers`
`id` PK · `release_id` FK→buyer_universe_releases (idx) · `name` · `buyer_type String(16) idx` (pe/strategic/financial) · `hq_state` · `preferred_industries String(512)` · `ebitda_min_m/max_m` · `ev_min_m/max_m` · `investment_thesis` · `hold_period_years` · `portfolio_count` · `notable_platforms` · `source_note` · `is_active Boolean`.

---

## E. Identity, access, billing, growth

### `user_profiles`
`id` PK · `user_id String(256) unique idx` (Clerk sub) · `role String(32)` (ADVISOR/CLIENT) · `created_at/updated_at`.

### `client_access` — legacy invite linkage
`id` PK · `company_id` FK (idx) · `invited_by_user_id String(256)` · `invite_email String(256) idx` · `invite_token String(128) unique idx` · `client_user_id String(256) idx` (set on accept) · `status String(32)=PENDING` · `created_at/accepted_at`.

### `company_access_grants` — current sharing model
`id` PK · `company_id` FK (idx) · `user_id String(256) idx` (grantee Clerk sub) · `role String(32)` (client/associate) · `granted_by String(256)` · `is_active Boolean=true` · `granted_at`.

### `user_subscriptions`
`id` PK · `user_id String(256) unique idx` · `stripe_customer_id` · `stripe_subscription_id` · `tier String(64)` (founding/pro/team) · `status String(64)=inactive` · `billing_interval String(16)=monthly` · `max_companies Integer=10` · `created_at/updated_at`.

### `company_engagement_billing`
`id` PK · `company_id` FK (unique idx) · `user_id String(256) idx` · `billing_status String(16)=included` (included/add_on) · `stripe_subscription_item_id` · `created_at`.

### `ai_copilot_usage` — **composite PK (`user_id`, `month`)**
`user_id String(256) PK` · `month String(7) PK` (YYYY-MM) · `tokens_input/output Integer` · `request_count Integer` · `last_request_at`.

### `advisor_firms`
`id` PK · `name` · `owner_user_id String(256) unique idx` · `subscription_user_id String(256) idx` · `max_seats Integer=5` · `created_at`. **No FK to companies or advisors — association is by convention via `CompanyAccessGrant`.**

### `referral_codes`
`id` PK · `code String(64) unique idx` · `owner_user_id String(256) unique idx` · `total_clicks/total_conversions Integer` · `credit_balance_cents Integer` · `created_at`.

### `referral_conversions`
`id` PK · `referral_code String(64) idx` · `converted_user_id String(256) idx` · `converted_at` · `credited_amount_cents` · `stripe_credit_applied Boolean`.

### `channel_partners`
`id` PK · `slug String(64) unique idx` · `name` · `logo_url` · `discount_pct Integer` · `stripe_coupon_id` · `is_active Boolean` · `created_at`.

### `qb_tokens` — **plaintext OAuth tokens**
`id` PK · `company_id` FK (unique idx) · `realm_id String(128)` · `access_token Text` · `refresh_token Text` · `expires_at` · `created_at/updated_at`.

### `demo_links`
`id` PK · `slug String(128) unique idx` · `recipient_name/firm/email` · `sender_note` · `created_at` · `visit_count` · `first_visited_at/last_visited_at` · `converted Boolean` · `ref_code` · `sections_viewed Text` (JSON).

### `app_settings`
`key String(128) PK` · `value Text`. K/V store (e.g. `spots_remaining`).

---

## Indexes (summary)
Explicit indexes on: `companies.owner_user_id`; every `company_id` FK column that declares `index=True` (most satellite tables); `ingestion_jobs.ingestion_id` (unique); unique keys on `user_profiles.user_id`, `user_subscriptions.user_id`, `client_access.invite_token`, `referral_codes.code`/`owner_user_id`, `advisor_firms.owner_user_id`, `channel_partners.slug`, `advisory_library_items.item_type`/`category`/`is_active`, `active_acquirers.buyer_type`, `score_snapshots.created_at`, `market_benchmark_cache.cache_key`/`expires_at`. Composite PK on `ai_copilot_usage(user_id, month)`.

## RLS policies
**None.** There is no Supabase and no Postgres row-level security. All tenant isolation is enforced in application code by `get_company_scope` / `get_company_write_scope` (`api/deps.py`). The database will happily return any row to any query that forgets the scope dependency.

---

## Commentary — fit against the engagement-centric spine

Target spine: **firm → advisor → client → engagement → assessment versions → outcomes.**
This schema is **company-centric and flat.** Mapping:

| Spine node | This repo | Verdict |
|---|---|---|
| **firm** | `advisor_firms` (billing-only; no FK to companies/advisors) | **Weak.** Exists but not load-bearing; firm membership is inferred from `CompanyAccessGrant.role='associate'`, not a firm FK. |
| **advisor** | Clerk sub in `Company.owner_user_id` + `advisor_id` string columns scattered on `engagement_profiles`, `advisor_overrides`, etc. | **Absent as an entity.** Advisors are bare strings, not rows. No `advisors` table. |
| **client** | `Company` (conflated) | **Conflated.** A client business = a `Company`. A person-client is a Clerk user via `client_access`/`company_access_grants`. The business-vs-relationship distinction doesn't exist. |
| **engagement** | `Company` + `engagement_plans`/`engagement_profiles` satellites | **Conflated.** There is exactly one engagement per company; you cannot model two engagements (e.g. 2024 baseline + 2027 re-engagement) for the same business without cloning the company. |
| **assessment versions** | **Missing.** Scores computed on read; `score_snapshots`/`engagement_snapshots` are trend logs, not immutable versioned assessments | **Absent.** No `assessment` entity, no version number, no supersede/correction semantics, no byte-stable stored result to diff. |
| **outcomes** | `deal_outcomes` (1:1 per company, append-ish) | **Present and decent.** Closest clean match; captures actual vs predicted. Still 1:1 to company, so multi-engagement outcomes collide. |

### What the schema *helps* with
- The **six ontology entities + lineage mixin** are a genuinely good normalized substrate for financial facts, with audit columns (`source_file`, `ingestion_id`, `confidence_level`) already present — exactly what an assessment engine wants to read.
- `deal_outcomes` already models the outcome-capture requirement.
- `score_snapshots` / `engagement_snapshots` prove the team *intends* longitudinal tracking; the plumbing (trigger tags, category JSON, EV bands) is a head-start.
- `advisory_library_items` gives a reusable catalog spine for questions/initiatives/risks.

### Where it *conflicts*
- **`company_id` is the universal foreign key.** ~25 tables hang off `companies.id`. The spine needs them to hang off `engagement_id` (and often `assessment_version_id`). Every one of those FKs is a migration.
- **No versioning primitive.** Cross-version deltas (a stated architectural requirement) have nothing to diff against — scores aren't persisted as versions, and `qualitative_inputs` is overwritten in place.
- **Ownership is a string, not a relationship.** `owner_user_id` can't express firm/advisor hierarchy, reassignment, or co-advisors cleanly (the `CompanyAccessGrant` bolt-on partially covers this).
- **`date` stored as display string** in `engagement_snapshots.date` (`String(64)`, "Mar 27, 2025") — a data-quality landmine for any delta/timeline computed server-side.

### What a migration to the spine would require (sketch)
1. Introduce real entities: `firms`, `advisors` (or reuse Clerk + a profile table with a firm FK), `clients` (the business), `engagements` (FK client, advisor, firm), `assessment_versions` (FK engagement, with version no. + immutable computed payload + supersede pointer).
2. Add `engagement_id` (and where relevant `assessment_version_id`) to all ~25 company-scoped satellites; backfill one engagement per existing company.
3. Repoint `deal_outcomes`, `score_snapshots`, `engagement_snapshots`, `qualitative_inputs`, `company_initiatives`, `buyer_question_states` from `company_id` to `engagement_id`.
4. Replace compute-on-read scoring with a **persist-on-assess** step that writes an immutable `assessment_version` row (prerequisite for byte-identical regression fixtures from the donor engine).
5. Add an `engagement_activity_log` table (absent today) for the WM activity-log requirement.
6. Introduce a real branding entity (firm/advisor level) to replace per-company `report_firm_name`/`report_logo_url`.

This is a **moderate-to-large migration** — the ORM is clean and Alembic is healthy, so it's mechanical, but it touches nearly every table and forces a scoring-persistence rearchitecture that the current compute-on-read design does not have.
</content>
