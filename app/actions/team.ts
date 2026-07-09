'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

async function requireTeamOwner(tenantId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' as const, user: null, admin: null };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: brokerProfile } = await db
    .from('broker_profiles')
    .select('brokerage_owner_id')
    .eq('id', user.id)
    .single();

  if (brokerProfile?.brokerage_owner_id) {
    return { error: 'Team members cannot invite their own sub-agents.' as const, user: null, admin: null };
  }

  const { data: agreement } = await db
    .from('agreements')
    .select('status')
    .eq('broker_id', user.id)
    .eq('tenant_id', tenantId)
    .single();

  if (agreement?.status !== 'signed') {
    return { error: 'You must sign the Co-Brokerage Agreement before building a team.' as const, user: null, admin: null };
  }

  return { error: null, user, admin };
}

export async function generateTeamInviteLink(
  tenantId: string,
  email: string
): Promise<{ url?: string; error?: string }> {
  const { error, user, admin } = await requireTeamOwner(tenantId);
  if (error || !admin) return { error: error ?? 'Not authorized' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: inv, error: insertError } = await db
    .from('invitations')
    .insert({
      email,
      tenant_id: tenantId,
      invite_type: 'team',
      invited_by_broker_id: user!.id,
      created_by: user!.id,
    })
    .select('token')
    .single();

  if (insertError || !inv) return { error: insertError?.message ?? 'Failed to create invitation.' };

  await db.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: user!.id,
    action: 'team_invitation_created',
    target_type: 'invitation',
    target_id: inv.token,
    metadata: { email },
  });

  revalidatePath(`/${tenantId}/team`);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return { url: `${baseUrl}/invite/${inv.token}` };
}

export async function getTeamInvites(tenantId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('invitations')
    .select('id, email, token, created_at, expires_at, used_at')
    .eq('tenant_id', tenantId)
    .eq('invite_type', 'team')
    .eq('invited_by_broker_id', user.id)
    .order('created_at', { ascending: false });

  return data ?? [];
}

export interface TeamMember {
  user_id: string;
  full_name: string;
  rera_card_no: string;
  agreement_status: string;
  verification_status: string;
}

export interface TeamInfo {
  role: 'owner' | 'member' | 'independent';
  brokerageName?: string;
  ownerName?: string;
  members: TeamMember[];
}

export async function getTeamMembers(_tenantId: string): Promise<TeamInfo> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { role: 'independent', members: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: myProfile } = await db
    .from('broker_profiles')
    .select('brokerage_owner_id, brokerage_name')
    .eq('id', user.id)
    .single();

  if (myProfile?.brokerage_owner_id) {
    const { data: owner } = await db
      .from('user_profiles')
      .select('full_name')
      .eq('id', myProfile.brokerage_owner_id)
      .single();

    return {
      role: 'member',
      brokerageName: myProfile.brokerage_name,
      ownerName: owner?.full_name ?? undefined,
      members: [],
    };
  }

  const { data: memberRows } = await db
    .from('broker_profiles')
    .select('id, rera_card_no, agreement_status, verification_status, user_profiles(full_name)')
    .eq('brokerage_owner_id', user.id);

  const members: TeamMember[] = (memberRows ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => ({
      user_id: m.id,
      full_name: m.user_profiles?.full_name ?? 'Unknown',
      rera_card_no: m.rera_card_no,
      agreement_status: m.agreement_status,
      verification_status: m.verification_status,
    })
  );

  return {
    role: members.length > 0 ? 'owner' : 'independent',
    brokerageName: myProfile?.brokerage_name,
    members,
  };
}

export async function removeTeamMember(
  tenantId: string,
  memberId: string
): Promise<{ error?: string }> {
  const { error, user, admin } = await requireTeamOwner(tenantId);
  if (error || !admin) return { error: error ?? 'Not authorized' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: member } = await db
    .from('broker_profiles')
    .select('brokerage_owner_id')
    .eq('id', memberId)
    .single();

  if (member?.brokerage_owner_id !== user!.id) {
    return { error: 'This broker is not a member of your team.' };
  }

  await db.from('broker_profiles').update({ brokerage_owner_id: null }).eq('id', memberId);

  await db.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: user!.id,
    action: 'team_member_removed',
    target_type: 'user',
    target_id: memberId,
    metadata: {},
  });

  revalidatePath(`/${tenantId}/team`);
  return {};
}

export async function leaveTeam(tenantId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  await db.from('broker_profiles').update({ brokerage_owner_id: null }).eq('id', user.id);

  await db.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: user.id,
    action: 'team_member_left',
    target_type: 'user',
    target_id: user.id,
    metadata: {},
  });

  revalidatePath(`/${tenantId}/team`);
  return {};
}

export async function getMyTeamBrokerIds(userId: string): Promise<string[]> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('broker_profiles')
    .select('id')
    .eq('brokerage_owner_id', userId);

  if (!data || data.length === 0) return [userId];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return [userId, ...data.map((m: any) => m.id)];
}

export async function isTeamOwnerOf(ownerId: string, brokerId: string): Promise<boolean> {
  if (ownerId === brokerId) return true;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('broker_profiles')
    .select('brokerage_owner_id')
    .eq('id', brokerId)
    .single();

  return data?.brokerage_owner_id === ownerId;
}
