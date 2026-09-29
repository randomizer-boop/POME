# POME — personal finance that answers one question

> **Live:** https://&lt;your-app&gt;.vercel.app · **Demo:** “Try the demo” on the sign-in screen (no sign-up) · **Code:** https://github.com/&lt;you&gt;/pome

---

## RU

### Коротко
POME — веб-приложение для личных финансов, которое каждый день отвечает на один вопрос: **«Сколько я могу потратить сегодня, чтобы в конце месяца всё сошлось?»** Название — от английского *pomegranate*, гранат: символ изобилия и бренд-мотив приложения. Маскот — благородный олень (марал): богатство, достоинство, спокойствие; нарисован в том же народном стиле, что и гранатовое дерево.

### Проблема
Обычные трекеры показывают, сколько денег *уже ушло*. Но решение человек принимает в моменте — у кассы — и ему нужно одно число на сегодня, в котором уже учтены аренда, подписки и откладывание на цели.

### Решение
- **«Можно потратить сегодня»** — от реальных денег, а не от дохода: баланс наличных и основного счёта − обязательные платежи до следующей зарплаты − ещё не отложенные взносы на цели − свой % сбережений с дохода (выбирается в онбординге, по умолчанию 5%; уже переведённое на «Сбережения» засчитывается), делённое на дни до зарплаты (включая сегодня). Без зарплаты в регулярных — до конца месяца. Формула раскрывается в карточке «Как считается»; можно посмотреть любой прошлый день — «как было на конец дня».
- **Регулярные платежи** списком по датам, уведомлением «к оплате» и кнопками «Оплатить» / «Уже оплачено». «Уже оплачено» находит среди трат ту, что похожа на платёж (сумма ±2%, категория или название), и привязывает её — без двойного учёта.
- **Счета и переводы**, бюджет по категориям, цели накоплений, аналитика, прогноз и «Что если?» (сократить категорию на N% → как изменятся цели).
- **Настройка-мастер** на весь экран: % сбережений → зарплата → обязательные платежи → остатки на счетах → бюджет → цель. Уже пришедшая зарплата и оплаченные платежи записываются, не меняя введённый остаток — ничего не считается дважды.
- **История**: переключение месяцев, для прошлых — «Итог месяца».
- **5 валют** (₸, ₮, $, €, ¥) с живым курсом; **RU / EN**; **телефон**; **демо-режим** только для чтения.

### Ключевые решения
1. **Без собственного бэкенда.** Браузер работает с Postgres напрямую через Neon Data API; вход — Neon Auth (Google + Email). Изоляция данных — Row-Level Security: каждая строка несёт `user_id`, политика `auth.user_id() = user_id`. Меньше кода, дешевле, нечему «падать».
2. **Деньги хранятся в валюте ввода.** Первая версия переводила всё в USD и округляла до центов — 1 500 000 ₸ превращались в 1 499 999 ₸. Теперь каждая строка хранит свою валюту и сумму в минимальных единицах (bigint), а в базовую валюту приложение пересчитывает только для расчётов. Введённое остаётся точным при любом курсе.
3. **Оптимистичные изменения с откатом.** Интерфейс обновляется мгновенно, запись в базу идёт в фоне; при ошибке состояние откатывается и показывается понятное сообщение.
4. **Безопасность.** Row-Level Security на каждой таблице, вход по коду из письма (без пароля), автовыход через 30 минут бездействия, «выйти на всех устройствах», правила нового пароля, security-заголовки.
5. **Состояние выводится из данных, а не хранится.** Прогресс гайда, статус платежей («оплачено / просрочено»), остатки счетов считаются из операций — нет рассинхрона.
6. **Чистая логика отдельно от UI.** Все денежные расчёты — в `modules/<feature>/logic.ts` и одной чистой функции `summarize()`; компоненты только показывают. Запланированное (регулярные платежи, ожидаемый доход) и фактическое (транзакции) разделены, переводы между своими счетами не считаются ни доходом, ни расходом. Суммы складываются в целых микро-единицах — без ошибок плавающей точки. 125 unit-тестов, включая крайние случаи: нулевой доход, отрицательный баланс, конец месяца, февраль, несколько валют, просроченная цель.

