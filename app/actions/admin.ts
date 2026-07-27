'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createHash, randomBytes } from 'crypto';

async function requireAdmin(tenantId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' as const, user: null, admin: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  if (membership?.role !== 'admin') return { error: 'Not authorized' as const, user: null, admin: null };

  return { error: null, user, admin: createAdminClient() };
}

export async function getAdminMembers(tenantId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // tenant_members.user_id and user_profiles/broker_profiles/agreements all
  // reference auth.users independently — there's no direct foreign key
  // between tenant_members and those tables, so PostgREST can't auto-embed
  // them in a single nested select (it errors with PGRST200). Fetch
  // separately and merge in application code instead.
  const { data: members } = await db
    .from('tenant_members')
    .select('user_id, role, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at');

  if (!members?.length) return [];

  const userIds = members.map((m: { user_id: string }) => m.user_id);

  const [{ data: profiles }, { data: brokerProfiles }, { data: agreements }] = await Promise.all([
    db.from('user_profiles').select('id, full_name').in('id', userIds),
    db.from('broker_profiles').select('id, rera_card_no, brokerage_name, dld_verified, agreement_status, verification_status, dld_license_path').in('id', userIds),
    db.from('agreements').select('broker_id, status').eq('tenant_id', tenantId).in('broker_id', userIds),
  ]);

  const profileById = new Map((profiles ?? []).map((p: { id: string }) => [p.id, p]));
  const brokerById = new Map((brokerProfiles ?? []).map((b: { id: string }) => [b.id, b]));
  const agreementByBrokerId = new Map((agreements ?? []).map((a: { broker_id: string }) => [a.broker_id, a]));

  return members.map((m: { user_id: string; role: string; created_at: string }) => ({
    user_id: m.user_id,
    role: m.role,
    created_at: m.created_at,
    user_profiles: profileById.get(m.user_id) ?? null,
    broker_profiles: brokerById.get(m.user_id) ?? null,
    agreements: agreementByBrokerId.get(m.user_id) ?? null,
  }));
}

export async function getBrokerLicenseUrl(
  tenantId: string,
  userId: string
): Promise<{ url?: string; error?: string }> {
  const { error, admin } = await requireAdmin(tenantId);
  if (error || !admin) return { error: error ?? 'Not authorized' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin as any)
    .from('broker_profiles')
    .select('dld_license_path')
    .eq('id', userId)
    .single();

  if (!profile?.dld_license_path) return { error: 'No license on file.' };

  const { data, error: signError } = await admin.storage
    .from('dld-licenses')
    .createSignedUrl(profile.dld_license_path, 60);

  if (signError || !data) return { error: 'Failed to generate license link.' };
  return { url: data.signedUrl };
}

export async function verifyBroker(
  tenantId: string,
  userId: string,
  verified: boolean
): Promise<{ error?: string }> {
  const { error, admin } = await requireAdmin(tenantId);
  if (error || !admin) return { error: error ?? 'Not authorized' };

  if (verified) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profileCheck } = await (admin as any)
      .from('broker_profiles')
      .select('dld_license_path')
      .eq('id', userId)
      .single();
    if (!profileCheck?.dld_license_path) return { error: 'Broker has not uploaded a DLD license.' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('broker_profiles')
    .update({
      dld_verified: verified,
      verification_status: verified ? 'verified' : 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: user!.id,
    action: verified ? 'broker_dld_verified' : 'broker_dld_unverified',
    target_type: 'user',
    target_id: userId,
    metadata: {},
  });

  if (verified) {
    try {
      const { sendAndRecordAgreement } = await import('@/utils/agreements');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: brokerProfile } = await (admin as any)
        .from('broker_profiles')
        .select('rera_card_no, brokerage_name')
        .eq('id', userId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userProfile } = await (admin as any)
        .from('user_profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      const { data: authUser } = await admin.auth.admin.getUserById(userId);

      if (authUser?.user?.email && brokerProfile) {
        await sendAndRecordAgreement({
          userId,
          tenantId,
          email: authUser.user.email,
          fullName: userProfile?.full_name ?? '',
          reraCardNo: brokerProfile.rera_card_no,
          brokerageName: brokerProfile.brokerage_name,
        });
      }
    } catch {
      // Non-fatal: agreement can be resent from admin panel
    }
  }

  try {
    const { sendPushToUsers } = await import('@/utils/push');
    await sendPushToUsers([userId], {
      title: verified ? 'License verified' : 'Verification update',
      body: verified
        ? 'Your DLD broker license has been verified.'
        : 'Your DLD broker license verification was reset — please check your profile.',
      url: `/${tenantId}/profile`,
      tag: 'broker-verification',
    });
  } catch {
    // Non-fatal: verification status change should not fail due to push errors
  }

  revalidatePath(`/${tenantId}/admin`);
  return {};
}

