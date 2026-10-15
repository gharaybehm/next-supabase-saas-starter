/* eslint-disable @typescript-eslint/no-explicit-any -- query rows are untyped */
// Applies every migration to an in-memory Postgres (PGlite) with a stub of
// Supabase's auth schema and roles, then checks the access rules the
// migrations promise: what a member, an outsider and the service role can and
// cannot do. Add a check here for every policy, grant or trigger you add.
import { describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const migrationsDir = fileURLToPath(new URL('../migrations/', import.meta.url))
const db = new PGlite()
const results: { name: string; pass: boolean; detail: string }[] = []
const ok = (name: string, pass: boolean, detail = '') => results.push({ name, pass, detail })

async function expectError(name: string, sql: string, params: unknown[], match?: string) {
  try {
    await db.query(sql, params)
    ok(name, false, 'no error')
  } catch (e) {
    const message = (e as Error).message
    ok(name, match ? new RegExp(match, 'i').test(message) : true, message)
  }
}
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`)
  try { return await fn() } finally { await db.exec('RESET ROLE;') }
}

// ── Supabase stub ──
await db.exec(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
`)

const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
for (const f of migrations) {
  try {
    await db.exec(readFileSync(migrationsDir + f, 'utf8'))
    ok(`apply ${f}`, true)
  } catch (e: any) {
    ok(`apply ${f}`, false, e.message)
    throw new Error(`${f} failed to apply: ${e.message}`)
  }
}
// Re-running must also work (idempotent).
try {
  for (const f of migrations.slice(1)) await db.exec(readFileSync(migrationsDir + f, 'utf8'))
  ok('migrations re-run cleanly', true)
} catch (e: any) { ok('migrations re-run cleanly', false, e.message) }

const U1 = '11111111-1111-1111-1111-111111111111' // admin of A
const U2 = '22222222-2222-2222-2222-222222222222' // worker of A
const U3 = '33333333-3333-3333-3333-333333333333' // outsider
const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

await db.exec(`
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    ('${U1}', 'u1@x.test', '{"full_name":"Una One"}'),
    ('${U2}', 'u2@x.test', '{}'),
    ('${U3}', 'u3@x.test', '{}');
  INSERT INTO public.tenants (id, name, slug, created_by) VALUES ('${A}', 'A', 'a', '${U1}'), ('${B}', 'B', 'b', '${U3}');
  INSERT INTO public.tenant_members (tenant_id, user_id, role) VALUES
    ('${A}', '${U1}', 'admin'), ('${A}', '${U2}', 'worker'), ('${B}', '${U3}', 'admin');
`)

const profiles = await db.query('SELECT id, full_name, role FROM public.user_profiles ORDER BY id')
ok('trigger creates a profile per auth user', profiles.rows.length === 3 && (profiles.rows[0] as any).full_name === 'Una One' && profiles.rows.every((r: any) => r.role === 'worker'), JSON.stringify(profiles.rows))

// ── user_profiles ──
await as(U2, () => expectError('member cannot set own role', `UPDATE public.user_profiles SET role = 'super_admin' WHERE id = $1`, [U2], 'permission denied'))
await as(U2, async () => {
  const r = await db.query(`UPDATE public.user_profiles SET full_name = 'Two' WHERE id = $1`, [U2])
  ok('member can set own name', r.affectedRows === 1)
})
await as(U2, () => expectError('member cannot insert a profile with a role', `INSERT INTO public.user_profiles (id, role) VALUES ($1, 'admin')`, [U2], 'permission denied'))
await as(U2, async () => {
  const r = await db.query('SELECT id FROM public.user_profiles ORDER BY id')
  ok('co-members see each other, not outsiders', JSON.stringify(r.rows.map((x: any) => x.id)) === JSON.stringify([U1, U2]), JSON.stringify(r.rows))
})

// ── tenant_members ──
await as(U2, async () => {
  const r = await db.query('SELECT user_id FROM public.tenant_members ORDER BY user_id')
  ok('member sees the whole team of own tenant only', r.rows.length === 2, JSON.stringify(r.rows))
})
await as(U3, () => expectError('outsider cannot add self to a tenant', `INSERT INTO public.tenant_members (tenant_id, user_id, role) VALUES ($1, $2, 'admin')`, [A, U3], 'permission denied'))

// ── tenants ──
await as(U3, async () => {
  const r = await db.query('SELECT id FROM public.tenants')
  ok('outsider sees only own tenant', r.rows.length === 1 && (r.rows[0] as any).id === B)
})
await as(U2, async () => {
  const r = await db.query(`UPDATE public.tenants SET name = 'hack' WHERE id = $1`, [A])
  ok('worker cannot rename tenant (0 rows)', r.affectedRows === 0)
})
await as(U1, async () => {
  const r = await db.query(`UPDATE public.tenants SET name = 'A2', updated_at = now() WHERE id = $1`, [A])
  ok('admin can rename tenant', r.affectedRows === 1)
})
await as(U1, () => expectError('admin cannot change organization_id', `UPDATE public.tenants SET organization_id = NULL WHERE id = $1`, [A], 'permission denied'))
await as(U1, () => expectError('client cannot insert a tenant', `INSERT INTO public.tenants (name, slug, created_by) VALUES ('x','x',$1)`, [U1], 'permission denied'))

