# Pre-Diligence Platform — Product Roadmap
### Fracture Systems

---

## Strategic Arc

```
Phase 0 (now)     → Repo scaffolded. UI demo proven. Blueprints documented.
Phase 1 (Client-0) → Get it working end-to-end for one real client.
Phase 2 (Platform) → Multi-client, production-grade, self-serve.
Phase 3 (Scale)    → Advisor network, integrations, AI-native workflows.
```

---

## Phase 1 — First Client (MVP)
**Goal:** Deliver a real pre-diligence engagement end-to-end. One advisor, one company, real data, real output.

### Milestone 1.1 — Data Ingestion (Blueprint I: P1–P11)
**Duration:** 3–4 weeks

| # | Task | Blueprint Ref | Done When |
|---|---|---|---|
| 1 | File upload endpoint — receive and store raw files immutably | P2 | File committed with SHA-256 hash |
| 2 | File validation & pre-screening | P3 | Structural + content sanity checks pass/quarantine |
| 3 | Schema profiler — auto-generate column profiles | P4 | Profile report per file: null rates, type inference, sample values |
| 4 | Column classifier — map columns to ontology fields with confidence scores | P5 | Every column mapped, flagged, or excluded |
| 5 | QuickBooks CSV/Excel parser — P&L, A/R, A/P, transaction detail | P5–P6 | 4 export types parsed cleanly |
| 6 | Row-level extractor + multi-format date/currency parser | P6 | Records extracted; parse errors logged with row refs |
| 7 | Business rule validator — domain rules per entity type | P7 | Revenue non-negative, dates coherent, etc. |
| 8 | Normalization engine — ISO 8601 dates, decimal USD, canonical enums | P8 | Zero raw strings in final ontology records |
| 9 | Entity resolver — deduplicate customers, merge source records | P9 | One canonical entity per real-world object |
| 10 | Relationship mapper — link revenue → customers → contracts | P10 | Entity graph connected; orphans flagged |
| 11 | Ontology commit — write with lineage tags (source, ingestion_id, confidence, timestamp) | P11 | Records in PostgreSQL with full audit trail |

**First target files:** QuickBooks P&L export (CSV), customer list (Excel), payroll register (CSV)

---

### Milestone 1.2 — Analytical Engine (Blueprint II: A1–A14)
**Duration:** 4–5 weeks

| # | Task | Blueprint Ref | Done When |
|---|---|---|---|
| 1 | Metric registry — all 40+ revenue, customer, cost, employee metrics | A1 | All metrics computed from real ontology records |
| 2 | EBITDA recast — step-by-step rebuild with addback schedule | A2 | Conservative / Base / Aggressive EBITDA produced |
| 3 | Addback challenge ratings — LOW / MEDIUM / HIGH / NOT_DEFENSIBLE | A2.2 | Every addback line rated and documented |
| 4 | Revenue Quality Score — 5 sub-scores, 0–100 | A3 | Recurring %, HHI, contract durability, CAGR, churn |
| 5 | Operational Independence Score — 4 sub-scores | A4 | Owner hours, SOP coverage, mgmt depth, automation |
| 6 | Customer Risk Score — 5 sub-scores | A5 | Concentration, tenure, contract coverage, churn |
| 7 | Management & Team Score — 4 sub-scores | A6 | Mgmt layers, non-competes, comp vs market, retention |
| 8 | Growth Drivers Score — 4 sub-scores | A7 | CAGR, pipeline coverage, positioning, repeatability |
| 9 | Financial Integrity Score — 4 sub-scores | A8 | Reconciliation quality, addback defensibility, GAAP, completeness |
| 10 | DRS Composite Score — weighted 0–100 + 3 confidence bands | A9 | Base / Conservative / Optimistic DRS produced |
| 11 | Enterprise Value calculation — DRS-adjusted multiple × Defensible EBITDA | A10 | EV floor, ceiling, midpoint |
| 12 | Value Gap Analysis — current EV vs achievable EV per initiative | A11 | Dollar gap quantified per initiative |
| 13 | Initiative Roadmap — ranked, time-boxed, EV-impact-quantified | A12 | 18–36mo roadmap with milestone DRS projections |
| 14 | Buyer Question Simulation — PE diligence Q&A prep by risk category | A13 | Question set keyed to identified risk flags |
| 15 | Insight Package Assembly | A14 | Risk heatmap, value roadmap, DRS scorecard, advisor summary |

