# Survivor Assessment — Dashboard & Infrastructure Repo

**Position (stated up front):** This repo should be the **survivor**, and the donor's scoring engine should be **ported in**. This repo is a working, deployed, full-stack product with the two things that are expensive to rebuild — a real presentation/reporting layer and a real operational spine (auth, billing, ingestion, migrations, CI, deploy). Its central weakness (a flat, company-centric data model with no assessment versioning) is a **known, mechanical migration** on healthy Alembic tooling, whereas the donor's presumed strength (a rigorous scoring engine) is a **library-shaped, well-bounded import**. It is cheaper to move a scoring engine into a working product than to rebuild a working product around a scoring engine.

This is a judgment made **without** having read the donor repo; it rests on the task's description of the donor (Python reference engine + 3 fixtures) and on what is verifiably present here. If the donor turns out to also carry a mature app shell, revisit — but the burden of proof shifts to *it*, because this repo's shell is confirmed working (140 tests green, frontend builds, deploy configs live).

---

## Case FOR this repo as survivor

1. **The presentation + reporting layer already exists and works.** 30+ advisor pages, 6 chart types wired through Recharts, React Query data layer, typed API client, *and* a server-side branded PDF generator with 5 report types. Rebuilding this from a scoring engine outward is weeks-to-months of UI work. `SURVIVOR` value concentrates here.
2. **The operational spine is real and tested, not scaffolding.** Clerk auth (prod JWKS + dev fallback), Stripe billing with a 27-test webhook suite, QuickBooks OAuth, a centralized guardrailed Claude client, fail-fast prod config validation, health/readiness probes, and multi-platform deploy manifests (Railway/Render/Fly + Docker). 140 backend tests pass.
3. **Migrations are healthy.** Linear Alembic `0001→0022` against `Base.metadata`, idempotent, with past drift already reconciled. The spine migration is large but *mechanical* on this foundation — low execution risk.
4. **The scoring seam is clean and centralized.** All scoring flows through `compute_category_modules` → `CategoryScores` (6 floats) → `compute_drs` → `DRSResult`. A replacement engine has one obvious insertion point, not a hundred.
5. **The outcome-capture and longitudinal intent already exist in miniature.** `deal_outcomes`, `score_snapshots`, `engagement_snapshots` show the team already reaches for outcomes + trends — the spine formalizes what's already gestating rather than introducing an alien concept.

## Case AGAINST this repo as survivor

1. **The data model is the wrong shape.** Company = client = engagement, with no assessment-version entity and scores computed on read. The engagement-centric spine (with versions, deltas, supersede) is a near-every-table migration and forces a *scoring-persistence rearchitecture* the current design lacks (AD-4). This is the single biggest cost.
2. **It carries a competing scoring engine that must be displaced.** Keeping the survivor means ripping out `a1…a14` + `scoring_rules.py` (or reducing them to a thin adapter) and re-pointing the UI/PDF/copilot at the donor engine. Risk of subtle behavioral divergence during the swap.
3. **Isolation is app-layer with a "NULL-owner = public" rule** — the opposite of the target's Supabase/RLS idiom, and a latent leak vector (AD-2). Moving to RLS is High-cost.
4. **The WM strategic layer has almost no substrate here.** No activity log, no event/cadence triggers, no n8n, per-company (not per-firm) branding. Three of the four WM features need schema or architecture work (below).
5. **"Well-tested" is partly an illusion.** Tests run on stubbed deps and mock DBs (AD-15); they validate logic, not persistence, isolation, or migrations. Confidence in the *shell* is high from build/deploy evidence, but not from the test suite alone.

---

## What must be ported IN if this repo wins — the scoring engine

**How cleanly can an external Python engine + fixtures integrate?** Cleanly, with one important condition.

- **Where it lives:** `backend/app/analytics/` is already a package of standalone, dependency-light modules. Drop the donor engine in as `backend/app/scoring/` (or replace `a1…a9`) with its fixtures under `backend/tests/fixtures/`. The engine is pure-Python and reads normalized facts — it does not need the web framework.
- **The integration seam:** a single function, `services/analytics_service.compute_category_modules(company_id, db)`, is the choke point every consumer (scores API, reports, copilot, value-gap, engagement re-score) calls. Reimplement that one function to (a) load facts from the ontology tables, (b) call the donor engine, (c) return objects exposing `.composite` / `.details` / `.data_confidence`. Everything downstream keeps working unchanged.
- **The condition (the risk):** the donor engine's **32 sub-scores must roll up to these exact 6 dimensions** (`revenue_quality, financial_integrity, operational_independence, customer_risk, management_team, growth_drivers`) and emit a base/conservative/optimistic band, because the UI, the radar chart, the PDF score bars, and value-gap are hardwired to that taxonomy (AD-7). If the donor's dimensions differ, add a rollup adapter (Medium) or reshape the dashboard (Medium–High).
- **Fixture fidelity:** byte-identical regression requires **persisting** the engine's output as an immutable assessment version (this repo currently recomputes on read — AD-4). So porting the engine *also* forces the persist-on-assess change. Budget for both together; they are the same work item.
- **Weights authority:** `core/scoring_rules.py` is the current single source for weights/tiers. Either the donor engine owns weights (retire `scoring_rules.py`) or it reads them from here — decide explicitly to avoid two sources of truth.