export async function rejectBroker(
  tenantId: string,
  userId: string
): Promise<{ error?: string }> {
  const { error, admin } = await requireAdmin(tenantId);
  if (error || !admin) return { error: error ?? 'Not authorized' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('broker_profiles')
    .update({ dld_verified: false, verification_status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', userId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: user!.id,
    action: 'broker_rejected',
    target_type: 'user',
    target_id: userId,
    metadata: {},
  });

  try {
    const { sendPushToUsers } = await import('@/utils/push');
    await sendPushToUsers([userId], {
      title: 'Verification update',
      body: 'Your DLD broker license verification was rejected — please check your profile.',
      url: `/${tenantId}/profile`,
      tag: 'broker-verification',
    });
  } catch {
    // Non-fatal: verification status change should not fail due to push errors
  }

  revalidatePath(`/${tenantId}/admin/verification`);
  return {};
}

export async function removeMember(
  tenantId: string,
  userId: string
): Promise<{ error?: string }> {
  const { error, admin } = await requireAdmin(tenantId);
  if (error || !admin) return { error: error ?? 'Not authorized' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('tenant_members')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('user_id', userId);

  revalidatePath(`/${tenantId}/admin`);
  return {};
}

export async function updateCommission(
  tenantId: string,
  listingPct: number,
  cooperatingPct: number
): Promise<{ error?: string }> {
  if (Math.abs(listingPct + cooperatingPct - 100) > 0.01) {
    return { error: 'Commission percentages must total 100%.' };
  }

  const { error, user, admin } = await requireAdmin(tenantId);
  if (error || !admin) return { error: error ?? 'Not authorized' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('commission_config').upsert({
    tenant_id: tenantId,
    listing_pct: listingPct,
    cooperating_pct: cooperatingPct,
    updated_by: user!.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id' });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: user!.id,
    action: 'commission_updated',
    target_type: 'commission_config',
    target_id: tenantId,
    metadata: { listing_pct: listingPct, cooperating_pct: cooperatingPct },
  });

  revalidatePath(`/${tenantId}/admin`);
  return {};
}

export async function getAuditLogs(tenantId: string, page = 0, pageSize = 50) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('audit_logs')
    .select('id, action, target_type, target_id, metadata, created_at, actor_id, user_profiles(full_name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  return data ?? [];
}

export async function generateApiKey(
  tenantId: string,
  name: string,
  brokerId?: string
): Promise<{ key?: string; error?: string }> {
  const { error, user, admin } = await requireAdmin(tenantId);
  if (error || !admin) return { error: error ?? 'Not authorized' };

  const rawKey = `mmls_${randomBytes(32).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (admin as any).from('api_keys').insert({
    tenant_id: tenantId,
    name,
    key_hash: keyHash,
    created_by: user!.id,
    broker_id: brokerId || null,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath(`/${tenantId}/admin`);
  return { key: rawKey };
}

export async function revokeApiKey(
  tenantId: string,
  keyId: string
): Promise<{ error?: string }> {
  const { error, admin } = await requireAdmin(tenantId);
  if (error || !admin) return { error: error ?? 'Not authorized' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('tenant_id', tenantId);

  revalidatePath(`/${tenantId}/admin`);
  return {};
}

export async function getApiKeys(tenantId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('api_keys')
    .select('id, name, created_at, last_used_at, revoked_at, broker_id, user_profiles!api_keys_broker_id_fkey(full_name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

export async function getAdminListings(tenantId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('listings')
    .select(`
      id, area, property_type, price_aed, status, dld_permit_no, created_at,
      user_profiles!listings_listing_broker_id_fkey(full_name),
      broker_profiles!listings_listing_broker_id_fkey(dld_verified)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

export async function getAdminInvitations(tenantId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('invitations')
    .select('id, email, token, role, created_at, expires_at, used_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  return data ?? [];
}
