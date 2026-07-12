# Fracture Prediligence Platform — State-of-the-Art Systems Audit

> **Purpose.** This document is a complete inventory of the high-value systems in the
> current codebase, written so a *new* repository can rebuild each one in a cleaner,
> more efficient form without reverse-engineering the source. For every system it
> records: **what it does**, **how it works today**, **the IP worth preserving**,
> and **what to change on the rebuild**.
>
> Audience: the engineer(s) standing up the next-generation repo.
> Scope: the *live advisor system*. The frozen demo surface is intentionally excluded.

---

## 0. TL;DR — What must survive the rebuild

The platform's defensible IP is **not** the CRUD or the UI. It is five engines and the
data ontology that feeds them:

| # | System | Why it's the moat | Current location |
|---|--------|-------------------|------------------|
| 1 | **Ingestion + Ontology Auto-Mapping** | Turns any messy CSV/QuickBooks export into a canonical financial ontology with confidence scoring and human-in-the-loop review. This is the "core IP." | `backend/app/ingestion/` |
| 2 | **Auto-Fill Context** | The glue that makes every downstream surface populate itself from ingested data — copilot context, connector auto-pull, value-gap→initiatives, deal-outcome derivation. | scattered (see §2) |
| 3 | **Recast Engine (Defensible EBITDA)** | Converts reported financials into PE-grade EBITDA with a 3-scenario addback schedule and challenge-likelihood ratings. | `backend/app/analytics/a2_ebitda_recast.py`, `ebitda_basis.py` |
| 4 | **Advisory Library** | A unified, seedable catalog of buyer questions, value-creation initiatives, and risk flags — the productized advisor knowledge base. | `backend/app/api/routes/library.py`, `a13_buyer_questions.py` |
| 5 | **DRS / EV / Value-Gap scoring stack** | The analytic core: 6-category Diligence Readiness Score → tier → EBITDA multiple → enterprise value → $ value-gap. Everything else is presentation. | `backend/app/analytics/a1…a14`, `core/scoring_rules.py` |

Everything else (buyer universe, market benchmarks, deal-outcome calibration, engagement
tracker, multi-tenancy) is high-value connective tissue documented in §5.

**The single most important rebuild principle:** today these engines are recomputed
from raw ontology rows *on every request*, with no score persistence and a known
revenue double-counting hazard (§6). The rebuild should make scoring a **materialized,
versioned artifact** produced once per ingestion, not a per-request computation.

---

## 1. System Map

```
                         ┌─────────────────────────────────────────────┐
   Sources               │            INGESTION (Blueprint I)           │
   ─ CSV/XLSX upload  ──▶ │  P2 raw store → P3 validate → P4 profile →   │
   ─ QuickBooks OAuth ──▶ │  P5 map(ontology) → P6 extract → P7 rules →  │
                         │  P8 normalize → P9 dedupe → P10 relate →     │
                         │  P11 commit (with lineage)                   │
                         └───────────────────┬─────────────────────────┘
                                             ▼
                         ┌─────────────────────────────────────────────┐
                         │        CANONICAL ONTOLOGY (Postgres)         │
                         │  RevenueStream · Customer · Employee ·       │
                         │  Expense · Contract  (+ LineageMixin)        │
                         └───────────────────┬─────────────────────────┘
                                             ▼
   ┌───────────────────────── ANALYTIC ENGINE (Blueprint II) ─────────────────────────┐
   │ A1 metrics → A3..A8 category scores → A9 DRS → A10 EV → A11 value gap             │
   │ A2 EBITDA recast · A13 buyer questions · A14 report · buyer_universe · benchmarks │
   └───────────────────┬──────────────────────────────────────────────────────────────┘
                       ▼
   ┌──────────────── SURFACES ────────────────┐
   │ Copilot · Readiness · Valuation ·         │   ← all read scores live, per request
   │ ValueGap · BuyerLens · AdvisoryWorkflow · │
   │ AdvisoryLibrary · Reports · DealOutcome   │
   └───────────────────────────────────────────┘
```

