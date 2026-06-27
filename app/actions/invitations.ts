'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { sendAgreement } from '@/utils/dropboxsign';
import { z } from 'zod';

const registerSchema = z.object({
  token: z.string().min(1),
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  rera_card_no: z.string().min(1),
  brokerage_name: z.string().min(1),
  trade_license_no: z.string().optional(),
});

export async function validateInviteToken(
  token: string
): Promise<{ valid: boolean; email?: string; tenantId?: string; error?: string }> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('invitations')
    .select('id, email, tenant_id, expires_at, used_at')
    .eq('token', token)
    .single();

  if (error || !data) return { valid: false, error: 'Invalid invitation.' };
  if (data.used_at) return { valid: false, error: 'This invitation has already been used.' };
  if (new Date(data.expires_at) < new Date()) return { valid: false, error: 'This invitation has expired.' };

  return { valid: true, email: data.email, tenantId: data.tenant_id };
}

export async function registerViaTnvite(
  formData: FormData
): Promise<{ success?: boolean; tenantId?: string; error?: string }> {
  const raw = {
    token: formData.get('token') as string,
    full_name: formData.get('full_name') as string,
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    rera_card_no: formData.get('rera_card_no') as string,
    brokerage_name: formData.get('brokerage_name') as string,
    trade_license_no: (formData.get('trade_license_no') as string) || undefined,
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const admin = createAdminClient();

  // Re-validate token
  const tokenCheck = await validateInviteToken(parsed.data.token);
  if (!tokenCheck.valid) return { error: tokenCheck.error };
  const tenantId = tokenCheck.tenantId!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invRow } = await (admin as any)
    .from('invitations')
    .select('id, role')
    .eq('token', parsed.data.token)
    .single();

  // Create Supabase auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });

  if (authError || !authData.user) {
    return { error: authError?.message ?? 'Failed to create account.' };
  }

  const userId = authData.user.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  // Insert user_profiles
  await db.from('user_profiles').insert({
    id: userId,
    full_name: parsed.data.full_name,
    role: invRow?.role ?? 'worker',
  });

  // Insert broker_profiles
  await db.from('broker_profiles').insert({
    id: userId,
    rera_card_no: parsed.data.rera_card_no,
    brokerage_name: parsed.data.brokerage_name,
    trade_license_no: parsed.data.trade_license_no ?? null,
    dld_verified: false,
    agreement_status: 'pending',
  });

  // Add to tenant_members
  await db.from('tenant_members').insert({
    tenant_id: tenantId,
    user_id: userId,
    role: invRow?.role ?? 'worker',
  });

  // Create agreements row
  await db.from('agreements').insert({
    broker_id: userId,
    tenant_id: tenantId,
    status: 'pending',
  });

  // Mark invitation as used
  await db.from('invitations').update({ used_at: new Date().toISOString() }).eq('id', invRow.id);

  // Append audit log
  await db.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: userId,
    action: 'broker_registered',
    target_type: 'user',
    target_id: userId,
    metadata: { email: parsed.data.email, rera_card_no: parsed.data.rera_card_no },
  });

  // Trigger Dropbox Sign agreement
  try {
    const sigRequestId = await sendAgreement({
      userId,
      tenantId,
      email: parsed.data.email,
      fullName: parsed.data.full_name,
      reraCardNo: parsed.data.rera_card_no,
      brokerageName: parsed.data.brokerage_name,
    });

    if (sigRequestId) {
      await db.from('agreements').update({
        signature_request_id: sigRequestId,
        status: 'sent',
        updated_at: new Date().toISOString(),
      }).eq('broker_id', userId);

      await db.from('broker_profiles').update({
        agreement_status: 'sent',
        updated_at: new Date().toISOString(),
      }).eq('id', userId);

      await db.from('audit_logs').insert({
        tenant_id: tenantId,
        actor_id: userId,
        action: 'agreement_sent',
        target_type: 'agreement',
        target_id: userId,
        metadata: { signature_request_id: sigRequestId },
      });
    }
  } catch {
    // Non-fatal: agreement can be resent from admin panel
  }

  revalidatePath('/tenants');
  return { success: true, tenantId };
}

export async function generateInviteLink(
  tenantId: string,
  email: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  if (membership?.role !== 'admin') return { error: 'Only admins can invite brokers.' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inv, error } = await (admin as any)
    .from('invitations')
    .insert({ email, tenant_id: tenantId, created_by: user.id })
    .select('token')
    .single();

  if (error || !inv) return { error: error?.message ?? 'Failed to create invitation.' };

  await (admin as any).from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: user.id,
    action: 'invitation_created',
    target_type: 'invitation',
    target_id: inv.token,
    metadata: { email },
  });

  revalidatePath(`/${tenantId}/admin`);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return { url: `${baseUrl}/invite/${inv.token}` };
}
