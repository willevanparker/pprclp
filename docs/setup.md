# pprclp setup guide

## Supabase

1. Create a new Supabase project.
2. Go to **Authentication → Providers → Email** and make sure email/password signups are enabled.
3. The MVP intentionally does not use magic links. The app only uses Supabase email/password methods: `signUp` and `signInWithPassword`.
4. Go to **SQL Editor** and run the full contents of `supabase/schema.sql`.
5. Confirm Row Level Security is enabled on `profiles`, `habits`, and `habit_logs`.

## Local environment

For local development, copy the config template:

```bash
cp src/config.example.js src/config.js
```

Then edit `src/config.js`:

```js
window.PPRCLP_CONFIG = {
  supabaseUrl: 'https://your-project-ref.supabase.co',
  supabaseAnonKey: 'your-anon-public-key',
};
```

Run the local static server:

```bash
npm run dev
```

Open `http://localhost:5173`.

## Netlify

1. Connect the repository to Netlify.
2. Set the build command to:

```bash
npm run build
```

3. Set the publish directory to:

```bash
dist
```

4. Add Netlify environment variables:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

5. Deploy. The build script writes those values into `dist/src/config.js`, and the included `netlify.toml` routes all paths to `index.html` for the single-page app.

## Required SQL

Use `supabase/schema.sql` as the source of truth. It creates:

- `profiles`: `id`, `first_name`, `last_name`, `created_at`
- `habits`: `id`, `user_id`, `name`, `current_streak`, `created_at`
- `habit_logs`: `id`, `habit_id`, `user_id`, `log_date`, `completed`, `created_at`
- unique daily log constraint on `habit_id` and `log_date`
- owner-only Row Level Security policies for all three tables