---

### Milestone 1.3 — UI Wired to Real Data
**Duration:** 2–3 weeks

| # | Task | Page |
|---|---|---|
| 1 | Replace all mockData.js with API calls | All pages |
| 2 | Company Workspace — live charts, live blockers, live levers | `/CompanyWorkspace` |
| 3 | Readiness Score page — live DRS radar + category breakdown | `/Readiness` |
| 4 | Business Quality page — live metric cards vs benchmarks | `/BusinessQuality` |
| 5 | Buyer Risk Profile — live buyer questions by risk flag | `/BuyerLens` |
| 6 | Valuation page — live EBITDA recast + EV scenarios | `/Valuation` |
| 7 | Value Gap page — live initiative table + EV waterfall | `/ValueGap` |
| 8 | Data Sources — file upload UI + ingestion status tracker | `/Connectors` |
| 9 | Field Mapping — column → ontology field review UI | `/DataMapping` |
| 10 | Data Quality — validation errors, quarantine queue | `/DataQuality` |
| 11 | Reports — generate PDF/DOCX insight package | `/Reports` |

---

### Milestone 1.4 — Report Output
**Duration:** 1–2 weeks

- [ ] PDF report generator (DRS scorecard, EBITDA recast, initiative roadmap)
- [ ] DOCX advisor summary (PE-grade narrative with tables)
- [ ] Email delivery to advisor
- [ ] Report versioning (v1, v2... as data updates)

---

### Milestone 1.5 — Client-0 Delivery Criteria
**Definition of "working for a client":**
- [ ] Real QuickBooks data ingested and mapped end-to-end
- [ ] DRS score produced with full category breakdown
- [ ] EBITDA recast with addback schedule reviewed by advisor
- [ ] Value gap quantified in dollars
- [ ] Initiative roadmap delivered to owner
- [ ] Advisor report (PDF) exported and reviewed
- [ ] Advisor signs off: "I would use this with a real client today"

**Target: 8–10 weeks from start**

---

## Phase 2 — Multi-Client Platform
**Goal:** Support 5–10 simultaneous advisory engagements. Repeatable onboarding. No white-glove data prep required.

### Milestone 2.1 — Multi-Tenancy & Auth
- [ ] Advisor accounts (login, firm-level settings)
- [ ] Client accounts (read-only portal view)
- [ ] Company isolation — one advisor sees only their companies
- [ ] Role-based access: Advisor / Associate / Client Owner
- [ ] Audit log — every data access and change recorded

### Milestone 2.2 — Automated Connectors
- [ ] QuickBooks Online API integration (live sync, not manual export)
- [ ] Xero API integration
- [ ] Gusto / ADP payroll API
- [ ] HubSpot CRM API
- [ ] Salesforce CRM API
- [ ] DocuSign / contract import
- [ ] Bank statement parser (PDF → structured transactions)

### Milestone 2.3 — Guided Ingestion UX
- [ ] Source intake wizard (P1 — structured intake interview)
- [ ] Column mapping review UI with AI-suggested mappings (Claude API)
- [ ] Confidence score display per mapped field
- [ ] Quarantine queue with analyst review workflow
- [ ] Data gap warnings with advisor guidance

### Milestone 2.4 — Scenario Simulator (Live)
- [ ] Real-time EV impact modeling per initiative
- [ ] Sensitivity analysis — what if recurring revenue reaches 75%?
- [ ] Stress testing — customer loss, margin compression, key person departure
- [ ] Side-by-side scenario comparison

