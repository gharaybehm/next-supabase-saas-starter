# Micro MLS

A micro-SaaS platform for a collaborative community of Dubai real estate brokers — a lightweight Multiple Listing Service (MLS) where brokers share listings, co-broker deals under a pre-signed digital agreement, and split commissions automatically.

See [`requirements.md`](../requirements.md) (project root) for the full product requirements, [`SETUP.md`](./SETUP.md) for step-by-step local setup, and [`PROGRESS.md`](./PROGRESS.md) for current feature status.

## Stack

| Layer            | Technology                                         |
|------------------|-----------------------------------------------------|
| Framework        | Next.js 16 (App Router) + TypeScript                |
| Styling          | Tailwind CSS v4                                     |
| Database         | Supabase (PostgreSQL + Auth + RLS)                  |
| i18n             | next-intl (EN, AR — RTL for Arabic)                 |
| E-signatures     | Dropbox Sign (Master Co-Brokerage Agreement)        |
| Billing          | Stripe (tenant-level subscription)                  |
| Media storage    | Filebase (S3-compatible)                            |
| PWA              | Service Worker + Web Push (VAPID)                   |
| Testing          | Vitest                                              |
| Deployment       | Netlify (via `@netlify/plugin-nextjs`)              |

## Core features

- **Invite-only onboarding** with a digital Master Co-Brokerage Agreement (Dropbox Sign) brokers must sign before accessing listings.
- **Listings** — submission, browse/search/filter, DLD permit tracking, multi-broker support (max 3, per DLD rules), image upload with automatic watermarking.
- **Deals & commissions** — configurable commission split, deal closing, auto-generated commission statement PDFs.
- **Broker contact via WhatsApp** deep-link (not in-app messaging — see `requirements.md` §3.4.1 for why).
- **Admin panel** — members, invitations, commission config, audit log, API keys.
- **Billing** — tenant-level Stripe subscription with a grace period before access is blocked on payment failure.
- **Public REST API** (`/api/v1/*`) for external CRM integration, including a market-trends aggregation endpoint.

## Quick start

```bash
npm install
npm run dev
```

Then follow [`SETUP.md`](./SETUP.md) to provision Supabase, run the schema, bootstrap an admin user, and (optionally) configure Dropbox Sign and Stripe.

## Tests

```bash
npm run test        # run once
npm run test:watch  # watch mode
```

## Project structure

```
app/
├── (auth)/{login,invite}/       # Auth + invite-based broker onboarding
├── [tenantId]/(dashboard)/      # Listings, admin panel, dashboard, pending-agreement
├── [tenantId]/billing/          # Subscription status + Stripe Checkout/Portal
├── actions/                     # Server actions (listings, deals, admin, billing, ...)
├── api/v1/                      # Public REST API
└── api/webhooks/                # Dropbox Sign + Stripe webhooks

utils/                           # Supabase clients, Stripe client, access gates
supabase/migrations/             # Schema migrations
supabase/setup.sql               # Consolidated schema for a fresh Supabase project
messages/                        # en.json, ar.json (i18n strings)
legal/agreement.md               # Master Co-Brokerage Agreement template
```

## Deployment

The repo is configured for Netlify via `netlify.toml`. Connect the GitHub repo, set the environment variables from `.env.local` in the Netlify dashboard, and deploy.
