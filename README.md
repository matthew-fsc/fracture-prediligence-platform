# Pre-Diligence Platform — Fracture Systems

> Pre-diligence operating intelligence platform that transforms fragmented SMB business data into investor-grade operational readiness scores.

---

## What This Is

The Pre-Diligence Platform helps M&A advisors, CEPA-certified exit planners, and PE-backed acquirers assess the diligence readiness of small-to-mid-size businesses before a formal sale process begins. It ingests raw business data (QuickBooks, CRM, payroll, contracts), normalizes it into a clean ontological model, then runs a battery of financial and operational scoring algorithms to produce a **Diligence Readiness Score (DRS)** and **Enterprise Value estimate** — along with a prioritized roadmap of value creation initiatives.

---

## Architecture

```
Raw Data (QuickBooks / CRM / Payroll / Contracts)
    │
    ▼
[Blueprint I — Ingestion Pipeline]  (backend/ingestion/)
    P1  Source Intake & Triage
    P2  Raw Extraction
    P3  File Validation & Pre-Screening
    P4  Schema Profiling
    P5  Column Classification & Mapping
    P6  Row-Level Extraction & Parsing
    P7  Business Rule Validation
    P8  Normalization & Standardization
    P9  Entity Resolution & Deduplication
    P10 Relationship Mapping
    P11 Ontology Commit & Lineage Tagging
    │
    ▼
[Clean Ontology Store]  (PostgreSQL)
    Entities: Revenue Streams · Customers · Employees · Expenses · Contracts · Owners
    │
    ▼
[Blueprint II — Analytical Engine]  (backend/analytics/)
    A1  Metric Computation          (40+ computed measures)
    A2  EBITDA Recast               (defensible EBITDA + addback schedule)
    A3  Revenue Quality Analysis    (recurring %, HHI, churn, contracts)
    A4  Operational Independence    (key person dependency, SOP coverage)
    A5  Customer Risk Profiling     (concentration, tenure, contract status)
    A6  Management & Team           (depth, comp benchmarks, retention)
    A7  Growth Driver Analysis      (CAGR, pipeline coverage, repeatability)
    A8  Financial Integrity         (auditability, GAAP proximity, recon)
    A9  DRS Composite Score         (0–100, 3 confidence bands)
    A10 Enterprise Value            (DRS-adjusted multiple × Defensible EBITDA)
    A11 Value Gap Analysis          (current EV vs. achievable EV)
    A12 Initiative Roadmap          (18–36mo milestones with EV impact)
    A13 Buyer Question Simulation   (PE diligence question prep)
    A14 Insight Package Assembly    (advisor-ready deliverables)
    │
    ▼
[Pre-Diligence Platform UI]  (frontend/)
    Dark-mode advisory dashboard — React + Vite + Tailwind
```

---

## Repository Structure

```
prediligence-platform/
├── frontend/                   # React + Vite UI
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/             # Primitives: cards, badges, progress bars
│   │   │   ├── layout/         # Sidebar, header, app shell
│   │   │   └── charts/         # Recharts wrappers
│   │   ├── pages/              # One file per route (17 pages)
│   │   ├── lib/
│   │   │   ├── utils.js
│   │   │   └── mockData.js     # Client-0 demo data
│   │   └── App.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── backend/                    # Python FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── api/routes/         # REST endpoints
│   │   ├── ingestion/          # Blueprint I: P1–P11
│   │   ├── analytics/          # Blueprint II: A1–A14
│   │   ├── ontology/           # Data models & schema
│   │   └── core/               # Config, DB, auth
│   ├── tests/
│   ├── requirements.txt
│   └── alembic/                # DB migrations
│
├── docs/
│   ├── blueprint-i-ingestion.md
│   ├── blueprint-ii-analytics.md
│   └── ui-spec.md
│
├── ROADMAP.md
└── README.md
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Lucide Icons, Recharts |
| Backend | Python 3.11+, FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL (ontology store) |
| Auth | JWT (advisor-level, client-level roles) |
| File storage | Local → S3-compatible (phase 2) |
| AI / NLP | Claude API (field mapping suggestions, AI Copilot, buyer Q sim) |

---

## Quick Start (Development)

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # fill in DB credentials
alembic upgrade head
uvicorn app.main:app --reload
# → http://localhost:8000
```

---

## DRS Scoring Weights

| Category | Weight | Phases |
|---|---|---|
| Revenue Quality | 25% | A3 |
| Financial Integrity | 20% | A8 |
| Operational Independence | 20% | A4 |
| Customer Risk | 15% | A5 |
| Management & Team | 10% | A6 |
| Growth Drivers | 10% | A7 |

**DRS Tiers:** 85–100 Institutional Grade · 70–84 Investment Grade · 55–69 Conditional · 40–54 High Risk · <40 Pre-Diligence Required

---

## Key Outputs

- **DRS 0–100** with Conservative / Base / Optimistic confidence bands
- **Defensible EBITDA** (3 scenarios: conservative, base, aggressive)
- **Enterprise Value range** (current floor/ceiling)
- **Value gap** — dollar delta between current EV and achievable EV
- **Initiative roadmap** — ranked, time-boxed, EV-impact-quantified
- **Buyer question simulation** — PE diligence prep by risk category
- **Advisor report** — exportable PDF/DOCX deliverable

---

*Fracture Systems — Confidential*
