# Hackathon Web App

Web app with sign up (Google or email), login, and user profile. Built with React + Vite + Tailwind, Node.js + Express, and Supabase (auth + PostgreSQL).

## Prerequisites

- **Node.js 18 or 20** (required for the frontend; Node 14–17 will fail with `base64url` or `??=` errors)
- A [Supabase](https://supabase.com) project (free tier)

**Upgrading Node:** Install from [nodejs.org](https://nodejs.org) (LTS) or use [nvm](https://github.com/nvm-sh/nvm): `nvm install 20 && nvm use 20`. This repo has an `.nvmrc`; from the project root run `nvm use` if you use nvm.

## Supabase setup (do once in browser)

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication > Providers**: enable **Email** and **Google**.
   - For Google: create OAuth 2.0 credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add authorized redirect URI from Supabase dashboard, then paste Client ID and Secret in Supabase.
3. **Authentication > URL Configuration**: set Site URL to `http://localhost:5173` (dev) and add `http://localhost:5173/**` to Redirect URLs.
4. **SQL Editor**: run the migration to create `profiles` and RLS:
   - Copy the contents of `supabase/migrations/001_profiles.sql` and run it in the SQL Editor.
5. In **Project Settings > API**: copy **Project URL** and **anon public** key for the client; copy **service_role** key for the server (keep it secret).

## Local development

### 1. Environment

```bash
# Client
cp client/.env.example client/.env
# Edit client/.env: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Server
cp server/.env.example server/.env
# Edit server/.env: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT, CLIENT_URL
```

### 2. Install and run

**Option A – one command (from project root, Node 18+):**

```bash
npm run install:all   # once: install root + server + client deps
npm run dev           # starts backend and frontend together
```

**Option B – two terminals (from project root):**

```bash
# Terminal 1 – backend
npm run dev:server

# Terminal 2 – frontend
npm run dev:client
```

**Option C – two terminals (cd into folders):**

```bash
# Terminal 1 – backend
cd server && npm run dev

# Terminal 2 – frontend
cd client && npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://localhost:4000](http://localhost:4000)

## Project structure

```
├── client/          # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/   # ProtectedRoute, etc.
│   │   ├── pages/       # Landing, Login, SignUp, Profile
│   │   ├── lib/         # supabase.js
│   │   └── App.jsx
│   └── .env
├── server/          # Express API
│   ├── src/
│   │   ├── routes/      # profile.js
│   │   ├── middleware/ # auth.js (JWT)
│   │   ├── controllers/
│   │   └── index.js
│   └── .env
├── supabase/
│   └── migrations/     # 001_profiles.sql
└── README.md
```

## API (optional)

The app uses the Supabase client in the frontend for auth and profile. The Express server provides optional profile endpoints:

- `GET /api/profile` – returns the authenticated user’s profile (requires `Authorization: Bearer <access_token>`).
- `PATCH /api/profile` – update profile (body: `full_name`, `avatar_url`).

Get the access token from the frontend: `const { data: { session } } = await supabase.auth.getSession(); session?.access_token`.

## Deployment

### Frontend (Vercel)

1. Connect the repo to Vercel.
2. Set root directory to `client`.
3. Build command: `npm run build`; output: `dist`.
4. Add env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

### Backend (Render)

1. New Web Service, connect repo.
2. Root directory: `server`.
3. Build: `npm install`; start: `npm start`.
4. Add env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLIENT_URL` (your Vercel URL), `PORT` (optional).

### Supabase after deploy

In **Authentication > URL Configuration**, set:

- Site URL: your production frontend URL (e.g. `https://your-app.vercel.app`).
- Redirect URLs: add `https://your-app.vercel.app/**`.

## Security

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in the frontend; use it only in the server.
- RLS is enabled on `profiles`: users can only read/update their own row.
