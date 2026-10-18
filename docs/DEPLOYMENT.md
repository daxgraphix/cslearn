# Deploy to Vercel

## 1. Create and configure Supabase

1. Create a Supabase project and wait for the database to finish provisioning.
2. Open **SQL Editor**, create a query, paste the full contents of [`../supabase/schema.sql`](../supabase/schema.sql), and run it.
3. In **Project Settings → API**, copy the project URL, anon/public key, and service role key.
4. In **Authentication → URL Configuration**, set the Site URL to your production URL (for example, `https://your-project.vercel.app`). Add your production URL and any custom domain as Redirect URLs. Keep localhost URLs for local development if needed.

`schema.sql` is the consolidated snapshot through migrations `0001` to `0016`, including role-based course review, account deletion, transactional review actions, and role editing. Run it once on a new Supabase project only. It is not idempotent: rerunning it on an initialized database can produce duplicate-object errors such as `42710` for `account_status`.

For an existing project, do not rerun `schema.sql`. An error like `42710: type "account_status" already exists` means the database is already initialized; do not drop the existing database objects to get past it. Apply only migrations that have not already run, in numeric order. Migration `0014_account_deletion_foreign_keys.sql` defines account deletion behavior; `0015_review_workflow_actions.sql` adds permission-checked, race-safe review actions; `0016_admin_role_editing.sql` adds audited updates for custom roles. Delete accounts through the Supabase Auth Admin API; deleting from `profiles` alone is blocked by its reference to `auth.users`.

## 2. Deploy the app

1. Push the repository to GitHub and import it in Vercel. Vercel detects Next.js; keep the project root at the repository root and the build command as `npm run build`.
2. Add these variables in **Vercel → Project Settings → Environment Variables** for each environment you deploy:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key; server-only, never use a `NEXT_PUBLIC_` prefix |
   | `NEXT_PUBLIC_SITE_URL` | The deployed site origin, including scheme, such as `https://your-project.vercel.app` |
   | `JOB_RUNNER_SECRET` | Secret for `/api/jobs/run`, if using the job runner |
   | `SIGNED_URL_TTL` | Optional private-storage URL lifetime in seconds; defaults to `300` in `.env.example` |

3. Deploy, then update Supabase's Site URL and Redirect URLs to the final Vercel production URL (and custom domain, if used).
   Use the full origin, including `https://`, in both Vercel and Supabase. Add `https://your-project.vercel.app/auth/callback` and `https://your-project.vercel.app/auth/confirm` to Supabase Redirect URLs. Bare hostnames can be interpreted as relative paths by Supabase and produce malformed callback URLs.
4. Confirm the deployment builds and test registration/login, email callback, course browsing, and private file access.

## Password recovery email

The recovery template is stored at [`../supabase/templates/recovery.html`](../supabase/templates/recovery.html) and configured for local Supabase in `supabase/config.toml`. For a hosted project, copy that template into **Authentication → Email Templates → Reset Password** and save it; hosted Supabase templates are managed in the dashboard. This custom link sends the token hash to the app without consuming it on page load. The `/auth/confirm` page verifies it only after the person presses Continue. The email also includes a one-time-code fallback.

```html
<h2>Reset your password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery">Continue to reset your password</a></p>
<p>Or enter this verification code on the reset password page:</p>
<p style="font-size: 24px; font-weight: bold; letter-spacing: 0.2em">{{ .Token }}</p>
<p>If you did not request a password reset, you can ignore this email.</p>
```

Save the template and request a new reset email. The app verifies the link only after the Continue button is submitted, and the recovery page also accepts the email code. Older emails that have already expired or been consumed need a fresh reset email.

Never commit real environment values. Use the anon/public key in browser-capable settings; the service role key bypasses Row Level Security and must remain a Vercel server-side environment variable.
