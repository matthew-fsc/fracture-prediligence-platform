# ABC Company Inc — Demo Fixture Reference

This document is the canonical specification for the seeded demo company. Any engineer writing analytics tests, UI smoke tests, or integration checks against `company_id=1` should use these values as ground truth.

---

## Identity

| Field | Value |
|-------|-------|
| Company ID | `1` |
| Name | ABC Company Inc |
| Industry | Field Services — Traffic Management |
| Founded | 2009 |
| Entity type | S-Corp |
| State | (not set in seed) |
| Headcount | 13 employees |
| Demo ingestion ID | `seed-demo-abc-qb-pl-v1` |

---

## How to seed / reset

```bash
# From the backend/ directory, with .venv activated and .env populated:
python scripts/seed_abc_company.py
```

The script is a thin wrapper around `app.services.demo_company_seed.run_seed_abc_company()`. It is safe to re-run; the seed function wipes existing data for `company_id=1` before inserting fresh rows.

On application startup the seed also runs automatically if no revenue streams exist for `company_id=1` (see KI-008 in `KNOWN_ISSUES.md` for the idempotency caveat).

---

## Financial targets (TTM 2025)

These are the numbers the analytical engine should produce after a clean seed. Use them to verify your local environment is healthy before starting feature work.

| Metric | Expected value |
|--------|---------------|
| TTM Revenue (2025) | ~$4,196,172 |
| TTM COGS + OPEX | calibrated so EBITDA proxy ≈ $1,740,000 |
| Reported Net Income (EBITDA proxy) | ~$1,740,000 |
| Owner comp addback | ~$82,200 |
| Defensible EBITDA (base) | ~$1,830,000 |
| 2023 Annual Revenue | $2,793,233 |
| 2024 Annual Revenue | $2,746,003 |
| YoY growth 2024→2025 | ~52.8% (TTM) |

### Quick API verification

```bash
curl http://localhost:8000/api/analytics/drs/1 | python3 -m json.tool
# Expect: "drs": 72, "tier": "INVESTMENT"

curl http://localhost:8000/api/analytics/ebitda/1 | python3 -m json.tool
# Expect: defensible_ebitda ~1830000
```

---

## DRS expected output

| Category | Score | Tier |
|----------|-------|------|
| Revenue Quality | 70 | MEDIUM |
| Financial Integrity | 74 | MEDIUM |
| Operational Independence | 71 | HIGH |
| Customer Risk | 70 | HIGH |
| Management & Team | 72 | HIGH |
| Growth Drivers | 78 | HIGH |
| **DRS Composite** | **72** | **INVESTMENT** |

Confidence bands: conservative 70 / base 72 / optimistic 74.

Enterprise Value range: ~$9.8M floor – $11.3M ceiling (DRS-adjusted 5.0–7.0× multiple × defensible EBITDA).

---

## Customer data

- Total customers: **68**
- Top 5 concentration: **~78.4%** of TTM revenue
- Remaining 63 customers: ~21.6%

### Top 5 customer concentration (2025 share)

| Rank | Customer | Approx 2025 share |
|------|----------|-------------------|
| 1 | COMPANY 1 | ~49.4% |
| 2 | COMPANY 2 | ~19.0% |
| 3 | COMPANY 3 | ~4.9% |
| 4 | COMPANY 4 | ~3.3% |
| 5 | COMPANY 5 | ~2.4% |

The high concentration (single customer >40%) is intentional — it drives the MEDIUM customer risk score and surfaces concentration risk flags in the buyer simulation.

---

## Revenue stream structure

| Period | Granularity | Description |
|--------|-------------|-------------|
| 2025 | Monthly (12 rows per customer group) | Used for TTM calculation |
| 2024 | Annual (1 row per customer) | Used for YoY comparison |
| 2023 | Annual (1 row per customer) | Used for 3-year CAGR |

All revenue streams have `ingestion_id = "seed-demo-abc-qb-pl-v1"` and `confidence_level = HIGH`.

Revenue types: primarily `PROJECT` (field services work orders) with a small portion flagged `RECURRING` (retainer-style contracts).

---

## Expense structure

| Category | Description |
|----------|-------------|
| `COGS` | Direct labor + materials per job |
| `OPEX` | Overhead (insurance, equipment lease, admin) |
| `OWNER` | Owner compensation (addback candidate) |

Owner compensation is seeded as a single `OWNER`-category expense row, triggering the automatic owner-comp addback in `a2_ebitda_recast.py`.

---

## Employee fixture

| Record | Details |
|--------|---------|
| Owner | `is_owner=True`, `is_key_person=True`, `management_level=0` |
| Remaining 12 | Mix of field technicians and admin; no other `is_key_person` flags set |

---

## Field mapping demo

The seed pre-populates a column mapping payload for the **Field Mapping** UI (P5). Source columns and their mapping status:

| Source column | Ontology field | Confidence | Requires review |
|---------------|---------------|------------|-----------------|
| Date | `REVENUE_PERIOD` | 98% | No |
| Customer | `CUSTOMER_NAME` | 95% | No |
| Amount | `REVENUE_GROSS` | 92% | No |
| Account Number | `EXPENSE_CATEGORY` | 88% | No |
| Memo / Description | `EXPENSE_DESCRIPTION` | 72% | **Yes** |
| Split | _(excluded)_ | 0% | No |
| Class | `EXPENSE_CATEGORY` | 61% | **Yes** |
| Name | `EMPLOYEE_NAME` | 90% | No |
| Hours | _(no ontology match)_ | 65% | No |

Auto-mapped: 5 · Review required: 2 · Excluded: 1

---

## Qualitative inputs (pre-set for demo)

The following `qualitative_inputs` defaults produce the DRS scores above. They are set during seed but can be overridden via the advisor UI.

| Field | Value | Effect |
|-------|-------|--------|
| `owner_hours_per_week` | 35 | Reduces operational independence sub-score |
| `sop_pct` | 55 | Moderate SOP coverage |
| `mgmt_qualified` | 2 | Two qualified managers |
| `mgmt_total_functions` | 5 | Five core functions |
| `pipeline_value` | $620,000 | ~15% pipeline coverage ratio |
| `market_positioning` | `moderate` | Mid-tier positioning |
| `repeatability_pct` | 72 | Most work is repeatable |
| `contract_pct` | 40 | 40% of customers under formal contract |

---

## Running the targeted test suite

```bash
cd backend
pytest tests/test_demo_data_integrity.py -v    # validates seed shape
pytest tests/test_scoring_rules.py -v          # validates DRS math
pytest tests/test_market_benchmarks.py -v      # validates EV multiples
pytest tests/ -v                               # full suite (all 5 files)
```

---

## Resetting to a known-good state

If you've run manual ingests against company 1 and the DRS is no longer matching the targets above:

```bash
# Wipe company 1's transactional data and re-seed
cd backend
python scripts/seed_abc_company.py
```

This deletes all revenue streams, expenses, customers, and employees for `company_id=1` and reloads the canonical fixture. The `Company` record itself (name, industry, etc.) is preserved.