// ── push_subscriptions ──
await as(U3, () => expectError('cannot subscribe to another tenant', `INSERT INTO public.push_subscriptions (user_id, tenant_id, endpoint, p256dh, auth) VALUES ($1, $2, 'e1', 'p', 'a')`, [U3, A], 'row-level security'))
await as(U2, async () => {
  const r = await db.query(`INSERT INTO public.push_subscriptions (user_id, tenant_id, endpoint, p256dh, auth) VALUES ($1, $2, 'e2', 'p', 'a')`, [U2, A])
  ok('member can subscribe to own tenant', r.affectedRows === 1)
})

// ── last admin ──
await expectError('cannot demote the only admin', `UPDATE public.tenant_members SET role = 'worker' WHERE tenant_id = $1 AND user_id = $2`, [A, U1], 'at least one admin')
await expectError('cannot remove the only admin', `DELETE FROM public.tenant_members WHERE tenant_id = $1 AND user_id = $2`, [A, U1], 'at least one admin')
await db.query(`UPDATE public.tenant_members SET role = 'admin' WHERE tenant_id = $1 AND user_id = $2`, [A, U2])
try {
  await db.query(`UPDATE public.tenant_members SET role = 'worker' WHERE tenant_id = $1 AND user_id = $2`, [A, U1])
  ok('can demote an admin when another remains', true)
} catch (e: any) { ok('can demote an admin when another remains', false, e.message) }
try {
  await db.query('DELETE FROM public.tenants WHERE id = $1', [B])
  ok('deleting a tenant cascades past the last-admin guard', true)
} catch (e: any) { ok('deleting a tenant cascades past the last-admin guard', false, e.message) }
try {
  await db.query('DELETE FROM auth.users WHERE id = $1', [U3])
  ok('deleting a sole-admin user cascades', true)
} catch (e: any) { ok('deleting a sole-admin user cascades', false, e.message) }

// ── organizations and seats ──
const O = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
await db.exec(`
  INSERT INTO public.organizations (id, name, slug, billing_email, tenant_seats) VALUES ('${O}', 'Org', 'org', 'u1@x.test', 2);
  INSERT INTO public.organization_members (organization_id, user_id, role) VALUES ('${O}', '${U1}', 'owner');
  UPDATE public.tenants SET organization_id = '${O}' WHERE id = '${A}';
  INSERT INTO public.tenants (name, slug, created_by, organization_id) VALUES ('A3', 'a3', '${U1}', '${O}');
`)
await expectError('third workspace on 2 seats is refused', `INSERT INTO public.tenants (name, slug, created_by, organization_id) VALUES ('A4', 'a4', $1, $2)`, [U1, O], 'limit has been reached')
await expectError('a user owns at most one organization', `
  WITH o AS (INSERT INTO public.organizations (name, slug, billing_email) VALUES ('O2','o2','x') RETURNING id)
  INSERT INTO public.organization_members (organization_id, user_id, role) SELECT id, '${U1}', 'owner' FROM o`, [], 'organization_members_one_owned_per_user')

await as(U1, async () => {
  try {
    const r = await db.query('SELECT id FROM public.organizations')
    const m = await db.query('SELECT user_id FROM public.organization_members')
    ok('owner reads own organization (no policy recursion)', r.rows.length === 1 && m.rows.length === 1, JSON.stringify([r.rows, m.rows]))
  } catch (e: any) { ok('owner reads own organization (no policy recursion)', false, e.message) }
})
await as(U2, async () => {
  const r = await db.query('SELECT id FROM public.organizations')
  ok('non-member sees no organization', r.rows.length === 0)
})
await as(U1, () => expectError('owner cannot change status or seats', `UPDATE public.organizations SET tenant_seats = 99 WHERE id = $1`, [O], 'permission denied'))
await as(U1, () => expectError('client cannot read stripe_invoices', 'SELECT * FROM public.stripe_invoices', [], 'permission denied'))
await expectError('super_admin is a valid role, others are not', `UPDATE public.user_profiles SET role = 'owner' WHERE id = '${U1}'`, [], 'user_profiles_role_check')
await db.query(`UPDATE public.user_profiles SET role = 'super_admin' WHERE id = $1`, [U1])
ok('super_admin can be set by the service role', true)


describe('migrations and access rules', () => {
  it.each(results.map((r) => [r.name, r] as const))('%s', (_name, r) => {
    expect(r.pass, r.detail).toBe(true)
  })
})