- **Backend:** Python 3.12 / FastAPI / SQLAlchemy 2.0 / Alembic / PostgreSQL 16.
- **Frontend:** React 18 / Vite / Tailwind / TanStack Query / Recharts (36 page components).
- **AI:** Anthropic Claude, funneled through a single `call_claude()` client with prompt
  caching, retry, guardrails, and cost tracking.
- **Multi-tenancy:** every route scoped via `Depends(get_company_scope)`.

---

## 2. System 1 — Ingestion + Ontology Auto-Mapping  *(the core IP)*

### 2.1 What it does
Accepts an arbitrary tabular file (manual upload or serialized QuickBooks export) and
drives it through a **10-phase pipeline (P2–P11)** that ends with typed, deduplicated,
relationship-linked rows written to the canonical ontology with full audit lineage.

### 2.2 How it works today
Orchestrator: `ingestion/pipeline.py :: run_pipeline()`. Never call phases directly.

| Phase | File | Responsibility | Notable logic to preserve |
|-------|------|----------------|---------------------------|
| P2 | `p2_raw_storage.py` | Immutable file store + SHA-256 | Hash is the **idempotency key** (dupe uploads are skipped, see QB `_run_if_new`). |
| P3 | `p3_file_validation.py` | Structural/content checks, encoding + header-row detection, `source_system_hint`, quarantine | Returns `header_row_index` and `encoding` consumed by the loader. |
| P4 | `p4_schema_profiling.py` | Per-column statistical profile: inferred type, null rate, cardinality, min/max/mean, date-year distribution, currency/ID-like flags, pattern detection (email/phone/zip/account_code) | Profiles are the *input to mapping* — "mapping without profiling is a guess." |
| **P5** | **`p5_column_mapping.py`** | **The crown jewel.** Assigns each column to an ontology field or excludes it, with 0–100 confidence. | See §2.3. |
| P6 | `p6_row_extraction.py` | Typed row parsing per mapping | Tracks error/skip counts per row. |
| P7 | `p7_business_rules.py` | Domain validation; determines `entity_type` | Whole-batch rejection → QUARANTINED. |
| P8 | `p8_normalization.py` | Canonical formats, enum mapping, inferred values | |
| P9 | `p9_entity_resolution.py` | In-batch dedupe (fuzzy name + hash) | |
| P10 | `p10_relationship_mapping.py` | Links revenue/contracts → customers | |
| P11 | `p11_ontology_commit.py` | DB write with `created_at, updated_at, ingestion_id, source_file, confidence_level` | Audit columns on every ontology row (`LineageMixin`). |

