# Deployment Guide

The app deploys as **two separate services**, both on free tiers:

- **Backend** (Express API + Socket.io) → **Render**
- **Frontend** (React/Vite SPA) → **Vercel**

---

## 0. Prerequisites

1. **Push the repo to GitHub** (Render and Vercel both deploy from a Git repo).
2. **MongoDB Atlas:**
   - Database Access → rotate the DB user's password (the old `todo:todo_10` is weak).
   - Network Access → add `0.0.0.0/0` (allow access from anywhere). Render's
     outbound IPs are not static on the free tier, so an allow-all entry is the
     practical choice for a small app.

---

## 1. Backend → Render

1. Go to [render.com](https://render.com) → **New** → **Blueprint**.
2. Connect this repository. Render detects [`render.yaml`](render.yaml) and shows
   the `expense-tracker-backend` service.
3. When prompted, fill the two secret values:
   - `MONGO_URI` — your Atlas connection string, with the rotated password.
   - `FRONTEND_URL` — put a placeholder for now (`http://localhost:3000`); you
     will correct it in step 3.
   - `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` — **leave these alone**,
     Render auto-generates them.
4. Click **Apply** / **Create**. Wait for the first deploy to finish.
5. Copy the service URL, e.g. `https://expense-tracker-backend.onrender.com`.
6. **Verify:** open `https://<backend-url>/health` — you should see
   `{"status":"ok","db":"connected",...}`.

---

## 2. Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import
   this repository.
2. Set **Root Directory** to `frontend`.
3. Framework preset: **Vite** (auto-detected). Build command `vite build` and
   output directory `dist` are auto-filled.
4. Add an **Environment Variable**:
   - `VITE_API_URL` = `https://<backend-url>/api`  ← note the **`/api`** suffix.
5. **Deploy.** Copy the resulting URL, e.g. `https://expense-tracker.vercel.app`.

---

## 3. Wire them together

1. In Render → `expense-tracker-backend` → **Environment** → set `FRONTEND_URL`
   to the **exact** Vercel URL — `https://expense-tracker.vercel.app`, **no
   trailing slash**. Save (this triggers a redeploy).
2. Open the Vercel URL, register an account, and log in.
3. Open browser DevTools → **Console** (no CORS errors) and **Application →
   Cookies** (the auth cookie is set).

---

## Notes

- **Cold start:** Render's free tier sleeps after ~15 min idle; the next request
  takes ~30–60s to wake it. Acceptable for a small/portfolio app.
- **HTTPS required:** in production the auth cookies use `secure: true` +
  `sameSite: 'none'`. Render and Vercel both serve HTTPS, so this works — it
  will **not** work over plain `http`.
- **Auto-deploy:** every push to the default branch redeploys both services, so
  later features go live automatically.
- **Region:** [`render.yaml`](render.yaml) sets `singapore`. Change it to match
  your Atlas cluster's region for the lowest database latency.
- **Env reference:** see `backend/.env.example` and `frontend/.env.example` for
  the full variable list.
