# Architecture Decisions — Baked-in Assumptions

Every silent decision this prototype has committed to, made explicit. For each: **what** it is, **where** it lives, whether it **helps or constrains** the target (engagement-centric, Supabase/Postgres + React + Claude + n8n, with a WM strategic layer), and **cost to reverse** (Low = hours, Medium = days, High = weeks / touches many files, Very High = foundational rewrite).

---

### AD-1 — The `Company` row is the universal unit (client = engagement = tenant)
- **What:** Everything scopes to `companies.id`. There is no client, engagement, or advisor entity. One company = one client business = one exit-planning engagement.
- **Where:** `ontology/models.py` (Company + ~25 satellites), `api/deps.py` (`company_id` is the scope key), every route signature (`/{company_id}` in the path).
- **Help/constrain:** **Constrains hard.** The target's unit is the multi-assessment engagement. This assumption is threaded through the DB, the API URL structure, the frontend `CompanyContext`, and React Query keys (`['company', companyId]`). It blocks two engagements per business and cross-version deltas.
- **Cost to reverse:** **Very High.** Schema migration (AD-9) + API path redesign + frontend context refactor. It is *the* central decision.

### AD-2 — Tenant isolation is app-layer, not database-enforced
- **What:** No RLS, no Supabase. Isolation = every route remembering `Depends(get_company_scope)`. `owner_user_id IS NULL` means world-readable (for demo).
- **Where:** `api/deps.py`, enforced by convention in all 21 routers.
- **Help/constrain:** **Constrains.** Target stack is Supabase/Postgres where RLS is idiomatic and safer. Current model is one forgotten dependency away from a cross-tenant leak, and the "NULL owner = public" rule is a foot-gun if ported naively.
- **Cost to reverse:** **High.** Re-expressing access tiers (owner/associate/client/legacy) as RLS policies + moving auth identity into Postgres (`auth.uid()`), or keeping app-layer and hardening it. Either way touches every table's access story.

