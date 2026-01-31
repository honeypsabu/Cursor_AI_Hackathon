# Setup checklist (after Step 1 – Supabase project created)

Do these in the Supabase dashboard, then run the app.

## Step 2 – Run the migration

1. In Supabase: **SQL Editor** → **New query**.
2. Open `supabase/migrations/001_profiles.sql` in your editor, copy all of it.
3. Paste into the SQL Editor and click **Run**.

## Step 3 – Enable auth providers

1. **Authentication** → **Providers**.
2. **Email**: leave enabled (default).
3. **Google**: turn on, then in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) create OAuth 2.0 credentials (Web application), add the redirect URI Supabase shows, and paste Client ID and Secret back into Supabase.

## Step 4 – Redirect URLs

1. **Authentication** → **URL Configuration**.
2. **Site URL**: `http://localhost:5173`
3. **Redirect URLs**: add `http://localhost:5173/**` → Save.

## Step 5 – Copy API keys

1. **Project Settings** (gear) → **API**.
2. Copy **Project URL**, **anon public** key, and **service_role** key.

## Step 6 – Fill `.env` files

- **client/.env**: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (from Step 5).
- **server/.env**: set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (from Step 5). Leave `PORT=4000` and `CLIENT_URL=http://localhost:5173` unless you need different values.

## Step 7 – Run the app

**If you have Node 18+** (from project root):

```bash
npm run install:all
npm run dev
```

**If you have Node 14–17**, use two terminals from the project root:

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev:client
```

Then open **http://localhost:5173** and test sign up, login, and profile.
