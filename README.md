# next-supabase-saas-starter

A multi-tenant SaaS starter built with Next.js and Supabase: auth, tenant workspaces, invite-based onboarding, tenant-level Stripe billing, an admin panel (members, invitations, audit log, API keys), i18n, and web push notifications — all wired up and ready to build a product on top of.

See [`SETUP.md`](./SETUP.md) for step-by-step local setup.

## Stack

| Layer            | Technology                                         |
|------------------|-----------------------------------------------------|
| Framework        | Next.js 16 (App Router) + TypeScript                |
| Styling          | Tailwind CSS v4                                     |
| Database         | Supabase (PostgreSQL + Auth + RLS)                  |
| i18n             | next-intl (EN, AR — RTL for Arabic)                 |
| Billing          | Stripe (tenant-level subscription)                  |
| PWA              | Service Worker + Web Push (VAPID)                   |
| Testing          | Vitest                                              |
| Deployment       | Netlify (via `@netlify/plugin-nextjs`)              |

## Core features

- **Multi-tenant workspaces** — users can belong to multiple tenants, each with its own members and role (`admin` / `supervisor` / `worker`).
- **Invite-only onboarding** — admins generate invite links; new users register and land directly in the tenant.
- **Admin panel** — members, invitations, audit log, and API keys.
- **Billing** — tenant-level Stripe subscription with a grace period before access is blocked on payment failure.
- **Web push notifications** — VAPID-based subscribe/unsubscribe, service worker included.
- **i18n** — English and Arabic (RTL) out of the box via next-intl.

## Quick start

```bash
npm install
npm run dev
```

Then follow [`SETUP.md`](./SETUP.md) to provision Supabase, run the schema, and bootstrap an admin user.

## Tests

```bash
npm run test        # run once
npm run test:watch  # watch mode
```

## Project structure

```
app/
├── (auth)/{login,invite}/       # Auth + invite-based onboarding
├── [tenantId]/(dashboard)/      # App shell, admin panel, dashboard
├── [tenantId]/billing/          # Subscription status + Stripe Checkout/Portal
├── actions/                     # Server actions (tenants, team, admin, billing, ...)
└── api/webhooks/                # Stripe webhook

utils/                           # Supabase clients, Stripe client, access gates
supabase/migrations/             # Schema migrations
messages/                        # en.json, ar.json (i18n strings)
```

## Deployment

The repo is configured for Netlify via `netlify.toml`. Connect the GitHub repo, set the environment variables from `.env.local` in the Netlify dashboard, and deploy.