### Стек
React 19 · TypeScript · Vite · Tailwind v4 (дизайн-токены) · Neon Postgres + Neon Auth + Data API (RLS) · Vercel · Vitest

### Моя роль
Продукт и UX: проблема, сценарии, формула «сколько можно потратить», дизайн (гранатовое дерево, спокойная палитра, направляющие линии), приоритеты и тестирование на себе. Разработка — вместе с AI-ассистентом (Claude): я ставила задачи, принимала архитектурные решения и проверяла результат.

---

## EN

### In one line
POME is a personal-finance web app that answers one question every day: **“How much can I spend today and still end the month on track?”** The name comes from *pomegranate* — a symbol of abundance and the app’s visual motif. The mascot is a noble deer (maral) — wealth, dignity and calm — drawn in the same folk style as the tree.

### Problem
Typical trackers show what you’ve *already spent*. But spending decisions happen in the moment, at the checkout — you need one number for today that already accounts for rent, subscriptions and savings.

### Solution
- **Safe to spend today** — from real money, not income: cash + main balance − bills due before the next payday − goal contributions not yet set aside − your savings % of income (picked in onboarding, 5% by default; money already moved to Savings counts), divided by the days until payday (today included); month end if no salary is set up. The card explains the formula; any past day can be viewed “as it was at the end of that day”.
- **Recurring payments** as a due-date list, a “due” alert and **Pay / Already paid**. “Already paid” finds the matching expense (amount ±2%, same category or name) and links it — no double counting.
- **Accounts & transfers**, category budgets, savings goals, analytics, a forecast and **What if?** (cut a category by N% → see how goals move).
- **Full-screen setup wizard**: savings % → salary → fixed payments → balances now → budget → goal. Salary already received and bills already paid are recorded without changing the typed balance — nothing is counted twice.
- **History**: switch months; past months show a month summary.
- **5 currencies** (KZT, MNT, USD, EUR, CNY) with live rates · **RU / EN** · **mobile** · read-only **demo mode**.

### Key decisions
1. **No custom backend.** The browser talks to Postgres through Neon Data API; sign-in via Neon Auth (Google + email). Isolation is Row-Level Security — every row has `user_id`, policy `auth.user_id() = user_id`.
2. **Money is stored in the currency it was entered in.** v1 converted everything to USD and rounded to cents — ₸1,500,000 came back as ₸1,499,999. Now each row keeps its currency and an integer minor-unit amount; conversion to the base currency happens only for calculations, so typed amounts stay exact at any rate.
3. **Optimistic updates with rollback** — instant UI, background writes, clear error on failure.
4. **Security** — RLS on every table, passwordless email-code sign-in, 30-min idle sign-out, sign out on all devices, new-password rules, security headers.
5. **Derived, not stored, state** — guide progress, bill status and balances are computed from transactions, so nothing drifts out of sync.
6. **Pure logic separate from UI** — every money calculation lives in `modules/<feature>/logic.ts` and one pure `summarize()`; components only display. Planned (recurring, expected income) and actual (transactions) are kept apart; transfers between own accounts are never income or spending. Sums use integer micro-units — no floating-point drift. 125 unit tests incl. edge cases: zero income, negative balance, month end, February, multiple currencies, overdue goal.

### Stack
React 19 · TypeScript · Vite · Tailwind v4 (design tokens) · Neon Postgres + Neon Auth + Data API (RLS) · Vercel · Vitest

### My role
Product & UX: problem framing, flows, the safe-to-spend model, visual design, prioritisation and dogfooding. Built together with an AI coding assistant (Claude): I defined the tasks, made the architecture calls and reviewed the results.