### AD-3 — Auth is Clerk, identity is an opaque string
- **What:** Users are Clerk subs (`String(256)`) stored directly on rows (`owner_user_id`, `advisor_id`, `invited_by_user_id`, …). Prod RS256/JWKS, dev HS256 fallback.
- **Where:** `middleware/auth.py`, `ontology/models.py` (string user columns everywhere), `frontend/.../ClerkAuthBridge.jsx`.
- **Help/constrain:** **Mixed.** Clerk is solid and the dev/prod split is clean. But identity-as-string (no `users`/`advisors` table) means no referential integrity on people, no easy firm hierarchy, and a migration off Clerk (Supabase Auth is the target's natural choice) would require rewriting `middleware/auth.py` and reconciling every string user column.
- **Cost to reverse (Clerk→Supabase Auth):** **High.** Token verification swap is Medium; the identity-model cleanup is what makes it High.

### AD-4 — Scores are computed on read, never persisted as versions
- **What:** DRS/EV/category scores are recomputed live from ingested data + `qualitative_inputs` + overrides on every request (`analytics_service.compute_category_modules` → `compute_drs`). Only opportunistic snapshots (`score_snapshots`, `engagement_snapshots`) are stored, as a trend log.
- **Where:** `analytics/a1…a14`, `services/analytics_service.py`, `routes/analytics.py`, `routes/reports.py`.
- **Help/constrain:** **Constrains** the versioning + regression-fixture requirement. Byte-identical fixtures presuppose a *stored, immutable* assessment payload; compute-on-read gives a different answer whenever inputs, weights, or code change. Also makes cross-version deltas impossible without reconstructing past inputs.
- **Cost to reverse:** **High.** Add a persist-on-assess step writing immutable `assessment_version` rows; rework the frontend to read stored versions instead of always recomputing.

### AD-5 — This repo owns a competing scoring engine
- **What:** A full 6-category DRS engine with weights, tiers, EV multiples, buyer-profile reweighting, and confidence bands lives here (`scoring_rules.py`, `a9_drs_composite.py`, `a1…a14`). The donor repo's canonical engine (32 sub-scores, 3 fixtures) is a *different* implementation of the same concept.
- **Where:** `backend/app/analytics/`, `backend/app/core/scoring_rules.py`, `backend/app/core/confidence.py`.
- **Help/constrain:** **Both.** Helps: the *contract* around scoring (a `CategoryScores` dataclass of 6 floats → `DRSResult`) is clean and centralized, so a replacement engine has an obvious seam. Constrains: the whole UI + PDF + copilot + value-gap + buyer-questions stack is hardwired to **six categories** and the `.composite`/`.details`/`.data_confidence` module shape. A 32-sub-score engine that rolls up to 6 dimensions slots in; one that doesn't roll up to these exact 6 forces UI rework.
- **Cost to reverse (displace with donor engine):** **Medium–High.** Contained if the donor engine exposes a 6-dimension rollup; High if the dimension taxonomy differs.

### AD-6 — Frontend/backend contract: REST, per-company URLs, JWT-in-header, FastAPI `detail` errors
- **What:** SPA calls `/api/<domain>/<company_id>/…`; `apiClient` injects Clerk JWT and unwraps `{detail}` into typed `ApiError`; React Query owns caching.
- **Where:** `frontend/src/lib/apiClient.js`, all pages.
- **Help/constrain:** **Neutral-to-helpful.** A conventional, portable contract. The only coupling is the `company_id`-in-path convention (see AD-1) and same-origin static serving.
- **Cost to reverse:** **Low–Medium** (mostly find/replace of the id key if AD-1 changes).

### AD-7 — Dashboard views assume a specific score shape (6 categories, band triplet, tiers)
- **What:** Pages, radar charts, PDF score bars, and value-gap all expect exactly: `revenue_quality, financial_integrity, operational_independence, customer_risk, management_team, growth_drivers`, each 0–100, plus a `{conservative, base, optimistic}` band and a 5-tier label (Foundation→Institutional).
- **Where:** `lib/drsCategoryColors.js`, `Readiness.jsx`, `ValueGap.jsx`, `BuyerLens.jsx`, `a14_report_generator.py`, `a11_value_gap.py`, `a9_drs_composite.py`.
- **Help/constrain:** **Constrains** integration of any engine whose output isn't these 6 dimensions + band + these tiers. This is the concrete answer to "would the DRS engine's output slot in?": **yes if it emits these 6 rolled-up dimensions and a base/low/high band; otherwise the dashboard and PDF need reshaping.**
- **Cost to reverse:** **Medium** (category list + colors + chart configs + PDF bars are enumerable but spread across ~8 files).

### AD-8 — Orchestration is in-process FastAPI, not n8n / queue / cron
- **What:** Async work = `BackgroundTasks` (ingestion P3–P11) + a lifespan bootstrap thread. No queue, no scheduler, no n8n. QuickBooks OAuth CSRF state is an in-process dict.
- **Where:** `routes/ingestion.py`, `main.py` lifespan, `integrations/quickbooks/auth.py` (`_OAUTH_STATE`).
- **Help/constrain:** **Constrains** the target's n8n-centric automation and the WM cadence-trigger requirement (which wants event-driven, out-of-band workflows). Also a scaling constraint: in-process state breaks under multiple workers.
- **Cost to reverse (add n8n + eventing):** **Medium** — additive (emit webhooks/events from key state transitions), no teardown required, but there are currently **zero** emission points to build on.

### AD-9 — Alembic is the schema authority; migrations are healthy but the model is flat
- **What:** Linear Alembic chain `0001→0022`, `target_metadata=Base.metadata`, idempotent `if_not_exists`. History shows past drift (`0009_former_runtime_bootstrap`, `0015_missing_tables`) now reconciled.
- **Where:** `backend/alembic/`.
- **Help/constrain:** **Helps** — a clean, working migration surface makes the spine migration mechanical rather than risky.
- **Cost to reverse:** N/A (this is an asset). The *content* migration to the spine is High (see SCHEMA.md), but the *tooling* is ready.

### AD-10 — White-labeling is per-company, single-brand frontend
- **What:** Report branding = `Company.report_firm_name` + `report_logo_url` + a per-company logo file; frontend UI is one fixed brand.
- **Where:** `a14_report_generator.py` header, `services/company_logo_storage.py`, `Company` columns.
- **Help/constrain:** **Partially helps, mostly constrains** the WM branded-report requirement. The *plumbing* to stamp a logo + firm name onto a PDF exists (real asset). But branding lives on the *client* record, not on a firm/advisor — a WM branding 20 clients sets it 20×, and there is no per-firm theme for the on-screen app.
- **Cost to reverse:** **Medium** — introduce a firm/advisor brand entity and resolve branding from there.

### AD-11 — Reports are server-rendered fpdf2, Latin-1, hand-laid-out
- **What:** PDFs drawn imperatively with fpdf2; non-Latin-1 chars transliterated (`_safe`); no HTML/CSS report path; no diff/delta report type.
- **Where:** `analytics/a14_report_generator.py`.
- **Help/constrain:** **Mixed.** Helps: fully working server-side PDF with branding, KPI boxes, score bars, tables — a real starting point for the branded delta report. Constrains: fpdf2's manual layout is laborious for polished client-facing design; a "polished PDF" WM deliverable may want an HTML→PDF pipeline (Playwright/weasyprint) instead, and Latin-1 will mangle any non-Western client names.
- **Cost to reverse (to HTML→PDF):** **Medium**; adding a delta builder within fpdf2 is **Low–Medium**.

### AD-12 — Demo system is a frozen parallel surface baked into routing
- **What:** `/demo` + `/demo/:slug` reuse advisor page components through `DemoShell`, hardwired to company id=1, unauthenticated, seeded on startup.
- **Where:** `App.jsx` (two large route blocks), `layout/DemoShell.jsx`, `routes/demo.py`, `seed_abc_company.py`.
- **Help/constrain:** **Neutral, some drag.** Demonstrates the presentation layer works end-to-end (a plus), but doubles the routing surface and bakes "company 1 is special / NULL-owner is public" into both DB and UI. Carrying it into the survivor adds dead weight if not pruned.
- **Cost to reverse (remove):** **Low–Medium.**

### AD-13 — Billing/growth machinery is deeply integrated (Stripe, referrals, firms, partners)
- **What:** Full Stripe checkout + webhook lifecycle, founding-spot scarcity, per-engagement overage billing, referral credits, channel partners, firm seats.
- **Where:** `routes/payments.py`, `routes/webhooks.py`, `routes/referrals.py`, `routes/firms.py`, `routes/partners.py`, `core/db_functions.py`, ~6 tables.
- **Help/constrain:** **Mixed.** Helps if the survivor keeps this commercial model (it's real, tested — 27 webhook tests). Constrains if the target's go-to-market differs (WM/advisor channel), since it's woven into the tenant model (`user_subscriptions.max_companies`, `company_engagement_billing`).
- **Cost to reverse:** **Medium** (self-contained routers, but the tenant/plan coupling leaks into company creation limits).

### AD-14 — Config is env-var + pydantic-settings with fail-fast prod validation
- **What:** ~90 typed settings; production startup rejects insecure/missing config; self-heals Railway secret placeholders.
- **Where:** `core/config.py`, `main.py` (`_validate_production_config`, `_check_db_connectivity`).
- **Help/constrain:** **Helps.** Portable, safe, no vault dependency. Directly reusable in any survivor.
- **Cost to reverse:** N/A (asset).

### AD-15 — Tests run against stubbed deps and mock DBs
- **What:** `conftest.py` stubs absent libraries and the DB layer so `pytest` runs "minimal"; tests exercise pure logic, not a live Postgres.
- **Where:** `backend/tests/conftest.py`, all test files.
- **Help/constrain:** **Constrains confidence.** 140 green tests look reassuring but prove almost nothing about DB behavior, RLS, migrations applying, or multi-tenant isolation under a real engine. Any survivor decision leaning on "it's well-tested" should discount accordingly.
- **Cost to reverse (add real integration tests):** **Medium.**

---

## Hardcoded values worth surfacing
- **Company id = 1** ("ABC Company Inc") is special-cased in bootstrap, demo, and valuation (`DEMO_CANONICAL_VALUATION`).
- **Six category keys + weights** hardcoded in `scoring_rules.py` and echoed in frontend `drsCategoryColors.js` (two sources of truth for the category taxonomy).
- **Brand fallbacks** "FRACTURE SYSTEMS" / "Exit Blueprint" / "Pre-Diligence Platform API" — three names across layers.
- **EV snapshot multiple 4.5×** hardcoded in `reports.py` `_snapshot_ev`.
- **`engagement_snapshots.date`** stored as a human display string, not a date.
- **QuickBooks tokens** stored plaintext; **CSRF state** in-process only.
</content>
