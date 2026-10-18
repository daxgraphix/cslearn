# Deploy to Vercel

## 1. Create and configure Supabase

1. Create a Supabase project and wait for the database to finish provisioning.
2. Open **SQL Editor**, create a query, paste the full contents of [`../supabase/schema.sql`](../supabase/schema.sql), and run it.
3. In **Project Settings → API**, copy the project URL, anon/public key, and service role key.
4. In **Authentication → URL Configuration**, set the Site URL to your production URL (for example, `https://your-project.vercel.app`). Add your production URL and any custom domain as Redirect URLs. Keep localhost URLs for local development if needed.

`schema.sql` is the consolidated snapshot through migrations `0001` to `0011`, including starter roles, permissions, categories, settings, the CSGO platform name, the cohort RLS recursion fix, admin-created platform roles, and the non-learner review/certificate-read baseline. Run it once on a new Supabase project only. It is not idempotent: rerunning it on an initialized database can produce duplicate-object errors such as `42710` for `account_status`.

For an existing project, do not rerun `schema.sql`. Apply only migrations that have not already run, in numeric order. Projects that already ran migration `0010` should run [`../supabase/migrations/0011_nonlearner_review_certificate_read.sql`](../supabase/migrations/0011_nonlearner_review_certificate_read.sql) by itself to grant assigned-submission review and read-only certificate access to every role except Learner, including roles created in the future.

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
   Use the full origin, including `https://`, in both Vercel and Supabase. Add `https://your-project.vercel.app/auth/callback` to Supabase Redirect URLs for email verification and password reset links. Bare hostnames can be interpreted as relative paths by Supabase and produce malformed callback URLs.
4. Confirm the deployment builds and test registration/login, email callback, course browsing, and private file access.

## Password recovery email

In **Authentication → Email Templates → Reset Password**, replace the default one-use confirmation link with an app confirmation page and include the one-time code as a fallback. Email security scanners can consume Supabase confirmation links before the person opens the email; the app's `/auth/confirm` page waits for the person to press Continue before verifying the token.

```html
<h2>Reset your password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery">Continue to reset your password</a></p>
<p>Or enter this verification code on the reset password page:</p>
<p style="font-size: 24px; font-weight: bold; letter-spacing: 0.2em">{{ .Token }}</p>
<p>If you did not request a password reset, you can ignore this email.</p>
```

Save the template and request a new reset email. The app verifies the link only after the Continue button is submitted, and the recovery page also accepts the email code. Older emails that have already expired or been consumed need a fresh reset email.

Never commit real environment values. Use the anon/public key in browser-capable settings; the service role key bypasses Row Level Security and must remain a Vercel server-side environment variable.