### Milestone 2.5 — AI Copilot
- [ ] Claude-powered Q&A over company data ("What is driving the HHI risk?")
- [ ] Buyer question simulation — dynamic, updated as data changes
- [ ] Addback documentation assistant — "Help me document this owner expense"
- [ ] Narrative generation for report sections

### Milestone 2.6 — Data Room (VDR)
- [ ] Document upload and categorization
- [ ] Contract repository with metadata extraction
- [ ] Diligence checklist tracker
- [ ] Advisor notes and annotations

### Milestone 2.7 — Market Intelligence
- [ ] Industry benchmark database (revenue growth, EBITDA margins, payroll ratios, multiples)
- [ ] Peer comparison by industry + revenue band + geography
- [ ] Multiple trend data (EV/EBITDA by sector, rolling 12mo)
- [ ] PitchBook / CapIQ integration for comps

---

## Phase 3 — Scale & Network
**Goal:** Become the operating system for SMB exit planning advisors.

### Milestone 3.1 — Advisor Network
- [ ] Advisor marketplace / directory
- [ ] Engagement handoff between advisors (M&A advisor → QoE firm)
- [ ] Referral and co-advisory tracking
- [ ] Certification integration (CEPA, CBB, CVA)

### Milestone 3.2 — Buyer Intelligence
- [ ] Strategic buyer universe mapping by industry/size
- [ ] PE fund targeting by deal size, sector, platform add-on thesis
- [ ] LOI tracker — track buyer interest per company
- [ ] Buyer question response library (reusable across engagements)

### Milestone 3.3 — Continuous Monitoring
- [ ] Monthly data sync → DRS recalculation → trend tracking
- [ ] Value creation initiative progress tracking
- [ ] Alert system: "Customer Acme Corp is now 25% of revenue — flag triggered"
- [ ] Owner dashboard — simplified view for business owners (not advisors)

### Milestone 3.4 — API & Integrations
- [ ] Public API for third-party advisor tools
- [ ] Zapier / Make integration
- [ ] Slack notifications for advisors
- [ ] CRM integration (advisor CRM → engagement tracking)

### Milestone 3.5 — Enterprise
- [ ] White-label for PE firms (portfolio company monitoring)
- [ ] Fund-level roll-up DRS dashboard
- [ ] QoE firm integration (share data room directly)
- [ ] Multi-currency / international entity support

---

## Technical Debt & Infrastructure (Continuous)

| Priority | Item |
|---|---|
| High | Test suite — unit tests for A1–A14 scoring logic |
| High | CI/CD pipeline (GitHub Actions → staging deploy) |
| High | Database migrations (Alembic) — schema evolution without data loss |
| Medium | Background job queue (Celery / Redis) for async ingestion pipeline |
| Medium | File storage migration (local → S3-compatible, e.g. Cloudflare R2) |
| Medium | API rate limiting and auth hardening |
| Low | Frontend E2E tests (Playwright) |
| Low | Observability (structured logging, error tracking) |

---

## Current State (as of March 2026)

| Component | Status |
|---|---|
| UI Demo (base44) | Complete — validated |
| UI Spec | Complete — documented |
| Blueprint I (Ingestion) | Complete — documented, P1–P11 |
| Blueprint II (Analytics) | Complete — documented, A1–A14 |
| Repo scaffold | Complete — frontend + backend structure |
| Frontend | React + Vite scaffold + Home/CompanyWorkspace/Readiness pages wired to mock data |
| Backend | FastAPI skeleton + ontology models + A1/A2/A9/A10 implementations |
| Database | Schema defined — not yet migrated |
| Client-0 | Not yet started |

**Next action:** Set up PostgreSQL, run Alembic migrations, implement P3–P6 (file validation → column mapping) with QuickBooks CSV test file.

---

*Fracture Systems — Confidential*
