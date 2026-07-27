# Micro MLS — Project Progress

## Stack
Next.js 16 (App Router) · Supabase · Tailwind CSS v4 · next-intl (EN/AR) · Dropbox Sign · Stripe · Netlify

---

## Phase 1 — MVP ✅ Complete

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | MLS database schema | ✅ Done | `supabase/migrations/20240102000000_mls_schema.sql` |
| 2 | Invitation-only broker onboarding | ✅ Done | `app/(auth)/invite/[token]/page.tsx` |
| 3 | Broker profile (RERA card, brokerage) | ✅ Done | `broker_profiles` table + registration form |
| 4 | Dropbox Sign agreement engine | ✅ Done | Reads `legal/agreement.md`, fills placeholders, sends as HTML |
| 5 | Agreement gate (pending-agreement page) | ✅ Done | `utils/requireAgreement.ts` + `pending-agreement/page.tsx` |
| 6 | Listing submission form | ✅ Done | `listings/new/page.tsx` — all required DLD fields |
| 7 | Listing browse + search/filter | ✅ Done | `listings/page.tsx` — area, type, price, size, status |
| 8 | Listing detail page | ✅ Done | Commission split, DLD permit, broker info |
| 9 | Admin panel | ✅ Done | Members, Invites, Commission config, Listings, Audit log, API Keys |
| 10 | Commission configuration | ✅ Done | Listing % / Cooperating % configurable by admin |
| 11 | Audit log | ✅ Done | Immutable append-only, visible to admin |
| 12 | EN + AR i18n (RTL) | ✅ Done | Full translation of all screens |
| 13 | Public REST API v1 | ✅ Done | `/api/v1/listings`, `/brokers`, `/commission`, status PATCH |
| 14 | API key management | ✅ Done | Generate, copy, revoke from admin panel |

---

## Phase 2 — Collaboration 🔲 In Progress

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 15 | Broker contact via WhatsApp | ✅ Done | "Message Broker" button on listing detail → `wa.me` deep link with pre-filled listing context. Replaces the originally-scoped in-app messaging system entirely — the `conversations`/`messages` schema was dropped (`supabase/migrations/20260703000000_drop_messaging.sql`), not just left unused |
| 16 | Push notifications on new message | ➖ N/A | No longer applicable — there is no in-app messaging to notify about |
| 17 | Image upload (listing photos) | ✅ Done | `app/actions/images.ts` · `AddPhotosPanel` · upload at creation + post-creation |
| 18 | Image watermarking | ✅ Done | `utils/images.ts` · Sharp SVG composite · broker name + RERA card bottom-right |
| 19 | Multi-broker DLD support | ✅ Done | `app/actions/co_brokers.ts` · `ManageCoBrokersPanel` · add/remove co-brokers, max 3 enforced |
| 20 | Deal tracking (Sold flow) | ✅ Done | `close/page.tsx` + `CloseDealForm.tsx` · `app/actions/deals.ts` |
| 21 | Commission statement PDF | ✅ Done | `app/components/pdf/CommissionStatementDocument.tsx` · `/api/[tenantId]/deals/[dealId]/commission-pdf` |
| 22 | API v1 Phase 2 endpoints | ✅ Done | `app/api/v1/deals/` — GET list, GET :id, POST close deal |

---

