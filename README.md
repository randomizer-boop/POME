# POME

Personal finance that answers one question: **how much can I spend today?**

- **Safe to spend today** — balance + expected income − upcoming bills − goal money still to set aside − your savings % of income (already moved to Savings counts), spread over the days left; any past day can be looked at
- Recurring payments with *Pay / Already paid*, accounts & transfers, category budgets, savings goals
- Analytics, forecast and *What if?*, month history
- Export a report for any period: Excel (summary, operations, transfers, bills, goals, budget on separate sheets) or CSV — built in the browser
- 5 currencies with live rates (amounts stored in the currency they were entered in), RU / EN, mobile, read-only demo

**Stack:** React 19 · TypeScript · Vite · Tailwind v4 · Neon (Postgres + Auth + Data API with Row-Level Security) · Vercel · Vitest

```
src/
  app/          shell: sidebar, auth screen, menus, loading
  modules/<x>/  one folder per feature: logic.ts (pure, tested) + UI
  store/        session, settings, finance store (optimistic updates), derived month summary
  data/         repository (DB ⇄ domain), currency conversion, demo seed
  shared/       types, formatting, i18n, UI primitives
db/             schema.sql + migrations/
```

Setup: [SETUP.md](SETUP.md) · Finance model: [FINANCE_MODEL.md](FINANCE_MODEL.md) · Product story & decisions: [PORTFOLIO.md](PORTFOLIO.md)

```bash
npm install && npm run dev      # without .env only the demo is available
npm test && npm run typecheck && npm run build
```