**Status machine:** `RUNNING → SUCCESS | FAILED | QUARANTINED | AWAITING_REVIEW | COMPLETE`.
Mid-pipeline `_checkpoint(publish=True)` commits *only the job row* so a polling client
sees live progress (P3–P10 don't touch ontology tables; only P11 does).

**Human-in-the-loop:** if >50% of columns need review, the job halts at `AWAITING_REVIEW`.
The advisor edits mappings; `resume_pipeline_after_mapping_review()` rebuilds the
`ColumnMappingResult` from stored JSON and resumes at P6. Failed/quarantined jobs can be
re-run from the stored raw file via `rerun_pipeline_job()`.

### 2.3 P5 — the mapping engine (study this closely)
A layered matcher, cheapest-first, so the LLM is a last resort:

1. **Exclude** administrative columns (`row number`, `uuid`, `created by`, …).
2. **Score every ontology field** in `ONTOLOGY_REGISTRY` (30 fields across 5 entities:
   revenue_stream, customer, employee, expense, contract). Each field carries a synonym
   list *including QuickBooks-specific synonyms* (`txndate`, `customerref.name`, …).
   - Exact normalized match → 97
   - Substring match → 88
   - Fuzzy (`difflib` ratio ≥0.85) → ~0.9×ratio; weak fuzzy ≥0.70 → ~0.75×ratio
   - **+5 boost** when inferred type matches expected type.
3. **Value-based inference** when headers are weak (date+financial → period; positive
   currency → revenue; account-code pattern → expense category; high-cardinality text → name/ID).
4. **Claude-assisted** (`_claude_suggest_mapping`, Haiku, 128 tokens, cached system prompt)
   for truly ambiguous columns — only fires when steps 1–3 fail.
5. **Entity-context second pass:** votes on the dominant entity across confident mappings,
   then re-assigns borderline columns (within 10 pts) toward that entity to break ties.
6. **Wide-format (pivot) detection:** ≥3 headers matching `Jan 2024` / `Q1 2024` regex →
   reject with a "reformat to narrow/tall" message instead of silently corrupting.

Confidence <80 ⇒ `requires_review=True`. Every mapping keeps `alternative_fields`
(top-3 runners-up) for the review UI.

### 2.4 IP worth preserving
- The **layered, LLM-last matching strategy** — cheap, deterministic, auditable, and
  only pays for Claude on the hard 5%.
- The **`ONTOLOGY_REGISTRY` synonym library** (incl. QuickBooks field names) — this is
  hand-tuned domain knowledge that took real iteration.
- **Confidence-gated human review** + **resume-from-review** flow.
- **Wide-format detection** and the QuickBooks→CSV→same-pipeline trick (QB data enters
  `run_pipeline()` as serialized CSV bytes, so there is exactly one ingestion path).

### 2.5 Rebuild recommendations
- **Make the pipeline asynchronous & durable.** Today `run_pipeline()` runs inline in
  the request thread and commits the session synchronously. Move to a task queue
  (Celery/RQ/Arq or a durable workflow engine like Temporal) so large files don't block
  HTTP workers and phase progress is a real event stream.
- **Persist the profile + mapping as first-class rows,** not just JSON blobs on the job.
  This enables a *learning loop*: when an advisor overrides a mapping, feed that back to
  raise the synonym library's confidence (today overrides die in `job.column_mappings`).
- **Externalize the ontology registry** to a versioned config/table so non-engineers can
  extend synonyms without a deploy.
- **Idempotency by (company, content-hash, source_type)** should be a DB constraint, not
  an app-level pre-query (the QB path and the upload path re-implement it separately).
- Replace `difflib` with a vectorized matcher (rapidfuzz) + optional embedding similarity
  for header matching — same tiering, an order of magnitude faster on wide files.

---

## 3. System 2 — Auto-Fill Context

"Auto-fill context" is not one module; it is the pattern of **surfaces populating
themselves from ingested data + prior state** so advisors never start from a blank form.
Five distinct mechanisms implement it today:

| Mechanism | Location | What it auto-fills |
|-----------|----------|--------------------|
| **Copilot context builder** | `routes/copilot.py :: _build_context()` | Assembles a structured company brief (DRS + bands, 6 category scores w/ weights, defensible EBITDA, EV range + multiple basis, top value-gap items, engagement profile, qualitative inputs) and injects it as the *dynamic* half of a hybrid cached system prompt. |
| **Connector auto-pull** | `routes/quickbooks.py :: fetch_and_ingest()` | One click pulls 3 datasets (invoices→revenue, customers, P&L→expenses), serializes each to CSV, and runs the pipeline — with SHA-256 dupe-guard. Default window = last 3 years. |
| **Value-gap → initiatives** | `routes/engagement.py :: populate_from_value_gap()` | Generates phase-tagged improvement initiatives from the value-gap analysis (score <40→Phase 1, <65→Phase 2, else Phase 3), skipping categories that already have a `source='value_gap'` initiative. |
| **Deal-outcome derivation** | `routes/deal_outcomes.py` | Auto-derives `ev_multiple` (actual_ev/ebitda) and `days_to_close` (close_date − engagement_start) when not supplied. |
| **Category-score enrichment** | `routes/analytics.py :: enrich()` | Wraps each category module's `.to_dict()` with raw vs. confidence-adjusted composite + confidence band metadata for the frontend. |

### 3.1 IP worth preserving
- The **hybrid cached system prompt** (`make_hybrid_system`): static instructions +
  ontology glossary are cache-eligible (paid once per ~5-min TTL), dynamic company data
  is appended fresh. This is the right cost/latency shape for per-company chat.
- The **"one connector → same pipeline"** design keeps the surface area tiny.
- **Idempotent auto-populate** (skip-if-exists on a natural key) — the correct pattern
  for any generative fill.

### 3.2 Rebuild recommendations
- **Centralize context assembly.** `_build_context()` re-runs the *entire* analytics stack
  (category modules → DRS → EV → market ctx → value gap) inside a chat request, wrapped in
  a broad `try/except`. Replace with a single **`CompanySnapshot` service** that reads
  materialized scores (see §6) and is shared by copilot, workflow, reports, and the
  scorecard. One source of truth, no per-surface recompute.
- **Make auto-pull incremental** (store a QB sync cursor / last-synced timestamp) instead
  of always refetching 3 years and relying on content-hash to skip.
- Generalize the connector abstraction beyond QuickBooks (Xero, ADP/Gusto payroll, CRM)
  behind an `extractor → normalizer(CSV) → pipeline` interface that already exists for QB.

---

## 4. System 3 — Recast Engine (Defensible EBITDA)

### 4.1 What it does
Transforms reported net income into **PE-grade "defensible EBITDA"** with a full addback
schedule and three valuation scenarios.

### 4.2 How it works (`analytics/a2_ebitda_recast.py`)
1. **Build reported EBITDA:** `net_income + D&A + interest + taxes`.
2. **Owner-comp normalization** (always the first addback): `owner_total_comp − market_rate_replacement`.
3. **Additional addbacks** from inputs, each tagged with a `ChallengeLikelihood` and category
   (`owner_comp | personal | non_recurring | related_party | proforma`).
4. **Three scenarios** driven by challenge likelihood:
   - `LOW`  → in all three (conservative/base/aggressive)
   - `MEDIUM` → 0% conservative, **50% base**, 100% aggressive
   - `HIGH` → excluded from conservative, included in aggressive (flagged)
   - `NOT_DEFENSIBLE` → removed everywhere
5. `defensible_ebitda = base_ebitda`.

**Basis resolver (`analytics/ebitda_basis.py`):** bridges the ontology proxy EBITDA
(`compute_metrics().ebitda_ttm`) with advisor-entered D&A / interest / tax / market-rate
overrides stored on `Company`. `ebitda_normalized_ttm = proxy + D&A`. Default market-rate
replacement = **$120,000** when unset. This is the number EV, value-gap, and copilot all consume.

Persistence: `AddbackOverride` table lets advisors edit the schedule; `Company` carries
`depreciation_amortization_ttm`, `interest_expense_ttm`, `income_tax_expense_ttm`,
`market_rate_replacement_annual`.

### 4.3 IP worth preserving
- The **challenge-likelihood → scenario matrix.** This encodes how a Quality-of-Earnings
  analyst actually thinks (each addback survives at a different rate under scrutiny) and is
  the reason the number is "defensible." Keep it verbatim.
- The **owner-comp-first normalization** and the market-rate-replacement concept.
- Separation of **ontology-derived proxy** vs. **advisor overrides** in `ebitda_basis`.

### 4.4 Rebuild recommendations
- **Unify the two EBITDA paths.** `a2_ebitda_recast` (rich, scenario-based) and
  `ebitda_basis` (simple proxy+D&A) compute EBITDA differently and are consumed by
  different surfaces. Downstream (EV, value gap, copilot) mostly uses the *simpler*
  `ebitda_normalized_ttm`, so the sophisticated 3-scenario recast is under-leveraged.
  Pick one canonical `DefensibleEBITDA` object with `{conservative, base, aggressive,
  schedule[]}` and feed EV from it.
- Store addbacks as **structured rows with document links** (QofE needs a paper trail;
  the model already knows this — the copilot prompt lists required evidence). Make
  "documented" a real attachment, not a boolean.
- Move the `$120k` default and the MEDIUM=50% weights into `scoring_rules.py` so the
  recast is versioned alongside the DRS weights.

---

## 5. System 4 — Advisory Library + the scoring/analytics stack

### 5.1 Advisory Library (`routes/library.py`, model `AdvisoryLibraryItem`)
A single catalog table unifying three item types: **`buyer_question`, `initiative`,
`risk_flag`**, filterable by DRS category, severity, buyer type, source, and free-text.
Full CRUD + `/meta` (enum lists for the UI) + `seed_library_if_empty()` which populates
from code templates on first boot:
- **Buyer questions** seeded from `a13_buyer_questions._LIBRARY`.
- **Initiatives** seeded from an inline `INIT_LIBRARY` (per category: title/effort/timeline/ev_impact).
- **Risk flags** seeded from a curated high-severity list.

Each item has `source` = `system` (seeded) or `advisor` (user-created), so productized
knowledge and firm-specific additions coexist.

**Buyer-question engine (`a13_buyer_questions.py`):** a template library keyed by category,
each row `(score_trigger, severity, buyer_type, question, data_needed)`. A question *fires*
only when the category score ≤ its trigger; results sort CRITICAL-first then by how far
below threshold. **No AI call** — deterministic, explainable, cheap. This is what makes
`BuyerLens` feel like a senior advisor prepping a diligence Q&A.

**IP to preserve:** the question/initiative/risk-flag *content* is real advisor knowledge;
the **score-triggered firing** model; the system/advisor `source` split; seed-if-empty.

**Rebuild:** the seed templates and the runtime `_LIBRARY` are **duplicated** (library seeds
*from* a13, but a13 also runs independently against live scores). Make the library table the
single source and have the buyer-question engine read from it (already keyed compatibly).
Add `score_trigger` to initiatives/risk flags too so all three fire off live scores uniformly.

### 5.2 DRS scoring engine (`a9_drs_composite.py` + `core/scoring_rules.py`)
- 6 category scores → weighted composite (Rev 25 / Fin 20 / Ops 20 / Cust 15 / Mgmt 10 / Growth 10).
- Tiers: Institutional 85+ / Investment 70 / Conditional 55 / High-Risk 40 / Foundation <40.
- **Conservative/Base/Optimistic bands** computed by applying per-category confidence
  multipliers *before* the weighted sum.
- **Buyer-type weight profiles** (`BUYER_WEIGHT_PROFILES`: pe/strategic/financial) re-weight
  the same category scores to show how different acquirers would grade the business, each
  with a UI rationale string.
- **All weights, thresholds, multiples, and anchors live in one frozen `SCORING_RULES` object**
  (`SCORING_RULES_VERSION = "v1"`). This is excellent — keep it and make it the *only* place.

### 5.3 Data-confidence modifier (`core/confidence.py`)
Aggregates per-category `data_confidence` (HIGH/MEDIUM/LOW, derived from row-count
thresholds) into a `ConfidenceSummary`: overall (worst-case) level, DRS band, band width,
per-category levels, and human-readable factors ("Insufficient data for Revenue Quality —
score band widened. HIGH requires ≥50 revenue rows"). Band multipliers:
HIGH 1.00/1.00, MEDIUM 0.97/1.02, LOW 0.90/1.05.

**This is the "score can't be gamed" feature** the product owner asked for — it weights the
score toward uncertainty when few source files are ingested. Preserve the concept; consider
making the multipliers and row-count thresholds part of `SCORING_RULES`.

### 5.4 Enterprise Value (`a10_enterprise_value.py`)
`EV = defensible_EBITDA × tier_multiple`. When a `MarketMultipleContext` is present, the
applied band is **blended 50/50** between the DRS-tier band and the market segment band, so
valuation stays tied to diligence quality while reflecting real comps. `format_ev_valuation_summary`
gives **honest provenance** ("platform heuristic; not a live PitchBook/IBBA pull") — an
important credibility feature; don't fake vendor citations.

### 5.5 Value Gap (`a11_value_gap.py`)
For each category below the 80 target, simulate raising *only* that category to 80, recompute
DRS via a **continuous DRS→multiple interpolation curve** (`drs_multiple_anchors`), and report
the marginal EV uplift. Sorts by $ uplift, assigns priority. Emits a `methodology` block with
the exact formula and before/after multiples — advisor-defensible math. This directly feeds
the auto-populated initiatives (§3).

### 5.6 Other high-value features (connective tissue)

| Feature | Location | One-liner |
|---------|----------|-----------|
| **Buyer Universe matching** | `analytics/buyer_universe.py` | Ranks curated active acquirers by fit (industry 40 / EBITDA-band 35 / EV-band 25) with reasons; seeded from JSON; versioned by `BuyerUniverseRelease`. |
| **Market Benchmarks** | `analytics/market_benchmarks.py` | Resolves company → industry slug via **NAICS prefix map (6→3 digit) then keyword rules**, looks up curated segment multiples, honest provenance. PitchBook client is a stubbed hint. |
| **Deal-Outcome calibration loop** | `routes/deal_outcomes.py` | Captures actual sale results and computes **prediction accuracy** (was actual EV inside predicted floor/ceiling?), avg error %, DRS-vs-multiple scatter. The empirical feedback loop for tuning the model. |
| **AI Copilot** | `routes/copilot.py` | Per-tier monthly **token budgets** (`AICopilotUsage`, `with_for_update` row lock), cost tracking, deep M&A system prompt, 60/hr rate limit. |
| **AI client** | `core/ai_client.py` | One funnel for all Claude calls: exp-backoff retry, prompt-cache helpers, injection/off-topic guardrails, per-call USD cost estimate, model pricing table. |
| **Advisory Workflow tracker** | `services/advisory_workflow.py` | Derives a 5-phase deal-flow tracker (Prep → Positioning → GTM → Bids → DD/Close) with per-step % **computed live from data presence** (jobs ingested, profile filled, initiatives, resolved buyer questions). Several phase-4/5 steps are stubs ("coming next release"). |
| **Owner self-serve onboarding** | `routes/owner_onboarding.py` | Client-role owners fill company basics via invite link; validated enums; feeds `effective_total_headcount` override used in metrics. |
| **Multi-tenancy** | `api/deps.py` | 5-tier access model (unowned/demo → owner → grant owner/associate → grant client RO → legacy ClientAccess) behind `get_company_scope` / `get_company_write_scope`. Never bypass. |

---

## 6. Known inefficiencies & architectural debt (fix these on rebuild)

These are the concrete reasons the current system is "less efficient." Each is a
rebuild target.

1. **Scores are recomputed from raw rows on every request.** There is *no score
   persistence used as the read path* (a `ScoreSnapshot` table exists but surfaces
   recompute anyway). Copilot, workflow, value-gap, and the scorecard each re-run
   `compute_category_modules → compute_drs → EV → value_gap`. 
   **Fix:** compute once per ingestion, write a versioned `CompanySnapshot`
   (scores + EBITDA + EV + confidence + value-gap), and have every surface read it.
   Recompute is a background job triggered by P11 completion or advisor overrides.

2. **Revenue double-counting hazard (documented in `a1_metric_computation.py` itself).**
   TTM revenue sums *every* row with `period ≥ ttm_start`. If a company has annual +
   monthly + connector ingests describing the same economics, revenue, gross profit, and
   EBITDA inflate. 
   **Fix:** a canonical single-P&L reconciliation step (period-grain dedupe / source
   precedence) before metrics, or store revenue at an explicit grain with a source-of-truth flag.

3. **Synchronous ingestion in the request path.** `run_pipeline()` blocks the HTTP worker
   and the caller commits the session. Large files or QB pulls tie up workers.
   **Fix:** async task queue + progress events (§2.5).

4. **JSON blobs as the pipeline's memory.** Profile, mappings, extraction errors live as
   JSON on `IngestionJob`. Advisor mapping overrides never feed back into the synonym
   library — no learning loop.
   **Fix:** structured tables + a feedback path that raises registry confidence.

5. **Two EBITDA computations, inconsistently consumed** (§4.4). Unify.

6. **Advisory Library content is duplicated** between `library.seed_*` and the live
   `a13._LIBRARY` / inline `INIT_LIBRARY` (§5.1). Single source.

7. **Per-surface `try/except` swallowing.** `_build_context` and `_vg_upside` wrap whole
   analytics stacks in bare excepts and emit "(partially unavailable)" — real errors are
   invisible. **Fix:** compute in one place, log/alert on failure, return typed partials.

8. **Advisory Library CRUD is not company-scoped** (`routes/library.py` uses `get_db`
   directly, no `get_company_scope`). Fine if the catalog is global/system, but advisor-
   created items have no tenant boundary. Decide global-vs-tenant explicitly and enforce it.

9. **Workflow phases 4–5 are stubs.** Bids/LOI/DD/Close are hardcoded 0% "coming soon."
   The rebuild should either model these entities (IOIs, LOIs, DD checklist, data room) or
   drop them from the tracker until real.

10. **Market/PitchBook is a stub** with honest provenance strings. Keep the honesty; wire a
    real comps source behind the same `MarketMultipleContext` interface when available.

---

## 7. Recommended target architecture for the new repo

```
Ingestion (async, durable)                 Scoring (materialized)
 ─ connectors/  (qb, xero, payroll, crm)    ─ snapshot service: one CompanySnapshot per
   → extractor → normalizer(CSV)              ingestion/override, versioned by rules ver.
 ─ pipeline as a workflow (Temporal/Arq):   ─ scoring_rules.py stays the ONLY tunable
   phases as steps, real progress events      (weights, tiers, multiples, confidence bands,
 ─ ontology registry in DB (versioned,        recast scenario weights, market-rate default)
   advisor-extendable, learns from overrides)
                                            Read model
Canonical ontology (unchanged shape)        ─ every surface reads CompanySnapshot, never
 ─ RevenueStream/Customer/Employee/            recomputes; copilot context = snapshot + glossary
   Expense/Contract + lineage               ─ Advisory Library is the single catalog; buyer
 ─ revenue stored at explicit grain with      questions/initiatives/risk-flags all fire off
   source precedence (kills double-count)      snapshot scores via score_trigger
```

**Guiding principles for the rebuild**
1. **Compute once, read many.** Scoring is a materialized artifact, not a request-time
   computation. This alone removes most of the inefficiency and the `try/except` noise.
2. **One source of truth per concept** — one EBITDA object, one scoring-rules module, one
   advisory catalog, one context assembler.
3. **Everything tunable lives in versioned config** (`scoring_rules.py` pattern) so the
   model can be recalibrated from the deal-outcome loop without code changes.
4. **The pipeline is async and durable, and it learns** from advisor mapping overrides.
5. **Preserve the hand-tuned domain IP verbatim:** the ONTOLOGY_REGISTRY synonyms, the
   challenge-likelihood recast matrix, the score-triggered buyer questions, the NAICS/
   keyword industry resolver, the honest-provenance EV strings, and the data-confidence
   modifier. These are the moat; the plumbing around them is what should get simpler.

---

*Generated as a rebuild reference. Source of truth for behavior remains the code paths
cited above; this document records intent and target state, not a line-by-line spec.*
