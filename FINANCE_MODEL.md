# POME — finance model

All money maths lives in `src/modules/*/logic.ts` and is wired together once in
`summarize()` (`src/store/useMonthSummary.ts`). Components only display.
Every function is pure and covered by tests (`npm test`).

## Actual vs planned
| | Source | Counts as income/expense? |
|---|---|---|
| **Actual** | transactions | yes — the only source of real income and spending |
| **Planned** | recurring rules (bills, salary with category *Income*) | no — only once a transaction pays/receives it (`recurringId`, or “Already paid”) |
| **Transfers** | between own accounts | never; they only move balances. Into *Savings* = intentional saving |

## Formulas
| Number | Formula | Where |
|---|---|---|
| Balance of an account | opening + its transactions + transfers in − transfers out | `accounts/logic.accountBalances` |
| Spending balance | cash + main (Savings excluded — money already set aside) | `accounts/logic.LIQUID_ACCOUNTS` |
| **Pay cycle** | today … day before the next *Income* rule date (≤ 45 days ahead); no income rule → until month end | `safe-to-spend/cycle.payCycle` |
| Expected income | month forecast: *Income* rules due this month, not received (linked, or same amount ±2% recorded). Safe to spend: only income due **today** | `recurring/logic.expectedIncome`, `cycle.incomeDueToday` |
| Upcoming bills | owed occurrences not yet paid — month: this month's (overdue incl.); safe to spend: from the 1st of this month up to the next payday, payday included. Partly paid → only the rest | `recurring/logic.schedule`, `cycle.bills` |
| Bill ↔ payment | a payment = transaction linked to the rule, or an unlinked one that clearly is it (same category **and** account, amount ±2%; income: same category or name). Payments close occurrences oldest-first, up to 35 days before a due date (paid early on 29 Sep → 5 Oct is paid, 5 Nov still due). A rule is owed from the day it was added (or its first payment) — a bill/salary added on the 29th isn't “overdue since the 5th”. Last month's bills only take last month's payments | `recurring/logic.schedule` |
| Goals still to set aside | max(0, Σ planned monthly contributions − moved to Savings **this calendar month**, as of the day viewed); contribution capped by what's left | `goals/logic.goalsPlannedTotal` + `safe-to-spend` |
| Savings % | per account (`user_settings`), default 5 %, 0–90 %. **A target, not a reserve**: target = % × income in the **pay cycle**; progress = moved to Savings **in the pay cycle**, minus the part that paid this month's goals. It does **not** reduce spendable — only a real transfer to Savings does (it already left cash/main). Two windows never mixed: goals ↔ calendar month, savings % ↔ pay cycle | `safe-to-spend/logic` |
| **Spendable** | spending balance + income due today − bills until payday − goals still to set aside. Negative only when bills/goals aren't covered → shown as “Short by X” | `safe-to-spend/logic.computeSafeToSpend` |
| **Daily limit** (one number everywhere) | (spendable + spent today) ÷ days left incl. today — the card, the calendar header and every calendar day use this; a past day is compared with the limit it had at its start | `summarize.safeOnDay`, `dayLimits` |
| Earlier day | safe to spend “as of” a picked day: only transactions/transfers up to the end of that day; month totals don't change | `summarize(…, { day })` |
| **Safe to spend per day** | (spendable + spent today) ÷ days left in the cycle incl. today; today left = that − spent today | same |
| Budget remaining | limit − actual expenses in the category (planned bills don't count) | `budget/logic.buildBudget` |
| Savings rate | net moved into Savings ÷ income | `accounts/logic.savingsRate` |
| Goal | remaining = target − saved; needed / month = remaining ÷ calendar months left (overdue → all now) | `goals/logic.goalProgress` |
| Goal top-up | from cash/main = a real transfer into Savings (+ goal.saved); from Savings = goal only | `FinanceStore.contributeToGoal` |
| Forecast end balance | spending balance + expected income (month) − upcoming bills (month) − avg daily variable spend × days after today (first 6 days: last month's average) | `forecast/logic.projectMonthEnd` |
| Setup wizard: salary already received / bill already paid | recorded as a transaction (history, stats, marks the rule done) and the account's opening shifts by the same amount — the balance the user types stays exact, nothing is counted twice | `FinanceStore.addTransactionKeepBalance` |
| Reconcile reminder | 7 days since balances were last confirmed (✎ on an account or “All matches”) | `accounts/logic.needsReconcile` |
| Month result (past months) | income − expenses − moved to Savings | `summarize` |

## Money precision
- DB: integer minor units (`bigint`, cents/tiyn) + the currency the amount was entered in.
- App: base currency (USD) for maths; each row converted with today's rate, so a typed amount shows back exactly.
- Sums/differences go through integer micro-units (`src/shared/money.ts`: `sum`, `add`, `sub`, `divide`, `scale`) — no `0.1 + 0.2` drift.
