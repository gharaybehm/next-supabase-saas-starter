# next-supabase-saas-starter

A Next.js SaaS starter with multi-tenant workspaces, role-based access enforced
in both code and Postgres RLS, organizations with Stripe seat billing, a
platform-operator area, i18n (EN/AR/TR) with RTL, a PWA with Web Push, and a
Docker image for Coolify or any Docker host. It ships with a Claude Code
workflow that runs `/code-review` and `/security-review` before every commit.

## Stack

| Layer        | Technology                                            |
|--------------|-------------------------------------------------------|
| Framework    | Next.js 16 (App Router) + TypeScript                  |
| Styling      | Tailwind CSS v4                                       |
| Database     | Supabase (Postgres + Auth + RLS), Cloud or self-hosted |
| i18n         | next-intl (EN, AR, TR; cookie-based, no URL prefix)   |
| Billing      | Stripe Checkout, Billing Portal and webhooks          |
| AI (opt.)    | OpenRouter through the `openai` SDK, server-side only |
| PWA          | Service worker + Web Push (VAPID)                     |
| Tests        | Vitest                                                |
| Hosting      | Docker (standalone Next.js), e.g. Coolify on a VPS    |

## Features

- **Workspaces (tenants)**: users belong to workspaces with the role admin,
  supervisor or worker. Every server action checks the role with
  `requireTenantRole`, and RLS enforces the same matrix in the database.
- **Organizations and billing**: each workspace belongs to an organization
  holding the Stripe subscription and a number of workspace seats. A solo user
  gets a one-person organization silently. The owner subscribes or manages
  billing from Settings → Billing.
- **Platform operator**: `/admin` for `super_admin` lists workspaces and
  subscribers with payment history. It shows counts, names and settings, never
  workspace content.
- **Auth**: email + password with "remember me", Google sign-in (always shows
  the account chooser), a session-refreshing request proxy.
- **i18n**: EN, AR, TR; RTL for Arabic; locale in a cookie.
- **PWA**: installable; the dashboard opens offline once visited; its cache is
  cleared on sign-out. Web Push per workspace or per user.
- **Error boundaries** for a page, the app and the root layout.

## Quick start

### 1. Create your repo and install

Click **Use this template** on GitHub, clone your new repo, then:

```bash
npm install
```

Use Node 24 (see `engines` in `package.json`; the Docker image uses the same).

### 2. Supabase

Create a project at [supabase.com](https://supabase.com), or use a
self-hosted Supabase. Note the **Project URL**, **anon key** and
**service_role key**.

### 3. Environment

```bash
cp .env.local.example .env.local
```

Fill in at least the Supabase values and `NEXT_PUBLIC_APP_URL`. Every other
block is optional and says what happens when it is unset.

### 4. Database

Apply the migrations in file-name order:

```
supabase/migrations/20240101000000_core_schema.sql
supabase/migrations/20261015000000_tenant_hardening.sql
supabase/migrations/20261015000100_super_admin_and_billing.sql
```

With the Supabase CLI: `npx supabase link --project-ref <id>` then
`npx supabase db push`. Or paste each file into Studio → SQL Editor. Each file
ends with checks to run afterwards.

Then regenerate types:

```bash
npx supabase gen types typescript --project-id <id> > utils/supabase/types.ts
```

### 5. Make yourself the platform operator (optional)

In Studio → SQL Editor, after you have signed up once:

```sql
UPDATE public.user_profiles SET role = 'super_admin'
 WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
```

Then open `/admin`.

### Tests

```bash
npm test
```

Runs the unit tests and applies every migration to an in-memory Postgres
(PGlite, with a stub of Supabase's `auth` schema), then checks the access
rules: what a member, an outsider and the service role can and cannot do.

### 6. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stripe

1. Create a product with a **recurring per-unit price**; its id goes in
   `STRIPE_PRICE_ID_TENANT_SEAT`. The quantity is the organization's seats.
2. Add a webhook endpoint at `https://<your app>/api/webhooks/stripe` for
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid` and
   `invoice.payment_failed`; its signing secret goes in `STRIPE_WEBHOOK_SECRET`.
3. Turn on the **Customer portal** in Stripe's settings (used by "Manage billing").
4. Locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

New organizations start as `trialing` with 3 seats. Change the default in the
billing migration, or the trial rule in `app/actions/tenants.ts`.

## Scheduled jobs

Routes under `/api/cron/` check `CRON_SECRET` sent as a bearer token
(`utils/cron-auth.ts`) and refuse everything in production when it is unset.
`/api/cron/ping` is the example. In Coolify, add a Scheduled Task:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/ping
```

## Deployment (Coolify or any Docker host)

1. Create an application from your repo with the **Dockerfile** build pack.
2. Add the variables from `.env.local.example`. Tick **Available at build
   time** for the `NEXT_PUBLIC_*` ones only: they are inlined into the browser
   bundle. Never make a server secret a build variable; the build does not
   need any.
3. Port 3000. Coolify's proxy handles TLS.
4. In Supabase → Auth → URL configuration, add
   `https://<your domain>/auth/callback` to the redirect URLs.

## Working with Claude Code

`CLAUDE.md` holds the project guide and the security model, and makes two
reviews part of every change:

- `/code-review` (use `high` for auth, RLS, billing and server actions)
- `/security-review`

Claude runs both on the pending diff before any commit, fixes or explains what
they find, runs lint, typecheck and tests, and records the outcome in
`PROGRESS.md`. Extend the Security model in `CLAUDE.md` as your app grows: the
reviews check against it.

## Customisation

### Rename "workspace" to your domain concept

Search and replace `tenant` / `Tenant` and the word "workspace" across `app/`,
`utils/`, `supabase/migrations/` (new migrations only) and `messages/*.json`,
and update `CLAUDE.md`.

### Add a page inside a workspace

1. Create `app/[tenantId]/(dashboard)/your-page/page.tsx`.
2. Add it to `navigation` in `app/components/Sidebar.tsx`, to
   `primaryNav`/`secondaryNav` in `app/components/BottomNav.tsx`, to
   `PAGE_SLUG_TITLES_KEY` in `app/components/TopNav.tsx` and to `PAGE_SLUGS` in
   `app/components/tenants/TenantTabs.tsx`.
3. Add its strings to all three `messages/*.json`.
4. Gate its actions with `requireTenantRole`; give any new table RLS.
5. To make it open offline, add its slug to `OFFLINE_PAGE` in `public/sw.js`.

### Brand, name and logo

- Colours: the `--color-brand-*` tokens in `app/globals.css`.
- Replace `public/icon.png` and `public/logo-full.png`; update `metadata` in
  `app/layout.tsx`, `public/manifest.json`, and `auth.login.*` in the messages.

### Remove languages

Set `locales` in `i18n/routing.ts`, delete the unused `messages/*.json`, and
remove `Noto_Sans_Arabic` from `app/layout.tsx`.

## Project structure

See `CLAUDE.md`.

## License

MIT
