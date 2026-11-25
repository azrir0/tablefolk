# Publishing TableFolk Wave 1 Live

Follow these 4 steps (~10 minutes total, free tier friendly) to put **TableFolk** online so friends and players can join right away.

---

## Step 1 — Push Repo to GitHub

From `C:\Users\ma06\.gemini\antigravity\scratch\tablefolk`:

```powershell
git init
git add .
git commit -m "TableFolk Wave 1 Public Beta"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/tablefolk.git
git push -u origin main
```

---

## Step 2 — Create Free Managed PostgreSQL (Supabase or Neon)

> **Why?** Cloud containers wipe local disk files on redeploy, so we use a real managed PostgreSQL database instead of local dev PGlite. TableFolk automatically creates all tables and seeds *Sunlit Oak Café* & *Treasure Trails* on first boot!

- **Option A (Supabase — recommended since you plan to use Supabase later):**
  1. Go to [supabase.com](https://supabase.com) → **New Project** (`tablefolk`).
  2. Open **Project Settings → Database → Connection string → URI** (choose **Session Pooler** or **Direct**).
  3. Copy the URI (`postgresql://postgres:YOUR_PASSWORD@...`).
- **Option B (Neon):**
  1. Go to [neon.tech](https://neon.tech) → **Create Project** → copy the `DATABASE_URL` connection string.

---

## Step 3 — Deploy Multiplayer Game Server (`apps/game-server`)

Colyseus needs an always-on Node container for WebSockets. Pick either **Railway** (no sleep, ~$5/mo credit) or **Render** (free tier available):

### Option A: Render (1-Click Blueprint via `render.yaml`)
1. Go to [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint** → connect your `tablefolk` GitHub repo.
2. Render automatically detects `render.yaml` and `Dockerfile.server`!
3. Fill in the prompted environment variables:
   - `DATABASE_URL` = your Supabase/Neon Postgres URI
   - `WEB_ORIGIN` = leave blank for now (we'll set it to your Vercel URL in Step 4!)
   - `TABLEFOLK_JWT_SECRET` = auto-generated strong secret
4. Click **Apply** and wait ~2 minutes. Verify `https://YOUR-RENDER-URL.onrender.com/api/health` returns `{"ok":true}`.

### Option B: Railway
1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
2. In service **Settings → Build**, set **Dockerfile Path** to `Dockerfile.server`.
3. In **Variables**, add:
   - `NODE_ENV=production`
   - `PORT=2567`
   - `DATABASE_URL=<your Supabase/Neon URI>`
   - `TABLEFOLK_JWT_SECRET=<any 32+ char random secret>`
   - `WEB_ORIGIN=https://your-app.vercel.app` (update after Step 4)
4. Under **Settings → Networking**, click **Generate Domain** (port `2567`).

---

## Step 4 — Deploy Web App (`apps/web`) to Vercel (Free)

1. Go to [vercel.com/new](https://vercel.com/new) → import your `tablefolk` GitHub repo.
2. Set **Root Directory** to **`apps/web`** (Vercel automatically detects pnpm monorepo & Next.js!).
3. Add **Environment Variables**:
   - `NEXT_PUBLIC_API_URL` = `https://YOUR-GAME-SERVER-DOMAIN` (e.g. `https://tablefolk-game-server.onrender.com`)
   - `NEXT_PUBLIC_WS_URL` = `wss://YOUR-GAME-SERVER-DOMAIN` (note **`wss://`** for secure WebSockets!)
4. Click **Deploy**!
5. *(Final security polish)* Go back to your Game Server env vars (Render/Railway) and set `WEB_ORIGIN` to your live Vercel URL (e.g., `https://tablefolk.vercel.app`) so only your site can make browser requests to your server.

---

## Live Smoke Check Before Sharing Your Link
1. Open your live Vercel URL on desktop **and** on your phone.
2. Enter as a Guest, walk around **Sunlit Oak Café**, and verify your avatar syncs between both devices!
3. Open **Game Wardrobe**, grab *Treasure Trails*, sit at **Grand Lantern Table**, and play a match together (or with Practice Bots).
4. Create a **Private Café**, copy the invite link (`/cafe?code=XXXXXX`), and send it to a friend!
