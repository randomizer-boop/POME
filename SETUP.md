# POME — setup (Neon + Vercel)

No backend server: the browser talks to Neon directly (Neon Auth + Data API),
and Row-Level Security makes every user see only their own rows.

## 1. Neon (free plan)
1. console.neon.tech → **New project**.
2. **Auth** tab → enable Neon Auth.
   - Email + password is on by default.
   - Google: works out of the box with Neon's shared dev keys; for production add your own
     Google OAuth Client ID/Secret (Google Cloud Console → Credentials).
3. **Data API** tab → enable it (auth provider: Neon Auth). Copy the **API URL**.
4. **SQL Editor** → paste and run `db/schema.sql`.

## 2. Local
```bash
npm install
cp .env.example .env      # paste the Data API URL into VITE_NEON_DATABASE_URL
npm run dev
```
Without `.env` the app still runs — only the demo is available.

## 3. Vercel
1. Import the GitHub repo (framework: Vite — detected automatically).
2. Settings → Environment Variables → `VITE_NEON_DATABASE_URL` = same URL.
3. Deploy, then in Neon → Auth → **Domains** add your `https://<app>.vercel.app`
   (otherwise sign-in redirects are blocked).

## Checks
```bash
npm test && npm run typecheck && npm run build
```
