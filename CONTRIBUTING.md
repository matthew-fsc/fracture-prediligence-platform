# Contributing to the Fracture Pre-Diligence Platform

This document covers the development workflow, branching strategy, and code conventions for contributors. Read it before opening your first PR.

---

## Branching strategy

We use a **trunk-based development** model with short-lived feature branches.

### Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<short-description>` | `feature/initiative-roadmap-pdf` |
| Bug fix | `fix/<short-description>` | `fix/drs-null-when-no-expenses` |
| Migration | `migration/<description>` | `migration/add-cascade-delete-billing` |
| Chore / docs | `chore/<description>` | `chore/update-env-example` |
| Claude Code sessions | `claude/<description>-<uid>` | `claude/prep-external-collaboration-U5jzO` |

### Rules

1. **Branch from `main`** — always. Never branch from another feature branch.
2. **Target `main`** on your PR.
3. **Keep branches short-lived** — aim for PRs open < 3 days. Large changes should be split.
4. **One logical change per PR** — a PR that adds a feature and also refactors an unrelated module is harder to review and harder to revert.
5. **Delete branches after merge** — do not let stale branches accumulate.
6. **Never force-push to `main`** — it is a protected branch.

### Protected branches

| Branch | Protection |
|--------|-----------|
| `main` | No direct pushes; PRs require tests passing |

---

## Local setup

See **Quick Start** in [`README.md`](README.md) and the **Happy Path** walkthrough section immediately below it.

Minimum checklist before writing code:
```bash
# Backend
cd backend
alembic upgrade head
pytest tests/ -v                  # all tests must pass

# Frontend
cd frontend
npm install
npm run lint                      # no errors
```

---

## Making changes

### Backend

**Adding a new API route:**
1. Create a new file in `backend/app/api/routes/<domain>.py`.
2. Register the router in `backend/app/main.py`.
3. All routes that touch company data **must** use `Depends(get_company_scope)` — see `backend/app/api/deps.py`.

**Adding or changing a DB model:**
1. Edit `backend/app/ontology/models.py`.
2. Generate a migration:
   ```bash
   cd backend
   alembic revision --autogenerate -m "describe the change"
   ```
3. Review the generated migration file in `backend/alembic/versions/` — autogenerate can miss FK constraints and nullable changes.
4. Apply and verify:
   ```bash
   alembic upgrade head
   alembic check    # should report "No new upgrade operations detected"
   ```
5. Never call `Base.metadata.create_all()` in production code (see KI-005 in [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md)).

**Changing DRS scoring logic:**
- Weights and tier thresholds live in `backend/app/core/scoring_rules.py`.
- The version constant is `SCORING_RULES_VERSION = "v1"`. Bump it if you change weights.
- Update `tests/test_scoring_rules.py` to match any new expected values.

**Calling the Claude API:**
- Use `claude-sonnet-4-6` or newer.
- Wrap all calls in try/except and return a structured error response — do not let the request hang on API unavailability (see KI-007 in [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md)).
- See `backend/app/api/routes/copilot.py` for the established pattern.

### Frontend

**API calls:**
- Always use `lib/apiClient.js` — it injects the Clerk JWT automatically.
- Use TanStack React Query for all server state. Default stale-time is 30s, retry once.

**Adding a new page:**
1. Create `frontend/src/pages/<PageName>.jsx`.
2. Add the route in `frontend/src/App.jsx` (React Router v6).
3. Protected pages must be wrapped in the authenticated route component.

**Icons:** Use Lucide React only.
**Charts:** Use the existing Recharts wrappers; see other pages for the pattern.
**Styling:** Dark mode default; use Tailwind CSS variables from `theme/`. Do not introduce new CSS files.

---

## Testing

### Backend

```bash
cd backend
pytest tests/ -v
```

Five test files must all pass:
- `test_company_access.py` — multi-tenancy / IDOR prevention
- `test_demo_data_integrity.py` — ABC Company fixture shape
- `test_market_benchmarks.py` — benchmark seeding and EV multiples
- `test_scoring_rules.py` — DRS scoring math
- `test_settings.py` — settings/config

When to add tests:
- All new analytics calculation paths need a test in `test_scoring_rules.py`.
- Any new route that touches company data needs an access-isolation test.

### Frontend

```bash
cd frontend
npm run lint
npm run build    # must succeed with no type errors
```

---

## Pull request checklist

Before requesting review, confirm:

- [ ] `pytest tests/ -v` — all tests pass
- [ ] `npm run lint` — no errors
- [ ] `npm run build` — no build errors
- [ ] `alembic check` — no unapplied model changes (if you changed models)
- [ ] No secrets, API keys, or credentials committed
- [ ] No `Base.metadata.create_all()` in production code paths
- [ ] All new routes use `Depends(get_company_scope)`
- [ ] PR description explains **why**, not just what
- [ ] If fixing a known issue, reference the issue ID (e.g. "Resolves KI-007")

---

## Commit messages

Use the imperative mood in the subject line. Keep it under 72 characters. Reference the area of the codebase:

```
fix(analytics): handle null expenses in EBITDA recast
feat(ingestion): add Excel .xlsx support to P3 validator
chore(deps): upgrade fastapi to 0.116
docs: add DATA_MODEL.md ontology reference
migration: add cascade delete to company_engagement_billing
```

---

## Environment variables

- Never commit `.env` files — they are gitignored.
- When you add a new env variable, add it to **both** `.env.example` files (backend and/or frontend) with a clear comment explaining what it does and where to find the value.
- Mark optional variables with a comment; make required variables obvious.

---

## Questions?

- Codebase orientation: [`docs/SPRINT_KICKOFF.md`](docs/SPRINT_KICKOFF.md)
- Data model reference: [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)
- Demo fixture: [`docs/DEMO_FIXTURE.md`](docs/DEMO_FIXTURE.md)
- Known issues: [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md)
- Architecture: [`README.md`](README.md)
