# Publish your app (step-by-step)

## 1. Push to GitHub

If you haven’t already:

```bash
cd /Users/honeysabu/Cursor_AI_Hackathon/Cursor_AI_Hackathon
git init
git add .
git commit -m "Initial commit"
```

Create a new repo on [github.com](https://github.com/new), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

(Replace `YOUR_USERNAME` and `YOUR_REPO` with your repo.)

---

## 2. Deploy frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub).
2. **Add New** → **Project** → import your GitHub repo.
3. **Root Directory:** click **Edit**, set to **`client`**, then **Continue**.
4. **Build and Output Settings** (Vercel usually detects Vite):
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. **Environment Variables** – add:
   - `VITE_SUPABASE_URL` = (from Supabase → Project Settings → API → Project URL)
   - `VITE_SUPABASE_ANON_KEY` = (anon public key)
6. Click **Deploy**. Wait for the build to finish.
7. Copy your frontend URL, e.g. `https://your-app.vercel.app`.

---

## 3. Deploy backend (Render)

1. Go to [render.com](https://render.com) and sign in (GitHub).
2. **New** → **Web Service** → connect the same GitHub repo.
3. **Settings:**
   - **Name:** e.g. `hackathon-api`
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free
4. **Environment** – add:
   - `SUPABASE_URL` = (same as frontend)
   - `SUPABASE_SERVICE_ROLE_KEY` = (from Supabase → Project Settings → API → service_role)
   - `CLIENT_URL` = your Vercel URL, e.g. `https://your-app.vercel.app`
   - `PORT` = leave default or `4000`
5. Click **Create Web Service**. Copy your backend URL, e.g. `https://hackathon-api.onrender.com`.

---

## 4. Update Supabase for production

1. Supabase dashboard → **Authentication** → **URL Configuration**.
2. **Site URL:** set to your Vercel URL, e.g. `https://your-app.vercel.app`.
3. **Redirect URLs:** add `https://your-app.vercel.app/**` (and keep `http://localhost:5173/**` for local dev).
4. Save.

---

## 5. Test the live app

1. Open your Vercel URL in the browser.
2. Sign up, log in, and edit your profile.
3. If something fails, check:
   - Vercel env vars (no typos, no extra spaces).
   - Render env vars and that the service is running (free tier may sleep after inactivity).
   - Supabase Site URL and Redirect URLs match your Vercel URL.

---

## Summary

| Service  | URL you get                   | Purpose           |
| -------- | ----------------------------- | ----------------- |
| Vercel   | https://your-app.vercel.app   | Frontend (React)  |
| Render   | https://your-api.onrender.com | Backend (Express) |
| Supabase | (already set up)              | Auth + DB         |

Your app is published when the Vercel URL loads and login/signup/profile work.
