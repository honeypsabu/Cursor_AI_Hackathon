# Glimmer

> Connection is better in person. Find nearby people who share your wavelength—map, chat, plan meetups, and break the ice with profile-based prompts.

Built for the [Cursor 2-Day AI Hackathon](https://github.com/raminos/cursor-ai-hackathon-template) in Hamburg.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Hosting**: Vercel (client), Render (server optional)

## How to Run

### Prerequisites

- **Node.js 18 or 20** (LTS from [nodejs.org](https://nodejs.org) or `nvm use` with `.nvmrc`)
- A [Supabase](https://supabase.com) project (free tier)

### Supabase setup (once)

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication > Providers**: enable **Email**.
3. **Authentication > URL Configuration**: Site URL `http://localhost:5173`, add `http://localhost:5173/**` to Redirect URLs.
4. **SQL Editor**: run migrations in order from `supabase/migrations/` (e.g. `001_profiles.sql` through `009_connections_chat.sql`).
5. **Project Settings > API**: copy **Project URL** and **anon public** key (client); **service_role** key for server (keep secret).

### Local development

```bash
# Clone the repo
git clone https://github.com/your-team/glimmer.git
cd glimmer

# Install dependencies
npm run install:all

# Environment
cp client/.env.example client/.env
cp server/.env.example server/.env
# Edit client/.env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
# Edit server/.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLIENT_URL, PORT

# Run (frontend + backend)
npm run dev
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend**: [http://localhost:4000](http://localhost:4000)

**Alternative – two terminals:**

```bash
npm run dev:server   # Terminal 1
npm run dev:client   # Terminal 2
```

## Details

- **Map**: See yourself and others by location; emojis from “What do you want to do?” (status) or interests.
- **Connections & chat**: Send connection requests from map or profile; when accepted, chat with ice-breaker suggestions from the other person’s profile.
- **Meetup planning**: In each chat, set date, time, and place; after 24 hours without details, a prompt nudges you to plan.
- **Auth**: Email sign up / log in only (no Google).

### Project structure

```
├── client/          # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/   # ProtectedRoute, ErrorBoundary, etc.
│   │   ├── pages/        # Landing, Login, SignUp, ViewProfile, EditProfile, MapView, ChatsList, Chat
│   │   ├── constants/    # interests, profile options
│   │   ├── utils/        # iceBreakers
│   │   └── lib/          # supabase.js
│   └── .env
├── server/          # Express API (optional profile endpoints)
├── supabase/
│   └── migrations/      # profiles, storage, connections, chat, RLS
└── README.md
```

### Deployment

- **Frontend (Vercel)**: Root `client`, build `npm run build`, env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Backend (Render)**: Root `server`, env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLIENT_URL`, `PORT`.
- **Supabase**: Set production Site URL and Redirect URLs in Authentication.

## About

Glimmer was built using the [Cursor AI Hackathon template](https://github.com/raminos/cursor-ai-hackathon-template).
