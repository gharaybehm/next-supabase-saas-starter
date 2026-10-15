# Progress

What is built, and a dated record of changes. Update it after every task
(see CLAUDE.md, Standing rules).

## Status

| Area | Status | Notes |
|------|--------|-------|
| Auth: email + password, Google, remember me | Built | Google always shows the account chooser |
| Workspaces (tenants) and roles | Built | `requireTenantRole` in code, same matrix in RLS |
| Team management and invite email | Built | Settings → Team |
| Organizations, seats, Stripe billing | Built | Settings → Billing (owner); webhook keeps status and seats in step |
| Platform operator area (`/admin`) | Built | Workspaces and subscribers; counts and settings only |
| i18n EN / AR / TR with RTL | Built | |
| PWA, offline dashboard, Web Push | Built | Page cache cleared on sign-out |
| Error boundaries | Built | Dashboard, app and global |
| Docker / Coolify hosting | Built | Build needs no secrets |
| Scheduled jobs | Pattern only | `/api/cron/ping` example |
| Your product's pages | Not started | |

## Changelog

### 2026-10-15

- Synced from the NutJob app: RLS hardening migration, `requireTenantRole`,
  `proxy.ts` session gate, organizations and Stripe billing, super-admin area,
  error boundaries, Docker/Coolify, lazy external clients, vitest, CLAUDE.md
  with the `/code-review` + `/security-review` workflow.
- `/code-review high` found 10 issues; all fixed: Billing tab stuck on
  "Manage billing" after an abandoned checkout (now chosen by subscription,
  not customer); the proxy overriding the "remember me" cookie lifetime (choice
  now stored in its own cookie and applied by every cookie writer); webhook
  trusting event payloads and order (now re-reads the subscription from Stripe,
  ignores non-current subscriptions); no error handling on the Stripe button;
  seat-limit and last-admin races (now database triggers); duplicate
  organizations on concurrent first use (one owned organization per user);
  workspace tabs capped at 3; missing post-run checks in the billing migration;
  duplicated slug/URL/redirect helpers; repeated Auth lookups per request
  (`getCurrentUser`, memoised).
- `/security-review`: no high-confidence vulnerabilities. Noted below the
  threshold: an admin can add any existing account by email, and co-members
  can then read that account's name and phone. Consider an invite/accept step.
- Migrations now tested (`supabase/tests/rls.test.ts`, 31 checks). This found
  that the original core schema could not run on a fresh database (a tenants
  policy referenced tenant_members before it existed); fixed in place.
- next 16.4.1 (critical advisories below 16.3.8), vitest 5, sharp 0.35.5.
  One dev-only advisory left in `braces` via eslint-config-next (no fix yet).
- From NutJob's `/code-review` of the same pattern: `REVOKE EXECUTE ... FROM
  anon` did nothing, because new functions are executable by PUBLIC. The
  membership helpers now revoke from `PUBLIC, anon`; three checks in
  `rls.test.ts` fail without it.
