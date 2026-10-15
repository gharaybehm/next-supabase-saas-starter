// Pure role helpers, kept apart from tenant-access.ts so client components and
// tests can import them without pulling in the server Supabase client.

export type TenantRole = 'admin' | 'supervisor' | 'worker';

/** Ordered least- to most-privileged. Index comparison is the whole ranking. */
export const RANK: readonly TenantRole[] = ['worker', 'supervisor', 'admin'];

export function isTenantRole(value: unknown): value is TenantRole {
  return typeof value === 'string' && (RANK as readonly string[]).includes(value);
}

export function atLeast(role: TenantRole | null | undefined, minimum: TenantRole): boolean {
  if (!role) return false;
  return RANK.indexOf(role) >= RANK.indexOf(minimum);
}
