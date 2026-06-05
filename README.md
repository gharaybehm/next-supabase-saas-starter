# next-supabase-saas-starter

A production-ready Next.js SaaS starter template with multi-tenant auth, role-based access, i18n (EN/AR/TR) with RTL, PWA + service worker, and Web Push notifications.

## Stack

| Layer        | Technology                                    |
|--------------|-----------------------------------------------|
| Framework    | Next.js 16 (App Router) + TypeScript          |
| Styling      | Tailwind CSS v4                               |
| Database     | Supabase (PostgreSQL + Auth + RLS)            |
| i18n         | next-intl (EN, AR, TR — cookie-based, no URL prefix) |
| PWA          | Service Worker + Web Push (VAPID)             |
| AI (opt.)    | @anthropic-ai/sdk via OpenRouter              |
| Deployment   | Netlify (via `@netlify/plugin-nextjs`)        |

## Features

- **Multi-tenant** — each user can belong to up to 3 workspaces; role-based access (admin / supervisor / worker)
- **Auth** — Supabase email + password with "Remember Me" (session vs. 30-day cookie)
- **i18n** — EN, AR, TR; RTL layout for Arabic; locale persisted via cookie
- **PWA** — installable, offline-capable dashboard, Web Push notifications
- **Navigation** — desktop sidebar + top nav, mobile bottom nav with "More" drawer, workspace-switcher tabs

## Quick Start

### 1. Clone via GitHub template

Click **"Use this template"** on GitHub → create a new repo → clone it locally.

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Supabase project

Go to [supabase.com](https://supabase.com) → New project → note your **Project URL** and **anon key**.

### 4. Set up environment variables

```bash
cp .env.local.example .env.local
```

Fill in the values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

For Web Push (optional):
```bash
npx web-push generate-vapid-keys
```
Copy the output into `.env.local`.

### 5. Apply the database schema

**Option A — Supabase CLI:**
```bash
npx supabase link --project-ref YOUR_PROJECT_ID
npx supabase db push
```

**Option B — Supabase Studio:**
Open `supabase/migrations/20240101000000_core_schema.sql` and paste it into **SQL Editor → New query** in your Supabase dashboard.

### 6. Regenerate TypeScript types

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > utils/supabase/types.ts
```

### 7. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Customisation Guide

### Rename "workspace" to your domain concept

Search and replace across the project:
- `tenant` / `Tenant` → your entity (e.g. `project`, `organisation`, `farm`)
- `workspace` → your label

Files to update:
- `utils/supabase/tenant-types.ts`
- `app/actions/tenants.ts`
- `app/components/tenants/`
- `supabase/migrations/` (rename tables)
- `messages/*.json` (`nav.tenants`, etc.)

### Add nav pages

1. Create `app/[tenantId]/(dashboard)/your-page/page.tsx`
2. Add an entry to `navigation` in `app/components/Sidebar.tsx`
3. Add an entry to `primaryNav` or `secondaryNav` in `app/components/BottomNav.tsx`
4. Add the page slug to `PAGE_SLUG_TITLES_KEY` in `app/components/TopNav.tsx`
5. Add the slug to `PAGE_SLUGS` in `app/components/tenants/TenantTabs.tsx`
6. Add i18n keys to `messages/*.json`

### Brand colours

Edit `app/globals.css` → `@theme` block. The `--color-brand-*` variables control all accent colours site-wide.

### App name / logo

- Replace `public/icon.png` and `public/logo-full.png`
- Update `metadata` in `app/layout.tsx`
- Update `public/manifest.json`
- Update `messages/en.json` → `auth.login.logoAlt` and `auth.login.tagline`

### AI integration

The `@anthropic-ai/sdk` package is included. Set `OPENROUTER_API_KEY` in `.env.local` and call Claude via OpenRouter from any server action or API route.

### Remove languages you don't need

Edit `i18n/routing.ts`:
```ts
locales: ['en'],   // remove 'ar', 'tr'
```
Then delete the unused `messages/*.json` files and remove the `Noto_Sans_Arabic` font from `app/layout.tsx`.

---

## Project Structure

```
app/
├── (auth)/login/           # Login page + server action
├── [tenantId]/(dashboard)/ # Per-tenant pages (layout + dashboard placeholder)
├── tenants/                # Workspace picker / create wizard
├── actions/                # Server actions (auth, tenants, settings)
├── api/push/               # Web Push subscribe/unsubscribe routes
├── components/
│   ├── auth/               # SignOutButton
│   ├── tenants/            # TenantPicker, TenantTabs, CreateTenantWizard
│   ├── TopNav.tsx
│   ├── Sidebar.tsx
│   ├── BottomNav.tsx
│   └── ServiceWorkerRegistration.tsx
├── layout.tsx              # Root layout (i18n, fonts, RTL, PWA)
└── globals.css             # Tailwind v4 + brand colour tokens

i18n/                       # next-intl routing + request config
messages/                   # en.json, ar.json, tr.json
utils/supabase/             # client, server, admin factories + types
utils/push.ts               # sendPushToTenant() server utility
supabase/migrations/        # Core schema SQL
public/
├── sw.js                   # Service worker
├── manifest.json           # PWA manifest
└── icon.png                # App icon (replace this)
```

## Deployment

### Netlify

1. Connect your GitHub repo to Netlify
2. Add all `.env.local` variables as **Environment variables** in the Netlify dashboard
3. Deploy — `netlify.toml` handles the rest

---

## License

MIT