## Phase 3 — Advanced Features ✅ Mostly Done

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 23 | Analytics dashboard | ✅ Done | Dashboard home — My Performance (all users) + Platform Overview (admin): status counts, deal volume, top brokers/areas |
| 24 | API v1 Phase 3 — market trends | ✅ Done | `GET /api/v1/trends` — `app/api/v1/trends/route.ts`; avg price per area, avg price/sqft by type, listing volume by type, avg days on market, deal volume by month. Computed from our own `listings`/`deals` data, no external data source |
| 25 | Advanced search | ✅ Done | `ListingsFilterBar` — area, type, beds, price, size, status, sort (8 filters) |
| 26 | DLD / RERA API integration | 🔲 Todo | Automatic Trakheesi permit verification |
| 27 | Decentralized media storage | ✅ Done | Filebase (S3-compatible IPFS gateway) — `utils/storage.ts` |
| 29 | Broker license verification | 🔲 In Progress | DLD license upload + admin verification queue — `admin/verification/`, `dld-licenses` storage bucket |
| 30 | Push notifications | ✅ Done | End-to-end: profile toggle (`PushSubscribeToggle`) subscribes via `sw.js`/`push_subscriptions`; `utils/push.ts` (`sendPushToTenant`, `sendPushToUsers`) delivers to both browser Web Push and Expo mobile tokens, fires on new listing, deal closed, and broker verification decided — respects `notify_new_listings`/`notify_deal_updates` prefs |
| 31 | Invite emails | ✅ Done | `utils/email.ts` (Resend) — invite links are now emailed, not just copied; admin/team panels show emailed-vs-copy status + explicit copy-link button. No-ops without `RESEND_API_KEY`/`RESEND_FROM_EMAIL` (not yet set in production — pending domain verification) |
| 32 | Mobile app foundation | 🔲 In Progress | Companion mobile client reads Supabase directly via RLS. So far: `app/api/mobile/agreements/resend/route.ts` (session-JWT-authenticated agreement resend), `tenant_members_read_profiles` RLS policy for the mobile broker-directory/WhatsApp lookup, explicit FKs (`listings_broker_user_profiles_fkey` etc.) so PostgREST can embed broker info |

---

## Phase 4 — Billing ✅ Done

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 28 | Stripe subscription billing | ✅ Done | Tenant-level flat recurring subscription. `subscriptions` table, `app/actions/billing.ts` (Checkout + Customer Portal), `/api/webhooks/stripe`, `utils/requireSubscription.ts` gate on the dashboard layout, `/[tenantId]/billing` page. Grace period (7 days) on failed payment before hard block. |

---

## Setup Checklist (before going live)

- [ ] Create Supabase project and fill in `.env.local`
- [ ] Run `npx supabase db push` to apply both migrations
- [ ] Create admin user in Supabase Auth, set role = `admin` in `user_profiles` + `tenant_members`
- [ ] Create the community tenant (one-time, from the app)
- [ ] Create Dropbox Sign account, get API key, set webhook URL → `/api/webhooks/dropboxsign`
- [ ] Create Stripe account, create a recurring Price, set webhook URL → `/api/webhooks/stripe`, fill `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID`
- [ ] Fill `PLATFORM_NAME`, `PLATFORM_ADDRESS`, `PLATFORM_REP` in `.env.local`
- [ ] Generate VAPID keys (`npx web-push generate-vapid-keys`) and fill in `.env.local`
- [ ] Add logo image at `public/logo-full.png` and `public/icon.png`
- [ ] Deploy to Netlify (or run `npm run dev` locally)

---

## Key File Map

```
platform/
├── legal/agreement.md              ← Edit this to update the co-brokerage agreement
├── supabase/migrations/
│   ├── 20240101000000_core_schema.sql   ← Scaffold tables (tenants, users, push)
│   └── 20240102000000_mls_schema.sql    ← MLS tables
├── app/
│   ├── (auth)/invite/[token]/      ← Broker registration via invite link
│   ├── [tenantId]/(dashboard)/
│   │   ├── listings/               ← Browse, new, detail
│   │   ├── admin/                  ← Admin panel
│   │   └── pending-agreement/      ← Agreement signing gate
│   ├── [tenantId]/billing/         ← Subscription status + Checkout/Portal buttons
│   ├── actions/                    ← Server actions (listings, admin, invitations, billing)
│   └── api/
│       ├── v1/                     ← Public REST API
│       ├── webhooks/dropboxsign/   ← Dropbox Sign webhook
│       └── webhooks/stripe/        ← Stripe webhook (subscription sync)
├── utils/
│   ├── dropboxsign.ts              ← Agreement generation + sending
│   ├── requireAgreement.ts         ← Page-level agreement gate
│   ├── stripe.ts                   ← Stripe client
│   └── requireSubscription.ts      ← Dashboard-layout billing gate
└── messages/
    ├── en.json                     ← English translations
    └── ar.json                     ← Arabic translations
```
