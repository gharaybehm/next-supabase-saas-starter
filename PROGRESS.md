# Micro MLS — Project Progress

## Stack
Next.js 16 (App Router) · Supabase · Tailwind CSS v4 · next-intl (EN/AR) · Dropbox Sign · Netlify

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
| 15 | Broker contact via WhatsApp | ✅ Done | "Message Broker" button on listing detail → `wa.me` deep link with pre-filled listing context |
| 16 | Push notifications on new message | ➖ N/A | Replaced by WhatsApp; VAPID infra remains for future use |
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
| 24 | API v1 Phase 3 — market trends | 🔲 Todo | Aggregated analytics for external tools |
| 25 | Advanced search | ✅ Done | `ListingsFilterBar` — area, type, beds, price, size, status, sort (8 filters) |
| 26 | DLD / RERA API integration | 🔲 Todo | Automatic Trakheesi permit verification |
| 27 | Decentralized media storage | 🔲 Todo | Migrate from Supabase Storage → Filebase/Sia |

---

## Setup Checklist (before going live)

- [ ] Create Supabase project and fill in `.env.local`
- [ ] Run `npx supabase db push` to apply both migrations
- [ ] Create admin user in Supabase Auth, set role = `admin` in `user_profiles` + `tenant_members`
- [ ] Create the community tenant (one-time, from the app)
- [ ] Create Dropbox Sign account, get API key, set webhook URL → `/api/webhooks/dropboxsign`
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
│   ├── actions/                    ← Server actions (listings, admin, invitations)
│   └── api/
│       ├── v1/                     ← Public REST API
│       └── webhooks/dropboxsign/   ← Dropbox Sign webhook
├── utils/
│   ├── dropboxsign.ts              ← Agreement generation + sending
│   └── requireAgreement.ts         ← Page-level agreement gate
└── messages/
    ├── en.json                     ← English translations
    └── ar.json                     ← Arabic translations
```
