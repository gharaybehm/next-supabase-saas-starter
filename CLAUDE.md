# CLAUDE.md

Guide for Claude Code (and any other agent) working in this repository. Rename
"tenant" and "workspace" below once you have renamed them in the code.

@AGENTS.md

## Project

A multi-tenant SaaS built on Next.js 16 (App Router), Supabase (Postgres, Auth,
RLS), Tailwind CSS v4 and next-intl (EN, AR, TR, with RTL for Arabic). A
*tenant* is an isolated workspace; users belong to tenants through
`tenant_members` with the role `admin`, `supervisor` or `worker`. Tenants
belong to an *organization*, which holds the Stripe subscription and the number
of tenant seats. `super_admin` is the platform operator.

`PROGRESS.md` records what is built. Keep it current (see Standing rules).

## Structure

```
app/
├── (auth)/login/              Login and sign-up (email + password, Google)
├── auth/callback/             OAuth / email-confirmation callback
├── tenants/                   Workspace picker and create wizard
├── [tenantId]/(dashboard)/    Pages inside a workspace (dashboard, settings, error boundary)
├── (superadmin)/admin/        Platform operator area (workspaces, subscribers)
├── actions/                   Server actions (auth, tenants, team, organizations, settings)
├── api/cron/                  Scheduled jobs, CRON_SECRET-protected (utils/cron-auth.ts)
├── api/webhooks/stripe/       Stripe webhook (signature-authenticated)
├── api/push/                  Web Push subscribe / unsubscribe
└── components/                UI by area (admin, auth, tenants, navs)
utils/
├── supabase/                  Clients, tenant-access.ts (requireTenantRole), roles.ts, types
├── openrouter.ts, ai-models.ts   The one AI client and the one place model names live
├── stripe.ts, email.ts, push.ts  External clients, all constructed lazily
└── cron-auth.ts, safe-redirect.ts
supabase/migrations/           SQL migrations, applied in file-name order
supabase/tests/rls.test.ts     Applies all migrations to PGlite and checks policies, grants, triggers
proxy.ts                       Next.js 16 request proxy (replaces middleware.ts)
messages/                      en.json, ar.json, tr.json
```

## Commands

```bash
npm run dev        # Dev server (Turbopack)
npm run build      # Production build (needs no secrets)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Unit tests, plus every migration applied to in-memory Postgres
                   # with the access rules checked (supabase/tests/rls.test.ts)
```

## Security model

These rules are what `/security-review` and `/code-review` check this repo
against (see "Review before every commit").

- **Every server action and route handler that touches tenant data gates on
  `requireTenantRole(tenantId, minimum)`** from `utils/supabase/tenant-access.ts`,
  before any read or write. Checking only that the user is signed in is a defect.
- **RLS enforces the same matrix in the database.** A new table with tenant data
  gets RLS enabled, policies built on `is_tenant_member()` / `has_tenant_role()`,
  and no `USING (true)`. Postgres ORs permissive policies together, so one
  broad policy left next to a narrow one opens the table.
- **The service-role client (`createAdminClient`) bypasses RLS.** Use it only
  after the role check, and validate every value from the client in code: a
  role from a form, an id that must belong to this tenant, the fields an update
  may change (copy an allow-list, never spread the client's object).
- **Columns a client may write are granted per column** on `user_profiles` and
  `tenants`. The platform role (`user_profiles.role`) is never client-writable.
  A new column on those tables needs its own `GRANT` if the client writes it.
- **`super_admin` is not a tenant member.** The operator sees counts, times,
  names and settings, never what a tenant's users wrote. Admin actions start
  with `requireSuperAdmin()`.
- **Billing is the organization owner's.** Seats are checked in
  `createTenant`; `organization_id` is not client-writable.
- **Secrets stay on the server and out of the build.** Only `NEXT_PUBLIC_*` may
  reach the browser or be a Docker build argument. External clients
  (Stripe, OpenRouter, web-push) are constructed on first use, so `next build`
  needs no secrets; keep it that way.
- **AI calls are server-side** through `utils/openrouter.ts`. User-typed text
  in a prompt is untrusted input: fence it and never let it change
  instructions. Model names live only in `utils/ai-models.ts`.
- **Scheduled jobs** start with `rejectUnauthorizedCron(request)` (bearer
  header, fails closed) and return counts and errors, never user content.
- **Redirects** built from request input go through `safeNextPath`.
- **HTML email** escapes every user-supplied value with `escapeHtml`.
- **Selects passed to client components name their columns** (no `'*'`), so
  a server-only column added later never reaches the browser.

## Review before every commit

Two Claude Code commands are part of the workflow here:

- **`/code-review`**: correctness review of the current diff. Use `high` or
  above for changes to auth, RLS, billing or anything under `app/actions` or
  `app/api`: `/code-review high`.
- **`/security-review`**: security review of the pending changes on the branch.

Before committing any change (only when the user asks for a commit):

1. Run `/code-review` on the diff, then `/security-review`.
2. Check the findings against the Security model above as well as the
   commands' own criteria; a gap in the model is itself a finding.
3. Fix what they confirm, or tell the user why a finding does not apply.
   Never commit with an unresolved high-severity finding unless the user says
   so for that finding.
4. Run `npm run lint`, `npm run typecheck` and `npm test`.
5. Record in the `PROGRESS.md` changelog entry that both reviews ran and what
   they found and changed.

For a migration, add a check to `supabase/tests/rls.test.ts` for every
policy, grant or trigger it adds (what must succeed and what must fail, as a
member, an outsider and the service role), and write the same checks as SQL
comments at the bottom of the migration for whoever applies it.

## Standing rules

- **Always update `PROGRESS.md`** after completing a task: the status row(s)
  and a dated changelog entry.
- Migrations are new files; never edit one that may have been applied.
- All user-facing strings go in `messages/en.json`, `ar.json` and `tr.json`,
  keeping the three at key parity. Use logical Tailwind classes
  (`ms-`, `me-`, `start-`, `text-start`) so RTL works.
- Server components by default; add `"use client"` only when needed.
- Next.js 16 differs from older versions: read `node_modules/next/dist/docs/`
  before using an API you have not used in this repo.

## Environment

See `.env.local.example`. `NEXT_PUBLIC_*` values are inlined at build time and
must be available at build in the deployment platform; everything else is
runtime-only.
