# POME — setup (Neon + Vercel)

No backend server: the browser talks to Neon directly (Neon Auth + Data API),
and Row-Level Security makes every user see only their own rows.

## 1. Neon (free plan)
1. console.neon.tech → **New project**.
2. **Auth** tab → enable Neon Auth. Copy the **Auth URL**.
   - Email + password is on by default.
   - Google: works out of the box with Neon's shared dev keys; for production add your own
     Google OAuth Client ID/Secret (Google Cloud Console → Credentials).
3. **Data API** tab → enable it (auth provider: Neon Auth). Copy the **API URL**.
4. **SQL Editor** → paste and run `db/schema.sql` (new project).
   Existing project: run the files in `db/migrations/` you haven't run yet (002, 003…),
   then Data API → **Refresh schema cache**.

## 2. Local
```bash
npm install
cp .env.example .env      # paste the Auth URL and the Data API URL
npm run dev
```
Without `.env` the app still runs — only the demo is available.

## 3. Vercel
1. Import the GitHub repo (framework: Vite — detected automatically).
2. Settings → Environment Variables → `VITE_NEON_AUTH_URL` and `VITE_NEON_DATA_API_URL` (same values as in `.env`).
3. Deploy, then in Neon → Auth → **Domains** add your `https://<app>.vercel.app`
   (otherwise sign-in redirects are blocked).

## Migrations to run on an existing database
- `db/migrations/004_user_settings.sql` — savings % stored per account (then Data API → Refresh schema cache).

## Account security
- **Sign-in with an email code** (passwordless): Neon Console → Auth → Settings → turn on *Sign-up and sign-in with Email* (Email OTP). Without it the “Sign in with a code” button returns an error; password and Google keep working.
- **Email verification** on sign-up: Neon Console → Auth → turn on email verification.
- **Forgot password**: code to email → new password (Email OTP reset); then the person signs in with the new password. Also adds a password to an account created with Google or an email code.
- **Verify at sign-up (code)**: after sign-up the app asks for the emailed code, then signs in.
- Built in: idle sign-out after 30 min, “Sign out on all devices”, stronger new-password rules, security headers (`vercel.json`), RLS on every table.
- True 2FA (TOTP / authenticator app) is on Neon Auth's roadmap (“MFA — coming soon”); add it when Neon ships the plugin.

## After any schema change
Run the migration in SQL Editor, then Neon → Data API → **Refresh schema cache**
(otherwise: `column "…" does not exist`).

## Checks
```bash
npm test && npm run typecheck && npm run build
```