**Net:** engine import is **Medium**; the coupled persist-on-assess + 6-dimension-rollup requirements are what push the *combined* task to Medium–High. Still far cheaper than rebuilding the shell.

## What must be ported OUT if this repo loses — extractable assets

Ranked by value × extraction-cleanliness:

| Asset | Where | Entanglement | Extractability |
|---|---|---|---|
| **PDF report generator** | `a14_report_generator.py` | Low — pure fpdf2, only depends on analytics outputs + `Company` branding fields | **Clean.** Lift with its input contract; swap data source. Best single donation. |
| **Claude client** | `core/ai_client.py` | Low — self-contained (retry, caching, guardrails, cost) | **Clean.** Copy as-is. |
| **Ingestion pipeline P2–P11** | `ingestion/`, `p5` Claude mapping | Medium — writes to ontology tables, uses `IngestionJob` | **Moderate.** Portable if the target keeps a similar fact schema; the phase framework is decoupled from the web layer. |
| **QuickBooks OAuth + normalizer** | `integrations/quickbooks/` | Medium — depends on `qb_tokens` table + config | **Moderate.** Self-contained module; needs the token table + fix the in-process CSRF state. |
| **Auth middleware** | `middleware/auth.py` | Low–Medium — Clerk-specific | **Clean if staying on Clerk;** rewrite if moving to Supabase Auth. |
| **Dashboard shells + chart pages** | `frontend/src/components/layout/*`, `pages/*` | **High** — coupled to React Router, Clerk, `CompanyContext`, React Query keys, the 6-category taxonomy, Tailwind | **Entangled.** Individual chart pages are liftable as patterns, but wholesale reuse drags the whole frontend framework choice with them. This is the reason *not* to make this repo the donor. |
| **Stripe billing + webhooks** | `routes/payments.py`, `routes/webhooks.py` | Medium — tied to `user_subscriptions`/tenant model | **Moderate.** Routers are self-contained; the plan↔company-limit coupling leaks. |
| **Alembic migration framework** | `backend/alembic/` | Low | **Clean** as a pattern, but migrations are model-specific — you port the *approach*, not the files. |

**The dashboard/frontend is the crown jewel and the most entangled** — which is precisely why losing this repo is the expensive outcome. You can cherry-pick the PDF generator and the Claude client cheaply, but you cannot cheaply extract "the dashboard."

---

## Readiness for the WM strategic layer

| WM feature | Rating | Why (one sentence) |
|---|---|---|
| **Branded client-facing delta report** | **NEEDS SCHEMA CHANGE** | The PDF generator + per-company logo/firm plumbing exist and work, but there is no delta/diff report type and no assessment-version pair to diff, and branding must move from the client record to a firm/advisor entity. |
| **Dual-milestone roadmap** (business + personal timeline) | **NEEDS SCHEMA CHANGE** | `company_initiatives` (phases, target/actual dates, DRS impact) already models business milestones on a timeline; adding advisor-entered *personal planning* milestones is a new milestone type/table plus a combined timeline view — additive, not structural. |
| **Touch-cadence event triggers** | **NEEDS REARCHITECTURE** | There is no eventing, no n8n, no scheduler, and zero emission points for "score moved" / "task completed"; `mark_initiative_complete` re-scores inline but emits nothing — this requires introducing an event bus + n8n integration from scratch. |
| **Engagement activity log** | **NEEDS SCHEMA CHANGE** | Fragments of append-only history exist (`qualitative_input_audits`, `score_snapshots`, `generated_reports`) but no unified activity table and no capture of touches/artifacts/views — a new `engagement_activity_log` table plus write-hooks on key actions. |

**Summary:** one of four WM features (cadence triggers) needs genuine new architecture; the other three are schema additions on top of surfaces that already exist. None is blocked by a fundamental limitation of this repo — they are blocked by the *absence* of the engagement/version spine, which is the same migration the core consolidation already requires. In other words, **doing the spine migration unlocks most of the WM layer as a side effect.**

---

## Recommended sequence if this repo is chosen
1. Land the engagement/assessment-version spine migration (SCHEMA.md sketch) — this is the gating item and also unblocks the WM layer.
2. Port the donor engine behind `compute_category_modules`, with persist-on-assess writing immutable version rows; validate the 3 fixtures against stored output.
3. Displace `a1…a9` / `scoring_rules.py`; keep `a10…a14` (EV, value-gap, reports) reading the new engine's rollup.
4. Add `engagement_activity_log` + a firm/advisor branding entity; build the delta-report builder in fpdf2 (or move to HTML→PDF).
5. Introduce n8n + event emission on score/task transitions for cadence triggers.
6. Fix the confirmed `engagement.py` DRS-attribute bug and add real DB-integration tests (the current suite won't catch spine regressions).

## The one confirmed defect found during audit (not fixed — out of scope)
`POST /api/engagement/initiatives/{company_id}/{initiative_id}/complete` will 500: it reads `drs_result.base/.conservative/.optimistic` but `DRSResult` exposes `base_drs/conservative_drs/optimistic_drs` (`engagement.py:365-367` vs `a9_drs_composite.py:69-71`). Flagged for the survivor's backlog.
</content>
