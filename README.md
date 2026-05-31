# pprclp

pprclp is a clean MVP habit tracker inspired by James Clear's paper clip habit story. It keeps the V1 product intentionally lightweight: email/password authentication, habit creation, daily Yes/No logging, and visible streaks.

## Project file structure

```text
pprclp/
├── docs/
│   └── setup.md              # Supabase, environment, and Netlify deployment instructions
├── scripts/
│   └── build.mjs             # Small static build script for Netlify
├── src/
│   ├── app.js                # Routing, Supabase auth, habit CRUD, and dashboard interactions
│   ├── config.example.js     # Local config template
│   └── styles.css            # Mobile-first app styling
├── supabase/
│   └── schema.sql            # Tables, constraints, indexes, and RLS policies
├── index.html
├── netlify.toml              # Netlify build and SPA redirect config
└── package.json
```

## Local development

```bash
cp src/config.example.js src/config.js
npm run dev
```

Edit `src/config.js` with your Supabase project URL and anon key before using auth or the dashboard. No install step is required for the static MVP.

## Supabase setup

1. Create a Supabase project.
2. In **Authentication → Providers → Email**, keep email/password enabled and turn off email confirmations if you want immediate password-only signups for the MVP.
3. Disable magic-link-only flows by using the app's password forms only. The app calls `signUp` and `signInWithPassword`; it does not call OTP or magic link APIs.
4. Open the Supabase SQL editor and run [`supabase/schema.sql`](supabase/schema.sql).
5. Copy your Project URL and anon public key into `src/config.js` for local development and into Netlify environment variables for deployment.

## Environment variables

For Netlify, set:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

For local development, copy `src/config.example.js` to `src/config.js` and fill in the same values.

## Netlify deployment

1. Push the repo to GitHub/GitLab/Bitbucket.
2. Create a new Netlify site from the repo.
3. Use build command `npm run build` and publish directory `dist`.
4. Add these environment variables in Netlify:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. `netlify.toml` includes the SPA redirect needed for direct links like `/dashboard`.

## Database

All required SQL lives in [`supabase/schema.sql`](supabase/schema.sql), including:

- `profiles`, connected to `auth.users`
- `habits`, connected to `auth.users`
- `habit_logs`, connected to both habits and users
- `unique (habit_id, log_date)` to prevent duplicate daily answers
- Row Level Security policies so users can only access their own data
